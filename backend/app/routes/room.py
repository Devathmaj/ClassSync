"""Room routes — global CRUD + timetable attach/detach."""
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, status
from sqlalchemy.orm import Session
from typing import List, Optional
from uuid import UUID
from pydantic import BaseModel, Field
from app.database import get_db
from app.models.user import User
from app.utils.auth import get_current_user
from app.services import room_service

router = APIRouter()


class RoomCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    short_name: str = Field(..., min_length=1, max_length=20)
    building_name: Optional[str] = None
    room_group: Optional[str] = None
    capacity: Optional[int] = None
    display_color: str = "#6366F1"


class RoomUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    short_name: Optional[str] = Field(None, min_length=1, max_length=20)
    building_name: Optional[str] = None
    room_group: Optional[str] = None
    capacity: Optional[int] = None
    display_color: Optional[str] = None


class RoomOut(BaseModel):
    id: UUID
    name: str
    short_name: str
    building_name: Optional[str]
    room_group: Optional[str]
    capacity: Optional[int]
    display_color: str

    class Config:
        from_attributes = True


# ── Global CRUD (/rooms) ──────────────────────────────────────────────────────

@router.get("/rooms", response_model=List[RoomOut], tags=["Rooms - Global"])
def list_global_rooms(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """List all rooms in the global catalog for the current user."""
    return room_service.get_global_rooms(current_user.id, db)

@router.post("/rooms", response_model=RoomOut, status_code=status.HTTP_201_CREATED, tags=["Rooms - Global"])
def create_global_room(
    payload: RoomCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Create a new room in the global catalog."""
    return room_service.create_room(current_user.id, payload.dict(), db)

@router.put("/rooms/{room_id}", response_model=RoomOut, tags=["Rooms - Global"])
def update_global_room(
    room_id: UUID,
    payload: RoomUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Update a global room."""
    try:
        return room_service.update_room(room_id, payload.dict(exclude_unset=True), db)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))

@router.delete("/rooms/{room_id}", status_code=status.HTTP_204_NO_CONTENT, tags=["Rooms - Global"])
def delete_global_room(
    room_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Delete a global room."""
    try:
        room_service.delete_room(room_id, db)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))

@router.post("/rooms/bulk-import", tags=["Rooms - Global"])
async def bulk_import_global_rooms(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Bulk import rooms from CSV into the global catalog.
    CSV columns: Room Name, Short Name, Capacity, Room Group Name
    """
    content = await file.read()
    return room_service.bulk_import_rooms(current_user.id, content, db)


# ── Timetable Attach / Detach (/timetables/{id}/rooms) ───────────────────────

@router.get("/timetables/{timetable_id}/rooms", response_model=List[RoomOut], tags=["Rooms - Timetable"])
def list_timetable_rooms(
    timetable_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """List rooms attached to a specific timetable."""
    return room_service.get_timetable_rooms(timetable_id, db)

@router.post("/timetables/{timetable_id}/rooms/{room_id}", response_model=RoomOut, status_code=status.HTTP_201_CREATED, tags=["Rooms - Timetable"])
def attach_room_to_timetable(
    timetable_id: UUID,
    room_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Attach an existing global room to a timetable."""
    try:
        return room_service.attach_room(timetable_id, room_id, db)
    except ValueError as e:
        detail = str(e)
        code = 409 if "already attached" in detail else 404
        raise HTTPException(status_code=code, detail=detail)

@router.delete("/timetables/{timetable_id}/rooms/{room_id}", status_code=status.HTTP_204_NO_CONTENT, tags=["Rooms - Timetable"])
def detach_room_from_timetable(
    timetable_id: UUID,
    room_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Detach a room from a timetable (does not delete the room globally)."""
    try:
        room_service.detach_room(timetable_id, room_id, db)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
