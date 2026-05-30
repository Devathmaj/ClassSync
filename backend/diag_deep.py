import sys
sys.path.insert(0, '.')
from app.database import SessionLocal
from app.models.timetable import Timetable
from app.models.lesson import Lesson
from app.models.bell_schedule import BellSchedule
from app.models.constraint import Constraint
from app.models.timetable_entities import TimetableClassroom, TimetableFaculty, TimetableSubject
from app.models.timetable_entry import TimetableEntry
from collections import defaultdict

db = SessionLocal()
tt = db.query(Timetable).first()

schedule = db.query(BellSchedule).filter(BellSchedule.timetable_id == tt.id).first()
working_days = schedule.working_days

classrooms = [link.classroom for link in db.query(TimetableClassroom).filter(TimetableClassroom.timetable_id == tt.id).all()]
classroom_map = {str(c.id): c.name for c in classrooms}
subjects = [link.subject for link in db.query(TimetableSubject).filter(TimetableSubject.timetable_id == tt.id).all()]
subject_map = {str(s.id): s.short_name or s.name for s in subjects}
faculties = [link.faculty for link in db.query(TimetableFaculty).filter(TimetableFaculty.timetable_id == tt.id).all()]
faculty_map = {str(f.id): f.short_name or f.full_name for f in faculties}

entries = db.query(TimetableEntry).filter(TimetableEntry.timetable_id == tt.id).all()
lessons = db.query(Lesson).filter(Lesson.timetable_id == tt.id).all()
constraints = db.query(Constraint).filter(Constraint.timetable_id == tt.id).all()

fac_busy_map = defaultdict(set)
cls_busy_map = defaultdict(set)
for e in entries:
    if e.faculty_id:
        fac_busy_map[str(e.faculty_id)].add((e.day_of_week, e.period_number))
    if e.classroom_id:
        cls_busy_map[str(e.classroom_id)].add((e.day_of_week, e.period_number))

entry_count = defaultdict(int)
for e in entries:
    entry_count[str(e.lesson_id)] += 1

# For each unscheduled lesson, show EVERY slot and why it's blocked
for l in lessons:
    placed = entry_count.get(str(l.id), 0)
    expected = l.periods_per_week * 2 if l.double_periods else l.periods_per_week
    if placed >= expected:
        continue
    
    subs = [subject_map.get(str(sid), '?') for sid in l.subject_ids]
    facs = [faculty_map.get(str(fid), '?') for fid in l.faculty_ids]
    cls_name = classroom_map.get(str(l.classroom_id), 'FacOnly')
    still_needed = expected - placed
    
    # Find specific days constraint
    allowed_days = None
    for c in constraints:
        if c.constraint_type == 'specific_days_subject' and c.subject_a_id in l.subject_ids:
            allowed_days = set(c.days_of_week)
    
    print(f"\n=== {cls_name} / {','.join(subs)} / {','.join(facs)} needs {still_needed} more ===")
    if allowed_days:
        print(f"  Day restriction: only {allowed_days}")
    
    for day in working_days:
        if allowed_days and day not in allowed_days:
            continue  # skip days not allowed
        for p in range(1, 8):
            reasons = []
            if l.classroom_id and (day, p) in cls_busy_map[str(l.classroom_id)]:
                reasons.append("CLASS_BUSY")
            for fid in l.faculty_ids:
                if (day, p) in fac_busy_map[str(fid)]:
                    reasons.append(f"FAC_BUSY")
            
            status = "✅ FREE" if not reasons else f"❌ {','.join(reasons)}"
            print(f"  {day[:3]} P{p}: {status}")

# Now check: what if WE lessons were shared (linked)?
# SJ teaches WE to 5thA, 5thB, 6thA, 6thB, 7thA, 7thB
# Currently: 5thB has 2 WE placed, 6thA has 2 WE placed, 6thB has 1, 7thA has 1, 7thB has 1, 5thA has 0
# Are the WE lessons shared?
print("\n\n=== WE LESSONS DETAIL ===")
for l in lessons:
    subs = [subject_map.get(str(sid), '?') for sid in l.subject_ids]
    if 'WE' not in subs:
        continue
    facs = [faculty_map.get(str(fid), '?') for fid in l.faculty_ids]
    cls_name = classroom_map.get(str(l.classroom_id), 'FacOnly')
    placed = entry_count.get(str(l.id), 0)
    print(f"  {cls_name}/WE teacher={','.join(facs)} ppw={l.periods_per_week} placed={placed} shared={l.shared_group_id}")

# M2 lessons
print("\n=== M2 LESSONS DETAIL ===")
for l in lessons:
    subs = [subject_map.get(str(sid), '?') for sid in l.subject_ids]
    if 'M2' not in subs:
        continue
    facs = [faculty_map.get(str(fid), '?') for fid in l.faculty_ids]
    cls_name = classroom_map.get(str(l.classroom_id), 'FacOnly')
    placed = entry_count.get(str(l.id), 0)
    print(f"  {cls_name}/M2 teacher={','.join(facs)} ppw={l.periods_per_week} placed={placed} shared={l.shared_group_id}")

# Check TOTAL demand on SJ for Thu+Fri
print("\n=== SJ DEMAND vs CAPACITY on Thu+Fri ===")
sj_lessons_we = []
total_we_demand = 0
for l in lessons:
    subs = [subject_map.get(str(sid), '?') for sid in l.subject_ids]
    if 'WE' in subs:
        facs = [faculty_map.get(str(fid), '?') for fid in l.faculty_ids]
        if 'SJ' in facs:
            cls_name = classroom_map.get(str(l.classroom_id), '?')
            total_we_demand += l.periods_per_week
            sj_lessons_we.append((cls_name, l.periods_per_week))
            
print(f"  WE lessons: {sj_lessons_we}")
print(f"  Total WE periods needed: {total_we_demand}")
print(f"  SJ available slots on Thu+Fri: {2 * 7} = 14 (if no sharing)")

# But SJ can only teach one class at a time (unless shared).
# With 6 classes × 2 periods each = 12 WE periods needed
# On Thu+Fri, SJ has 14 slots total, so it FITS in theory.
# But the CLASSES also need free slots on those days.

# Let's check for each class, free slots on Thu+Fri
print("\n=== CLASS FREE SLOTS on Thu+Fri ===")
for c in classrooms:
    free = []
    for day in ['Thursday', 'Friday']:
        for p in range(1, 8):
            if (day, p) not in cls_busy_map[str(c.id)]:
                free.append(f"{day[:3]}/P{p}")
    print(f"  {c.name}: {len(free)} free -> {free}")

db.close()
