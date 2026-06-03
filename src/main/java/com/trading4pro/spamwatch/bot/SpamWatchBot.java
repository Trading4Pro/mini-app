package com.trading4pro.spamwatch.bot;

import com.trading4pro.spamwatch.config.AppConfig;
import com.trading4pro.spamwatch.config.WatchJob;
import com.trading4pro.spamwatch.util.ChatRef;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.telegram.telegrambots.bots.TelegramLongPollingBot;
import org.telegram.telegrambots.meta.api.methods.groupadministration.GetChatAdministrators;
import org.telegram.telegrambots.meta.api.methods.send.SendMessage;
import org.telegram.telegrambots.meta.api.objects.Chat;
import org.telegram.telegrambots.meta.api.objects.Message;
import org.telegram.telegrambots.meta.api.objects.Update;
import org.telegram.telegrambots.meta.api.objects.chatmember.ChatMember;
import org.telegram.telegrambots.meta.exceptions.TelegramApiException;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Long-polling Telegram bot. For each incoming message it finds the active {@link WatchJob}s
 * whose origin matches the message's chat, applies admin-exclusion, runs the sliding-window
 * trigger, and posts an alert to the destination chat when a job fires.
 */
public class SpamWatchBot extends TelegramLongPollingBot {

    private static final Logger log = LoggerFactory.getLogger(SpamWatchBot.class);

    private final AppConfig cfg;
    private final List<JobRuntime> runtimes = new ArrayList<>();

    /** Cached admin ids per origin api-chat-id. */
    private record AdminCache(Set<Long> ids, long expiresAtMillis) {
    }

    private final Map<String, AdminCache> adminCache = new HashMap<>();

    /** Chat ids already logged, so the discovery line below prints once per chat. */
    private final Set<Long> seenChats = ConcurrentHashMap.newKeySet();

    public SpamWatchBot(AppConfig cfg) {
        super(cfg.botToken);
        this.cfg = cfg;
        for (WatchJob job : cfg.jobs) {
            runtimes.add(new JobRuntime(job, cfg.caseSensitive, cfg.wordBoundary));
        }
    }

    public List<JobRuntime> runtimes() {
        return runtimes;
    }

    @Override
    public String getBotUsername() {
        return cfg.botUsername;
    }

    @Override
    public void onUpdateReceived(Update update) {
        Message msg = extractMessage(update);
        if (msg == null || msg.getChat() == null) {
            return;
        }

        String text = msg.getText() != null ? msg.getText() : msg.getCaption();
        if (text == null || text.isBlank()) {
            return;
        }

        long now = System.currentTimeMillis();
        Chat chat = msg.getChat();

        // Discovery aid: log each chat's id once so you can find group ids without third-party bots.
        // Add this bot to a group, send any message, and read the "Chat seen" line in the console.
        if (seenChats.add(chat.getId())) {
            log.info("Chat seen: id={} title='{}' type={}",
                    chat.getId(), chat.getTitle(), chat.getType());
        }

        for (JobRuntime rt : runtimes) {
            if (!rt.isActive() || !rt.origin().matches(chat)) {
                continue;
            }
            if (!rt.matchesText(text)) {
                continue;
            }
            if (cfg.excludeAdmins && isFromAdmin(msg, rt.origin())) {
                log.debug("Skipping admin message for job {}.", rt.job().label());
                continue;
            }

            long userId = resolveUserId(msg);
            JobRuntime.Outcome out = rt.record(userId, now);
            log.debug("Hit on {} in '{}': mentions={}, users={}, triggered={}",
                    rt.job().label(), chat.getTitle(), out.mentions(), out.distinctUsers(), out.triggered());

            if (out.triggered()) {
                sendAlert(rt, msg, out);
            }
        }
    }

    private static Message extractMessage(Update update) {
        if (update.hasMessage()) {
            return update.getMessage();
        }
        if (update.hasChannelPost()) {
            return update.getChannelPost();
        }
        if (update.hasEditedMessage()) {
            return update.getEditedMessage();
        }
        if (update.hasEditedChannelPost()) {
            return update.getEditedChannelPost();
        }
        return null;
    }

    /** Identify the sender; anonymous admins / channel posts have no {@code from} user. */
    private static long resolveUserId(Message msg) {
        if (msg.getFrom() != null) {
            return msg.getFrom().getId();
        }
        if (msg.getSenderChat() != null && msg.getSenderChat().getId() != null) {
            return msg.getSenderChat().getId();
        }
        return 0L;
    }

    private boolean isFromAdmin(Message msg, ChatRef origin) {
        // Anonymous admins post "as the group", i.e. sender_chat == chat.
        if (msg.getSenderChat() != null && msg.getChat() != null
                && msg.getSenderChat().getId().equals(msg.getChat().getId())) {
            return true;
        }
        if (msg.getFrom() == null) {
            return false;
        }
        return adminIds(origin).contains(msg.getFrom().getId());
    }

    private Set<Long> adminIds(ChatRef origin) {
        String key = origin.apiChatId();
        if (key == null) {
            return Set.of();
        }
        long now = System.currentTimeMillis();
        AdminCache cached = adminCache.get(key);
        if (cached != null && now < cached.expiresAtMillis()) {
            return cached.ids();
        }
        Set<Long> ids = new HashSet<>();
        try {
            List<ChatMember> admins = execute(GetChatAdministrators.builder().chatId(key).build());
            for (ChatMember m : admins) {
                if (m.getUser() != null) {
                    ids.add(m.getUser().getId());
                }
            }
            log.debug("Refreshed admin list for {}: {} admins.", key, ids.size());
        } catch (TelegramApiException e) {
            log.warn("Could not fetch admins for {}: {}", key, e.getMessage());
        }
        adminCache.put(key, new AdminCache(ids, now + cfg.adminCacheMinutes * 60_000L));
        return ids;
    }

    private void sendAlert(JobRuntime rt, Message msg, JobRuntime.Outcome out) {
        String destId = rt.destination().apiChatId();
        if (destId == null) {
            log.warn("Job {} triggered but destination is unresolvable; skipping alert.", rt.job().label());
            return;
        }

        String alert = buildAlert(rt, msg, out);
        try {
            execute(SendMessage.builder()
                    .chatId(destId)
                    .text(alert)
                    .disableWebPagePreview(true)
                    .build());
            log.info("Alert sent for {} (mentions={}, users={}).",
                    rt.job().label(), out.mentions(), out.distinctUsers());
        } catch (TelegramApiException e) {
            log.error("Failed to send alert for {} to {}: {}", rt.job().label(), destId, e.getMessage());
        }
    }

    private String buildAlert(JobRuntime rt, Message msg, JobRuntime.Outcome out) {
        WatchJob job = rt.job();

        String chatName = msg.getChat() != null && msg.getChat().getTitle() != null
                ? msg.getChat().getTitle()
                : "the chat";

        StringBuilder sb = new StringBuilder();
        sb.append('"').append(job.text).append("\" was mentioned by ")
                .append(out.distinctUsers())
                .append(out.distinctUsers() == 1 ? " different user" : " different users")
                .append(" in last ").append(formatPeriod(job.periodMinutes))
                .append(" in ").append(chatName);

        if (cfg.includeMessageLink) {
            String link = ChatRef.messageLink(msg.getChat(), msg.getMessageId());
            if (link != null) {
                sb.append('\n').append(link);
            }
        }
        return sb.toString();
    }

    /**
     * Formats the sliding-window length for humans: whole hours as "48 hours" / "1 hour",
     * sub-hour as "30 minutes", and mixed as "1h 30m".
     */
    private static String formatPeriod(long minutes) {
        long h = minutes / 60;
        long m = minutes % 60;
        if (m == 0) {
            return h + (h == 1 ? " hour" : " hours");
        }
        if (h == 0) {
            return m + (m == 1 ? " minute" : " minutes");
        }
        return h + "h " + m + "m";
    }
}
