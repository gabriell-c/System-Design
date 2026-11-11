@echo off
rem ============================================================
rem Archia Web dev server (Next.js) on http://localhost:3015
rem - Secrets/config read from web\.env.local (next dev auto-loads it).
rem   Copy web\.env.example to web\.env.local
rem   (NEXT_PUBLIC_API_URL=http://localhost:4410).
rem - Expected ports: web 3015, API 4410 (see docker-compose.yml / README).
rem - Nothing secret is set in this script.
rem ============================================================
setlocal
pushd "%~dp0web"

if not exist .env.local (
    echo [start-web] WARNING: web\.env.local not found.
    echo [start-web] Copy web\.env.example to web\.env.local.
)

pnpm dev
popd
endlocal
