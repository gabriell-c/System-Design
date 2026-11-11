@echo off
rem ============================================================
rem Archia API dev server (uvicorn) on http://127.0.0.1:4410
rem - Config/secrets are read from backend\.env (the app auto-loads it).
rem   Copy backend\.env.example to backend\.env and set ARCHIA_JWT_SECRET.
rem - Expected port: 4410 (see docker-compose.yml / README).
rem - Nothing secret is set in this script.
rem ============================================================
setlocal
pushd "%~dp0backend"

if not exist .env (
    echo [start-api] WARNING: backend\.env not found.
    echo [start-api] Copy backend\.env.example to backend\.env and set ARCHIA_JWT_SECRET.
)

py -3.12 -m uvicorn app.main:app --host 127.0.0.1 --port 4410
popd
endlocal
