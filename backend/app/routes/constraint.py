from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from uuid import UUID
from pydantic import BaseModel
from typing import Optional
from app.database import get_db
from app.models.user import User, RoleType
from app.models.constraint import ConstraintType, ConstraintScope
from app.utils.auth import get_current_user
from app.services import constraint_service

router = APIRouter()

class ConstraintCreate(BaseModel):
    constraint_type: ConstraintType
    scope: ConstraintScope = ConstraintScope.INSTITUTE
    subject_a_id: Optional[UUID] = None
    subject_b_id: Optional[UUID] = None
    classroom_id: Optional[UUID] = None
    description: Optional[str] = None
    days_of_week: Optional[List[str]] = None

class ConstraintUpdate(BaseModel):
    constraint_type: Optional[ConstraintType] = None
    scope: Optional[ConstraintScope] = None
    subject_a_id: Optional[UUID] = None
    subject_b_id: Optional[UUID] = None
    classroom_id: Optional[UUID] = None
    description: Optional[str] = None
    days_of_week: Optional[List[str]] = None

class ConstraintOut(BaseModel):
    id: UUID
    constraint_type: ConstraintType
    scope: ConstraintScope
    subject_a_id: Optional[UUID]
    subject_b_id: Optional[UUID]
    classroom_id: Optional[UUID]
    description: Optional[str]
    days_of_week: Optional[List[str]]

    class Config:
        from_attributes = True

@router.get("/{timetable_id}/constraints", response_model=List[ConstraintOut])
def list_constraints(
    timetable_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return constraint_service.get_constraints(timetable_id, db)

@router.post("/{timetable_id}/constraints", response_model=ConstraintOut, status_code=status.HTTP_201_CREATED)
def create_constraint(
    timetable_id: UUID,
    payload: ConstraintCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if current_user.role == RoleType.FACULTY:
        raise HTTPException(status_code=403, detail="Not authorized")
    return constraint_service.create_constraint(timetable_id, payload.dict(), db)


@router.put("/{timetable_id}/constraints/{constraint_id}", response_model=ConstraintOut)
def update_constraint(
    timetable_id: UUID,
    constraint_id: UUID,
    payload: ConstraintUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if current_user.role == RoleType.FACULTY:
        raise HTTPException(status_code=403, detail="Not authorized")
    try:
        return constraint_service.update_constraint(timetable_id, constraint_id, payload.dict(exclude_unset=True), db)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))

@router.delete("/{timetable_id}/constraints/{constraint_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_constraint(
    timetable_id: UUID,
    constraint_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if current_user.role == RoleType.FACULTY:
        raise HTTPException(status_code=403, detail="Not authorized")
    try:
        constraint_service.delete_constraint(timetable_id, constraint_id, db)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
