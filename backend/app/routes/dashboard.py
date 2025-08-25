"""
Dashboard API Routes
"""

from fastapi import APIRouter, HTTPException, Depends
import structlog

from app.models.schemas import DashboardStats
from app.services.database_service import db_service
from app.middleware.auth import get_current_user

logger = structlog.get_logger()
router = APIRouter()


@router.get("/stats", response_model=DashboardStats)
async def get_dashboard_stats(
    current_user: dict = Depends(get_current_user)
):
    """Get dashboard statistics for the current user"""
    try:
        stats = await db_service.get_dashboard_stats(current_user["sub"])
        return stats
    except Exception as e:
        logger.error("Failed to get dashboard stats", error=str(e))
        raise HTTPException(status_code=500, detail="Failed to retrieve dashboard statistics")
