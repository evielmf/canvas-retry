"""
Pydantic Models for Canvas API Integration
"""

from pydantic import BaseModel, Field, validator
from typing import Optional, List, Dict, Any, Union
from datetime import datetime, date
from enum import Enum
import uuid


class AssignmentStatus(str, Enum):
    UPCOMING = "upcoming"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    OVERDUE = "overdue"
    SUBMITTED = "submitted"


class SyncStatus(str, Enum):
    PENDING = "pending"
    SYNCING = "syncing"
    COMPLETED = "completed"
    FAILED = "failed"


class CanvasConnectionStatus(str, Enum):
    CONNECTED = "connected"
    DISCONNECTED = "disconnected"
    ERROR = "error"
    EXPIRED = "expired"


# Request Models
class CanvasTokenRequest(BaseModel):
    """Request model for Canvas API token setup"""
    canvas_url: str = Field(..., description="Canvas institution URL")
    canvas_name: str = Field(..., description="Canvas institution name")
    api_token: str = Field(..., description="Canvas API token")
    
    @validator('canvas_url')
    def validate_canvas_url(cls, v):
        if not v.startswith(('http://', 'https://')):
            raise ValueError('Canvas URL must start with http:// or https://')
        return v.rstrip('/')
    
    @validator('api_token')
    def validate_api_token(cls, v):
        if len(v) < 10:
            raise ValueError('API token appears to be too short')
        return v


class CanvasTokenUpdate(BaseModel):
    """Update Canvas API token"""
    api_token: str = Field(..., description="New Canvas API token")


class SyncRequest(BaseModel):
    """Request model for manual sync"""
    sync_type: str = Field(default="full", description="Type of sync: full, incremental")
    force: bool = Field(default=False, description="Force sync even if recently synced")


class StudySessionCreate(BaseModel):
    """Create study session"""
    course_id: Optional[uuid.UUID] = None
    assignment_id: Optional[uuid.UUID] = None
    duration_minutes: int = Field(..., gt=0, description="Duration in minutes")
    focus_score: Optional[int] = Field(None, ge=1, le=10, description="Focus score 1-10")
    session_type: str = Field(default="study", description="Type of study session")
    notes: Optional[str] = None
    started_at: datetime
    ended_at: datetime


class ReminderCreate(BaseModel):
    """Create reminder"""
    assignment_id: Optional[uuid.UUID] = None
    title: str = Field(..., max_length=200)
    message: Optional[str] = None
    remind_at: datetime


# Response Models
class UserProfile(BaseModel):
    """User profile response"""
    id: uuid.UUID
    email: str
    full_name: Optional[str]
    avatar_url: Optional[str]
    timezone: str
    preferences: Dict[str, Any]
    created_at: datetime
    updated_at: datetime


class CanvasConnection(BaseModel):
    """Canvas connection response"""
    id: uuid.UUID
    canvas_url: str
    canvas_name: str
    status: CanvasConnectionStatus
    last_sync: Optional[datetime]
    created_at: datetime
    updated_at: datetime


class Course(BaseModel):
    """Course response model"""
    id: uuid.UUID
    canvas_course_id: str
    name: str
    course_code: Optional[str]
    instructor_name: Optional[str]
    credits: Optional[int]
    color: str
    is_favorite: bool
    enrollment_status: str
    start_date: Optional[date]
    end_date: Optional[date]
    created_at: datetime
    updated_at: datetime


class Assignment(BaseModel):
    """Assignment response model"""
    id: uuid.UUID
    course_id: uuid.UUID
    canvas_assignment_id: str
    title: str
    description: Optional[str]
    due_date: Optional[datetime]
    points_possible: Optional[float]
    submission_types: Optional[List[str]]
    status: AssignmentStatus
    submitted_at: Optional[datetime]
    graded_at: Optional[datetime]
    created_at: datetime
    updated_at: datetime
    course: Optional[Course] = None


class Grade(BaseModel):
    """Grade response model"""
    id: uuid.UUID
    course_id: uuid.UUID
    assignment_id: Optional[uuid.UUID]
    canvas_grade_id: Optional[str]
    score: Optional[float]
    grade: Optional[str]
    points_possible: Optional[float]
    weight: Optional[float]
    graded_at: Optional[datetime]
    created_at: datetime
    updated_at: datetime


class SyncLog(BaseModel):
    """Sync log response model"""
    id: uuid.UUID
    status: SyncStatus
    sync_type: str
    started_at: datetime
    completed_at: Optional[datetime]
    error_message: Optional[str]
    items_synced: int
    created_at: datetime


class DashboardStats(BaseModel):
    """Dashboard statistics"""
    total_courses: int
    completed_assignments: int
    upcoming_assignments: int
    overdue_assignments: int
    average_score: float
    total_study_time_week: int


class CanvasValidationResponse(BaseModel):
    """Canvas token validation response"""
    valid: bool
    user_info: Optional[Dict[str, Any]] = None
    error_message: Optional[str] = None
    canvas_url: Optional[str] = None
    canvas_name: Optional[str] = None
    last_sync: Optional[datetime] = None


class SyncResponse(BaseModel):
    """Sync operation response"""
    success: bool
    sync_log_id: uuid.UUID
    message: str
    items_synced: Optional[int] = None


class CanvasDataResponse(BaseModel):
    """Complete Canvas data response"""
    courses: List[Course]
    assignments: List[Assignment]
    grades: List[Grade]
    sync_info: SyncLog


class PaginatedResponse(BaseModel):
    """Paginated response wrapper"""
    items: List[Any]
    total: int
    page: int
    size: int
    pages: int


class ErrorResponse(BaseModel):
    """Error response model"""
    error: str
    message: str
    details: Optional[Dict[str, Any]] = None
    timestamp: datetime = Field(default_factory=datetime.now)


# Canvas API Models
class CanvasCourse(BaseModel):
    """Canvas course from API"""
    id: int
    name: str
    course_code: Optional[str]
    enrollment_term_id: Optional[int]
    start_at: Optional[str]
    end_at: Optional[str]
    teachers: Optional[List[Dict[str, Any]]] = []


class CanvasAssignment(BaseModel):
    """Canvas assignment from API"""
    id: int
    name: str
    description: Optional[str]
    due_at: Optional[str]
    points_possible: Optional[float]
    submission_types: Optional[List[str]]
    submitted_at: Optional[str]
    graded_at: Optional[str]
    course_id: int


class CanvasGrade(BaseModel):
    """Canvas grade from API"""
    id: Optional[int]
    course_id: int
    grades: Optional[Dict[str, Any]] = {}


class CanvasSyncData(BaseModel):
    """Complete Canvas sync data"""
    courses: List[CanvasCourse]
    assignments: List[CanvasAssignment]
    grades: List[CanvasGrade]
