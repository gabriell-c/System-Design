#!/usr/bin/env python3
"""Debug projects auth - writes to file"""
import httpx
import asyncio

async def main():
    output = []
    async with httpx.AsyncClient(base_url="http://localhost:4410", follow_redirects=False) as c:
        # Direct call without any cookies
        r = await c.get("/api/v1/projects", follow_redirects=False)
        output.append(f"Status: {r.status_code}")
        output.append(f"Headers: {dict(r.headers)}")
        output.append(f"Body: {r.text[:300]}")
        
        # Try with explicit empty cookies
        r = await c.get("/api/v1/projects", cookies={})
        output.append(f"\nWith empty cookies: {r.status_code}")
        output.append(f"Body: {r.text[:200]}")
        
        # Check if there's a public project setting
        r = await c.get("/api/v1/projects?archived=false")
        output.append(f"\nWith params: {r.status_code}")
        output.append(f"Body: {r.text[:200]}")
    
    with open("debug-output.txt", "w") as f:
        f.write("\n".join(output))

asyncio.run(main())
