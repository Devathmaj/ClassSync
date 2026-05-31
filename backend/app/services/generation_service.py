from sqlalchemy.orm import Session
from fastapi import BackgroundTasks
from app.database import SessionLocal
from uuid import UUID
from app.models.generation_job import GenerationJob, JobStatus
from app.models.timetable import Timetable
from app.models.user import User, RoleType
from app.utils.validation import validate_timetable_for_generation
from app.services.scheduling_service import generate_entries_for_timetable
from app.services import timetable_service
from datetime import datetime

class ValidationError(Exception):
    def __init__(self, errors):
        self.errors = errors
        super().__init__("Timetable validation failed")

def run_generation_background_task(timetable_id: UUID, job_id: UUID):
    db: Session = SessionLocal()
    try:
        job = db.query(GenerationJob).filter(GenerationJob.id == job_id).first()
        if not job:
            return

        job.status = JobStatus.RUNNING
        job.started_at = datetime.utcnow()
        db.commit()

        _, score, warnings = generate_entries_for_timetable(db, timetable_id)
        
        job.status = JobStatus.COMPLETED
        job.progress = 1.0
        job.score = score
        job.completed_at = datetime.utcnow()
        
        tt = db.query(Timetable).filter(Timetable.id == timetable_id).first()
        if tt:
            tt.generation_warnings = warnings
            
        db.commit()

    except Exception as exc:
        job = db.query(GenerationJob).filter(GenerationJob.id == job_id).first()
        if job:
            job.status = JobStatus.FAILED
            job.error_message = str(exc)
            job.completed_at = datetime.utcnow()
            db.commit()
    finally:
        db.close()


def start_generation(timetable_id: UUID, current_user: User, db: Session, background_tasks: BackgroundTasks):
    if current_user.role == RoleType.FACULTY:
        raise ValueError("Not authorized")
    timetable = timetable_service.get_timetable(timetable_id, current_user, db)

    validation = validate_timetable_for_generation(str(timetable_id), db)
    if not validation["passed"]:
        raise ValidationError(validation["errors"])

    job = GenerationJob(timetable_id=timetable_id, status=JobStatus.PENDING)
    db.add(job)
    db.commit()
    db.refresh(job)

    background_tasks.add_task(run_generation_background_task, timetable_id, job.id)

    return job
def get_job_status(timetable_id: UUID, job_id: UUID, current_user: User, db: Session):
    timetable_service.get_timetable(timetable_id, current_user, db)

    job = db.query(GenerationJob).filter(
        GenerationJob.id == job_id,
        GenerationJob.timetable_id == timetable_id
    ).first()
    if not job:
        raise ValueError("Job not found")
    return job

def list_jobs(timetable_id: UUID, current_user: User, db: Session):
    timetable_service.get_timetable(timetable_id, current_user, db)
    return db.query(GenerationJob).filter(GenerationJob.timetable_id == timetable_id).all()
