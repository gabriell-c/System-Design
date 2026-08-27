@echo off
cd /d "d:\OmniRoute\system_design\web"
set NEXT_PUBLIC_API_URL=http://127.0.0.1:8021
start /B pnpm exec next start -p 3021 -H 127.0.0.1
timeout /t 3 /nobreak >nul
echo Web server started