package com.trading4pro.spamwatch.util;

import org.telegram.telegrambots.meta.api.objects.Chat;

import java.util.Locale;

/**
 * A reference to a Telegram chat, parsed from whatever the config provides: a numeric chat id,
 * an {@code @username}, or a {@code t.me} link.
 *
 * <p>Telegram's Bot API can only act on chats by numeric id or by public {@code @username}.
 * Private-group invite links ({@code t.me/+hash}, {@code t.me/joinchat/...}) cannot be resolved
 * to an id from the link alone — for those, put the numeric chat id in the config instead (find
 * it by running with {@code LOG_LEVEL=DEBUG} and reading the logged chat id). Such refs report
 * {@link #isResolvable()} == false.</p>
 */
public final class ChatRef {

    public enum Kind {ID, USERNAME, UNRESOLVABLE}

    private final Kind kind;
    private final Long id;
    private final String username; // lower-case, no leading @
    private final String raw;

    private ChatRef(Kind kind, Long id, String username, String raw) {
        this.kind = kind;
        this.id = id;
        this.username = username;
        this.raw = raw;
    }

    /** Parse a config string into a ChatRef. Never returns null; may be UNRESOLVABLE. */
    public static ChatRef parse(String input) {
        String raw = input == null ? "" : input.trim();
        if (raw.isEmpty()) {
            return new ChatRef(Kind.UNRESOLVABLE, null, null, raw);
        }

        // Pure numeric id, e.g. -1001234567890 or 123456789
        if (raw.matches("-?\\d+")) {
            return new ChatRef(Kind.ID, Long.parseLong(raw), null, raw);
        }

        // Strip scheme and known host prefixes to get the path/handle.
        String s = raw;
        s = s.replaceFirst("(?i)^https?://", "");
        s = s.replaceFirst("(?i)^(www\\.)?(t\\.me|telegram\\.me|telegram\\.dog)/", "");

        if (s.startsWith("@")) {
            s = s.substring(1);
        }

        // Private channel/supergroup permalink: t.me/c/<internalId>/<msg>
        if (s.matches("(?i)^c/\\d+.*")) {
            String[] parts = s.split("/");
            if (parts.length >= 2 && parts[1].matches("\\d+")) {
                long full = Long.parseLong("-100" + parts[1]);
                return new ChatRef(Kind.ID, full, null, raw);
            }
            return new ChatRef(Kind.UNRESOLVABLE, null, null, raw);
        }

        // Invite links cannot be resolved to an id/username from the link alone.
        if (s.startsWith("+") || s.matches("(?i)^joinchat/.*")) {
            return new ChatRef(Kind.UNRESOLVABLE, null, null, raw);
        }

        // Public handle, optionally followed by a message id: t.me/<username>[/<msg>]
        String handle = s.split("/")[0];
        if (handle.matches("(?i)[a-z0-9_]{3,}")) {
            return new ChatRef(Kind.USERNAME, null, handle.toLowerCase(Locale.ROOT), raw);
        }

        return new ChatRef(Kind.UNRESOLVABLE, null, null, raw);
    }

    /** True if this ref can be used with the Bot API (matched, sent to, queried for admins). */
    public boolean isResolvable() {
        return kind != Kind.UNRESOLVABLE;
    }

    /** Does the given incoming chat correspond to this reference? */
    public boolean matches(Chat chat) {
        if (chat == null) {
            return false;
        }
        return switch (kind) {
            case ID -> id != null && id.equals(chat.getId());
            case USERNAME -> username != null && username.equalsIgnoreCase(chat.getUserName());
            case UNRESOLVABLE -> false;
        };
    }

    /** The chat_id string accepted by Bot API calls (numeric id, or {@code @username}); null if unresolvable. */
    public String apiChatId() {
        return switch (kind) {
            case ID -> String.valueOf(id);
            case USERNAME -> "@" + username;
            case UNRESOLVABLE -> null;
        };
    }

    public String raw() {
        return raw;
    }

    @Override
    public String toString() {
        return isResolvable() ? apiChatId() : raw + " (unresolvable)";
    }

    /** Build a public permalink to a message, or null if the chat has no public/known form. */
    public static String messageLink(Chat chat, int messageId) {
        if (chat == null) {
            return null;
        }
        if (chat.getUserName() != null && !chat.getUserName().isBlank()) {
            return "https://t.me/" + chat.getUserName() + "/" + messageId;
        }
        Long cid = chat.getId();
        if (cid != null) {
            String s = String.valueOf(cid);
            if (s.startsWith("-100")) {
                return "https://t.me/c/" + s.substring(4) + "/" + messageId;
            }
        }
        return null;
    }
}
