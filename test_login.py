import httpx
import asyncio

async def test_login():
    async with httpx.AsyncClient() as client:
        r = await client.post('http://localhost:4410/api/v1/auth/login', json={'username': 'SENIOR', 'password': 'CHANGEPASSWORD'})
        print(f"Status: {r.status_code}")
        print(f"Response: {r.text[:300]}")

asyncio.run(test_login())
