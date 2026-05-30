"""Classroom service — global CRUD + timetable attach/detach.

'Classrooms', 'Grades', and 'Divisions' are all the same concept in this system.
The UI labels them as 'Grades & Divisions' to help users understand their purpose.
"""
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from uuid import UUID
from app.models.classroom import Classroom
from app.models.timetable_entities import TimetableClassroom
from app.utils.csv_utils import parse_csv_bytes, generate_short_name


# ── Global CRUD ──────────────────────────────────────────────────────────────

def get_global_classrooms(user_id: UUID, db: Session):
    """Return all global classrooms/grades/divisions belonging to this user."""
    return db.query(Classroom).filter(Classroom.owner_id == user_id).order_by(Classroom.name).all()

def create_classroom(user_id: UUID, payload_dict: dict, db: Session):
    """Create a new classroom/grade/division in the global catalog."""
    c = Classroom(**payload_dict, owner_id=user_id, organization_id=None)
    db.add(c)
    db.commit()
    db.refresh(c)
    return c

def update_classroom(classroom_id: UUID, payload_dict: dict, db: Session):
    """Update a global classroom/grade/division."""
    c = db.query(Classroom).filter(Classroom.id == classroom_id).first()
    if not c:
        raise ValueError("Classroom not found")
    for field, value in payload_dict.items():
        setattr(c, field, value)
    db.commit()
    db.refresh(c)
    return c

def delete_classroom(classroom_id: UUID, db: Session):
    """Delete a global classroom (removes all timetable attachments via cascade)."""
    c = db.query(Classroom).filter(Classroom.id == classroom_id).first()
    if not c:
        raise ValueError("Classroom not found")
    db.delete(c)
    db.commit()


# ── Timetable Attach / Detach ─────────────────────────────────────────────────

def get_timetable_classrooms(timetable_id: UUID, db: Session):
    """Return classrooms attached to a specific timetable."""
    links = (
        db.query(TimetableClassroom)
        .filter(TimetableClassroom.timetable_id == timetable_id)
        .all()
    )
    return [link.classroom for link in links]

def attach_classroom(timetable_id: UUID, classroom_id: UUID, db: Session):
    """Attach a global classroom to a timetable."""
    c = db.query(Classroom).filter(Classroom.id == classroom_id).first()
    if not c:
        raise ValueError("Classroom not found")
    link = TimetableClassroom(timetable_id=timetable_id, classroom_id=classroom_id)
    db.add(link)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise ValueError("Classroom is already attached to this timetable")
    return c

def detach_classroom(timetable_id: UUID, classroom_id: UUID, db: Session):
    """Detach a classroom from a timetable (does not delete globally)."""
    link = (
        db.query(TimetableClassroom)
        .filter(
            TimetableClassroom.timetable_id == timetable_id,
            TimetableClassroom.classroom_id == classroom_id,
        )
        .first()
    )
    if not link:
        raise ValueError("Classroom is not attached to this timetable")
    db.delete(link)
    db.commit()


# ── Bulk Import ───────────────────────────────────────────────────────────────

from app.models.faculty import Faculty

def bulk_import_classrooms(user_id: UUID, content: bytes, db: Session):
    """Import classrooms from CSV into the global catalog. Skips duplicates by name."""
    rows = parse_csv_bytes(content)
    count = 0
    skipped = 0
    for row in rows:
        name = row.get("Class Name", "").strip()
        if not name:
            continue
        existing = db.query(Classroom).filter(
            Classroom.name == name, Classroom.owner_id == user_id
        ).first()
        if existing:
            skipped += 1
            continue
        short_name = row.get("Short Name", "") or generate_short_name(name)
        
        teacher_name = row.get("Class Teacher", "").strip()
        teacher_id = None
        if teacher_name:
            teacher = db.query(Faculty).filter(Faculty.name == teacher_name, Faculty.owner_id == user_id).first()
            if teacher:
                teacher_id = teacher.id

        db.add(Classroom(
            name=name,
            short_name=short_name.upper(),
            class_teacher_id=teacher_id,
            owner_id=user_id,
            organization_id=None,
        ))
        count += 1
    db.commit()
    return {"imported": count, "skipped": skipped}
