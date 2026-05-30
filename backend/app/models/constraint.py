import uuid
from datetime import datetime
from sqlalchemy import Column, String, ForeignKey, DateTime, Enum as SAEnum, Text, JSON
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from app.database import Base
import enum


class ConstraintType(str, enum.Enum):
    SUBJECT_SEQUENCE = "subject_sequence"   # A must follow B
    SAME_DAY_EXCLUSION = "same_day_exclusion"  # A and B not on same day
    FACULTY_CONSTRAINT = "faculty_constraint"
    ROOM_CONSTRAINT = "room_constraint"
    FIRST_PERIOD_CLASS_TEACHER = "first_period_class_teacher"
    SPECIFIC_DAYS_SUBJECT = "specific_days_subject"


class ConstraintScope(str, enum.Enum):
    INSTITUTE = "institute"
    CLASS = "class"


class Constraint(Base):
    __tablename__ = "constraints"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    timetable_id = Column(UUID(as_uuid=True), ForeignKey("timetables.id"), nullable=False)
    constraint_type = Column(String(100), nullable=False)
    scope = Column(String(50), default="institute")
    subject_a_id = Column(UUID(as_uuid=True), ForeignKey("subjects.id"), nullable=True)
    subject_b_id = Column(UUID(as_uuid=True), ForeignKey("subjects.id"), nullable=True)
    classroom_id = Column(UUID(as_uuid=True), ForeignKey("classrooms.id"), nullable=True)
    description = Column(Text, nullable=True)
    days_of_week = Column(JSON, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    timetable = relationship("Timetable", back_populates="constraints")
