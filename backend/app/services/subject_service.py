"""Subject service — global CRUD + timetable attach/detach.

Subjects and Activities are the same entity; the distinction is user-facing labeling only.
"""
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from uuid import UUID
from app.models.subject import Subject
from app.models.timetable_entities import TimetableSubject
from app.utils.csv_utils import parse_csv_bytes, generate_short_name


# ── Global CRUD ──────────────────────────────────────────────────────────────

def get_global_subjects(user_id: UUID, db: Session):
    """Return all global subjects/activities belonging to this user."""
    return db.query(Subject).filter(Subject.owner_id == user_id).order_by(Subject.name).all()

def create_subject(user_id: UUID, payload_dict: dict, db: Session):
    """Create a new subject/activity in the global catalog."""
    s = Subject(**payload_dict, owner_id=user_id, organization_id=None)
    db.add(s)
    db.commit()
    db.refresh(s)
    return s

def update_subject(subject_id: UUID, payload_dict: dict, db: Session):
    """Update a global subject/activity."""
    s = db.query(Subject).filter(Subject.id == subject_id).first()
    if not s:
        raise ValueError("Subject not found")
    for field, value in payload_dict.items():
        setattr(s, field, value)
    db.commit()
    db.refresh(s)
    return s

def delete_subject(subject_id: UUID, db: Session):
    """Delete a global subject (removes all timetable attachments via cascade)."""
    s = db.query(Subject).filter(Subject.id == subject_id).first()
    if not s:
        raise ValueError("Subject not found")
    db.delete(s)
    db.commit()


# ── Timetable Attach / Detach ─────────────────────────────────────────────────

def get_timetable_subjects(timetable_id: UUID, db: Session):
    """Return subjects attached to a specific timetable."""
    links = (
        db.query(TimetableSubject)
        .filter(TimetableSubject.timetable_id == timetable_id)
        .all()
    )
    return [link.subject for link in links]

def attach_subject(timetable_id: UUID, subject_id: UUID, db: Session):
    """Attach a global subject to a timetable."""
    s = db.query(Subject).filter(Subject.id == subject_id).first()
    if not s:
        raise ValueError("Subject not found")
    link = TimetableSubject(timetable_id=timetable_id, subject_id=subject_id)
    db.add(link)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise ValueError("Subject is already attached to this timetable")
    return s

def detach_subject(timetable_id: UUID, subject_id: UUID, db: Session):
    """Detach a subject from a timetable (does not delete globally)."""
    link = (
        db.query(TimetableSubject)
        .filter(
            TimetableSubject.timetable_id == timetable_id,
            TimetableSubject.subject_id == subject_id,
        )
        .first()
    )
    if not link:
        raise ValueError("Subject is not attached to this timetable")
    db.delete(link)
    db.commit()


# ── Bulk Import ───────────────────────────────────────────────────────────────

def bulk_import_subjects(user_id: UUID, content: bytes, db: Session):
    """Import subjects from CSV into the global catalog. Skips duplicates by name."""
    rows = parse_csv_bytes(content)
    count = 0
    skipped = 0
    for row in rows:
        name = row.get("Subject Name", "").strip()
        if not name:
            continue
        existing = db.query(Subject).filter(
            Subject.name == name, Subject.owner_id == user_id
        ).first()
        if existing:
            skipped += 1
            continue
        short_name = row.get("Short Name", "") or generate_short_name(name)
        db.add(Subject(
            name=name,
            short_name=short_name.upper(),
            owner_id=user_id,
            organization_id=None,
        ))
        count += 1
    db.commit()
    return {"imported": count, "skipped": skipped}
