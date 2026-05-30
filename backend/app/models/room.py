import uuid
from datetime import datetime
from sqlalchemy import Column, String, ForeignKey, DateTime, Integer, Boolean
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from app.database import Base


class Room(Base):
    """Shared facility (lab, library, computer room) — globally owned."""
    __tablename__ = "rooms"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    # Global scope: owned by a user (no timetable_id)
    owner_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    organization_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id"), nullable=True)
    name = Column(String(100), nullable=False)
    short_name = Column(String(20), nullable=False)
    building_name = Column(String(100), nullable=True)
    room_group = Column(String(100), nullable=True)
    capacity = Column(Integer, nullable=True)
    display_color = Column(String(7), default="#6366F1")
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    organization = relationship("Organization", back_populates="rooms")
    timetable_links = relationship("TimetableRoom", back_populates="room", cascade="all, delete-orphan")
