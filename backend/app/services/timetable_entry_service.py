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
