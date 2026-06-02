# spamwatch-bot (Java)

A Telegram bot that watches one or more **origin** chats for a given **text** over a sliding
**time window** and posts an alert to a **destination** chat when the text shows up often enough.
Each watch is a *job* defined in `config.json`.

Per-job parameters (your spec):

| Param | Config key | Required | Meaning |
|-------|-----------|----------|---------|
| text | `text` | yes | The word/phrase to watch for. |
| origin link | `origin` + `originApproved` | yes | Chat to watch. Stays **pending** until `originApproved: true`. |
| destination link | `destination` + `destinationApproved` | yes | Chat alerts go to. Stays **pending** until `destinationApproved: true`. |
| no. of mentions | `mentionCount` | optional | Alert once the text appears this many times in the window. |
| no. of origin users | `userCount` | optional | Alert once this many *distinct* users have used the text in the window. |
| period | `periodMinutes` | yes | Length of the sliding window, in minutes. |

A job only runs when **both** approval flags are `true` — that is how the "pending approval"
requirement is modelled. On startup the bot prints each job as `ACTIVE` or `PENDING` (with the
reason).

## Important Telegram limitation

This is a **Bot API** bot, so it can only read messages in a group/channel that the bot has been
**added to**, with *Group Privacy turned off*. It **cannot** monitor an arbitrary personal account
or a group it isn't a member of, just from a link. (Watching a personal account would require a
*userbot* logged in with a real phone number via MTProto — a different, heavier design.)

## Build

Requires JDK 21+ and Maven (both already installed on this machine).

```
mvn clean package
```

This produces a single runnable jar: `target/spamwatch-bot.jar`.

## Set up the bot with BotFather

1. In Telegram, open **@BotFather** → `/newbot` → copy the **token**.
2. `/mybots` → pick your bot → **Bot Settings** → **Group Privacy** → **Turn off**.
   (Without this, the bot only sees commands, not normal group messages.)
3. Add the bot to each **origin** group. If you changed Group Privacy *after* adding it, **remove
   and re-add** the bot so the setting takes effect.
4. Add the bot to the **destination** chat too (it must be a member to post there).

## Configure

```
copy config.example.json config.json   # PowerShell: Copy-Item config.example.json config.json
```

Then edit `config.json`:

- **Token** — paste it into `botToken`, **or** leave the placeholder and set the `BOT_TOKEN`
  environment variable instead (the env var wins). The env var keeps your token out of the file.
- **`botUsername`** — your bot's @username (without the `@`).
- For each job set `text`, `origin`, `destination`, `periodMinutes`, and any of the optional
  `mentionCount` / `userCount`.
- When you're happy a job is correct, **approve** it: set `originApproved` and
  `destinationApproved` to `true`.

### Origin / destination formats

`origin` and `destination` accept any of:

- a **numeric chat id**, e.g. `-1001234567890` (works for any chat, including private groups);
- an **@username**, e.g. `@my_channel` (public chats only);
- a **t.me link**, e.g. `https://t.me/my_channel` or `https://t.me/c/1234567890/55`.

Private-group **invite links** (`https://t.me/+hash`, `.../joinchat/...`) can't be resolved from
the link alone — use the numeric chat id for those. To find a chat's id, run with `LOG_LEVEL=DEBUG`,
send a message in the chat, and read the logged `chat id`.

### How the thresholds combine

Within the sliding window of `periodMinutes`:

- neither `mentionCount` nor `userCount` set → alert on **every** match;
- only one set → that one must be reached;
- both set → **both** must be reached (default), or **either** if you set
  `"requireAllThresholds": false` on the job.

Optional `cooldownMinutes` (default `0`) suppresses repeat alerts for a job for a while after one
fires.

### Other config keys (global)

| Key | Default | Meaning |
|-----|---------|---------|
| `excludeAdmins` | `true` | Ignore messages from admins of the origin chat. |
| `adminCacheMinutes` | `10` | How long to cache each origin's admin list. |
| `caseSensitive` | `false` | Whether matching respects letter case. |
| `wordBoundary` | `true` | Match whole words only (`cat` won't match `category`). |
| `includeMessageLink` | `true` | Add a link to the triggering message in the alert. |

## Run

```
java -jar target/spamwatch-bot.jar
```

Optional: pass a config path as the first argument, and/or set env vars:

```
# PowerShell
$env:BOT_TOKEN = "123456:your-token"
$env:LOG_LEVEL = "DEBUG"
java -jar target/spamwatch-bot.jar config.json
```

The bot logs `ACTIVE` / `PENDING` for each job, then polls for updates until stopped (Ctrl+C).

## Deploying 24/7

On a Linux VPS, a minimal `systemd` unit:

```ini
[Unit]
Description=spamwatch telegram bot
After=network-online.target

[Service]
WorkingDirectory=/opt/spamwatch-bot
Environment=BOT_TOKEN=123456:your-token
ExecStart=/usr/bin/java -jar /opt/spamwatch-bot/spamwatch-bot.jar /opt/spamwatch-bot/config.json
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

## Notes

- Sliding-window state is kept **in memory**; restarting the bot resets the counters. For the
  typical multi-hour windows that's usually fine.
- The bot needs no admin rights in the origin chat — only to *read* (privacy off). It must be a
  member of the destination chat to post there.
- `config.json` is git-ignored because it can hold your token; commit `config.example.json` instead.
```
