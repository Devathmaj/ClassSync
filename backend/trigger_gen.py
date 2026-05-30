import sys
sys.path.insert(0, '.')
from app.database import SessionLocal
from app.models.timetable import Timetable
from app.services.scheduling_service import generate_entries_for_timetable

db = SessionLocal()
tt = db.query(Timetable).first()
if tt:
    print(f"Triggering generation for {tt.name} (ID: {tt.id})...")
    entries, score, warnings = generate_entries_for_timetable(db, tt.id)
    print(f"Generated {len(entries)} entries. Score: {score}")
    if warnings:
        print(f"Warnings ({len(warnings)}):")
        for w in warnings:
            print(f"  {w}")
    else:
        print("No warnings! Perfect score.")
else:
    print("No timetable found.")
db.close()
