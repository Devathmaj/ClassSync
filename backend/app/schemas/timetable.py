from pydantic import BaseModel, Field
from uuid import UUID
from datetime import datetime, date
from typing import Optional
from app.models.timetable import TimetableStatus


class TimetableCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    description: Optional[str] = Field(None, max_length=500)
    session_name: Optional[str] = Field(None, max_length=100)
    session_start: Optional[date] = None
    session_end: Optional[date] = None
    institution_id: Optional[str] = None


class TimetableUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    description: Optional[str] = Field(None, max_length=500)
    session_name: Optional[str] = None
    session_start: Optional[date] = None
    session_end: Optional[date] = None


class TimetableOut(BaseModel):
    id: UUID
    name: str
    description: Optional[str]
    status: TimetableStatus
    session_name: Optional[str]
    session_start: Optional[date]
    session_end: Optional[date] = None
    generation_warnings: Optional[list[dict]] = None
    created_at: datetime
    updated_at: datetime
    owner_id: UUID

    class Config:
        from_attributes = True


class TimetableListOut(BaseModel):
    id: UUID
    name: str
    status: TimetableStatus
    session_name: Optional[str] = None
    session_start: Optional[date] = None
    session_end: Optional[date] = None
    created_at: datetime
    updated_at: datetime
    owner_id: UUID

    class Config:
        from_attributes = True
