"""
Canvas Integration API Routes
Handles Canvas API token management and data fetching
"""

import asyncio
from fastapi import APIRouter, HTTPException, Depends, BackgroundTasks
from fastapi.security import HTTPBearer
import structlog
from typing import List, Optional

from app.models.schemas import (
    CanvasTokenRequest, CanvasTokenUpdate, SyncRequest, 
    CanvasConnection, CanvasValidationResponse, SyncResponse,
    Course, Assignment, Grade, CanvasDataResponse
)
from app.services.canvas_service import CanvasAPIClient
from app.services.database_service import db_service
from app.services.background_sync import background_sync
from app.middleware.auth import get_current_user

logger = structlog.get_logger()
router = APIRouter()
security = HTTPBearer()


@router.post("/setup", response_model=CanvasConnection)
async def setup_canvas_integration(
    canvas_request: CanvasTokenRequest,
    current_user: dict = Depends(get_current_user)
):
    """
    Set up Canvas integration with API token
    
    This endpoint:
    1. Validates the Canvas API token
    2. Encrypts and stores the token securely
    3. Creates a Canvas connection record
    4. Triggers initial data sync
    """
    try:
        logger.info(
            "Setting up Canvas integration",
            user_id=current_user["sub"],
            canvas_url=canvas_request.canvas_url
        )
        
        # Step 1: Validate Canvas API token
        canvas_client = CanvasAPIClient(canvas_request.canvas_url, canvas_request.api_token)
        validation = await canvas_client.validate_connection()
        
        if not validation.valid:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid Canvas API token: {validation.error_message}"
            )
        
        logger.info(
            "Canvas token validated successfully",
            user_info=validation.user_info
        )
        
        # Step 2: Create/update Canvas connection with encrypted token
        connection = await db_service.create_or_update_canvas_connection(
            user_id=current_user["sub"],
            canvas_url=canvas_request.canvas_url,
            canvas_name=canvas_request.canvas_name,
            api_token=canvas_request.api_token
        )
        
        # Step 3: Trigger initial sync in background
        sync_log_id = await background_sync.trigger_manual_sync(
            user_id=current_user["sub"],
            connection_id=str(connection.id),
            sync_type="initial"
        )
        
        logger.info(
            "Canvas integration setup completed",
            connection_id=str(connection.id),
            sync_log_id=sync_log_id
        )
        
        return connection
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Canvas integration setup failed", error=str(e))
        raise HTTPException(status_code=500, detail="Failed to setup Canvas integration")


@router.get("/connections", response_model=List[CanvasConnection])
async def get_canvas_connections(
    current_user: dict = Depends(get_current_user)
):
    """Get all Canvas connections for the current user"""
    try:
        connections = await db_service.get_canvas_connections(current_user["sub"])
        return connections
    except Exception as e:
        logger.error("Failed to get Canvas connections", error=str(e))
        raise HTTPException(status_code=500, detail="Failed to retrieve Canvas connections")


@router.put("/connections/{connection_id}/token", response_model=CanvasConnection)
async def update_canvas_token(
    connection_id: str,
    token_update: CanvasTokenUpdate,
    current_user: dict = Depends(get_current_user)
):
    """Update Canvas API token for an existing connection"""
    try:
        # Get existing connection
        connection_data = await db_service.get_canvas_connection_with_token(connection_id)
        if not connection_data:
            raise HTTPException(status_code=404, detail="Canvas connection not found")
        
        connection, _ = connection_data
        
        # Validate new token
        canvas_client = CanvasAPIClient(connection.canvas_url, token_update.api_token)
        validation = await canvas_client.validate_connection()
        
        if not validation.valid:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid Canvas API token: {validation.error_message}"
            )
        
        # Update connection with new token
        updated_connection = await db_service.create_or_update_canvas_connection(
            user_id=current_user["sub"],
            canvas_url=connection.canvas_url,
            canvas_name=connection.canvas_name,
            api_token=token_update.api_token
        )
        
        logger.info(f"Canvas token updated for connection {connection_id}")
        return updated_connection
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to update Canvas token", error=str(e))
        raise HTTPException(status_code=500, detail="Failed to update Canvas token")


@router.get("/validate-token", response_model=CanvasValidationResponse)
async def validate_user_canvas_token(
    current_user: dict = Depends(get_current_user)
):
    """
    Validate if the current user has a Canvas token configured
    """
    try:
        # Get user's Canvas connections
        connections = await db_service.get_canvas_connections(current_user["sub"])
        
        if not connections:
            # No Canvas integration found
            return CanvasValidationResponse(
                valid=False,
                error_message="No Canvas integration configured"
            )
        
        # Get the first (primary) connection
        connection = connections[0]
        
        # Get connection with decrypted token
        connection_data = await db_service.get_canvas_connection_with_token(str(connection.id))
        if not connection_data:
            return CanvasValidationResponse(
                valid=False,
                error_message="Canvas connection not found"
            )
        
        connection, token = connection_data
        
        # Test the connection
        canvas_client = CanvasAPIClient(connection.canvas_url, token)
        validation = await canvas_client.validate_connection()
        
        # Add connection info to response
        if validation.valid:
            validation.canvas_url = connection.canvas_url
            validation.canvas_name = connection.canvas_name
            validation.last_sync = connection.last_sync_at
        
        return validation
        
    except Exception as e:
        logger.error("Failed to validate user Canvas token", error=str(e))
        return CanvasValidationResponse(
            valid=False,
            error_message="Failed to validate Canvas integration"
        )


@router.post("/connections/{connection_id}/validate", response_model=CanvasValidationResponse)
async def validate_canvas_connection(
    connection_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Validate Canvas connection and token"""
    try:
        # Get connection and decrypt token
        connection_data = await db_service.get_canvas_connection_with_token(connection_id)
        if not connection_data:
            raise HTTPException(status_code=404, detail="Canvas connection not found")
        
        connection, token = connection_data
        
        # Test connection
        canvas_client = CanvasAPIClient(connection.canvas_url, token)
        validation = await canvas_client.validate_connection()
        
        return validation
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to validate Canvas connection", error=str(e))
        raise HTTPException(status_code=500, detail="Failed to validate Canvas connection")


@router.post("/connections/{connection_id}/sync", response_model=SyncResponse)
async def trigger_canvas_sync(
    connection_id: str,
    sync_request: SyncRequest,
    current_user: dict = Depends(get_current_user)
):
    """Trigger manual Canvas data synchronization"""
    try:
        # Trigger sync
        sync_log_id = await background_sync.trigger_manual_sync(
            user_id=current_user["sub"],
            connection_id=connection_id,
            sync_type=sync_request.sync_type
        )
        
        logger.info(
            f"Manual sync triggered for connection {connection_id}",
            sync_log_id=sync_log_id
        )
        
        return SyncResponse(
            success=True,
            sync_log_id=sync_log_id,
            message="Sync started successfully"
        )
        
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Failed to trigger sync", error=str(e))
        raise HTTPException(status_code=500, detail="Failed to trigger synchronization")


@router.get("/connections/{connection_id}/sync/status")
async def get_sync_status(
    connection_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get current sync status for a Canvas connection"""
    try:
        status = await background_sync.get_sync_status(
            user_id=current_user["sub"],
            connection_id=connection_id
        )
        return status
    except Exception as e:
        logger.error(f"Failed to get sync status", error=str(e))
        raise HTTPException(status_code=500, detail="Failed to get sync status")


@router.delete("/connections/{connection_id}/sync")
async def cancel_sync(
    connection_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Cancel ongoing synchronization"""
    try:
        cancelled = await background_sync.cancel_sync(
            user_id=current_user["sub"],
            connection_id=connection_id
        )
        
        if cancelled:
            return {"message": "Sync cancelled successfully"}
        else:
            return {"message": "No active sync to cancel"}
            
    except Exception as e:
        logger.error(f"Failed to cancel sync", error=str(e))
        raise HTTPException(status_code=500, detail="Failed to cancel sync")


@router.get("/courses", response_model=List[Course])
async def get_courses(
    current_user: dict = Depends(get_current_user)
):
    """Get all courses for the current user"""
    try:
        courses = await db_service.get_user_courses(current_user["sub"])
        return courses
    except Exception as e:
        logger.error("Failed to get courses", error=str(e))
        raise HTTPException(status_code=500, detail="Failed to retrieve courses")


@router.get("/assignments", response_model=List[Assignment])
async def get_assignments(
    course_id: Optional[str] = None,
    status: Optional[str] = None,
    limit: int = 50,
    offset: int = 0,
    current_user: dict = Depends(get_current_user)
):
    """Get assignments for the current user with filtering"""
    try:
        assignments = await db_service.get_user_assignments(
            user_id=current_user["sub"],
            course_id=course_id,
            status=status,
            limit=limit,
            offset=offset
        )
        return assignments
    except Exception as e:
        logger.error("Failed to get assignments", error=str(e))
        raise HTTPException(status_code=500, detail="Failed to retrieve assignments")


@router.get("/grades", response_model=List[Grade])
async def get_grades(
    course_id: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """Get grades for the current user"""
    try:
        grades = await db_service.get_user_grades(
            user_id=current_user["sub"],
            course_id=course_id
        )
        return grades
    except Exception as e:
        logger.error("Failed to get grades", error=str(e))
        raise HTTPException(status_code=500, detail="Failed to retrieve grades")


@router.get("/data", response_model=CanvasDataResponse)
async def get_canvas_data(
    current_user: dict = Depends(get_current_user)
):
    """Get all Canvas data for the current user"""
    try:
        # Get all data in parallel
        courses, assignments, grades, sync_logs = await asyncio.gather(
            db_service.get_user_courses(current_user["sub"]),
            db_service.get_user_assignments(current_user["sub"]),
            db_service.get_user_grades(current_user["sub"]),
            db_service.get_recent_sync_logs(current_user["sub"], 1)
        )
        
        return CanvasDataResponse(
            courses=courses,
            assignments=assignments,
            grades=grades,
            sync_info=sync_logs[0] if sync_logs else None
        )
        
    except Exception as e:
        logger.error("Failed to get Canvas data", error=str(e))
        raise HTTPException(status_code=500, detail="Failed to retrieve Canvas data")
