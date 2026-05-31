from sqlalchemy.orm import Session
from app.models.user import User, RoleType
from app.models.timetable import Timetable, TimetableStatus

def get_dashboard_stats(user_id: str, db: Session) -> dict:
    user = db.query(User).filter(User.id == user_id).first()
    
    if user and user.role == RoleType.ADMIN:
        total = db.query(Timetable).count()
        published = db.query(Timetable).filter(Timetable.status == TimetableStatus.PUBLISHED).count()
    else:
        total = db.query(Timetable).filter(Timetable.owner_id == user_id).count()
        published = db.query(Timetable).filter(
            Timetable.owner_id == user_id,
            Timetable.status == TimetableStatus.PUBLISHED,
        ).count()
        
    drafts = total - published

    return {
        "total_timetables": total,
        "published": published,
        "drafts": drafts,
        "plan": user.plan if user else "free",
    }
