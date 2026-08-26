#!/usr/bin/env python3
"""Comprehensive manual test - test all flows"""
import httpx
import asyncio
import json
import sys

BASE = "http://localhost:4410"
results = []

async def test_api():
    async with httpx.AsyncClient(base_url=BASE, follow_redirects=False) as c:
        # 1. Health check
        r = await c.get("/api/health")
        results.append(("HEALTH", r.status_code, r.status_code == 200))
        
        # 2. Register new user
        r = await c.post("/api/v1/auth/register", json={
            "username": "manualtest",
            "email": "manual@test.com",
            "password": "Test1234!"
        })
        results.append(("REGISTER", r.status_code, r.status_code in [200, 201]))
        
        # 3. Login
        r = await c.post("/api/v1/auth/login", json={
            "username": "manualtest",
            "password": "Test1234!"
        })
        token = r.cookies.get("archia_session")
        results.append(("LOGIN", r.status_code, r.status_code == 200 and token is not None))
        
        if not token:
            results.append(("ERROR", "No token", False))
            return
        
        # 4. Profile (should not redirect)
        r = await c.get("/api/v1/profile", cookies={"archia_session": token})
        results.append(("PROFILE", r.status_code, r.status_code == 200))
        
        # 5. Projects list (should require auth)
        r = await c.get("/api/v1/projects", cookies={"archia_session": token})
        results.append(("PROJECTS_LIST", r.status_code, r.status_code == 200))
        
        # 6. Projects without auth (should fail)
        r = await c.get("/api/v1/projects")
        results.append(("PROJECTS_NO_AUTH", r.status_code, r.status_code in [401, 403]))
        
        # 7. Create project
        r = await c.post("/api/v1/projects", cookies={"archia_session": token}, json={
            "name": "Test Project",
            "description": "Test",
            "context": "Test context"
        })
        pid = r.json().get("id") if r.status_code in [200, 201] else None
        results.append(("CREATE_PROJECT", r.status_code, r.status_code in [200, 201]))
        
        if pid:
            # 8. List graphs
            r = await c.get(f"/api/v1/projects/{pid}/graphs", cookies={"archia_session": token})
            results.append(("LIST_GRAPHS", r.status_code, r.status_code == 200))
            
            # 9. Create graph
            r = await c.post(f"/api/v1/projects/{pid}/graphs", cookies={"archia_session": token}, json={
                "name": "Architecture Diagram",
                "diagram_kind": "architecture"
            })
            gid = r.json().get("id") if r.status_code == 200 else None
            results.append(("CREATE_GRAPH", r.status_code, r.status_code == 200))
            
            if gid:
                # 10. Update graph
                r = await c.put(f"/api/v1/graphs/{gid}", cookies={"archia_session": token}, json={
                    "nodes": [
                        {"id": "web", "kind": "frontend", "x": 100, "y": 100, "label": "Web App"},
                        {"id": "api", "kind": "backend", "x": 300, "y": 100, "label": "API"},
                        {"id": "db", "kind": "database", "x": 500, "y": 100, "label": "Database"}
                    ],
                    "edges": [
                        {"id": "e1", "source": "web", "target": "api", "type": "sync"},
                        {"id": "e2", "source": "api", "target": "db", "type": "sync"}
                    ]
                })
                results.append(("UPDATE_GRAPH", r.status_code, r.status_code == 200))
                
                # 11. Analyze
                r = await c.post(f"/api/v1/graphs/{gid}/analyze", cookies={"archia_session": token})
                results.append(("ANALYZE", r.status_code, r.status_code in [200, 202]))
                
                # 12. Get analysis
                r = await c.get(f"/api/v1/graphs/{gid}", cookies={"archia_session": token})
                results.append(("GET_GRAPH", r.status_code, r.status_code == 200))
                
                # 13. Delete graph
                r = await c.delete(f"/api/v1/graphs/{gid}", cookies={"archia_session": token})
                results.append(("DELETE_GRAPH", r.status_code, r.status_code == 204))
            
            # 14. Delete project
            r = await c.delete(f"/api/v1/projects/{pid}", cookies={"archia_session": token})
            results.append(("DELETE_PROJECT", r.status_code, r.status_code in [200, 204]))
        
        # 15. Test 404
        r = await c.get("/api/v1/nonexistent")
        results.append(("404_TEST", r.status_code, r.status_code == 404))
        
        # 16. Test invalid project
        r = await c.get("/api/v1/projects/fake-id", cookies={"archia_session": token})
        results.append(("INVALID_PROJECT", r.status_code, r.status_code == 404))

def print_results():
    print("\n" + "="*60)
    print("TEST RESULTS")
    print("="*60)
    passed = 0
    failed = 0
    for name, code, ok in results:
        status = "[PASS]" if ok else "[FAIL]"
        print(f"{status:8} | {name:20} | HTTP {code}")
        if ok:
            passed += 1
        else:
            failed += 1
    
    print("="*60)
    print(f"TOTAL: {passed + failed} | PASSED: {passed} | FAILED: {failed}")
    print("="*60)
    
    if failed > 0:
        print("\nFAILED TESTS:")
        for name, code, ok in results:
            if not ok:
                print(f"  - {name}: HTTP {code}")

if __name__ == "__main__":
    asyncio.run(test_api())
    print_results()
