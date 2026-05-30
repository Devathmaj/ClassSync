from sqlalchemy.orm import Session
from uuid import UUID
from app.models.lesson import Lesson, LessonFaculty, LessonSubject
from app.schemas.lesson import LessonCreate

def get_lessons(timetable_id: UUID, db: Session):
    return db.query(Lesson).filter(Lesson.timetable_id == timetable_id).all()

def create_lesson(timetable_id: UUID, payload: LessonCreate, db: Session):
    lesson = Lesson(
        timetable_id=timetable_id,
        classroom_id=payload.classroom_id,
        periods_per_week=payload.periods_per_week,
        sequence=payload.sequence,
        double_periods=payload.double_periods,
        is_faculty_only=payload.is_faculty_only,
        split_into_groups=payload.split_into_groups,
    )
    db.add(lesson)
    db.flush()

    for subject_id in payload.subject_ids:
        db.add(LessonSubject(lesson_id=lesson.id, subject_id=subject_id))
    for faculty_id in payload.faculty_ids:
        db.add(LessonFaculty(lesson_id=lesson.id, faculty_id=faculty_id))

    db.commit()
    db.refresh(lesson)
    return lesson

def update_lesson(timetable_id: UUID, lesson_id: UUID, payload_dict: dict, db: Session):
    lesson = db.query(Lesson).filter(
        Lesson.id == lesson_id, Lesson.timetable_id == timetable_id
    ).first()
    if not lesson:
        raise ValueError("Lesson not found")
    
    subject_ids = payload_dict.pop("subject_ids", None)
    faculty_ids = payload_dict.pop("faculty_ids", None)

    for field, value in payload_dict.items():
        setattr(lesson, field, value)

    if subject_ids is not None:
        db.query(LessonSubject).filter(LessonSubject.lesson_id == lesson.id).delete()
        for subject_id in subject_ids:
            db.add(LessonSubject(lesson_id=lesson.id, subject_id=subject_id))

    if faculty_ids is not None:
        db.query(LessonFaculty).filter(LessonFaculty.lesson_id == lesson.id).delete()
        for faculty_id in faculty_ids:
            db.add(LessonFaculty(lesson_id=lesson.id, faculty_id=faculty_id))

    db.commit()
    db.refresh(lesson)
    return lesson

def delete_lesson(timetable_id: UUID, lesson_id: UUID, db: Session):
    lesson = db.query(Lesson).filter(
        Lesson.id == lesson_id, Lesson.timetable_id == timetable_id
    ).first()
    if not lesson:
        raise ValueError("Lesson not found")
    db.delete(lesson)
    db.commit()
