# ============================================================
# Archia API dev server (uvicorn) on http://127.0.0.1:4410
# - Config/secrets are read from backend\.env (the app auto-loads it).
#   Copy backend\.env.example to backend\.env and set ARCHIA_JWT_SECRET.
# - Expected port: 4410 (see docker-compose.yml / README).
# - Nothing secret is set in this script.
# ============================================================
$repoRoot = Split-Path -Parent $PSScriptRoot
Set-Location (Join-Path $repoRoot "backend")

if (-not (Test-Path ".env")) {
    Write-Warning "[start-api] backend\.env not found. Copy backend\.env.example to backend\.env and set ARCHIA_JWT_SECRET."
}

py -3.12 -m uvicorn app.main:app --host 127.0.0.1 --port 4410
