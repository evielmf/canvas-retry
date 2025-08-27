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
    Course, Assignment, Grade, CanvasDataResponse,
    CanvasAnnouncement, CanvasDiscussion, CanvasCalendarEvent,
    CanvasModule, CanvasModuleItem, CanvasQuiz, CanvasFile,
    CanvasPage, CanvasRubric, CanvasUserProfile
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


@router.get("/announcements")
async def get_announcements(
    course_id: Optional[str] = None,
    limit: int = 50,
    offset: int = 0,
    current_user: dict = Depends(get_current_user)
):
    """Get Canvas announcements for the current user"""
    try:
        announcements = await db_service.get_user_announcements(
            user_id=current_user["sub"],
            course_id=course_id,
            limit=limit,
            offset=offset
        )
        return announcements
    except Exception as e:
        logger.error("Failed to get announcements", error=str(e))
        raise HTTPException(status_code=500, detail="Failed to retrieve announcements")


@router.get("/discussions")
async def get_discussions(
    course_id: Optional[str] = None,
    limit: int = 50,
    offset: int = 0,
    current_user: dict = Depends(get_current_user)
):
    """Get Canvas discussions for the current user"""
    try:
        discussions = await db_service.get_user_discussions(
            user_id=current_user["sub"],
            course_id=course_id,
            limit=limit,
            offset=offset
        )
        return discussions
    except Exception as e:
        logger.error("Failed to get discussions", error=str(e))
        raise HTTPException(status_code=500, detail="Failed to retrieve discussions")


@router.get("/calendar-events")
async def get_calendar_events(
    course_id: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    limit: int = 100,
    offset: int = 0,
    current_user: dict = Depends(get_current_user)
):
    """Get Canvas calendar events for the current user"""
    try:
        events = await db_service.get_user_calendar_events(
            user_id=current_user["sub"],
            course_id=course_id,
            start_date=start_date,
            end_date=end_date,
            limit=limit,
            offset=offset
        )
        return events
    except Exception as e:
        logger.error("Failed to get calendar events", error=str(e))
        raise HTTPException(status_code=500, detail="Failed to retrieve calendar events")


@router.get("/modules")
async def get_modules(
    course_id: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """Get Canvas modules for the current user"""
    try:
        modules = await db_service.get_user_modules(
            user_id=current_user["sub"],
            course_id=course_id
        )
        return modules
    except Exception as e:
        logger.error("Failed to get modules", error=str(e))
        raise HTTPException(status_code=500, detail="Failed to retrieve modules")


@router.get("/module-items")
async def get_module_items(
    course_id: Optional[str] = None,
    module_id: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """Get Canvas module items for the current user"""
    try:
        items = await db_service.get_user_module_items(
            user_id=current_user["sub"],
            course_id=course_id,
            module_id=module_id
        )
        return items
    except Exception as e:
        logger.error("Failed to get module items", error=str(e))
        raise HTTPException(status_code=500, detail="Failed to retrieve module items")


@router.get("/quizzes")
async def get_quizzes(
    course_id: Optional[str] = None,
    limit: int = 50,
    offset: int = 0,
    current_user: dict = Depends(get_current_user)
):
    """Get Canvas quizzes for the current user"""
    try:
        quizzes = await db_service.get_user_quizzes(
            user_id=current_user["sub"],
            course_id=course_id,
            limit=limit,
            offset=offset
        )
        return quizzes
    except Exception as e:
        logger.error("Failed to get quizzes", error=str(e))
        raise HTTPException(status_code=500, detail="Failed to retrieve quizzes")


@router.get("/files")
async def get_files(
    course_id: Optional[str] = None,
    limit: int = 50,
    offset: int = 0,
    current_user: dict = Depends(get_current_user)
):
    """Get Canvas files for the current user"""
    try:
        files = await db_service.get_user_files(
            user_id=current_user["sub"],
            course_id=course_id,
            limit=limit,
            offset=offset
        )
        return files
    except Exception as e:
        logger.error("Failed to get files", error=str(e))
        raise HTTPException(status_code=500, detail="Failed to retrieve files")


@router.get("/pages")
async def get_pages(
    course_id: Optional[str] = None,
    limit: int = 50,
    offset: int = 0,
    current_user: dict = Depends(get_current_user)
):
    """Get Canvas pages for the current user"""
    try:
        pages = await db_service.get_user_pages(
            user_id=current_user["sub"],
            course_id=course_id,
            limit=limit,
            offset=offset
        )
        return pages
    except Exception as e:
        logger.error("Failed to get pages", error=str(e))
        raise HTTPException(status_code=500, detail="Failed to retrieve pages")


@router.get("/rubrics")
async def get_rubrics(
    course_id: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """Get Canvas rubrics for the current user"""
    try:
        rubrics = await db_service.get_user_rubrics(
            user_id=current_user["sub"],
            course_id=course_id
        )
        return rubrics
    except Exception as e:
        logger.error("Failed to get rubrics", error=str(e))
        raise HTTPException(status_code=500, detail="Failed to retrieve rubrics")


@router.get("/profile")
async def get_user_profile(
    current_user: dict = Depends(get_current_user)
):
    """Get Canvas user profile for the current user"""
    try:
        profile = await db_service.get_canvas_user_profile(current_user["sub"])
        return profile
    except Exception as e:
        logger.error("Failed to get user profile", error=str(e))
        raise HTTPException(status_code=500, detail="Failed to retrieve user profile")


@router.get("/comprehensive-data")
async def get_comprehensive_canvas_data(
    current_user: dict = Depends(get_current_user)
):
    """Get ALL Canvas data for the current user in one request"""
    try:
        # Get all data in parallel for maximum performance
        results = await asyncio.gather(
            db_service.get_user_courses(current_user["sub"]),
            db_service.get_user_assignments(current_user["sub"]),
            db_service.get_user_grades(current_user["sub"]),
            db_service.get_user_announcements(current_user["sub"]),
            db_service.get_user_discussions(current_user["sub"]),
            db_service.get_user_calendar_events(current_user["sub"]),
            db_service.get_user_modules(current_user["sub"]),
            db_service.get_user_module_items(current_user["sub"]),
            db_service.get_user_quizzes(current_user["sub"]),
            db_service.get_user_files(current_user["sub"]),
            db_service.get_user_pages(current_user["sub"]),
            db_service.get_user_rubrics(current_user["sub"]),
            db_service.get_canvas_user_profile(current_user["sub"]),
            db_service.get_recent_sync_logs(current_user["sub"], 1),
            return_exceptions=True
        )
        
        (courses, assignments, grades, announcements, discussions, 
         calendar_events, modules, module_items, quizzes, files, 
         pages, rubrics, user_profile, sync_logs) = results
        
        # Handle any exceptions by returning empty lists
        def safe_result(result, default=None):
            if isinstance(result, Exception):
                logger.warning(f"Failed to fetch data: {result}")
                return [] if default is None else default
            return result
        
        return {
            "courses": safe_result(courses, []),
            "assignments": safe_result(assignments, []),
            "grades": safe_result(grades, []),
            "announcements": safe_result(announcements, []),
            "discussions": safe_result(discussions, []),
            "calendar_events": safe_result(calendar_events, []),
            "modules": safe_result(modules, []),
            "module_items": safe_result(module_items, []),
            "quizzes": safe_result(quizzes, []),
            "files": safe_result(files, []),
            "pages": safe_result(pages, []),
            "rubrics": safe_result(rubrics, []),
            "user_profile": safe_result(user_profile, None),
            "sync_info": safe_result(sync_logs, [])[0] if safe_result(sync_logs, []) else None
        }
        
    except Exception as e:
        logger.error("Failed to get comprehensive Canvas data", error=str(e))
        raise HTTPException(status_code=500, detail="Failed to retrieve comprehensive Canvas data")
