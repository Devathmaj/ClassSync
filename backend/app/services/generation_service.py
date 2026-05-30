from sqlalchemy.orm import Session
from uuid import UUID
from app.models.generation_job import GenerationJob, JobStatus
from app.models.timetable import Timetable
from app.utils.validation import validate_timetable_for_generation
from app.services.scheduling_service import generate_entries_for_timetable
from datetime import datetime

class ValidationError(Exception):
    def __init__(self, errors):
        self.errors = errors
        super().__init__("Timetable validation failed")

def start_generation(timetable_id: UUID, user_id: str, db: Session):
    timetable = db.query(Timetable).filter(
        Timetable.id == timetable_id, Timetable.owner_id == user_id
    ).first()
    if not timetable:
        raise ValueError("Timetable not found")

    validation = validate_timetable_for_generation(str(timetable_id), db)
    if not validation["passed"]:
        raise ValidationError(validation["errors"])

    job = GenerationJob(timetable_id=timetable_id, status=JobStatus.PENDING)
    db.add(job)
    db.commit()
    db.refresh(job)

    try:
        from app.workers.generation_worker import run_generation
        task = run_generation.delay(str(timetable_id), str(job.id))
        job.celery_task_id = task.id
        db.commit()
    except Exception:
        job.status = JobStatus.RUNNING
        job.started_at = datetime.utcnow()
        db.commit()
        try:
            _, score, warnings = generate_entries_for_timetable(db, timetable_id)
            job.status = JobStatus.COMPLETED
            job.progress = 1.0
            job.score = score
            job.completed_at = datetime.utcnow()
            db.commit()
        except Exception as exc:
            job.status = JobStatus.FAILED
            job.error_message = str(exc)
            job.completed_at = datetime.utcnow()
            db.commit()
    return job

def get_job_status(timetable_id: UUID, job_id: UUID, user_id: str, db: Session):
    timetable = db.query(Timetable).filter(
        Timetable.id == timetable_id, Timetable.owner_id == user_id
    ).first()
    if not timetable:
        raise ValueError("Timetable not found")

    job = db.query(GenerationJob).filter(
        GenerationJob.id == job_id,
        GenerationJob.timetable_id == timetable_id,
    ).first()
    if not job:
        raise ValueError("Generation job not found")
    return job

def list_jobs(timetable_id: UUID, user_id: str, db: Session):
    timetable = db.query(Timetable).filter(
        Timetable.id == timetable_id, Timetable.owner_id == user_id
    ).first()
    if not timetable:
        raise ValueError("Timetable not found")
    return db.query(GenerationJob).filter(GenerationJob.timetable_id == timetable_id).all()
