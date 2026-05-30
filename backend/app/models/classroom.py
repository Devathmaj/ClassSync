import uuid
from datetime import datetime
from sqlalchemy import Column, String, ForeignKey, DateTime, Integer, Boolean, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from app.database import Base


class Classroom(Base):
    """Grade / Division (e.g., '10th Grade A') — globally owned.
    
    Represents a student group. 'Grade' and 'Division' are the same concept;
    the label used in the UI depends on context (e.g., 'Grade A' vs 'Division A').
    """
    __tablename__ = "classrooms"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    # Global scope: owned by a user (no timetable_id)
    owner_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    organization_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id"), nullable=True)
    name = Column(String(100), nullable=False)
    short_name = Column(String(20), nullable=False)
    class_teacher_id = Column(UUID(as_uuid=True), ForeignKey("faculty.id"), nullable=True)
    student_count = Column(Integer, nullable=True)
    display_color = Column(String(7), default="#3B82F6")
    availability = Column(Integer, default=1)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    organization = relationship("Organization", back_populates="classrooms")
    class_teacher = relationship("Faculty", foreign_keys=[class_teacher_id])
    lessons = relationship("Lesson", back_populates="classroom")
    timetable_links = relationship("TimetableClassroom", back_populates="classroom", cascade="all, delete-orphan")
