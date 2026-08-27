import subprocess, os, sys, time, urllib.request

os.chdir(r'd:\OmniRoute\system_design\backend')
env = os.environ.copy()
env['DATABASE_URL'] = 'sqlite:///./data/playwright.db'
env['CORS_ORIGINS'] = 'http://127.0.0.1:3021,http://localhost:3021'
env['ARCHIA_JWT_SECRET'] = 'archia-playwright-secret-key-32b-min!!'
env['ARCHIA_ENV'] = 'test'

proc = subprocess.Popen(
    [sys.executable, '-m', 'uvicorn', 'app.main:app', '--host', '127.0.0.1', '--port', '8021'],
    cwd=r'd:\OmniRoute\system_design\backend',
    env=env,
    stdout=subprocess.PIPE,
    stderr=subprocess.STDOUT,
)

print(f'Started API server PID={proc.pid}')
for i in range(30):
    time.sleep(1)
    try:
        r = urllib.request.urlopen('http://127.0.0.1:8021/api/health', timeout=2)
        print(f'Health check OK: {r.read().decode()}')
        break
    except Exception as e:
        print(f'Waiting ({i+1}s)... {e}')

# Keep running for e2e tests
time.sleep(600)
proc.terminate()
proc.wait()
