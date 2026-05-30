from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from typing import List
from uuid import UUID

from app.database import get_db
from app.models.user import User
from app.schemas.timetable_entry import TimetableEntryOut
from app.services import timetable_entry_service
from app.services import timetable_service
from app.utils.auth import get_current_user

router = APIRouter()


@router.get("/{timetable_id}/entries", response_model=List[TimetableEntryOut])
def list_timetable_entries(
    timetable_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    timetable_service.get_timetable(timetable_id, str(current_user.id), db)
    return timetable_entry_service.list_entries(timetable_id, db)
