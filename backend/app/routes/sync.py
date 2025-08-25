"""
Sync Management Routes
"""

from fastapi import APIRouter, HTTPException, Depends
import structlog
from typing import List

from app.models.schemas import SyncLog, SyncResponse
from app.services.database_service import db_service
from app.services.background_sync import background_sync
from app.middleware.auth import get_current_user

logger = structlog.get_logger()
router = APIRouter()


@router.get("/logs", response_model=List[SyncLog])
async def get_sync_logs(
    limit: int = 20,
    current_user: dict = Depends(get_current_user)
):
    """Get sync logs for the current user"""
    try:
        logs = await db_service.get_recent_sync_logs(current_user["sub"], limit)
        return logs
    except Exception as e:
        logger.error("Failed to get sync logs", error=str(e))
        raise HTTPException(status_code=500, detail="Failed to retrieve sync logs")


@router.get("/status")
async def get_overall_sync_status(
    current_user: dict = Depends(get_current_user)
):
    """Get overall sync status for all user connections"""
    try:
        connections = await db_service.get_canvas_connections(current_user["sub"])
        status_info = []
        
        for connection in connections:
            status = await background_sync.get_sync_status(
                current_user["sub"], 
                str(connection.id)
            )
            status_info.append({
                "connection_id": str(connection.id),
                "connection_name": connection.canvas_name,
                **status
            })
        
        return {"connections": status_info}
    except Exception as e:
        logger.error("Failed to get sync status", error=str(e))
        raise HTTPException(status_code=500, detail="Failed to get sync status")
