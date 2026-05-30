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
# The engine uses period_number 1..7 per day (idx from _build_slots)
working_days = schedule.working_days
periods_per_day = 7  # 7 non-break periods per day

classrooms = [link.classroom for link in db.query(TimetableClassroom).filter(TimetableClassroom.timetable_id == tt.id).all()]
classroom_map = {str(c.id): c.name for c in classrooms}
subjects = [link.subject for link in db.query(TimetableSubject).filter(TimetableSubject.timetable_id == tt.id).all()]
subject_map = {str(s.id): s.short_name or s.name for s in subjects}
faculties = [link.faculty for link in db.query(TimetableFaculty).filter(TimetableFaculty.timetable_id == tt.id).all()]
faculty_map = {str(f.id): f.short_name or f.full_name for f in faculties}

entries = db.query(TimetableEntry).filter(TimetableEntry.timetable_id == tt.id).all()
lessons = db.query(Lesson).filter(Lesson.timetable_id == tt.id).all()
constraints = db.query(Constraint).filter(Constraint.timetable_id == tt.id).all()

print(f"Working days: {working_days}")
print(f"Periods per day: {periods_per_day}")
print(f"Total weekly slots per class: {len(working_days) * periods_per_day}")

# Grid
grid = defaultdict(dict)
for e in entries:
    cls_name = classroom_map.get(str(e.classroom_id), '?')
    sub_name = subject_map.get(str(e.subject_id), '?') if e.subject_id else '?'
    fac_name = faculty_map.get(str(e.faculty_id), '?') if e.faculty_id else '?'
    grid[cls_name][(e.day_of_week, e.period_number)] = (sub_name, fac_name)

print("\n=== COMPLETE GRID ===")
for cls_name in sorted(grid.keys()):
    print(f"\n{cls_name}:")
    for day in working_days:
        row = []
        for p in range(1, periods_per_day + 1):
            cell = grid[cls_name].get((day, p))
            if cell:
                row.append(f"{cell[0]:4s}/{cell[1][:3]}")
            else:
                row.append(f"  FREE   ")
        print(f"  {day[:3]}: {'|'.join(row)}")

# SJ (WE teacher) - where is SJ busy/free on Thu/Fri specifically?
print("\n=== SJ (WE teacher) slot map ===")
sj_busy = defaultdict(dict)
for e in entries:
    fac = faculty_map.get(str(e.faculty_id), '')
    if fac == 'SJ':
        cls = classroom_map.get(str(e.classroom_id), '?')
        sub = subject_map.get(str(e.subject_id), '?') if e.subject_id else '?'
        sj_busy[(e.day_of_week, e.period_number)] = f"{cls}/{sub}"

for day in working_days:
    slots_info = []
    for p in range(1, periods_per_day + 1):
        info = sj_busy.get((day, p))
        if info:
            slots_info.append(f"P{p}:BUSY({info})")
        else:
            slots_info.append(f"P{p}:free")
    print(f"  {day[:3]}: {', '.join(slots_info)}")

# SMP (M2 teacher for 7th B)
print("\n=== SMP (M2 teacher for 7th B) slot map ===")
smp_busy = defaultdict(dict)
for e in entries:
    fac = faculty_map.get(str(e.faculty_id), '')
    if fac == 'SMP':
        cls = classroom_map.get(str(e.classroom_id), '?')
        sub = subject_map.get(str(e.subject_id), '?') if e.subject_id else '?'
        smp_busy[(e.day_of_week, e.period_number)] = f"{cls}/{sub}"

for day in working_days:
    slots_info = []
    for p in range(1, periods_per_day + 1):
        info = smp_busy.get((day, p))
        if info:
            slots_info.append(f"P{p}:BUSY({info})")
        else:
            slots_info.append(f"P{p}:free")
    print(f"  {day[:3]}: {', '.join(slots_info)}")

# Unscheduled analysis
print("\n=== UNSCHEDULED LESSONS - FEASIBILITY ===")
entry_count = defaultdict(int)
for e in entries:
    entry_count[str(e.lesson_id)] += 1

# Compute faculty busy and class busy sets
fac_busy_map = defaultdict(set)  # fac_id -> set of (day, period)
cls_busy_map = defaultdict(set)  # cls_id -> set of (day, period)
for e in entries:
    if e.faculty_id:
        fac_busy_map[str(e.faculty_id)].add((e.day_of_week, e.period_number))
    if e.classroom_id:
        cls_busy_map[str(e.classroom_id)].add((e.day_of_week, e.period_number))

# WE constraint
we_allowed_days = None
for c in constraints:
    if c.constraint_type == 'specific_days_subject':
        sa = subject_map.get(str(c.subject_a_id), '')
        if sa == 'WE':
            we_allowed_days = set(c.days_of_week)
            print(f"WE allowed days: {we_allowed_days}")

for l in lessons:
    placed = entry_count.get(str(l.id), 0)
    expected = l.periods_per_week * 2 if l.double_periods else l.periods_per_week
    if placed >= expected:
        continue
    
    subs = [subject_map.get(str(sid), '?') for sid in l.subject_ids]
    facs = [faculty_map.get(str(fid), '?') for fid in l.faculty_ids]
    cls_name = classroom_map.get(str(l.classroom_id), 'FacOnly')
    still_needed = expected - placed
    
    print(f"\n--- {cls_name} / {','.join(subs)} / teacher={','.join(facs)} needs {still_needed} more slot(s) ---")
    
    # What's the specific days constraint for this subject?
    allowed_days = None
    for c in constraints:
        if c.constraint_type == 'specific_days_subject' and c.subject_a_id in l.subject_ids:
            allowed_days = set(c.days_of_week)
    
    available = []
    for day in working_days:
        for p in range(1, periods_per_day + 1):
            reasons = []
            if l.classroom_id and (day, p) in cls_busy_map[str(l.classroom_id)]:
                reasons.append("CLASS_BUSY")
            for fid in l.faculty_ids:
                if (day, p) in fac_busy_map[str(fid)]:
                    reasons.append(f"FAC_BUSY({faculty_map.get(str(fid),'?')})")
            if allowed_days and day not in allowed_days:
                reasons.append(f"DAY_RESTRICTED")
            
            if not reasons:
                available.append(f"{day[:3]}/P{p}")
            # Only print blocked on allowed days to keep output short
            elif allowed_days is None or day in allowed_days:
                pass  # skip printing blocked on allowed days for brevity
    
    print(f"  Available slots: {available}")
    if len(available) >= still_needed:
        print(f"  ✅ CAN be scheduled! {len(available)} slots available, needs {still_needed}")
    else:
        print(f"  ❌ IMPOSSIBLE with current placements. Only {len(available)} slots, needs {still_needed}")

# Shared groups
print("\n=== SHARED GROUPS ===")
groups = defaultdict(list)
for l in lessons:
    if l.shared_group_id:
        subs = [subject_map.get(str(sid), '?') for sid in l.subject_ids]
        facs = [faculty_map.get(str(fid), '?') for fid in l.faculty_ids]
        cls_name = classroom_map.get(str(l.classroom_id), 'FacOnly')
        groups[l.shared_group_id].append(f"{cls_name}/{','.join(subs)}/{','.join(facs)}")

for gid, members in groups.items():
    print(f"  Group {gid[:8]}...: {members}")

db.close()
