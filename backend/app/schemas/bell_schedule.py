from pydantic import BaseModel
from typing import List, Optional
from uuid import UUID
from datetime import datetime
from app.models.bell_schedule import ScheduleType, PeriodConfigStyle

class PeriodBase(BaseModel):
    name: str
    start_time: str
    end_time: str
    is_break: bool = False
    order: int
    day_of_week: Optional[str] = None

class PeriodCreate(PeriodBase):
    pass

class PeriodOut(PeriodBase):
    id: UUID

    class Config:
        from_attributes = True

class BellScheduleBase(BaseModel):
    schedule_type: ScheduleType
    period_config_style: PeriodConfigStyle
    working_days: List[str]

class BellScheduleCreate(BellScheduleBase):
    periods: List[PeriodCreate]

class BellScheduleOut(BellScheduleBase):
    id: UUID
    timetable_id: UUID
    periods: List[PeriodOut]

    class Config:
        from_attributes = True
