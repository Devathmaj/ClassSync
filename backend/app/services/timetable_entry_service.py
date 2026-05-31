from sqlalchemy.orm import Session
from uuid import UUID

from app.models.timetable_entry import TimetableEntry


def list_entries(timetable_id: UUID, db: Session):
    return (
        db.query(TimetableEntry)
        .filter(TimetableEntry.timetable_id == timetable_id)
        .order_by(
            TimetableEntry.week_number.asc(),
            TimetableEntry.day_of_week.asc(),
            TimetableEntry.period_number.asc(),
        )
        .all()
    )

def create_entry(timetable_id: UUID, entry_in, db: Session):
    entry = TimetableEntry(
        timetable_id=timetable_id,
        lesson_id=entry_in.lesson_id,
        classroom_id=entry_in.classroom_id,
        faculty_id=entry_in.faculty_id,
        subject_id=entry_in.subject_id,
        room_id=entry_in.room_id,
        day_of_week=entry_in.day_of_week,
        period_number=entry_in.period_number,
        week_number=entry_in.week_number,
    )
    db.add(entry)
    db.commit()
    db.refresh(entry)
    return entry

def update_entry(entry_id: UUID, entry_in, db: Session):
    entry = db.query(TimetableEntry).filter(TimetableEntry.id == entry_id).first()
    if not entry:
        raise ValueError("Entry not found")
    
    update_data = entry_in.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(entry, key, value)
        
    db.commit()
    db.refresh(entry)
    return entry

def delete_entry(entry_id: UUID, db: Session):
    entry = db.query(TimetableEntry).filter(TimetableEntry.id == entry_id).first()
    if not entry:
        raise ValueError("Entry not found")
    db.delete(entry)
    db.commit()

