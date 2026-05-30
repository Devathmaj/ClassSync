import uuid
from datetime import datetime
from sqlalchemy import Column, String, ForeignKey, DateTime, Enum as SAEnum, Float, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from app.database import Base
import enum


class JobStatus(str, enum.Enum):
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"


class GenerationJob(Base):
    __tablename__ = "generation_jobs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    timetable_id = Column(UUID(as_uuid=True), ForeignKey("timetables.id"), nullable=False)
    status = Column(SAEnum(JobStatus), default=JobStatus.PENDING)
    celery_task_id = Column(String(255), nullable=True)
    progress = Column(Float, default=0.0)  # 0.0 – 1.0
    score = Column(Float, nullable=True)   # optimization score
    error_message = Column(Text, nullable=True)
    started_at = Column(DateTime, nullable=True)
    completed_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    timetable = relationship("Timetable", back_populates="generation_jobs")
