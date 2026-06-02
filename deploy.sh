#!/usr/bin/env bash
# One-shot bot redeploy on the VPS.
# Run from your laptop with:  ssh root@46.224.58.231 "bash /opt/spamwatch-bot/deploy.sh"
cd /opt/spamwatch-bot || { echo "no /opt/spamwatch-bot"; exit 1; }

if docker compose version >/dev/null 2>&1; then DC="docker compose"; else DC="docker-compose"; fi
echo "=== using: $DC ==="

if [ ! -f config.json ]; then echo "MISSING config.json — copy config.example.json and edit it"; exit 1; fi
if [ ! -f .env ];        then echo "MISSING .env — copy .env.example and set BOT_TOKEN";          exit 1; fi

echo "=== build (a few minutes) ==="
$DC build || { echo "BUILD FAILED"; exit 1; }
$DC up -d  || { echo "UP FAILED";   exit 1; }

echo "=== STATUS ==="
$DC ps
echo "=== LOGS (last 30) ==="
$DC logs --tail 30 bot
echo "=== DONE — follow live with: $DC logs -f bot ==="
