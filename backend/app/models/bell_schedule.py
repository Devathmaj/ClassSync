import uuid
from datetime import datetime
from sqlalchemy import Column, String, ForeignKey, DateTime, Boolean, Integer, Enum as SAEnum, JSON
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from app.database import Base
import enum

class ScheduleType(str, enum.Enum):
    WEEKLY = "weekly"
    FORTNIGHTLY = "fortnightly"
    CUSTOM_CYCLE = "custom_cycle"
    DAY_ROTATION = "day_rotation"

class PeriodConfigStyle(str, enum.Enum):
    UNIFORM = "uniform"
    CUSTOM_DAY = "custom_day"

class BellSchedule(Base):
    __tablename__ = "bell_schedules"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    timetable_id = Column(UUID(as_uuid=True), ForeignKey("timetables.id", ondelete="CASCADE"), unique=True, nullable=False)
    schedule_type = Column(
        SAEnum(ScheduleType, values_callable=lambda x: [e.value for e in x], native_enum=False),
        default=ScheduleType.WEEKLY,
        nullable=False,
    )
    period_config_style = Column(
        SAEnum(PeriodConfigStyle, values_callable=lambda x: [e.value for e in x], native_enum=False),
        default=PeriodConfigStyle.UNIFORM,
        nullable=False,
    )
    working_days = Column(JSON, nullable=False, default=list)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    timetable = relationship("Timetable", back_populates="bell_schedule")
    periods = relationship("Period", back_populates="bell_schedule", cascade="all, delete-orphan", order_by="Period.order")

class Period(Base):
    __tablename__ = "periods"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    bell_schedule_id = Column(UUID(as_uuid=True), ForeignKey("bell_schedules.id", ondelete="CASCADE"), nullable=False)
    name = Column(String(100), nullable=False)
    start_time = Column(String(8), nullable=False)
    end_time = Column(String(8), nullable=False)
    is_break = Column(Boolean, default=False)
    order = Column(Integer, nullable=False)
    day_of_week = Column(String(20), nullable=True) # Used if PeriodConfigStyle is CUSTOM_DAY

    # Relationships
    bell_schedule = relationship("BellSchedule", back_populates="periods")
