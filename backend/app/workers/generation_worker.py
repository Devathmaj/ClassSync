"""
Generation worker — Celery task that runs the scheduling algorithm.
In production: uses constraint-satisfaction / genetic algorithm.
This file contains the Celery app setup and a placeholder task.
"""
from celery import Celery
from app.config import settings

celery_app = Celery(
    "classsync",
    broker=settings.CELERY_BROKER_URL,
    backend=settings.CELERY_RESULT_BACKEND,
)

celery_app.conf.update(
    task_serializer="json",
    result_serializer="json",
    accept_content=["json"],
    timezone="UTC",
    enable_utc=True,
)


@celery_app.task(bind=True, name="generation.run")
def run_generation(self, timetable_id: str, job_id: str):
    """
    Main scheduling task.
    Steps:
      1. Load timetable data from DB.
      2. Build constraint model.
      3. Run optimization (placeholder: random assignment).
      4. Persist TimetableEntry rows.
      5. Update GenerationJob status.
    """
    from datetime import datetime
    from sqlalchemy.orm import Session
    from app.database import SessionLocal
    from app.models.generation_job import GenerationJob, JobStatus
    from app.services.scheduling_service import generate_entries_for_timetable

    db: Session = SessionLocal()
    try:
        job = db.query(GenerationJob).filter(GenerationJob.id == job_id).first()
        if not job:
            return

        job.status = JobStatus.RUNNING
        job.started_at = datetime.utcnow()
        db.commit()

        self.update_state(state="PROGRESS", meta={"progress": 0.5})
        _, score, warnings = generate_entries_for_timetable(db, timetable_id)

        job.status = JobStatus.COMPLETED
        job.progress = 1.0
        job.score = score
        job.completed_at = datetime.utcnow()
        
        from app.models.timetable import Timetable
        tt = db.query(Timetable).filter(Timetable.id == timetable_id).first()
        if tt:
            tt.generation_warnings = warnings
            
        db.commit()

    except Exception as exc:
        if job:
            job.status = JobStatus.FAILED
            job.error_message = str(exc)
            db.commit()
        raise
    finally:
        db.close()
