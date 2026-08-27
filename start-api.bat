@echo off
cd /d "d:\OmniRoute\system_design\backend"
set DATABASE_URL=sqlite:///./data/playwright.db
set CORS_ORIGINS=http://127.0.0.1:3021,http://localhost:3021
set ARCHIA_JWT_SECRET=archia-playwright-secret-key-32b-min!!
set ARCHIA_ENV=test
start /B py -3.12 -m uvicorn app.main:app --host 127.0.0.1 --port 8021
timeout /t 5 /nobreak >nul
echo API server started