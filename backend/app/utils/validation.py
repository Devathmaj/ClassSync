"""
Validation utilities for timetable configuration.
Checks that all required data is present before generation.
"""
from sqlalchemy.orm import Session
from app.models.timetable import Timetable
from app.models.lesson import Lesson
from app.models.faculty import Faculty
from app.models.classroom import Classroom
from app.models.subject import Subject
from app.models.bell_schedule import BellSchedule
from app.models.constraint import Constraint, ConstraintType
from typing import List, Dict


def validate_timetable_for_generation(timetable_id: str, db: Session) -> Dict:
    """
    Returns a dict with 'passed' bool and list of 'errors'.
    All validations must pass before the generation job can start.
    """
    errors: List[str] = []

    timetable = db.query(Timetable).filter(Timetable.id == timetable_id).first()
    if not timetable:
        return {"passed": False, "errors": ["Timetable not found."]}

    # Bell schedule
    schedule = db.query(BellSchedule).filter(BellSchedule.timetable_id == timetable_id).first()
    if not schedule or not schedule.working_days:
        errors.append("No bell schedule configured.")
    elif not schedule.periods:
        errors.append("No periods defined in bell schedule.")

    from app.models.timetable_entities import TimetableFaculty, TimetableClassroom
    faculty_count = db.query(TimetableFaculty).filter(TimetableFaculty.timetable_id == timetable_id).count()
    classroom_count = db.query(TimetableClassroom).filter(TimetableClassroom.timetable_id == timetable_id).count()
    if faculty_count == 0:
        errors.append("No faculty configured.")
    if classroom_count == 0:
        errors.append("No classes configured.")

    classrooms = [link.classroom for link in db.query(TimetableClassroom).filter(TimetableClassroom.timetable_id == timetable_id).all()]

    # Lessons
    lessons = db.query(Lesson).filter(Lesson.timetable_id == timetable_id).all()
    if not lessons:
        errors.append("No lessons configured.")
    else:
        for lesson in lessons:
            if not lesson.subjects:
                errors.append(f"Lesson {lesson.id} has no subject assigned.")
            if not lesson.faculty:
                errors.append(f"Lesson {lesson.id} has no faculty assigned.")

    if schedule and schedule.working_days and schedule.periods:
        non_break_periods = [p for p in schedule.periods if not p.is_break]
        if getattr(schedule, "period_config_style", "uniform") == "custom_day":
            total_slots = len(non_break_periods)
        else:
            total_slots = len(schedule.working_days) * len(non_break_periods)
            
        from collections import defaultdict
        req_by_class = defaultdict(int)
        for lesson in lessons:
            if lesson.classroom_id:
                req_by_class[lesson.classroom_id] += max(lesson.periods_per_week, 0)
        
        for cls_id, req in req_by_class.items():
            if req > total_slots:
                errors.append(
                    f"A classroom requires {req} periods, exceeding weekly slots ({total_slots})."
                )

    constraints = db.query(Constraint).filter(Constraint.timetable_id == timetable_id).all()
    forward_pairs = set()
    for c in constraints:
        if c.constraint_type != ConstraintType.SUBJECT_SEQUENCE:
            continue
        if not c.subject_a_id or not c.subject_b_id:
            continue
        pair = (c.subject_a_id, c.subject_b_id, c.classroom_id)
        reverse = (c.subject_b_id, c.subject_a_id, c.classroom_id)
        if reverse in forward_pairs:
            errors.append(
                "Circular sequence constraint detected between two subjects in the same scope."
            )
            break
        forward_pairs.add(pair)

    return {"passed": len(errors) == 0, "errors": errors}
