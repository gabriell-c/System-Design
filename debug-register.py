#!/usr/bin/env python3
"""Debug register 422"""
import httpx
import asyncio
import uuid

async def main():
    unique_id = uuid.uuid4().hex[:8]
    username = f"test_{unique_id}"
    email = f"{unique_id}@test.com"
    
    async with httpx.AsyncClient(base_url="http://localhost:4410") as c:
        # Test register
        r = await c.post("/api/v1/auth/register", json={
            "username": username,
            "email": email,
            "password": "Test1234!"
        })
        print(f"REGISTER: {r.status_code}")
        print(f"Body: {r.text}")
        
        # Check what fields are required
        from app.schemas.user import UserCreate
        import inspect
        print(f"\nUserCreate fields:")
        for name, field in UserCreate.model_fields.items():
            print(f"  {name}: required={field.is_required()}, default={field.default}")

if __name__ == "__main__":
    asyncio.run(main())
