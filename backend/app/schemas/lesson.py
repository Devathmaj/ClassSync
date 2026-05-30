from pydantic import BaseModel, Field
from uuid import UUID
from typing import Optional, List
from datetime import datetime


class LessonCreate(BaseModel):
    classroom_id: Optional[UUID] = None
    subject_ids: List[UUID] = Field(default_factory=list)
    faculty_ids: List[UUID] = Field(default_factory=list)
    room_id: Optional[UUID] = None
    periods_per_week: int = Field(1, ge=0, le=100)
    sequence: int = Field(1, ge=1, le=10)
    double_periods: bool = False
    is_faculty_only: bool = False
    split_into_groups: bool = False
    shared_group_id: Optional[str] = None


class LessonUpdate(BaseModel):
    classroom_id: Optional[UUID] = None
    subject_ids: Optional[List[UUID]] = None
    faculty_ids: Optional[List[UUID]] = None
    room_id: Optional[UUID] = None
    periods_per_week: Optional[int] = Field(None, ge=0, le=100)
    sequence: Optional[int] = Field(None, ge=1, le=10)
    double_periods: Optional[bool] = None
    is_faculty_only: Optional[bool] = None
    shared_group_id: Optional[str] = None


class LessonOut(BaseModel):
    id: UUID
    timetable_id: UUID
    classroom_id: Optional[UUID]
    periods_per_week: int
    sequence: int
    double_periods: bool
    is_faculty_only: bool
    split_into_groups: bool
    shared_group_id: Optional[str]
    created_at: datetime
    updated_at: datetime
    
    # Expose relations
    subject_ids: List[UUID] = Field(default_factory=list)
    faculty_ids: List[UUID] = Field(default_factory=list)

    class Config:
        from_attributes = True
