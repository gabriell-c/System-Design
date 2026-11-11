#!/usr/bin/env sh
# ============================================================
# Archia Web dev server (Next.js) on http://localhost:3015
# - Secrets/config read from web/.env.local (next dev auto-loads it).
#   Copy web/.env.example to web/.env.local
#   (NEXT_PUBLIC_API_URL=http://localhost:4410).
# - Expected ports: web 3015, API 4410 (see docker-compose.yml / README).
# - Nothing secret is set in this script.
# ============================================================
set -eu
cd "$(dirname "$0")/web"

if [ ! -f .env.local ]; then
    echo "[start-web] WARNING: web/.env.local not found."
    echo "[start-web] Copy web/.env.example to web/.env.local."
fi

exec pnpm dev
