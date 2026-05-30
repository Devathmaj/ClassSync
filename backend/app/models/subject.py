import uuid
from datetime import datetime
from sqlalchemy import Column, String, ForeignKey, DateTime, Integer, Boolean, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from app.database import Base


class Subject(Base):
    """Academic subject or activity (e.g. Math, Sports, Assembly) — globally owned."""
    __tablename__ = "subjects"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    # Global scope: owned by a user (no timetable_id)
    owner_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    organization_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id"), nullable=True)
    name = Column(String(100), nullable=False)
    short_name = Column(String(20), nullable=False)
    description = Column(Text, nullable=True)
    display_color = Column(String(7), default="#8B5CF6")
    availability = Column(Integer, default=1)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    organization = relationship("Organization", back_populates="subjects")
    lessons = relationship("LessonSubject", back_populates="subject")
    timetable_links = relationship("TimetableSubject", back_populates="subject", cascade="all, delete-orphan")
