import sys
sys.path.insert(0, '/app')
from app.database import SessionLocal
from sqlalchemy import text

db = SessionLocal()
try:
    project_id = "55205d76-def9-4887-af5c-382f8b9e92e1"
    result = db.execute(text(f"SELECT id, name, project_kind FROM projects WHERE id = '{project_id}'"))
    row = result.fetchone()
    with open('/tmp/project_check.txt', 'w') as f:
        if row:
            f.write(f"Project found: {row[0]}, {row[1]}, {row[2]}\n")
        else:
            f.write("Project not found\n")
        
        # Check diagrams
        result = db.execute(text(f"SELECT id, name, diagram_kind FROM graphs WHERE project_id = '{project_id}'"))
        diagrams = result.fetchall()
        f.write(f"Diagrams: {len(diagrams)}\n")
        for d in diagrams:
            f.write(f"  {d[0]}, {d[1]}, {d[2]}\n")
except Exception as e:
    with open('/tmp/project_check.txt', 'w') as f:
        f.write(f"Error: {e}\n")
finally:
    db.close()
