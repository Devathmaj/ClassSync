import uuid
from datetime import datetime
from sqlalchemy import Column, String, ForeignKey, DateTime, Integer, Boolean
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from app.database import Base


class Lesson(Base):
    """Assignment of subject(s) to a classroom with faculty and period count."""
    __tablename__ = "lessons"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    timetable_id = Column(UUID(as_uuid=True), ForeignKey("timetables.id"), nullable=False)
    classroom_id = Column(UUID(as_uuid=True), ForeignKey("classrooms.id"), nullable=True)
    periods_per_week = Column(Integer, default=1)
    sequence = Column(Integer, default=1)
    double_periods = Column(Boolean, default=False)  # lab/extended blocks
    is_faculty_only = Column(Boolean, default=False)  # no classroom assigned
    split_into_groups = Column(Boolean, default=False)
    shared_group_id = Column(String(50), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    timetable = relationship("Timetable", back_populates="lessons")
    classroom = relationship("Classroom", back_populates="lessons")
    faculty = relationship("LessonFaculty", back_populates="lesson", cascade="all, delete-orphan")
    subjects = relationship("LessonSubject", back_populates="lesson", cascade="all, delete-orphan")
    entries = relationship("TimetableEntry", back_populates="lesson", cascade="all, delete-orphan")

    @property
    def subject_ids(self):
        return [s.subject_id for s in self.subjects]

    @property
    def faculty_ids(self):
        return [f.faculty_id for f in self.faculty]


class LessonFaculty(Base):
    """Many-to-many: Lesson <-> Faculty."""
    __tablename__ = "lesson_faculty"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    lesson_id = Column(UUID(as_uuid=True), ForeignKey("lessons.id"), nullable=False)
    faculty_id = Column(UUID(as_uuid=True), ForeignKey("faculty.id"), nullable=False)

    # Relationships
    lesson = relationship("Lesson", back_populates="faculty")
    faculty = relationship("Faculty", back_populates="lessons")


class LessonSubject(Base):
    """Many-to-many: Lesson <-> Subject."""
    __tablename__ = "lesson_subjects"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    lesson_id = Column(UUID(as_uuid=True), ForeignKey("lessons.id"), nullable=False)
    subject_id = Column(UUID(as_uuid=True), ForeignKey("subjects.id"), nullable=False)

    # Relationships
    lesson = relationship("Lesson", back_populates="subjects")
    subject = relationship("Subject", back_populates="lessons")
