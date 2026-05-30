from pydantic import BaseModel, EmailStr, Field
from uuid import UUID
from typing import Optional
from datetime import datetime


class FacultyCreate(BaseModel):
    full_name: str = Field(..., min_length=1, max_length=255)
    short_name: str = Field(..., min_length=1, max_length=20)
    email: Optional[EmailStr] = None
    phone: Optional[str] = Field(None, max_length=20)
    designation: Optional[str] = Field(None, max_length=100)
    role: str = "Member"


class FacultyUpdate(BaseModel):
    full_name: Optional[str] = Field(None, max_length=255)
    short_name: Optional[str] = Field(None, max_length=20)
    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    designation: Optional[str] = None
    role: Optional[str] = None


class FacultyOut(BaseModel):
    id: UUID
    full_name: str
    short_name: str
    email: Optional[str]
    phone: Optional[str]
    designation: Optional[str]
    role: str
    availability: int
    created_at: datetime

    class Config:
        from_attributes = True
