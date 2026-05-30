"""Room service — global CRUD + timetable attach/detach."""
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from uuid import UUID
from app.models.room import Room
from app.models.timetable_entities import TimetableRoom
from app.utils.csv_utils import parse_csv_bytes, generate_short_name


# ── Global CRUD ──────────────────────────────────────────────────────────────

def get_global_rooms(user_id: UUID, db: Session):
    """Return all global rooms belonging to this user."""
    return db.query(Room).filter(Room.owner_id == user_id).order_by(Room.name).all()

def create_room(user_id: UUID, payload_dict: dict, db: Session):
    """Create a new room in the global catalog."""
    r = Room(**payload_dict, owner_id=user_id, organization_id=None)
    db.add(r)
    db.commit()
    db.refresh(r)
    return r

def update_room(room_id: UUID, payload_dict: dict, db: Session):
    """Update a global room."""
    r = db.query(Room).filter(Room.id == room_id).first()
    if not r:
        raise ValueError("Room not found")
    for field, value in payload_dict.items():
        setattr(r, field, value)
    db.commit()
    db.refresh(r)
    return r

def delete_room(room_id: UUID, db: Session):
    """Delete a global room (removes all timetable attachments via cascade)."""
    r = db.query(Room).filter(Room.id == room_id).first()
    if not r:
        raise ValueError("Room not found")
    db.delete(r)
    db.commit()


# ── Timetable Attach / Detach ─────────────────────────────────────────────────

def get_timetable_rooms(timetable_id: UUID, db: Session):
    """Return rooms attached to a specific timetable."""
    links = (
        db.query(TimetableRoom)
        .filter(TimetableRoom.timetable_id == timetable_id)
        .all()
    )
    return [link.room for link in links]

def attach_room(timetable_id: UUID, room_id: UUID, db: Session):
    """Attach a global room to a timetable."""
    r = db.query(Room).filter(Room.id == room_id).first()
    if not r:
        raise ValueError("Room not found")
    link = TimetableRoom(timetable_id=timetable_id, room_id=room_id)
    db.add(link)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise ValueError("Room is already attached to this timetable")
    return r

def detach_room(timetable_id: UUID, room_id: UUID, db: Session):
    """Detach a room from a timetable (does not delete globally)."""
    link = (
        db.query(TimetableRoom)
        .filter(
            TimetableRoom.timetable_id == timetable_id,
            TimetableRoom.room_id == room_id,
        )
        .first()
    )
    if not link:
        raise ValueError("Room is not attached to this timetable")
    db.delete(link)
    db.commit()


# ── Bulk Import ───────────────────────────────────────────────────────────────

def bulk_import_rooms(user_id: UUID, content: bytes, db: Session):
    """Import rooms from CSV into the global catalog. Skips duplicates by name."""
    rows = parse_csv_bytes(content)
    count = 0
    skipped = 0
    for row in rows:
        name = row.get("Room Name", "").strip()
        if not name:
            continue
        existing = db.query(Room).filter(
            Room.name == name, Room.owner_id == user_id
        ).first()
        if existing:
            skipped += 1
            continue
        short_name = row.get("Short Name", "") or generate_short_name(name)
        db.add(Room(
            name=name,
            short_name=short_name.upper(),
            room_group=row.get("Room Group Name") or None,
            owner_id=user_id,
            organization_id=None,
        ))
        count += 1
    db.commit()
    return {"imported": count, "skipped": skipped}
