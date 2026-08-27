cd "d:\OmniRoute\system_design\backend"
$env:DATABASE_URL = "sqlite:///./data/playwright.db"
$env:CORS_ORIGINS = "http://127.0.0.1:3021,http://localhost:3021"
$env:ARCHIA_JWT_SECRET = "archia-playwright-secret-key-32b-min!!"
$env:ARCHIA_ENV = "test"
py -3.12 -m uvicorn app.main:app --host 127.0.0.1 --port 8021
