"""Faculty service — global CRUD + timetable attach/detach."""
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from uuid import UUID
from app.models.faculty import Faculty
from app.models.timetable_entities import TimetableFaculty
from app.utils.csv_utils import parse_csv_bytes, generate_short_name


# ── Global CRUD ──────────────────────────────────────────────────────────────

def get_global_faculty(user_id: UUID, db: Session):
    """Return all global faculty belonging to this user."""
    return db.query(Faculty).filter(Faculty.owner_id == user_id).order_by(Faculty.full_name).all()

def create_faculty(user_id: UUID, payload_dict: dict, db: Session):
    """Create a new faculty member in the global catalog."""
    f = Faculty(**payload_dict, owner_id=user_id, organization_id=None)
    db.add(f)
    db.commit()
    db.refresh(f)
    return f

def update_faculty(faculty_id: UUID, payload_dict: dict, db: Session):
    """Update a global faculty member."""
    f = db.query(Faculty).filter(Faculty.id == faculty_id).first()
    if not f:
        raise ValueError("Faculty not found")
    for field, value in payload_dict.items():
        setattr(f, field, value)
    db.commit()
    db.refresh(f)
    return f

def delete_faculty(faculty_id: UUID, db: Session):
    """Delete a global faculty member (removes all timetable attachments via cascade)."""
    f = db.query(Faculty).filter(Faculty.id == faculty_id).first()
    if not f:
        raise ValueError("Faculty not found")
    db.delete(f)
    db.commit()


# ── Timetable Attach / Detach ─────────────────────────────────────────────────

def get_timetable_faculty(timetable_id: UUID, db: Session):
    """Return faculty attached to a specific timetable."""
    links = (
        db.query(TimetableFaculty)
        .filter(TimetableFaculty.timetable_id == timetable_id)
        .all()
    )
    return [link.faculty for link in links]

def attach_faculty(timetable_id: UUID, faculty_id: UUID, db: Session):
    """Attach a global faculty member to a timetable."""
    f = db.query(Faculty).filter(Faculty.id == faculty_id).first()
    if not f:
        raise ValueError("Faculty not found")
    link = TimetableFaculty(timetable_id=timetable_id, faculty_id=faculty_id)
    db.add(link)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise ValueError("Faculty is already attached to this timetable")
    return f

def detach_faculty(timetable_id: UUID, faculty_id: UUID, db: Session):
    """Detach a faculty member from a timetable (does not delete globally)."""
    link = (
        db.query(TimetableFaculty)
        .filter(
            TimetableFaculty.timetable_id == timetable_id,
            TimetableFaculty.faculty_id == faculty_id,
        )
        .first()
    )
    if not link:
        raise ValueError("Faculty is not attached to this timetable")
    db.delete(link)
    db.commit()


# ── Bulk Import ───────────────────────────────────────────────────────────────

def bulk_import_faculty(user_id: UUID, content: bytes, db: Session):
    """Import faculty from CSV into the global catalog. Skips duplicates by name."""
    rows = parse_csv_bytes(content)
    created = []
    skipped = []
    for row in rows:
        name = row.get("Name", "").strip()
        if not name:
            continue
        # Deduplicate by full_name + owner
        existing = db.query(Faculty).filter(
            Faculty.full_name == name, Faculty.owner_id == user_id
        ).first()
        if existing:
            skipped.append(name)
            continue
        short_name = row.get("Short Name", "") or generate_short_name(name)
        f = Faculty(
            owner_id=user_id,
            full_name=name,
            short_name=short_name.upper(),
            email=row.get("Email") or None,
            phone=row.get("Phone") or None,
            role=row.get("Role", "Member"),
            designation=row.get("Designation") or None,
            organization_id=None,
        )
        db.add(f)
        created.append(name)
    db.commit()
    return {"imported": len(created), "skipped": len(skipped), "names": created}
