#!/usr/bin/env sh
# ============================================================
# Archia API dev server (uvicorn) on http://127.0.0.1:4410
# - Config/secrets are read from backend/.env (the app auto-loads it).
#   Copy backend/.env.example to backend/.env and set ARCHIA_JWT_SECRET.
# - Expected port: 4410 (see docker-compose.yml / README).
# - Nothing secret is set in this script.
# ============================================================
set -eu
cd "$(dirname "$0")/backend"

if [ ! -f .env ]; then
    echo "[start-api] WARNING: backend/.env not found."
    echo "[start-api] Copy backend/.env.example to backend/.env and set ARCHIA_JWT_SECRET."
fi

exec python3 -m uvicorn app.main:app --host 127.0.0.1 --port 4410
