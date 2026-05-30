import sys
sys.path.insert(0, '.')
from app.database import SessionLocal
from app.models.timetable import Timetable
from app.models.bell_schedule import BellSchedule

db = SessionLocal()
tt = db.query(Timetable).first()
schedule = db.query(BellSchedule).filter(BellSchedule.timetable_id == tt.id).first()

print(f"period_config_style: {schedule.period_config_style}")
print(f"schedule_type: {schedule.schedule_type}")
print(f"working_days: {schedule.working_days}")
print(f"\nAll periods ({len(schedule.periods)}):")
for p in sorted(schedule.periods, key=lambda x: x.order):
    print(f"  order={p.order}, name={p.name}, is_break={p.is_break}, start={p.start_time}, end={p.end_time}, day_of_week={p.day_of_week}")

non_break = sorted([p for p in schedule.periods if not p.is_break], key=lambda x: x.order)
print(f"\nNon-break period orders: {[p.order for p in non_break]}")
print(f"Total non-break: {len(non_break)}")
print(f"Total slots per week: {len(schedule.working_days) * len(non_break)}")
db.close()
