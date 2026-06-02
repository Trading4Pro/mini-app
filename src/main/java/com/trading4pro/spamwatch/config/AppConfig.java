package com.trading4pro.spamwatch.config;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

import java.util.ArrayList;
import java.util.List;

/**
 * Top-level configuration, deserialized from config.json.
 *
 * <p>The bot token may be left as a placeholder here and supplied instead via the
 * {@code BOT_TOKEN} environment variable, which takes precedence (see {@link ConfigLoader}).</p>
 */
@JsonIgnoreProperties(ignoreUnknown = true)
public class AppConfig {

    /** Bot token from @BotFather. The BOT_TOKEN env var overrides this if set. */
    public String botToken;

    /** The bot's @username (without @). Used only for registration; not critical. */
    public String botUsername = "spamwatch_bot";

    /** If true, messages from admins of an origin chat are ignored. */
    public boolean excludeAdmins = true;

    /** How long (minutes) to cache each origin chat's admin list. */
    public int adminCacheMinutes = 10;

    /** If true, matching respects letter case. */
    public boolean caseSensitive = false;

    /** If true, match whole words only (so "cat" won't match "category"). */
    public boolean wordBoundary = true;

    /** If true, include a clickable link to the triggering message in the alert. */
    public boolean includeMessageLink = true;

    /** The watch jobs. */
    public List<WatchJob> jobs = new ArrayList<>();
}
