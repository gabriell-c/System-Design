#!/usr/bin/env python3
import httpx
import asyncio

BASE = "http://localhost:4410"

async def main():
    async with httpx.AsyncClient(base_url=BASE, follow_redirects=False) as c:
        # Login
        r = await c.post("/api/v1/auth/login", json={"username":"testuser","password":"Test1234!"})
        print(f"LOGIN {r.status_code}")
        token = r.cookies.get("archia_session")
        print(f"Cookie: {token[:30] if token else 'NONE'}...")
        
        # Profile
        r = await c.get("/api/v1/profile", cookies={"archia_session": token})
        print(f"PROFILE {r.status_code}")
        print(f"  Location: {r.headers.get('location', 'None')}")
        print(f"  Body: {r.text[:200]}")
        
        # Projects
        r = await c.get("/api/v1/projects", cookies={"archia_session": token})
        print(f"PROJECTS {r.status_code}")
        print(f"  Count: {len(r.json())}")
        
        # Create project
        r = await c.post("/api/v1/projects", cookies={"archia_session": token}, json={"name":"Test","description":"d","context":"c"})
        print(f"CREATE PROJ {r.status_code}")
        pid = r.json().get("id") if r.status_code == 201 else None
        print(f"  PID: {pid}")
        
        if pid:
            # Graphs
            r = await c.get(f"/api/v1/projects/{pid}/graphs", cookies={"archia_session": token})
            print(f"GRAPHS {r.status_code}: {len(r.json()) if r.status_code == 200 else r.text[:100]}")
            
            # Create graph
            r = await c.post(f"/api/v1/projects/{pid}/graphs", cookies={"archia_session": token}, json={"name":"Diagram","diagram_kind":"architecture"})
            print(f"CREATE GRAPH {r.status_code}: {r.text[:200]}")
            
            if r.status_code == 200:
                gid = r.json().get("id")
                
                # Update graph
                r = await c.put(f"/api/v1/graphs/{gid}", cookies={"archia_session": token}, json={
                    "nodes": [{"id":"n1","kind":"service","x":100,"y":100,"label":"API"}],
                    "edges": []
                })
                print(f"UPDATE GRAPH {r.status_code}: {r.text[:200]}")
                
                # Analyze
                r = await c.post(f"/api/v1/graphs/{gid}/analyze", cookies={"archia_session": token})
                print(f"ANALYZE {r.status_code}: {r.text[:300]}")
                
                # Delete
                r = await c.delete(f"/api/v1/graphs/{gid}", cookies={"archia_session": token})
                print(f"DELETE GRAPH {r.status_code}")
            
            # Delete project
            r = await c.delete(f"/api/v1/projects/{pid}", cookies={"archia_session": token})
            print(f"DELETE PROJ {r.status_code}")

asyncio.run(main())
