"""Faculty routes — global CRUD + timetable attach/detach."""
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, status
from sqlalchemy.orm import Session
from typing import List, Optional
from uuid import UUID
from app.database import get_db
from app.models.user import User, RoleType
from app.schemas.faculty import FacultyCreate, FacultyUpdate, FacultyOut
from app.utils.auth import get_current_user
from app.services import faculty_service

router = APIRouter()


# ── Global CRUD (/faculty) ────────────────────────────────────────────────────

@router.get("/faculty", response_model=List[FacultyOut], tags=["Faculty - Global"])
def list_global_faculty(
    institution_id: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """List all faculty in the global catalog."""
    return faculty_service.get_global_faculty(current_user, db, institution_id)

@router.post("/faculty", response_model=FacultyOut, status_code=status.HTTP_201_CREATED, tags=["Faculty - Global"])
def create_global_faculty(
    payload: FacultyCreate,
    institution_id: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Create a new faculty member in the global catalog."""
    if current_user.role == RoleType.FACULTY:
        raise HTTPException(status_code=403, detail="Not authorized")
    target_owner = institution_id if (current_user.role == RoleType.ADMIN and institution_id) else current_user.id
    return faculty_service.create_faculty(target_owner, payload.dict(), db)

@router.put("/faculty/{faculty_id}", response_model=FacultyOut, tags=["Faculty - Global"])
def update_global_faculty(
    faculty_id: UUID,
    payload: FacultyUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Update a global faculty member."""
    if current_user.role == RoleType.FACULTY:
        raise HTTPException(status_code=403, detail="Not authorized")
    try:
        return faculty_service.update_faculty(faculty_id, payload.dict(exclude_unset=True), db)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))

@router.patch("/faculty/{faculty_id}", response_model=FacultyOut, tags=["Faculty - Global"])
def patch_global_faculty(
    faculty_id: UUID,
    payload: FacultyUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Partially update a global faculty member."""
    if current_user.role == RoleType.FACULTY:
        raise HTTPException(status_code=403, detail="Not authorized")
    try:
        return faculty_service.update_faculty(faculty_id, payload.dict(exclude_unset=True), db)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))

@router.delete("/faculty/{faculty_id}", status_code=status.HTTP_204_NO_CONTENT, tags=["Faculty - Global"])
def delete_global_faculty(
    faculty_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Delete a global faculty member."""
    if current_user.role == RoleType.FACULTY:
        raise HTTPException(status_code=403, detail="Not authorized")
    try:
        faculty_service.delete_faculty(faculty_id, db)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))

@router.post("/faculty/bulk-import", tags=["Faculty - Global"])
async def bulk_import_faculty(
    file: UploadFile = File(...),
    institution_id: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Import faculty globally from CSV."""
    if current_user.role == RoleType.FACULTY:
        raise HTTPException(status_code=403, detail="Not authorized")
    target_owner = institution_id if (current_user.role == RoleType.ADMIN and institution_id) else current_user.id
    content = await file.read()
    return faculty_service.bulk_import_faculty(target_owner, content, db)


# ── Timetable Attach / Detach (/timetables/{id}/faculty) ─────────────────────

@router.get("/timetables/{timetable_id}/faculty", response_model=List[FacultyOut], tags=["Faculty - Timetable"])
def list_timetable_faculty(
    timetable_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """List faculty attached to a specific timetable."""
    return faculty_service.get_timetable_faculty(timetable_id, db)

@router.post("/timetables/{timetable_id}/faculty/{faculty_id}", response_model=FacultyOut, status_code=status.HTTP_201_CREATED, tags=["Faculty - Timetable"])
def attach_faculty_to_timetable(
    timetable_id: UUID,
    faculty_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Attach an existing global faculty member to a timetable."""
    if current_user.role == RoleType.FACULTY:
        raise HTTPException(status_code=403, detail="Not authorized")
    try:
        return faculty_service.attach_faculty(timetable_id, faculty_id, db)
    except ValueError as e:
        detail = str(e)
        code = 409 if "already attached" in detail else 404
        raise HTTPException(status_code=code, detail=detail)

@router.delete("/timetables/{timetable_id}/faculty/{faculty_id}", status_code=status.HTTP_204_NO_CONTENT, tags=["Faculty - Timetable"])
def detach_faculty_from_timetable(
    timetable_id: UUID,
    faculty_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Detach a faculty member from a timetable (does not delete the faculty globally)."""
    if current_user.role == RoleType.FACULTY:
        raise HTTPException(status_code=403, detail="Not authorized")
    try:
        faculty_service.detach_faculty(timetable_id, faculty_id, db)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
