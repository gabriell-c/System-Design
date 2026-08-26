#!/usr/bin/env python3
import httpx, json, asyncio, sys

BASE = "http://localhost:4410"
log = []

async def main():
    async with httpx.AsyncClient(base_url=BASE) as c:
        # Register
        r = await c.post("/api/v1/auth/register", json={"username":"testuser","email":"test@example.com","password":"Test1234!"})
        log.append(f"REG {r.status_code}: {r.text[:200]}")
        
        # Login
        r = await c.post("/api/v1/auth/login", json={"username":"testuser","password":"Test1234!"})
        token = r.cookies.get("archia_session")
        body = r.json() if r.status_code == 200 else {}
        log.append(f"LOGIN {r.status_code}: token={'SET' if token else 'NONE'} access_token={'SET' if body.get('access_token') else 'NONE'}")
        
        if not token:
            with open("test-log.txt", "w") as f:
                f.write("\n".join(log))
            return
        
        # Get profile
        r = await c.get("/api/v1/profile", cookies={"archia_session": token})
        log.append(f"PROFILE {r.status_code}: {r.text[:200]}")
        
        # List projects
        r = await c.get("/api/v1/projects", cookies={"archia_session": token})
        projects = r.json() if r.status_code == 200 else []
        log.append(f"PROJECTS {r.status_code}: count={len(projects)}")
        
        # Create project
        r = await c.post("/api/v1/projects", cookies={"archia_session": token}, json={"name":"Test Project","description":"desc","context":"ctx"})
        log.append(f"CREATE PROJ {r.status_code}: {r.text[:200]}")
        
        pid = None
        if r.status_code == 200:
            pid = r.json().get("id")
            
            # List graphs
            r = await c.get(f"/api/v1/projects/{pid}/graphs", cookies={"archia_session": token})
            log.append(f"GRAPHS {r.status_code}: {r.text[:200]}")
            
            # Create graph
            r = await c.post(f"/api/v1/projects/{pid}/graphs", cookies={"archia_session": token}, json={"name":"Diagram","diagram_kind":"architecture"})
            log.append(f"CREATE GRAPH {r.status_code}: {r.text[:200]}")
            
            gid = None
            if r.status_code == 200:
                gid = r.json().get("id")
                
                # Update graph
                r = await c.put(f"/api/v1/graphs/{gid}", cookies={"archia_session": token}, json={
                    "nodes": [{"id":"n1","kind":"service","x":100,"y":100,"label":"API"}],
                    "edges": []
                })
                log.append(f"UPDATE GRAPH {r.status_code}: {r.text[:200]}")
                
                # Analyze
                r = await c.post(f"/api/v1/graphs/{gid}/analyze", cookies={"archia_session": token})
                log.append(f"ANALYZE {r.status_code}: {r.text[:500]}")
        
        with open("test-log.txt", "w") as f:
            f.write("\n".join(log))

asyncio.run(main())
