from sqlalchemy.orm import Session
from uuid import UUID
from app.models.timetable import Timetable, TimetableStatus
from app.models.user import User, RoleType
from app.models.faculty import Faculty
from app.utils.validation import validate_timetable_for_generation

def _resolve_institution_id(current_user: User, db: Session):
    if current_user.role == RoleType.FACULTY:
        faculty = db.query(Faculty).filter(Faculty.user_id == current_user.id).first()
        return faculty.owner_id if faculty else None
    return current_user.id

def get_timetables(current_user: User, db: Session, institution_id: str = None):
    query = db.query(Timetable)
    if current_user.role == RoleType.ADMIN:
        if institution_id:
            query = query.filter(Timetable.owner_id == institution_id)
    else:
        owner_id = _resolve_institution_id(current_user, db)
        if not owner_id:
            return []
        query = query.filter(Timetable.owner_id == owner_id)
    return query.all()

def create_timetable(current_user: User, payload_dict: dict, db: Session):
    if current_user.role == RoleType.FACULTY:
        raise ValueError("Not authorized")
    owner_id = current_user.id
    if current_user.role == RoleType.ADMIN:
        institution_id = payload_dict.pop("institution_id", None)
        if not institution_id:
            raise ValueError("institution_id is required for Admin to create a timetable")
        owner_id = institution_id
    else:
        payload_dict.pop("institution_id", None)

    t = Timetable(**payload_dict, owner_id=owner_id)
    db.add(t)
    db.commit()
    db.refresh(t)
    return t

def _get_timetable_or_raise(timetable_id: UUID, current_user: User, db: Session):
    query = db.query(Timetable).filter(Timetable.id == timetable_id)
    if current_user.role != RoleType.ADMIN:
        owner_id = _resolve_institution_id(current_user, db)
        if not owner_id:
            raise ValueError("Timetable not found")
        query = query.filter(Timetable.owner_id == owner_id)
    t = query.first()
    if not t:
        raise ValueError("Timetable not found")
    return t

def get_timetable(timetable_id: UUID, current_user: User, db: Session):
    return _get_timetable_or_raise(timetable_id, current_user, db)

def update_timetable(timetable_id: UUID, current_user: User, payload_dict: dict, db: Session):
    if current_user.role == RoleType.FACULTY:
        raise ValueError("Not authorized")
    t = _get_timetable_or_raise(timetable_id, current_user, db)
    payload_dict.pop("institution_id", None)
    for field, value in payload_dict.items():
        setattr(t, field, value)
    db.commit()
    db.refresh(t)
    return t

def delete_timetable(timetable_id: UUID, current_user: User, db: Session):
    if current_user.role == RoleType.FACULTY:
        raise ValueError("Not authorized")
    t = _get_timetable_or_raise(timetable_id, current_user, db)
    db.delete(t)
    db.commit()

def validate_timetable(timetable_id: UUID, current_user: User, db: Session):
    _get_timetable_or_raise(timetable_id, current_user, db)
    return validate_timetable_for_generation(str(timetable_id), db)

def publish_timetable(timetable_id: UUID, current_user: User, db: Session):
    if current_user.role == RoleType.FACULTY:
        raise ValueError("Not authorized")
    t = _get_timetable_or_raise(timetable_id, current_user, db)
    t.status = TimetableStatus.PUBLISHED
    db.commit()
    db.refresh(t)
    return t
