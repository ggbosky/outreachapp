#!/usr/bin/env bash
# Jednorázová příprava Codespace: .env, balíčky, Chromium pro scraper, tabulky v DB
set -euo pipefail

LOCAL_DB="postgresql://postgres:postgres@db:5432/outreach"

if [ ! -f .env ]; then
  cp .env.example .env
  # V Codespace používáme lokální PostgreSQL z docker-compose
  sed -i "s#^DATABASE_URL=.*#DATABASE_URL=\"$LOCAL_DB\"#; s#^DIRECT_URL=.*#DIRECT_URL=\"$LOCAL_DB\"#" .env
fi

npm install
npx playwright install --with-deps chromium

# Počkáme na databázi a vytvoříme tabulky
for i in $(seq 1 30); do
  npx prisma db push --skip-generate && break
  echo "Čekám na databázi…"; sleep 2
done

echo
echo "✅ Hotovo. Aplikace se spustí na portu 3000 (záložka PORTS)."
echo "   API klíče (ANTHROPIC_API_KEY, SMTP_PASS…) nastav jako Codespaces secrets nebo v souboru .env."
