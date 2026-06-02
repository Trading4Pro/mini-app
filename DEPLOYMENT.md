# Deployment

Runs on the **same Hetzner VPS as prop-crm** but as a **completely separate
project** — its own directory, its own Docker Compose project, its own
container. It shares nothing with the CRM and uses no ports (the bot long-polls
Telegram, so there is nothing to conflict with the CRM's 8080/9090/3000).

| Thing            | prop-crm                | spamwatch-bot            |
|------------------|-------------------------|--------------------------|
| VPS dir          | `/opt/prop-crm`         | `/opt/spamwatch-bot`     |
| Compose project  | `prop-crm`              | `spamwatch-bot`          |
| Container        | `prop-crm-backend` …    | `spamwatch-bot`          |
| Ports            | 8080 / 9090 / 3000      | none                     |
| GitHub           | `Trading4Pro/funded_crm`| `Trading4Pro/mini-app`   |

VPS: `root@46.224.58.231`.

## 1. Push code to GitHub (from this folder)

```bash
git add -A
git commit -m "your message"
git push origin main
```

`config.json` and `.env` are git-ignored — only `config.example.json` and
`.env.example` ship in the repo. Your token and real chat ids never hit GitHub.

## 2. First-time VPS setup

```bash
ssh root@46.224.58.231
git clone https://github.com/Trading4Pro/mini-app.git /opt/spamwatch-bot
cd /opt/spamwatch-bot

cp .env.example .env          && nano .env          # set BOT_TOKEN
cp config.example.json config.json && nano config.json  # set jobs + approvals

bash deploy.sh                # build + start + show logs
```

`config.json` per-job: set `text`, `origin`, `destination`, `periodMinutes`,
`userCount` and/or `mentionCount`, then flip `originApproved` **and**
`destinationApproved` to `true` (a job stays PENDING until both are true).
Find numeric chat ids by setting `LOG_LEVEL=DEBUG` in `.env`, adding the bot to
the chat, sending a message, and reading the logged `Chat seen` line.

## 3. Updating later (the routine flow)

On the laptop, push (step 1). Then on the VPS:

```bash
ssh root@46.224.58.231 "cd /opt/spamwatch-bot && git pull && bash deploy.sh"
```

`deploy.sh` rebuilds the image, restarts the container, and tails the logs.
Changing **only** `config.json` or `.env`? No rebuild needed — just:

```bash
ssh root@46.224.58.231 "cd /opt/spamwatch-bot && docker compose up -d --force-recreate"
```

## 4. Operating

```bash
cd /opt/spamwatch-bot
docker compose logs -f bot      # live logs (ACTIVE/PENDING per job, alerts)
docker compose ps               # running?
docker compose restart bot      # bounce it (in-memory window counters reset)
docker compose down             # stop
```

## Notes

- Sliding-window counters are **in memory** — a restart resets them. Fine for
  multi-hour windows.
- BotFather: **Group Privacy must be OFF**, and the bot must be a *member* of
  every origin chat and the destination chat.
- The bot needs no host Java — everything builds inside the image, so the only
  VPS requirement is Docker (already installed for the CRM).
