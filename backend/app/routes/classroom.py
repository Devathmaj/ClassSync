"""Classroom / Grade / Division routes — global CRUD + timetable attach/detach.

'Classrooms', 'Grades', and 'Divisions' are all the same entity.
The UI labels them as 'Grades & Divisions' to help users understand their purpose.
"""
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, status
from typing import List, Optional
from uuid import UUID
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.user import User, RoleType
from app.utils.auth import get_current_user
from app.services import classroom_service

router = APIRouter()


class ClassroomCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    short_name: str = Field(..., min_length=1, max_length=20)
    class_teacher_id: Optional[UUID] = None
    student_count: Optional[int] = None
    display_color: str = "#3B82F6"


class ClassroomUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    short_name: Optional[str] = Field(None, min_length=1, max_length=20)
    class_teacher_id: Optional[UUID] = None
    student_count: Optional[int] = None
    display_color: Optional[str] = None


class ClassroomOut(BaseModel):
    id: UUID
    name: str
    short_name: str
    class_teacher_id: Optional[UUID]
    student_count: Optional[int]
    display_color: str
    availability: int

    class Config:
        from_attributes = True


# ── Global CRUD (/classrooms) ─────────────────────────────────────────────────

@router.get("/classrooms", response_model=List[ClassroomOut], tags=["Classrooms - Global"])
def list_global_classrooms(
    institution_id: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """List all classrooms/grades/divisions in the global catalog."""
    return classroom_service.get_global_classrooms(current_user, db, institution_id)

@router.post("/classrooms", response_model=ClassroomOut, status_code=status.HTTP_201_CREATED, tags=["Classrooms - Global"])
def create_global_classroom(
    payload: ClassroomCreate,
    institution_id: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Create a new classroom/grade/division in the global catalog."""
    if current_user.role == RoleType.FACULTY:
        raise HTTPException(status_code=403, detail="Not authorized")
    target_owner = institution_id if (current_user.role == RoleType.ADMIN and institution_id) else current_user.id
    return classroom_service.create_classroom(target_owner, payload.dict(), db)

@router.put("/classrooms/{classroom_id}", response_model=ClassroomOut, tags=["Classrooms - Global"])
def update_global_classroom(
    classroom_id: UUID,
    payload: ClassroomUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Update a global classroom/grade/division."""
    if current_user.role == RoleType.FACULTY:
        raise HTTPException(status_code=403, detail="Not authorized")
    try:
        return classroom_service.update_classroom(classroom_id, payload.dict(exclude_unset=True), db)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))

@router.delete("/classrooms/{classroom_id}", status_code=status.HTTP_204_NO_CONTENT, tags=["Classrooms - Global"])
def delete_global_classroom(
    classroom_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Delete a global classroom/grade/division."""
    if current_user.role == RoleType.FACULTY:
        raise HTTPException(status_code=403, detail="Not authorized")
    try:
        classroom_service.delete_classroom(classroom_id, db)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))

@router.post("/classrooms/bulk-import", tags=["Classrooms - Global"])
async def bulk_import_global_classrooms(
    file: UploadFile = File(...),
    institution_id: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Bulk import classrooms from CSV into the global catalog.
    CSV columns: Class Name, Short Name, Student Count
    """
    if current_user.role == RoleType.FACULTY:
        raise HTTPException(status_code=403, detail="Not authorized")
    target_owner = institution_id if (current_user.role == RoleType.ADMIN and institution_id) else current_user.id
    content = await file.read()
    return classroom_service.bulk_import_classrooms(target_owner, content, db)


# ── Timetable Attach / Detach (/timetables/{id}/classrooms) ──────────────────

@router.get("/timetables/{timetable_id}/classrooms", response_model=List[ClassroomOut], tags=["Classrooms - Timetable"])
def list_timetable_classrooms(
    timetable_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """List classrooms/grades/divisions attached to a specific timetable."""
    return classroom_service.get_timetable_classrooms(timetable_id, db)

@router.post("/timetables/{timetable_id}/classrooms/{classroom_id}", response_model=ClassroomOut, status_code=status.HTTP_201_CREATED, tags=["Classrooms - Timetable"])
def attach_classroom_to_timetable(
    timetable_id: UUID,
    classroom_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Attach an existing global classroom/grade/division to a timetable."""
    if current_user.role == RoleType.FACULTY:
        raise HTTPException(status_code=403, detail="Not authorized")
    try:
        return classroom_service.attach_classroom(timetable_id, classroom_id, db)
    except ValueError as e:
        detail = str(e)
        code = 409 if "already attached" in detail else 404
        raise HTTPException(status_code=code, detail=detail)

@router.delete("/timetables/{timetable_id}/classrooms/{classroom_id}", status_code=status.HTTP_204_NO_CONTENT, tags=["Classrooms - Timetable"])
def detach_classroom_from_timetable(
    timetable_id: UUID,
    classroom_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Detach a classroom from a timetable (does not delete the classroom globally)."""
    if current_user.role == RoleType.FACULTY:
        raise HTTPException(status_code=403, detail="Not authorized")
    try:
        classroom_service.detach_classroom(timetable_id, classroom_id, db)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
