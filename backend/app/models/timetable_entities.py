"""Many-to-many join tables linking timetables to globally shared entities."""
import uuid
from sqlalchemy import Column, ForeignKey, UniqueConstraint, DateTime
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from datetime import datetime
from app.database import Base


class TimetableFaculty(Base):
    """Join table: Timetable ↔ Faculty (many-to-many)."""
    __tablename__ = "timetable_faculty"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    timetable_id = Column(UUID(as_uuid=True), ForeignKey("timetables.id", ondelete="CASCADE"), nullable=False)
    faculty_id = Column(UUID(as_uuid=True), ForeignKey("faculty.id", ondelete="CASCADE"), nullable=False)
    attached_at = Column(DateTime, default=datetime.utcnow)

    __table_args__ = (
        UniqueConstraint("timetable_id", "faculty_id", name="uq_timetable_faculty"),
    )

    # Relationships
    timetable = relationship("Timetable", back_populates="faculty_links")
    faculty = relationship("Faculty", back_populates="timetable_links")


class TimetableRoom(Base):
    """Join table: Timetable ↔ Room (many-to-many)."""
    __tablename__ = "timetable_rooms"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    timetable_id = Column(UUID(as_uuid=True), ForeignKey("timetables.id", ondelete="CASCADE"), nullable=False)
    room_id = Column(UUID(as_uuid=True), ForeignKey("rooms.id", ondelete="CASCADE"), nullable=False)
    attached_at = Column(DateTime, default=datetime.utcnow)

    __table_args__ = (
        UniqueConstraint("timetable_id", "room_id", name="uq_timetable_room"),
    )

    # Relationships
    timetable = relationship("Timetable", back_populates="room_links")
    room = relationship("Room", back_populates="timetable_links")


class TimetableSubject(Base):
    """Join table: Timetable ↔ Subject (many-to-many)."""
    __tablename__ = "timetable_subjects"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    timetable_id = Column(UUID(as_uuid=True), ForeignKey("timetables.id", ondelete="CASCADE"), nullable=False)
    subject_id = Column(UUID(as_uuid=True), ForeignKey("subjects.id", ondelete="CASCADE"), nullable=False)
    attached_at = Column(DateTime, default=datetime.utcnow)

    __table_args__ = (
        UniqueConstraint("timetable_id", "subject_id", name="uq_timetable_subject"),
    )

    # Relationships
    timetable = relationship("Timetable", back_populates="subject_links")
    subject = relationship("Subject", back_populates="timetable_links")


class TimetableClassroom(Base):
    """Join table: Timetable ↔ Classroom/Grade/Division (many-to-many)."""
    __tablename__ = "timetable_classrooms"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    timetable_id = Column(UUID(as_uuid=True), ForeignKey("timetables.id", ondelete="CASCADE"), nullable=False)
    classroom_id = Column(UUID(as_uuid=True), ForeignKey("classrooms.id", ondelete="CASCADE"), nullable=False)
    attached_at = Column(DateTime, default=datetime.utcnow)

    __table_args__ = (
        UniqueConstraint("timetable_id", "classroom_id", name="uq_timetable_classroom"),
    )

    # Relationships
    timetable = relationship("Timetable", back_populates="classroom_links")
    classroom = relationship("Classroom", back_populates="timetable_links")
