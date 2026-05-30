import uuid
from datetime import datetime
from sqlalchemy import Column, String, ForeignKey, DateTime, Text, Enum as SAEnum, Boolean, Date
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from app.database import Base
import enum
from sqlalchemy.types import JSON


class TimetableStatus(str, enum.Enum):
    DRAFT = "draft"
    PUBLISHED = "published"
    ARCHIVED = "archived"


class Timetable(Base):
    __tablename__ = "timetables"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(100), nullable=False)
    description = Column(Text, nullable=True)
    status = Column(SAEnum(TimetableStatus), default=TimetableStatus.DRAFT)
    owner_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    organization_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id"), nullable=True)

    # Academic Session
    session_name = Column(String(100), nullable=True)
    session_start = Column(Date, nullable=True)
    session_end = Column(Date, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    generation_warnings = Column(JSON, nullable=True)

    # Timetable-local relationships (cascade delete)
    owner = relationship("User", back_populates="timetables")
    organization = relationship("Organization", back_populates="timetables")
    bell_schedule = relationship("BellSchedule", back_populates="timetable", uselist=False, cascade="all, delete-orphan")
    lessons = relationship("Lesson", back_populates="timetable", cascade="all, delete-orphan")
    entries = relationship("TimetableEntry", back_populates="timetable", cascade="all, delete-orphan")
    generation_jobs = relationship("GenerationJob", back_populates="timetable")
    constraints = relationship("Constraint", back_populates="timetable", cascade="all, delete-orphan")

    # Global entity attachment relationships (join tables)
    faculty_links = relationship("TimetableFaculty", back_populates="timetable", cascade="all, delete-orphan")
    room_links = relationship("TimetableRoom", back_populates="timetable", cascade="all, delete-orphan")
    subject_links = relationship("TimetableSubject", back_populates="timetable", cascade="all, delete-orphan")
    classroom_links = relationship("TimetableClassroom", back_populates="timetable", cascade="all, delete-orphan")

    # Convenience accessors for attached global entities
    @property
    def faculty(self):
        return [link.faculty for link in self.faculty_links]

    @property
    def rooms(self):
        return [link.room for link in self.room_links]

    @property
    def subjects(self):
        return [link.subject for link in self.subject_links]

    @property
    def classrooms(self):
        return [link.classroom for link in self.classroom_links]
