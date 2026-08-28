#!/usr/bin/env python3
import httpx, json, asyncio

BASE = "http://localhost:4410"

async def main():
    async with httpx.AsyncClient(base_url=BASE) as c:
        # Login
        r = await c.post("/api/v1/auth/login", json={"username":"testuser","password":"Test1234!"})
        token = r.cookies.get("archia_session")
        print(f"LOGIN: {r.status_code} token={'SET' if token else 'NONE'}")
        
        # Create project
        r = await c.post("/api/v1/projects", cookies={"archia_session": token}, json={"name":"Test","description":"d","context":"c"})
        print(f"CREATE PROJ: {r.status_code} {r.text[:200]}")
        pid = r.json().get("id") if r.status_code == 201 else None
        
        if pid:
            # Create graph
            r = await c.post(f"/api/v1/projects/{pid}/graphs", cookies={"archia_session": token}, json={"name":"My Diagram","diagram_kind":"architecture"})
            print(f"CREATE GRAPH: {r.status_code} {r.text[:200]}")
            
            # Try without diagram_kind
            r = await c.post(f"/api/v1/projects/{pid}/graphs", cookies={"archia_session": token}, json={"name":"No Kind"})
            print(f"CREATE GRAPH (no kind): {r.status_code} {r.text[:200]}")
        
        # Test analysis endpoint
        r = await c.get("/api/v1/graphs")
        print(f"GRAPHS LIST: {r.status_code}")

asyncio.run(main())
