import subprocess, os, sys, time, urllib.request, json

BACKEND_DIR = r'd:\OmniRoute\system_design\backend'
WEB_DIR = r'd:\OmniRoute\system_design\web'

env = os.environ.copy()
env['DATABASE_URL'] = 'sqlite:///./data/playwright.db'
env['CORS_ORIGINS'] = 'http://127.0.0.1:3021,http://localhost:3021'
env['ARCHIA_JWT_SECRET'] = 'archia-playwright-secret-key-32b-min!!'
env['ARCHIA_ENV'] = 'test'
env['NEXT_PUBLIC_API_URL'] = 'http://127.0.0.1:8021'

# Start API server
print('Starting API server...')
api_proc = subprocess.Popen(
    [sys.executable, '-m', 'uvicorn', 'app.main:app', '--host', '127.0.0.1', '--port', '8021'],
    cwd=BACKEND_DIR,
    env=env,
    stdout=subprocess.PIPE,
    stderr=subprocess.STDOUT,
)
print(f'API server PID={api_proc.pid}')

# Wait for API to be ready
for i in range(30):
    time.sleep(1)
    try:
        r = urllib.request.urlopen('http://127.0.0.1:8021/api/health', timeout=2)
        print(f'API ready: {r.read().decode()}')
        break
    except Exception as e:
        print(f'Waiting API ({i+1}s)...')

# Wait a bit more for the server to stabilize
time.sleep(2)

# Test login directly
print('Testing login...')
try:
    login_resp = urllib.request.urlopen(
        urllib.request.Request(
            'http://127.0.0.1:8021/api/v1/auth/login',
            data=json.dumps({"username": "SENIOR", "password": "CHANGEPASSWORD"}).encode(),
            headers={'Content-Type': 'application/json'},
            method='POST'
        ),
        timeout=5
    )
    login_data = json.loads(login_resp.read().decode())
    print(f'Login response: {login_data}')
except Exception as e:
    print(f'Login error: {e}')

# Start Next.js production server
print('Starting Next.js server...')
web_proc = subprocess.Popen(
    [r'C:\Users\User\AppData\Roaming\npm\pnpm.cmd', 'exec', 'next', 'start', '-p', '3021', '-H', '127.0.0.1'],
    cwd=WEB_DIR,
    env=env,
    stdout=subprocess.PIPE,
    stderr=subprocess.STDOUT,
)
print(f'Web server PID={web_proc.pid}')

# Wait for web to be ready
for i in range(60):
    time.sleep(1)
    try:
        r = urllib.request.urlopen('http://127.0.0.1:3021', timeout=3)
        print(f'Web ready after {i+1}s')
        break
    except:
        if i >= 59:
            print('Web not ready')

time.sleep(3)

# Run Playwright e2e tests
print('Running Playwright e2e tests...')
result = subprocess.run(
    [r'C:\Users\User\AppData\Roaming\npm\pnpm.cmd', 'exec', 'playwright', 'test', 'e2e/journey.spec.ts', '--reporter=list'],
    cwd=WEB_DIR,
    capture_output=True,
    text=True,
    timeout=300,
    env=env,
)
print(result.stdout[-5000:])
if result.stderr:
    print(result.stderr[-2000:])
print(f'Exit code: {result.returncode}')

# Cleanup
for p in [api_proc, web_proc]:
    try:
        p.terminate()
        p.wait(timeout=5)
    except:
        pass
