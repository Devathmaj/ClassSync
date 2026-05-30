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
non_break = sorted([p for p in schedule.periods if not p.is_break], key=lambda p: p.order)
period_numbers = [p.order for p in non_break]

classrooms = [link.classroom for link in db.query(TimetableClassroom).filter(TimetableClassroom.timetable_id == tt.id).all()]
classroom_map = {str(c.id): c.name for c in classrooms}
subjects = [link.subject for link in db.query(TimetableSubject).filter(TimetableSubject.timetable_id == tt.id).all()]
subject_map = {str(s.id): s.short_name or s.name for s in subjects}
faculties = [link.faculty for link in db.query(TimetableFaculty).filter(TimetableFaculty.timetable_id == tt.id).all()]
faculty_map = {str(f.id): f.short_name or f.full_name for f in faculties}

entries = db.query(TimetableEntry).filter(TimetableEntry.timetable_id == tt.id).all()
lessons = db.query(Lesson).filter(Lesson.timetable_id == tt.id).all()
constraints = db.query(Constraint).filter(Constraint.timetable_id == tt.id).all()

# Compact grid per class
grid = defaultdict(dict)
for e in entries:
    cls_name = classroom_map.get(str(e.classroom_id), '?')
    sub_name = subject_map.get(str(e.subject_id), '?') if e.subject_id else '?'
    fac_name = faculty_map.get(str(e.faculty_id), '?') if e.faculty_id else '?'
    grid[cls_name][(e.day_of_week, e.period_number)] = (sub_name, fac_name)

print("=== COMPACT GRID (only periods 1-7) ===")
for cls_name in sorted(grid.keys()):
    print(f"\n{cls_name}:")
    for day in schedule.working_days:
        row = []
        for p in period_numbers[:7]:  # only show actual used periods
            cell = grid[cls_name].get((day, p))
            if cell:
                row.append(f"{cell[0]:4s}/{cell[1][:3]}")
            else:
                row.append(f"{'----':>8s}")
        print(f"  {day[:3]}: {' | '.join(row)}")

# WE constraint
print("\n=== WE-RELATED CONSTRAINTS ===")
for c in constraints:
    sa = subject_map.get(str(c.subject_a_id), '') if c.subject_a_id else ''
    if sa == 'WE' or c.constraint_type == 'specific_days_subject':
        sb = subject_map.get(str(c.subject_b_id), '') if c.subject_b_id else ''
        print(f"  {c.constraint_type}: subA={sa}, days={c.days_of_week}, scope={c.scope}")

# SJ (WE teacher) availability check
print("\n=== SJ FREE SLOTS (WE teacher) ===")
sj_busy = set()
for e in entries:
    if faculty_map.get(str(e.faculty_id), '') == 'SJ':
        sj_busy.add((e.day_of_week, e.period_number))

for day in schedule.working_days:
    free = [p for p in period_numbers[:7] if (day, p) not in sj_busy]
    busy = [p for p in period_numbers[:7] if (day, p) in sj_busy]
    print(f"  {day[:3]}: free={free}, busy={busy}")

# SMP (M2 teacher) availability check
print("\n=== SMP FREE SLOTS (M2 teacher for 7th B) ===")
smp_busy = set()
for e in entries:
    if faculty_map.get(str(e.faculty_id), '') == 'SMP':
        smp_busy.add((e.day_of_week, e.period_number))

for day in schedule.working_days:
    free = [p for p in period_numbers[:7] if (day, p) not in smp_busy]
    busy = [p for p in period_numbers[:7] if (day, p) in smp_busy]
    print(f"  {day[:3]}: free={free}, busy={busy}")

# Check each missing lesson in detail
print("\n=== DETAILED ANALYSIS OF EACH MISSING LESSON ===")

entry_count = defaultdict(int)
for e in entries:
    entry_count[str(e.lesson_id)] += 1

for l in lessons:
    placed = entry_count.get(str(l.id), 0)
    expected = l.periods_per_week * 2 if l.double_periods else l.periods_per_week
    if placed >= expected:
        continue
    
    subs = [subject_map.get(str(sid), '?') for sid in l.subject_ids]
    facs = [faculty_map.get(str(fid), '?') for fid in l.faculty_ids]
    cls_name = classroom_map.get(str(l.classroom_id), 'FacOnly') if l.classroom_id else 'FacOnly'
    still_needed = expected - placed
    
    print(f"\n--- {cls_name} / {','.join(subs)} ({','.join(facs)}) needs {still_needed} more slot(s) ---")
    
    # Check every slot to see which are available
    fac_ids = [str(fid) for fid in l.faculty_ids]
    fac_busy = set()
    cls_busy = set()
    for e in entries:
        if str(e.faculty_id) in fac_ids:
            fac_busy.add((e.day_of_week, e.period_number))
        if str(e.classroom_id) == str(l.classroom_id):
            cls_busy.add((e.day_of_week, e.period_number))
    
    # specific days constraint for this subject
    allowed_days = None
    for c in constraints:
        if c.constraint_type == 'specific_days_subject' and c.subject_a_id in l.subject_ids:
            allowed_days = set(c.days_of_week) if c.days_of_week else None

    for day in schedule.working_days:
        for p in period_numbers[:7]:
            reasons = []
            if (day, p) in cls_busy:
                reasons.append("CLASS_BUSY")
            if (day, p) in fac_busy:
                reasons.append("FAC_BUSY")
            if allowed_days and day not in allowed_days:
                reasons.append(f"DAY_RESTRICTED(allowed={allowed_days})")
            
            if not reasons:
                print(f"  ✅ {day[:3]} P{p} - AVAILABLE")
            elif len(reasons) <= 2:
                print(f"  ❌ {day[:3]} P{p} - {', '.join(reasons)}")

db.close()
