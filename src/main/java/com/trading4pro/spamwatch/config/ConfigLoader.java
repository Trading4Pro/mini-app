package com.trading4pro.spamwatch.config;

import com.fasterxml.jackson.databind.ObjectMapper;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;

/** Loads {@link AppConfig} from a JSON file and applies the BOT_TOKEN env override. */
public final class ConfigLoader {

    private static final ObjectMapper MAPPER = new ObjectMapper();

    private ConfigLoader() {
    }

    /**
     * Reads the config file, then lets the {@code BOT_TOKEN} environment variable override the
     * token in the file (so the real token never has to live in config.json).
     *
     * @throws IOException if the file can't be read or parsed
     */
    public static AppConfig load(Path file) throws IOException {
        if (!Files.exists(file)) {
            throw new IOException("Config file not found: " + file.toAbsolutePath()
                    + "\nCopy config.example.json to config.json and fill it in.");
        }

        AppConfig cfg = MAPPER.readValue(Files.readString(file), AppConfig.class);

        String envToken = System.getenv("BOT_TOKEN");
        if (envToken != null && !envToken.isBlank()) {
            cfg.botToken = envToken.trim();
        }
        if (cfg.jobs == null) {
            cfg.jobs = new java.util.ArrayList<>();
        }
        return cfg;
    }
}
