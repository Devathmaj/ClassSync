from pydantic import BaseModel
from uuid import UUID
from datetime import datetime
from typing import Optional


class TimetableEntryOut(BaseModel):
    id: UUID
    timetable_id: UUID
    lesson_id: UUID
    classroom_id: Optional[UUID]
    faculty_id: Optional[UUID]
    subject_id: Optional[UUID]
    room_id: Optional[UUID]
    day_of_week: str
    period_number: int
    week_number: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
