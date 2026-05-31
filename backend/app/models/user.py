import uuid
from datetime import datetime
from sqlalchemy import Column, String, Boolean, DateTime, Enum as SAEnum
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from app.database import Base
import enum


class PlanType(str, enum.Enum):
    FREE = "free"
    PRO = "pro"
    MAX = "max"


class RoleType(str, enum.Enum):
    ADMIN = "admin"
    INSTITUTION = "institution"
    FACULTY = "faculty"


class User(Base):
    __tablename__ = "users"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    username = Column(String(255), unique=True, nullable=False, index=True)
    email = Column(String(255), nullable=True)
    hashed_password = Column(String(255), nullable=False)
    full_name = Column(String(255), nullable=False)
    role = Column(SAEnum(RoleType), default=RoleType.INSTITUTION, nullable=False)
    must_change_password = Column(Boolean, default=False)
    is_active = Column(Boolean, default=True)
    is_verified = Column(Boolean, default=False)
    plan = Column(SAEnum(PlanType), default=PlanType.FREE)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    organizations = relationship("Organization", back_populates="owner")
    timetables = relationship("Timetable", back_populates="owner")
