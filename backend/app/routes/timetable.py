from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Optional
from uuid import UUID
from app.database import get_db
from app.models.user import User, RoleType
from app.schemas.timetable import TimetableCreate, TimetableUpdate, TimetableOut, TimetableListOut
from app.utils.auth import get_current_user
from app.services import timetable_service

router = APIRouter()

@router.get("", response_model=List[TimetableListOut])
def list_timetables(
    institution_id: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return timetable_service.get_timetables(current_user, db, institution_id)

@router.post("", response_model=TimetableOut, status_code=status.HTTP_201_CREATED)
def create_timetable(
    payload: TimetableCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if current_user.role == RoleType.FACULTY:
        raise HTTPException(status_code=403, detail="Not authorized")
    return timetable_service.create_timetable(current_user, payload.dict(), db)

@router.get("/{timetable_id}", response_model=TimetableOut)
def get_timetable(
    timetable_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    try:
        return timetable_service.get_timetable(timetable_id, current_user, db)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))

@router.patch("/{timetable_id}", response_model=TimetableOut)
def update_timetable(
    timetable_id: UUID,
    payload: TimetableUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if current_user.role == RoleType.FACULTY:
        raise HTTPException(status_code=403, detail="Not authorized")
    try:
        return timetable_service.update_timetable(timetable_id, current_user, payload.dict(exclude_unset=True), db)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.put("/{timetable_id}", response_model=TimetableOut)
def replace_timetable(
    timetable_id: UUID,
    payload: TimetableUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if current_user.role == RoleType.FACULTY:
        raise HTTPException(status_code=403, detail="Not authorized")
    try:
        return timetable_service.update_timetable(timetable_id, current_user, payload.dict(exclude_unset=True), db)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))

@router.delete("/{timetable_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_timetable(
    timetable_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if current_user.role == RoleType.FACULTY:
        raise HTTPException(status_code=403, detail="Not authorized")
    try:
        timetable_service.delete_timetable(timetable_id, current_user, db)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))

@router.get("/{timetable_id}/validate")
def validate_timetable(
    timetable_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Run pre-generation validation checks."""
    try:
        return timetable_service.validate_timetable(timetable_id, current_user, db)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))

@router.post("/{timetable_id}/publish", response_model=TimetableOut)
def publish_timetable(
    timetable_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if current_user.role == RoleType.FACULTY:
        raise HTTPException(status_code=403, detail="Not authorized")
    try:
        return timetable_service.publish_timetable(timetable_id, current_user, db)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
