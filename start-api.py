import subprocess
import time
import os

os.chdir(r'd:\OmniRoute\system_design\backend')
os.environ['DATABASE_URL'] = 'sqlite:///./data/playwright.db'
os.environ['CORS_ORIGINS'] = 'http://127.0.0.1:3021,http://localhost:3021'
os.environ['ARCHIA_JWT_SECRET'] = 'archia-playwright-secret-key-32b-min!!'

import subprocess
proc = subprocess.Popen(
    ['py', '-3.12', '-m', 'uvicorn', 'app.main:app', '--host', '127.0.0.1', '--port', '8021'],
    cwd=r'd:\OmniRoute\system_design\backend',
    env=os.environ.copy(),
    stdout=subprocess.PIPE,
    stderr=subprocess.PIPE,
)
time.sleep(3)
print(proc.stdout.read().decode('utf-8', errors='replace'))
print(proc.stderr.read().decode('utf-8', errors='replace'))
