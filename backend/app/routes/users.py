"""
Authentication and User Management Routes
"""

from fastapi import APIRouter, HTTPException, Depends
from fastapi.security import HTTPBearer
import structlog

from app.models.schemas import UserProfile
from app.services.database_service import db_service
from app.middleware.auth import get_current_user

logger = structlog.get_logger()
router = APIRouter()
security = HTTPBearer()


@router.get("/me", response_model=UserProfile)
async def get_current_user_profile(
    current_user: dict = Depends(get_current_user)
):
    """Get current user profile"""
    try:
        profile = await db_service.get_user_profile(current_user["sub"])
        if not profile:
            raise HTTPException(status_code=404, detail="User profile not found")
        return profile
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Failed to get user profile", error=str(e))
        raise HTTPException(status_code=500, detail="Failed to retrieve user profile")


@router.put("/me", response_model=UserProfile)
async def update_user_profile(
    profile_update: dict,
    current_user: dict = Depends(get_current_user)
):
    """Update current user profile"""
    try:
        # Implementation for updating user profile
        # This would validate and update user profile data
        profile = await db_service.get_user_profile(current_user["sub"])
        if not profile:
            raise HTTPException(status_code=404, detail="User profile not found")
        
        # Update logic would go here
        return profile
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Failed to update user profile", error=str(e))
        raise HTTPException(status_code=500, detail="Failed to update user profile")
