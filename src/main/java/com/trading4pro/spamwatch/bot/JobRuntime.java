package com.trading4pro.spamwatch.bot;

import com.trading4pro.spamwatch.config.WatchJob;
import com.trading4pro.spamwatch.util.ChatRef;

import java.util.ArrayDeque;
import java.util.Deque;
import java.util.HashSet;
import java.util.Set;
import java.util.regex.Pattern;

/**
 * Live state for one {@link WatchJob}: the compiled text matcher, a sliding window of hits, and
 * the trigger logic for the optional mention-count / distinct-user-count thresholds.
 *
 * <p>All mutating access is synchronized because the Telegram client may deliver updates from
 * more than one thread.</p>
 */
public final class JobRuntime {

    /** A single matching message within the window. */
    private record Hit(long timestampMillis, long userId) {
    }

    /** Result of recording a hit, for logging and alerting. */
    public record Outcome(int mentions, int distinctUsers, boolean triggered) {
    }

    private final WatchJob job;
    private final ChatRef origin;
    private final ChatRef destination;
    private final Pattern pattern;
    private final long periodMillis;
    private final long cooldownMillis;

    private final boolean active;
    private final String inactiveReason;

    private final Deque<Hit> hits = new ArrayDeque<>();
    private long lastAlertMillis = 0L;

    public JobRuntime(WatchJob job, boolean caseSensitive, boolean wordBoundary) {
        this.job = job;
        this.origin = ChatRef.parse(job.origin);
        this.destination = ChatRef.parse(job.destination);
        this.periodMillis = job.periodMinutes * 60_000L;
        this.cooldownMillis = job.cooldownMinutes * 60_000L;
        this.pattern = compile(job.text, caseSensitive, wordBoundary);

        this.inactiveReason = computeInactiveReason();
        this.active = inactiveReason == null;
    }

    private static Pattern compile(String text, boolean caseSensitive, boolean wordBoundary) {
        if (text == null || text.isEmpty()) {
            return Pattern.compile("(?!x)x"); // never matches; job will be inactive anyway
        }
        String body = Pattern.quote(text);
        if (wordBoundary) {
            body = "\\b" + body + "\\b";
        }
        int flags = caseSensitive ? 0 : (Pattern.CASE_INSENSITIVE | Pattern.UNICODE_CASE);
        return Pattern.compile(body, flags);
    }

    private String computeInactiveReason() {
        if (job.text == null || job.text.isBlank()) {
            return "no text to watch";
        }
        if (job.periodMinutes <= 0) {
            return "periodMinutes must be > 0";
        }
        if (!job.originApproved || !job.destinationApproved) {
            return "pending approval (originApproved=" + job.originApproved
                    + ", destinationApproved=" + job.destinationApproved + ")";
        }
        if (!origin.isResolvable()) {
            return "origin '" + job.origin + "' can't be resolved to a chat id/username "
                    + "(use a numeric chat id for private groups)";
        }
        if (!destination.isResolvable()) {
            return "destination '" + job.destination + "' can't be resolved to a chat id/username "
                    + "(use a numeric chat id for private groups)";
        }
        return null;
    }

    public boolean isActive() {
        return active;
    }

    public String inactiveReason() {
        return inactiveReason;
    }

    public WatchJob job() {
        return job;
    }

    public ChatRef origin() {
        return origin;
    }

    public ChatRef destination() {
        return destination;
    }

    public boolean matchesText(String text) {
        return text != null && pattern.matcher(text).find();
    }

    /**
     * Record a matching message and decide whether to alert.
     *
     * <p>Trigger rule, evaluated over the sliding window:</p>
     * <ul>
     *   <li>neither threshold set → alert on every match;</li>
     *   <li>only one set → that one must be met;</li>
     *   <li>both set → both (requireAllThresholds=true) or either (false) must be met.</li>
     * </ul>
     * A triggered alert is still suppressed if a cooldown is in effect.
     */
    public synchronized Outcome record(long userId, long nowMillis) {
        hits.addLast(new Hit(nowMillis, userId));

        long cutoff = nowMillis - periodMillis;
        while (!hits.isEmpty() && hits.peekFirst().timestampMillis() < cutoff) {
            hits.pollFirst();
        }

        int mentions = hits.size();
        Set<Long> users = new HashSet<>();
        for (Hit h : hits) {
            users.add(h.userId());
        }
        int distinctUsers = users.size();

        boolean thresholdMet = evaluateThresholds(mentions, distinctUsers);
        boolean coolingDown = cooldownMillis > 0 && (nowMillis - lastAlertMillis) < cooldownMillis;
        boolean triggered = thresholdMet && !coolingDown;

        if (triggered) {
            lastAlertMillis = nowMillis;
        }
        return new Outcome(mentions, distinctUsers, triggered);
    }

    private boolean evaluateThresholds(int mentions, int distinctUsers) {
        Integer m = job.mentionCount;
        Integer u = job.userCount;

        if (m == null && u == null) {
            return true; // alert on first/every match
        }
        if (m != null && u == null) {
            return mentions >= m;
        }
        if (m == null) {
            return distinctUsers >= u;
        }
        boolean mOk = mentions >= m;
        boolean uOk = distinctUsers >= u;
        return job.requireAllThresholds ? (mOk && uOk) : (mOk || uOk);
    }
}
