from pydantic import BaseModel
from uuid import UUID
from datetime import datetime
from typing import Optional

class TimetableEntryBase(BaseModel):
    lesson_id: UUID
    classroom_id: Optional[UUID] = None
    faculty_id: Optional[UUID] = None
    subject_id: Optional[UUID] = None
    room_id: Optional[UUID] = None
    day_of_week: str
    period_number: int
    week_number: int

class TimetableEntryCreate(TimetableEntryBase):
    pass

class TimetableEntryUpdate(BaseModel):
    day_of_week: Optional[str] = None
    period_number: Optional[int] = None
    week_number: Optional[int] = None

class TimetableEntryOut(TimetableEntryBase):
    id: UUID
    timetable_id: UUID
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
