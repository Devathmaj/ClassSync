from sqlalchemy.orm import Session
from uuid import UUID
from app.models.timetable import Timetable, TimetableStatus
from app.utils.validation import validate_timetable_for_generation

def get_timetables(user_id: str, db: Session):
    return db.query(Timetable).filter(Timetable.owner_id == user_id).all()

def create_timetable(user_id: str, payload_dict: dict, db: Session):
    t = Timetable(**payload_dict, owner_id=user_id)
    db.add(t)
    db.commit()
    db.refresh(t)
    return t

def _get_timetable_or_raise(timetable_id: UUID, user_id: str, db: Session):
    t = db.query(Timetable).filter(
        Timetable.id == timetable_id,
        Timetable.owner_id == user_id
    ).first()
    if not t:
        raise ValueError("Timetable not found")
    return t

def get_timetable(timetable_id: UUID, user_id: str, db: Session):
    return _get_timetable_or_raise(timetable_id, user_id, db)

def update_timetable(timetable_id: UUID, user_id: str, payload_dict: dict, db: Session):
    t = _get_timetable_or_raise(timetable_id, user_id, db)
    for field, value in payload_dict.items():
        setattr(t, field, value)
    db.commit()
    db.refresh(t)
    return t

def delete_timetable(timetable_id: UUID, user_id: str, db: Session):
    t = _get_timetable_or_raise(timetable_id, user_id, db)
    db.delete(t)
    db.commit()

def validate_timetable(timetable_id: UUID, user_id: str, db: Session):
    _get_timetable_or_raise(timetable_id, user_id, db)
    return validate_timetable_for_generation(str(timetable_id), db)

def publish_timetable(timetable_id: UUID, user_id: str, db: Session):
    t = _get_timetable_or_raise(timetable_id, user_id, db)
    t.status = TimetableStatus.PUBLISHED
    db.commit()
    db.refresh(t)
    return t
