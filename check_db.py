import sys
sys.path.insert(0, '/app')
print("Starting script", flush=True)
from app.database import SessionLocal
from sqlalchemy import text
print("Connected to database", flush=True)

db = SessionLocal()
try:
    # Check projects table
    result = db.execute(text("SELECT count(*) FROM projects"))
    count = result.scalar()
    print(f"Projects count: {count}", flush=True)
    
    # Check graphs table
    result = db.execute(text("SELECT count(*) FROM graphs"))
    count = result.scalar()
    print(f"Graphs count: {count}", flush=True)
    
    # List projects
    result = db.execute(text("SELECT id, name, project_kind FROM projects"))
    rows = result.fetchall()
    print(f"\nProjects:", flush=True)
    for row in rows:
        print(f"  ID: {row[0]}, Name: {row[1]}, Kind: {row[2]}", flush=True)
        
except Exception as e:
    print(f"Error: {e}", flush=True)
finally:
    db.close()
print("Done", flush=True)
