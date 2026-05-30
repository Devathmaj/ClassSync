from pydantic import BaseModel
from uuid import UUID
from typing import Optional
from datetime import datetime
from app.models.generation_job import JobStatus


class GenerationTrigger(BaseModel):
    """Request body to start a generation run."""
    pass  # No extra params for free plan; Pro settings handled separately


class GenerationJobOut(BaseModel):
    id: UUID
    timetable_id: UUID
    status: JobStatus
    progress: float
    score: Optional[float]
    error_message: Optional[str]
    started_at: Optional[datetime]
    completed_at: Optional[datetime]
    created_at: datetime

    class Config:
        from_attributes = True
