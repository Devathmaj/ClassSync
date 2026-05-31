from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from uuid import UUID
from app.database import get_db
from app.schemas.bell_schedule import BellScheduleCreate, BellScheduleOut
from app.services import bell_schedule_service
from app.utils.auth import get_current_user
from app.models.user import User, RoleType
from app.services import timetable_service

router = APIRouter(prefix="/timetables/{timetable_id}/bell-schedule", tags=["bell-schedule"])

def verify_ownership(timetable_id: UUID, current_user: User, db: Session):
    try:
        t = timetable_service.get_timetable(timetable_id, current_user, db)
        return t
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))

@router.get("", response_model=BellScheduleOut)
def get_bell_schedule(timetable_id: UUID, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    verify_ownership(timetable_id, current_user, db)
    bs = bell_schedule_service.get_bell_schedule(timetable_id, db)
    if not bs:
        raise HTTPException(status_code=404, detail="Bell schedule not configured yet")
    return bs

@router.put("", response_model=BellScheduleOut)
def save_bell_schedule(timetable_id: UUID, payload: BellScheduleCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    verify_ownership(timetable_id, current_user, db)
    if current_user.role == RoleType.FACULTY:
        raise HTTPException(status_code=403, detail="Not authorized")
    return bell_schedule_service.save_bell_schedule(timetable_id, payload, db)


@router.delete("", status_code=status.HTTP_204_NO_CONTENT)
def delete_bell_schedule(timetable_id: UUID, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    verify_ownership(timetable_id, current_user, db)
    if current_user.role == RoleType.FACULTY:
        raise HTTPException(status_code=403, detail="Not authorized")
    try:
        bell_schedule_service.delete_bell_schedule(timetable_id, db)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
