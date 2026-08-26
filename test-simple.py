#!/usr/bin/env python3
import httpx
import asyncio
import sys

async def main():
    output = []
    async with httpx.AsyncClient(base_url="http://localhost:4410", follow_redirects=False) as c:
        # Test health
        r = await c.get("/api/health")
        output.append(f"HEALTH: {r.status_code}")
        
        # Test login
        r = await c.post("/api/v1/auth/login", json={"username":"testuser","password":"Test1234!"})
        output.append(f"LOGIN: {r.status_code}")
        
        # Test profile
        token = r.cookies.get("archia_session")
        r = await c.get("/api/v1/profile", cookies={"archia_session": token})
        output.append(f"PROFILE: {r.status_code}")
        output.append(f"PROFILE LOCATION: {r.headers.get('location', 'none')}")
        output.append(f"PROFILE BODY: {r.text[:200]}")
        
        # Test projects
        r = await c.get("/api/v1/projects", cookies={"archia_session": token})
        output.append(f"PROJECTS: {r.status_code}")
        
        # Test 404
        r = await c.get("/api/v1/nonexistent")
        output.append(f"404: {r.status_code}")
        
        # Test no auth
        r = await c.get("/api/v1/projects")
        output.append(f"NO AUTH: {r.status_code}")
    
    with open("test-output.txt", "w") as f:
        f.write("\n".join(output))

asyncio.run(main())
