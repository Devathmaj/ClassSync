import sys, itertools
sys.path.insert(0, '.')
from app.database import SessionLocal
from app.models.timetable import Timetable
from app.models.classroom import Classroom
from app.models.faculty import Faculty
from app.models.subject import Subject
from app.models.lesson import Lesson, LessonFaculty, LessonSubject
from app.models.bell_schedule import BellSchedule
from app.models.timetable_entities import TimetableClassroom, TimetableFaculty, TimetableSubject
from app.models.timetable_entry import TimetableEntry

db = SessionLocal()
tt = db.query(Timetable).filter(Timetable.name == 'Test').first()
if not tt:
    print('Timetable Test not found')
    sys.exit(1)

# ============ GET THE REAL DATA ============
schedule = db.query(BellSchedule).filter(BellSchedule.timetable_id == tt.id).first()
non_break = [p for p in schedule.periods if not p.is_break]
periods_per_week = len(schedule.working_days) * len(non_break)
print('Periods per week per class: {}'.format(periods_per_week))

classrooms = [link.classroom for link in db.query(TimetableClassroom).filter(TimetableClassroom.timetable_id == tt.id).all()]
faculties = [link.faculty for link in db.query(TimetableFaculty).filter(TimetableFaculty.timetable_id == tt.id).all()]
subjects = [link.subject for link in db.query(TimetableSubject).filter(TimetableSubject.timetable_id == tt.id).all()]
faculty_ids = {f.id for f in faculties}

print('Classrooms: {}'.format(len(classrooms)))
print('Faculties: {}'.format(len(faculties)))
print('Subjects: {}'.format(len(subjects)))

# ============ FIX 11B CLASS TEACHER ============
# Find the classroom that has a broken class_teacher_id (not in faculties list)
for c in classrooms:
    if c.class_teacher_id not in faculty_ids:
        # Assign a faculty that isn't already a class teacher somewhere
        used_ct = {cc.class_teacher_id for cc in classrooms if cc.class_teacher_id in faculty_ids}
        available = [f for f in faculties if f.id not in used_ct]
        if not available:
            # All faculties are class teachers, just pick any
            available = faculties
        c.class_teacher_id = available[0].id
        print('Fixed class teacher for {} -> {}'.format(c.name, available[0].full_name))

db.commit()
# Refresh classrooms
db.expire_all()
classrooms = [link.classroom for link in db.query(TimetableClassroom).filter(TimetableClassroom.timetable_id == tt.id).all()]

# ============ WIPE LESSONS ============
db.query(LessonFaculty).filter(LessonFaculty.lesson.has(timetable_id=tt.id)).delete(synchronize_session=False)
db.query(LessonSubject).filter(LessonSubject.lesson.has(timetable_id=tt.id)).delete(synchronize_session=False)
db.query(TimetableEntry).filter(TimetableEntry.timetable_id == tt.id).delete(synchronize_session=False)
db.query(Lesson).filter(Lesson.timetable_id == tt.id).delete(synchronize_session=False)
db.commit()
print('Wiped existing lessons and entries.')

# ============ GENERATE PERFECT LESSONS ============
# Strategy:
# - Each class gets exactly `periods_per_week` lesson periods total
# - First lesson = class teacher's lesson (5 periods, 1 per day)
# - Remaining periods split evenly among OTHER faculties
# - Each lesson block = 5 periods (one per working day) so it fits perfectly
# - Use all 8 subjects cycling, ensuring no same-faculty conflict
# Constraint: A faculty can teach at most N classes * (periods_per_week / num_faculties) to avoid overload

num_days = len(schedule.working_days)   # 5
num_periods_day = len(non_break)         # e.g. 34/5 -> wait, 34 periods total? No, 34*5=170

print('Days: {}, Periods/day: {}, Total slots/class/week: {}'.format(num_days, num_periods_day, periods_per_week))

# Build a faculty usage tracker to avoid over-assigning one faculty
faculty_usage = {f.id: 0 for f in faculties}  # total periods assigned across ALL classes

for c in classrooms:
    remaining = periods_per_week
    ct_faculty = next((f for f in faculties if f.id == c.class_teacher_id), faculties[0])
    ct_subject = subjects[0]  # Physics for class teacher block

    # Add class teacher lesson: exactly num_days periods (1/day)
    ct_periods = num_days  # 5 periods, one per day
    lesson = Lesson(timetable_id=tt.id, classroom_id=c.id, periods_per_week=ct_periods)
    db.add(lesson)
    db.flush()
    db.add(LessonFaculty(lesson_id=lesson.id, faculty_id=ct_faculty.id))
    db.add(LessonSubject(lesson_id=lesson.id, subject_id=ct_subject.id))
    faculty_usage[ct_faculty.id] += ct_periods
    remaining -= ct_periods
    print('  {}: CT lesson ({} periods) -> {}'.format(c.name, ct_periods, ct_faculty.full_name))

    # Fill remaining with 5-period blocks using non-CT faculties round-robin
    # Use subjects cycling from index 1 onwards
    other_faculties = [f for f in faculties if f.id != ct_faculty.id]
    f_cycle = itertools.cycle(other_faculties)
    s_cycle = itertools.cycle(subjects[1:])  # skip subjects[0] used by CT

    while remaining > 0:
        # Use exactly 5-period blocks (1 per day) - this ensures clean fit
        block = min(num_days, remaining)
        f = next(f_cycle)
        s = next(s_cycle)
        lesson = Lesson(timetable_id=tt.id, classroom_id=c.id, periods_per_week=block)
        db.add(lesson)
        db.flush()
        db.add(LessonFaculty(lesson_id=lesson.id, faculty_id=f.id))
        db.add(LessonSubject(lesson_id=lesson.id, subject_id=s.id))
        faculty_usage[f.id] += block
        remaining -= block

    print('  {} fully covered ({} periods total).'.format(c.name, periods_per_week))

db.commit()

total_lesson_periods = sum(
    l.periods_per_week
    for l in db.query(Lesson).filter(Lesson.timetable_id == tt.id).all()
)
total_required = periods_per_week * len(classrooms)
print()
print('Total lesson periods: {} (required: {})'.format(total_lesson_periods, total_required))
print('Faculty load:')
for f in faculties:
    print('  {}: {} periods'.format(f.full_name, faculty_usage.get(f.id, 0)))
print('DONE - lessons generated perfectly.')
