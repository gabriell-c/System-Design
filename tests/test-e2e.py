#!/usr/bin/env python3
"""Comprehensive test - correct endpoints"""
import httpx
import asyncio

BASE = "http://localhost:4410"
results = []

async def main():
    async with httpx.AsyncClient(base_url=BASE, follow_redirects=False) as c:
        # 1. Health
        r = await c.get("/api/health")
        results.append(("HEALTH", r.status_code, r.status_code == 200))
        
        # 2. Register
        r = await c.post("/api/v1/auth/register", json={
            "username": "e2etest",
            "email": "e2e@test.com",
            "password": "Test1234!"
        })
        results.append(("REGISTER", r.status_code, r.status_code in [200, 201]))
        
        # 3. Login
        r = await c.post("/api/v1/auth/login", json={
            "username": "e2etest",
            "password": "Test1234!"
        })
        token = r.cookies.get("archia_session")
        results.append(("LOGIN", r.status_code, r.status_code == 200 and token is not None))
        
        if not token:
            results.append(("ERROR", "No token", False))
            write_results()
            return
        
        # 4. Profile
        r = await c.get("/api/v1/profile", cookies={"archia_session": token})
        results.append(("PROFILE", r.status_code, r.status_code == 200))
        
        # 5. Projects list with auth
        r = await c.get("/api/v1/projects", cookies={"archia_session": token})
        results.append(("PROJECTS_AUTH", r.status_code, r.status_code == 200))
        
        # 6. Projects without auth
        r = await c.get("/api/v1/projects")
        results.append(("PROJECTS_NO_AUTH", r.status_code, r.status_code in [401, 403]))
        
        # 7. Create project
        r = await c.post("/api/v1/projects", cookies={"archia_session": token}, json={
            "name": "E2E Test",
            "description": "Test",
            "context": "Context"
        })
        pid = r.json().get("id") if r.status_code in [200, 201] else None
        results.append(("CREATE_PROJECT", r.status_code, r.status_code in [200, 201]))
        
        if pid:
            # 8. List graphs (correct endpoint)
            r = await c.get("/api/v1/graphs", cookies={"archia_session": token})
            results.append(("LIST_GRAPHS", r.status_code, r.status_code == 200))
            
            # 9. Create graph (correct endpoint)
            r = await c.post("/api/v1/graphs", cookies={"archia_session": token}, json={
                "name": "Test Diagram",
                "diagram_kind": "architecture"
            })
            gid = r.json().get("id") if r.status_code == 201 else None
            results.append(("CREATE_GRAPH", r.status_code, r.status_code == 201))
            
            if gid:
                # 10. Update graph
                r = await c.put(f"/api/v1/graphs/{gid}", cookies={"archia_session": token}, json={
                    "nodes": [
                        {"id": "n1", "kind": "service", "x": 100, "y": 100, "label": "API"}
                    ],
                    "edges": []
                })
                results.append(("UPDATE_GRAPH", r.status_code, r.status_code == 200))
                
                # 11. Analyze
                r = await c.post(f"/api/v1/graphs/{gid}/analyze", cookies={"archia_session": token})
                results.append(("ANALYZE", r.status_code, r.status_code in [200, 202]))
                
                # 12. Get graph
                r = await c.get(f"/api/v1/graphs/{gid}", cookies={"archia_session": token})
                results.append(("GET_GRAPH", r.status_code, r.status_code == 200))
                
                # 13. Delete graph
                r = await c.delete(f"/api/v1/graphs/{gid}", cookies={"archia_session": token})
                results.append(("DELETE_GRAPH", r.status_code, r.status_code in [200, 204]))
            
            # 14. Delete project
            r = await c.delete(f"/api/v1/projects/{pid}", cookies={"archia_session": token})
            results.append(("DELETE_PROJECT", r.status_code, r.status_code in [200, 204]))
        
        # 15. 404 test
        r = await c.get("/api/v1/nonexistent")
        results.append(("404_TEST", r.status_code, r.status_code == 404))
        
        write_results()

def write_results():
    passed = sum(1 for _, _, ok in results if ok)
    failed = sum(1 for _, _, ok in results if not ok)
    
    lines = ["="*60, "TEST RESULTS", "="*60]
    for name, code, ok in results:
        status = "[PASS]" if ok else "[FAIL]"
        lines.append(f"{status:8} | {name:20} | HTTP {code}")
    
    lines += ["="*60, f"TOTAL: {len(results)} | PASSED: {passed} | FAILED: {failed}", "="*60]
    
    if failed > 0:
        lines.append("\nFAILED:")
        for name, code, ok in results:
            if not ok:
                lines.append(f"  - {name}: HTTP {code}")
    
    with open("test-results.txt", "w") as f:
        f.write("\n".join(lines) + "\n")
    
    print("\n".join(lines))

if __name__ == "__main__":
    asyncio.run(main())
