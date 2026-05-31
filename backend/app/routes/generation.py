from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks
from sqlalchemy.orm import Session
from uuid import UUID
from app.database import get_db
from app.models.user import User, RoleType
from app.schemas.generation import GenerationJobOut
from app.utils.auth import get_current_user
from app.services import generation_service

router = APIRouter()

@router.post("/{timetable_id}/generate", response_model=GenerationJobOut, status_code=status.HTTP_202_ACCEPTED)
def start_generation(
    timetable_id: UUID,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Enqueue a timetable generation job."""
    if current_user.role == RoleType.FACULTY:
        raise HTTPException(status_code=403, detail="Not authorized")
    try:
        return generation_service.start_generation(timetable_id, current_user, db, background_tasks)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except generation_service.ValidationError as e:
        raise HTTPException(status_code=422, detail=e.errors)

@router.get("/{timetable_id}/generate/{job_id}", response_model=GenerationJobOut)
def get_job_status(
    timetable_id: UUID,
    job_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    try:
        return generation_service.get_job_status(timetable_id, job_id, current_user, db)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))

@router.get("/{timetable_id}/generate", response_model=list)
def list_generation_jobs(
    timetable_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    try:
        jobs = generation_service.list_jobs(timetable_id, current_user, db)
        return [GenerationJobOut.from_orm(j) for j in jobs]
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
