from pydantic import BaseModel, EmailStr, Field
from uuid import UUID
from datetime import datetime
from typing import Optional
from app.models.user import PlanType, RoleType


class UserCreate(BaseModel):
    username: str = Field(..., min_length=1, max_length=255)
    email: Optional[str] = None
    password: str = Field(..., min_length=8)
    full_name: str = Field(..., min_length=1, max_length=255)
    role: RoleType = RoleType.INSTITUTION

class UserUpdate(BaseModel):
    username: Optional[str] = Field(None, min_length=1, max_length=255)
    email: Optional[str] = None
    password: Optional[str] = Field(None, min_length=8)
    full_name: Optional[str] = Field(None, min_length=1, max_length=255)


class UserLogin(BaseModel):
    username: str
    password: str


class ChangeCredentials(BaseModel):
    username: str
    new_password: str = Field(..., min_length=8)


class UserOut(BaseModel):
    id: UUID
    username: str
    email: Optional[str] = None
    full_name: str
    role: RoleType
    must_change_password: bool
    plan: PlanType
    is_active: bool
    is_verified: bool
    created_at: datetime

    class Config:
        from_attributes = True


class Token(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    user: UserOut


class TokenRefresh(BaseModel):
    refresh_token: str
