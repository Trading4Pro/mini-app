package com.trading4pro.spamwatch.config;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

/**
 * One watch job, as defined in config.json.
 *
 * <p>The bot watches {@link #origin} for messages containing {@link #text} over a sliding
 * window of {@link #periodMinutes} minutes. When the optional thresholds are met it posts an
 * alert to {@link #destination}.</p>
 *
 * <p>Both {@link #originApproved} and {@link #destinationApproved} must be {@code true} for the
 * job to run — this is how the "pending approval" requirement is modelled in a config-driven
 * design. A freshly added job has both flags {@code false} and is therefore inactive until you
 * approve it.</p>
 */
@JsonIgnoreProperties(ignoreUnknown = true)
public class WatchJob {

    /** Human-friendly label used in logs and alerts. Optional; defaults to the text. */
    public String name;

    /** The text/phrase to watch for. Required. */
    public String text;

    /** Origin chat to watch: a numeric chat id, an @username, or a t.me link. Required. */
    public String origin;

    /** Pending-approval flag for the origin. The job is inactive until this is true. */
    public boolean originApproved = false;

    /** Destination chat for alerts: a numeric chat id, an @username, or a t.me link. Required. */
    public String destination;

    /** Pending-approval flag for the destination. The job is inactive until this is true. */
    public boolean destinationApproved = false;

    /** Sliding-window length in minutes. Required (must be &gt; 0). */
    public long periodMinutes = 720;

    /** Optional: number of times {@link #text} must appear within the window to alert. */
    public Integer mentionCount;

    /** Optional: number of distinct origin users who must have used {@link #text} to alert. */
    public Integer userCount;

    /**
     * When both {@link #mentionCount} and {@link #userCount} are set: if true (default), BOTH
     * must be satisfied; if false, EITHER one triggers an alert. Ignored when only one is set.
     */
    public boolean requireAllThresholds = true;

    /** After an alert fires, suppress further alerts for this job for this many minutes (0 = none). */
    public int cooldownMinutes = 0;

    /** Label for logs/alerts. */
    public String label() {
        if (name != null && !name.isBlank()) {
            return name;
        }
        return text == null ? "(unnamed)" : '"' + text + '"';
    }

    public boolean approved() {
        return originApproved && destinationApproved;
    }
}
