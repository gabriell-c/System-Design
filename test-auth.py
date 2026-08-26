#!/usr/bin/env python3
"""Test projects auth - writes to file"""
import httpx
import asyncio

results = []

async def main():
    async with httpx.AsyncClient(base_url="http://localhost:4410") as c:
        # Test without auth
        r = await c.get("/api/v1/projects")
        results.append(f"PROJECTS (no auth): {r.status_code}")
        results.append(f"Body: {r.text[:300]}")
        
        # Test with auth
        r = await c.post("/api/v1/auth/login", json={"username":"testuser","password":"Test1234!"})
        token = r.cookies.get("archia_session")
        if token:
            r = await c.get("/api/v1/projects", cookies={"archia_session": token})
            results.append(f"PROJECTS (with auth): {r.status_code}")
            results.append(f"Count: {len(r.json()) if r.status_code == 200 else 'N/A'}")
        
        # Check container code
        import subprocess
        r = subprocess.run(["docker", "exec", "system_design-backend-1", "python3", "-c", 
                          "import ast; src=open('app/routes/projects.py').read(); print('current_user' in src)"],
                         capture_output=True, text=True)
        results.append(f"Container has auth dep: {r.stdout.strip()}")
        results.append(f"stderr: {r.stderr[:200]}")
    
    with open("auth-test.txt", "w") as f:
        f.write("\n".join(results))

asyncio.run(main())
