import uuid
from datetime import datetime
from sqlalchemy import Column, String, ForeignKey, DateTime, Text, Integer, Boolean
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from app.database import Base


class Faculty(Base):
    __tablename__ = "faculty"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    # Global scope: owned by a user (no timetable_id)
    owner_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    organization_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id"), nullable=True)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)  # linked org user
    full_name = Column(String(255), nullable=False)
    short_name = Column(String(20), nullable=False)
    email = Column(String(255), nullable=True)
    phone = Column(String(20), nullable=True)
    designation = Column(String(100), nullable=True)
    role = Column(String(50), default="Member")
    availability = Column(Integer, default=1)  # number of simultaneous slots
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    organization = relationship("Organization", back_populates="faculty")
    lessons = relationship("LessonFaculty", back_populates="faculty")
    timetable_links = relationship("TimetableFaculty", back_populates="faculty", cascade="all, delete-orphan")
