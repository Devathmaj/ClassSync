from sqlalchemy.orm import Session
from uuid import UUID
from app.models.bell_schedule import BellSchedule, Period
from app.schemas.bell_schedule import BellScheduleCreate
from app.utils.time_utils import normalize_time

def get_bell_schedule(timetable_id: UUID, db: Session):
    return db.query(BellSchedule).filter(BellSchedule.timetable_id == timetable_id).first()

def save_bell_schedule(timetable_id: UUID, payload: BellScheduleCreate, db: Session):
    existing = get_bell_schedule(timetable_id, db)
    
    if existing:
        existing.schedule_type = payload.schedule_type
        existing.period_config_style = payload.period_config_style
        existing.working_days = list(payload.working_days)
        
        db.query(Period).filter(Period.bell_schedule_id == existing.id).delete(synchronize_session=False)
        bs = existing
    else:
        bs = BellSchedule(
            timetable_id=timetable_id,
            schedule_type=payload.schedule_type,
            period_config_style=payload.period_config_style,
            working_days=list(payload.working_days),
        )
        db.add(bs)
        db.flush()

    for p in payload.periods:
        db.add(Period(
            bell_schedule_id=bs.id,
            name=p.name,
            start_time=normalize_time(p.start_time),
            end_time=normalize_time(p.end_time),
            is_break=p.is_break,
            order=p.order,
            day_of_week=p.day_of_week
        ))

    db.commit()
    db.refresh(bs)
    return bs


def delete_bell_schedule(timetable_id: UUID, db: Session):
    existing = get_bell_schedule(timetable_id, db)
    if not existing:
        raise ValueError("Bell schedule not found")
    db.delete(existing)
    db.commit()
