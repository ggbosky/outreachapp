#!/usr/bin/env bash
# Start v produkci: schéma DB → worker na pozadí → Next.js server
set -euo pipefail

npx prisma db push --skip-generate

if [ "${RUN_WORKER:-true}" = "true" ]; then
  npm run worker &
fi

exec npx next start -p "${PORT:-3000}"
