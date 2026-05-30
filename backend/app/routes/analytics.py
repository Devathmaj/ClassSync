from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.user import User
from app.utils.auth import get_current_user
from app.services import analytics_service

router = APIRouter()

@router.get("/dashboard")
def dashboard_analytics(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Summary stats for the dashboard."""
    return analytics_service.get_dashboard_stats(current_user.id, db)
