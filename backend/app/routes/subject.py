"""Subject/Activity routes — global CRUD + timetable attach/detach.

Subjects and Activities are the same entity; the UI label is user-facing only.
"""
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, status
from sqlalchemy.orm import Session
from typing import List, Optional
from uuid import UUID
from pydantic import BaseModel, Field
from app.database import get_db
from app.models.user import User, RoleType
from app.utils.auth import get_current_user
from app.services import subject_service

router = APIRouter()


class SubjectCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    short_name: str = Field(..., min_length=1, max_length=20)
    description: Optional[str] = Field(None, max_length=500)
    display_color: str = "#8B5CF6"


class SubjectUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    short_name: Optional[str] = Field(None, min_length=1, max_length=20)
    description: Optional[str] = Field(None, max_length=500)
    display_color: Optional[str] = None


class SubjectOut(BaseModel):
    id: UUID
    name: str
    short_name: str
    description: Optional[str]
    display_color: str
    availability: int

    class Config:
        from_attributes = True


# ── Global CRUD (/subjects) ───────────────────────────────────────────────────

@router.get("/subjects", response_model=List[SubjectOut], tags=["Subjects - Global"])
def list_global_subjects(
    institution_id: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """List all subjects in the global catalog."""
    return subject_service.get_global_subjects(current_user, db, institution_id)

@router.post("/subjects", response_model=SubjectOut, status_code=status.HTTP_201_CREATED, tags=["Subjects - Global"])
def create_global_subject(
    payload: SubjectCreate,
    institution_id: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Create a new subject/activity in the global catalog."""
    if current_user.role == RoleType.FACULTY:
        raise HTTPException(status_code=403, detail="Not authorized")
    target_owner = institution_id if (current_user.role == RoleType.ADMIN and institution_id) else current_user.id
    return subject_service.create_subject(target_owner, payload.dict(), db)

@router.put("/subjects/{subject_id}", response_model=SubjectOut, tags=["Subjects - Global"])
def update_global_subject(
    subject_id: UUID,
    payload: SubjectUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Update a global subject/activity."""
    if current_user.role == RoleType.FACULTY:
        raise HTTPException(status_code=403, detail="Not authorized")
    try:
        return subject_service.update_subject(subject_id, payload.dict(exclude_unset=True), db)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))

@router.delete("/subjects/{subject_id}", status_code=status.HTTP_204_NO_CONTENT, tags=["Subjects - Global"])
def delete_global_subject(
    subject_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Delete a global subject/activity."""
    if current_user.role == RoleType.FACULTY:
        raise HTTPException(status_code=403, detail="Not authorized")
    try:
        subject_service.delete_subject(subject_id, db)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))

@router.post("/subjects/bulk-import", tags=["Subjects - Global"])
async def bulk_import_global_subjects(
    file: UploadFile = File(...),
    institution_id: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Bulk import subjects from CSV into the global catalog.
    CSV columns: Subject Name, Short Name, Description
    """
    if current_user.role == RoleType.FACULTY:
        raise HTTPException(status_code=403, detail="Not authorized")
    target_owner = institution_id if (current_user.role == RoleType.ADMIN and institution_id) else current_user.id
    content = await file.read()
    return subject_service.bulk_import_subjects(target_owner, content, db)


# ── Timetable Attach / Detach (/timetables/{id}/subjects) ────────────────────

@router.get("/timetables/{timetable_id}/subjects", response_model=List[SubjectOut], tags=["Subjects - Timetable"])
def list_timetable_subjects(
    timetable_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """List subjects attached to a specific timetable."""
    return subject_service.get_timetable_subjects(timetable_id, db)

@router.post("/timetables/{timetable_id}/subjects/{subject_id}", response_model=SubjectOut, status_code=status.HTTP_201_CREATED, tags=["Subjects - Timetable"])
def attach_subject_to_timetable(
    timetable_id: UUID,
    subject_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Attach an existing global subject/activity to a timetable."""
    if current_user.role == RoleType.FACULTY:
        raise HTTPException(status_code=403, detail="Not authorized")
    try:
        return subject_service.attach_subject(timetable_id, subject_id, db)
    except ValueError as e:
        detail = str(e)
        code = 409 if "already attached" in detail else 404
        raise HTTPException(status_code=code, detail=detail)

@router.delete("/timetables/{timetable_id}/subjects/{subject_id}", status_code=status.HTTP_204_NO_CONTENT, tags=["Subjects - Timetable"])
def detach_subject_from_timetable(
    timetable_id: UUID,
    subject_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Detach a subject from a timetable (does not delete the subject globally)."""
    if current_user.role == RoleType.FACULTY:
        raise HTTPException(status_code=403, detail="Not authorized")
    try:
        subject_service.detach_subject(timetable_id, subject_id, db)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
