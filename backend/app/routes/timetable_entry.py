from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from typing import List
from uuid import UUID

from app.database import get_db
from app.models.user import User
from app.schemas.timetable_entry import TimetableEntryOut, TimetableEntryCreate, TimetableEntryUpdate
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
    timetable_service.get_timetable(timetable_id, current_user, db)
    return timetable_entry_service.list_entries(timetable_id, db)

@router.post("/{timetable_id}/entries", response_model=TimetableEntryOut)
def create_timetable_entry(
    timetable_id: UUID,
    entry_in: TimetableEntryCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    timetable_service.get_timetable(timetable_id, current_user, db)
    # verify user has edit permissions (get_timetable raises error if faculty and editing not allowed? wait get_timetable just checks access.
    # timetable_service handles permissions in get_timetable if it's not a read operation... actually we should just call get_timetable and let it check, but get_timetable doesn't know it's a write.
    # Wait, timetable_service functions like update_timetable do explicit checks for faculty.
    if current_user.role == "faculty":
        raise ValueError("Not authorized to modify timetables")
    return timetable_entry_service.create_entry(timetable_id, entry_in, db)

@router.put("/{timetable_id}/entries/{entry_id}", response_model=TimetableEntryOut)
def update_timetable_entry(
    timetable_id: UUID,
    entry_id: UUID,
    entry_in: TimetableEntryUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    timetable_service.get_timetable(timetable_id, current_user, db)
    if current_user.role == "faculty":
        raise ValueError("Not authorized to modify timetables")
    return timetable_entry_service.update_entry(entry_id, entry_in, db)

@router.delete("/{timetable_id}/entries/{entry_id}", status_code=204)
def delete_timetable_entry(
    timetable_id: UUID,
    entry_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    timetable_service.get_timetable(timetable_id, current_user, db)
    if current_user.role == "faculty":
        raise ValueError("Not authorized to modify timetables")
    timetable_entry_service.delete_entry(entry_id, db)

