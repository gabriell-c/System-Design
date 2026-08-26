#!/usr/bin/env python3
"""Clean final test"""
import httpx
import asyncio

results = []

async def main():
    # Test 1: Health
    async with httpx.AsyncClient(base_url="http://localhost:4410") as c:
        r = await c.get("/api/health")
        results.append(("HEALTH", r.status_code, r.status_code == 200))
        
        # Test 2: Register
        r = await c.post("/api/v1/auth/register", json={"username":"clean","email":"clean@test.com","password":"Test1234!"})
        results.append(("REGISTER", r.status_code, r.status_code in [200, 201]))
        
        # Test 3: Login
        r = await c.post("/api/v1/auth/login", json={"username":"clean","password":"Test1234!"})
        token = r.cookies.get("archia_session")
        results.append(("LOGIN", r.status_code, r.status_code == 200 and bool(token)))
        
        if token:
            # Test 4: Profile
            r = await c.get("/api/v1/profile", cookies={"archia_session": token})
            results.append(("PROFILE", r.status_code, r.status_code == 200))
            
            # Test 5: Projects with auth
            r = await c.get("/api/v1/projects", cookies={"archia_session": token})
            results.append(("PROJECTS_AUTH", r.status_code, r.status_code == 200))
            
            # Test 6: Projects WITHOUT auth - fresh client
            async with httpx.AsyncClient(base_url="http://localhost:4410") as noauth:
                r = await noauth.get("/api/v1/projects")
                results.append(("PROJECTS_NO_AUTH", r.status_code, r.status_code in [401, 403]))
            
            # Create project
            r = await c.post("/api/v1/projects", cookies={"archia_session": token}, json={"name":"Clean","description":"d","context":"c"})
            pid = r.json().get("id") if r.status_code in [200, 201] else None
            results.append(("CREATE_PROJECT", r.status_code, r.status_code in [200, 201]))
            
            if pid:
                # Create graph
                r = await c.post("/api/v1/graphs", cookies={"archia_session": token}, json={"name":"Clean","diagram_kind":"architecture"})
                gid = r.json().get("id") if r.status_code == 201 else None
                results.append(("CREATE_GRAPH", r.status_code, r.status_code == 201))
                
                if gid:
                    # Update
                    r = await c.put(f"/api/v1/graphs/{gid}", cookies={"archia_session": token}, json={"nodes":[{"id":"n1","kind":"svc","x":0,"y":0,"label":"A"}],"edges":[]})
                    results.append(("UPDATE_GRAPH", r.status_code, r.status_code == 200))
                    
                    # Analyze
                    r = await c.post(f"/api/v1/graphs/{gid}/analyze", cookies={"archia_session": token})
                    results.append(("ANALYZE", r.status_code, r.status_code in [200, 202]))
                    
                    # Delete graph
                    r = await c.delete(f"/api/v1/graphs/{gid}", cookies={"archia_session": token})
                    results.append(("DELETE_GRAPH", r.status_code, r.status_code in [200, 204]))
                
                # Delete project
                r = await c.delete(f"/api/v1/projects/{pid}", cookies={"archia_session": token})
                results.append(("DELETE_PROJECT", r.status_code, r.status_code in [200, 204]))
    
    # Print results
    passed = sum(1 for _,_,ok in results if ok)
    failed = sum(1 for _,_,ok in results if not ok)
    print("\n" + "="*60)
    print("FINAL CLEAN TEST RESULTS")
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
