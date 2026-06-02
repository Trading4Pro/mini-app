package com.trading4pro.spamwatch;

import com.trading4pro.spamwatch.bot.JobRuntime;
import com.trading4pro.spamwatch.bot.SpamWatchBot;
import com.trading4pro.spamwatch.config.AppConfig;
import com.trading4pro.spamwatch.config.ConfigLoader;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.telegram.telegrambots.meta.TelegramBotsApi;
import org.telegram.telegrambots.updatesreceivers.DefaultBotSession;

import java.nio.file.Path;
import java.util.concurrent.CountDownLatch;

/**
 * Entry point. Loads config.json (path overridable as the first CLI arg), validates the token,
 * registers the long-polling bot, and prints which jobs are active vs. pending approval.
 */
public final class Main {

    private static final Logger log = LoggerFactory.getLogger(Main.class);

    public static void main(String[] args) throws Exception {
        Path configPath = Path.of(args.length > 0 ? args[0] : "config.json");
        AppConfig cfg = ConfigLoader.load(configPath);

        if (cfg.botToken == null || cfg.botToken.isBlank() || cfg.botToken.contains("REPLACE")) {
            log.error("No valid bot token. Set BOT_TOKEN env var, or put your @BotFather token in {}.",
                    configPath.toAbsolutePath());
            System.exit(1);
        }

        SpamWatchBot bot = new SpamWatchBot(cfg);

        int active = 0;
        for (JobRuntime rt : bot.runtimes()) {
            if (rt.isActive()) {
                active++;
                log.info("ACTIVE  | {} | watch \"{}\" in {} -> alert {} | period={}m mentionCount={} userCount={}",
                        rt.job().label(), rt.job().text, rt.origin(), rt.destination(),
                        rt.job().periodMinutes, rt.job().mentionCount, rt.job().userCount);
            } else {
                log.warn("PENDING | {} | inactive: {}", rt.job().label(), rt.inactiveReason());
            }
        }

        if (active == 0) {
            log.warn("No active jobs. Approve a job (set originApproved & destinationApproved to true) "
                    + "and make sure origin/destination resolve to a chat id or @username.");
        }

        TelegramBotsApi botsApi = new TelegramBotsApi(DefaultBotSession.class);
        botsApi.registerBot(bot);
        log.info("spamwatch-bot started as @{} with {} active job(s). Polling for updates...",
                cfg.botUsername, active);

        // Keep the JVM alive; the polling session runs on its own threads.
        new CountDownLatch(1).await();
    }
}
