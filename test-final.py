#!/usr/bin/env python3
"""Final test with valid username"""
import httpx
import asyncio
import uuid
import time

results = []

async def main():
    # Use timestamp for unique username
    unique_id = f"u{int(time.time())}"
    username = f"test{unique_id}"
    email = f"{unique_id}@test.com"
    
    async with httpx.AsyncClient(base_url="http://localhost:4410", follow_redirects=False) as c:
        # 1. Health
        r = await c.get("/api/health")
        results.append(("HEALTH", r.status_code, r.status_code == 200))
        
        # 2. Register
        r = await c.post("/api/v1/auth/register", json={
            "username": username,
            "email": email,
            "password": "Test1234!"
        })
        results.append(("REGISTER", r.status_code, r.status_code in [200, 201]))
        
        # 3. Login
        r = await c.post("/api/v1/auth/login", json={
            "username": username,
            "password": "Test1234!"
        })
        token = r.cookies.get("archia_session")
        results.append(("LOGIN", r.status_code, r.status_code == 200 and bool(token)))
        
        if token:
            # 4. Profile
            r = await c.get("/api/v1/profile", cookies={"archia_session": token})
            results.append(("PROFILE", r.status_code, r.status_code == 200))
            
            # 5. Projects with auth
            r = await c.get("/api/v1/projects", cookies={"archia_session": token})
            results.append(("PROJECTS_AUTH", r.status_code, r.status_code == 200))
            
            # 6. Projects without auth
            async with httpx.AsyncClient(base_url="http://localhost:4410") as noauth:
                r = await noauth.get("/api/v1/projects")
                results.append(("PROJECTS_NO_AUTH", r.status_code, r.status_code in [401, 403]))
            
            # 7. Create project
            r = await c.post("/api/v1/projects", cookies={"archia_session": token}, json={
                "name": "Final Test",
                "description": "Test",
                "context": "Context"
            })
            pid = r.json().get("id") if r.status_code in [200, 201] else None
            results.append(("CREATE_PROJECT", r.status_code, r.status_code in [200, 201]))
            
            if pid:
                # 8. Create graph
                r = await c.post("/api/v1/graphs", cookies={"archia_session": token}, json={
                    "name": "Final Diagram",
                    "diagram_kind": "architecture"
                })
                gid = r.json().get("id") if r.status_code == 201 else None
                results.append(("CREATE_GRAPH", r.status_code, r.status_code == 201))
                
                if gid:
                    # 9. Update graph
                    r = await c.put(f"/api/v1/graphs/{gid}", cookies={"archia_session": token}, json={
                        "nodes": [{"id": "n1", "kind": "service", "x": 100, "y": 100, "label": "API"}],
                        "edges": []
                    })
                    results.append(("UPDATE_GRAPH", r.status_code, r.status_code == 200))
                    
                    # 10. Analyze
                    r = await c.post(f"/api/v1/graphs/{gid}/analyze", cookies={"archia_session": token})
                    results.append(("ANALYZE", r.status_code, r.status_code in [200, 202]))
                    
                    # 11. Delete graph
                    r = await c.delete(f"/api/v1/graphs/{gid}", cookies={"archia_session": token})
                    results.append(("DELETE_GRAPH", r.status_code, r.status_code in [200, 204]))
                
                # 12. Delete project
                r = await c.delete(f"/api/v1/projects/{pid}", cookies={"archia_session": token})
                results.append(("DELETE_PROJECT", r.status_code, r.status_code in [200, 204]))
        
        # Print results
        passed = sum(1 for _,_,ok in results if ok)
        failed = sum(1 for _,_,ok in results if not ok)
        print("\n" + "="*60)
        print("FINAL TEST RESULTS")
        print("="*60)
        for name, code, ok in results:
            s = "[PASS]" if ok else "[FAIL]"
            print(f"{s:8} | {name:20} | HTTP {code}")
        print("="*60)
        print(f"TOTAL: {len(results)} | PASSED: {passed} | FAILED: {failed}")
        print("="*60)
        
        if failed > 0:
            print("\nFAILED:")
            for name, code, ok in results:
                if not ok:
                    print(f"  - {name}: HTTP {code}")

if __name__ == "__main__":
    asyncio.run(main())
