"""
Canvas API Service with Parallel Fetching
High-performance Canvas data fetching with asyncio and concurrent processing
"""

import asyncio
import httpx
import structlog
from typing import List, Dict, Any, Optional, Tuple
from datetime import datetime, timedelta
import json
from cryptography.fernet import Fernet
import base64
import os

from app.models.schemas import (
    CanvasCourse, CanvasAssignment, CanvasGrade, CanvasSyncData,
    CanvasValidationResponse
)
from app.config import settings

logger = structlog.get_logger()


class CanvasTokenManager:
    """Secure Canvas API token management with AES encryption"""
    
    @staticmethod
    def generate_key() -> bytes:
        """Generate a new encryption key"""
        return Fernet.generate_key()
    
    @staticmethod
    def encrypt_token(token: str, key: Optional[str] = None) -> Tuple[str, str]:
        """
        Encrypt Canvas API token
        Returns: (encrypted_token, encryption_key)
        """
        if not key:
            key = settings.CANVAS_ENCRYPTION_KEY
        
        # Ensure key is proper format
        if isinstance(key, str):
            # If key is string, encode it and pad/truncate to 32 bytes
            key_bytes = key.encode()[:32].ljust(32, b'0')
            key = base64.urlsafe_b64encode(key_bytes).decode()
        
        fernet = Fernet(key.encode() if isinstance(key, str) else key)
        encrypted = fernet.encrypt(token.encode())
        return base64.urlsafe_b64encode(encrypted).decode(), key
    
    @staticmethod
    def decrypt_token(encrypted_token: str, key: str) -> str:
        """Decrypt Canvas API token"""
        try:
            # Ensure key is proper format
            if isinstance(key, str) and len(key) < 44:  # Fernet key is 44 chars
                key_bytes = key.encode()[:32].ljust(32, b'0')
                key = base64.urlsafe_b64encode(key_bytes).decode()
            
            fernet = Fernet(key.encode() if isinstance(key, str) else key)
            encrypted_bytes = base64.urlsafe_b64decode(encrypted_token.encode())
            decrypted = fernet.decrypt(encrypted_bytes)
            return decrypted.decode()
        except Exception as e:
            logger.error("Failed to decrypt Canvas token", error=str(e))
            raise ValueError("Invalid token or encryption key")


class CanvasAPIClient:
    """High-performance Canvas API client with parallel processing"""
    
    def __init__(self, canvas_url: str, api_token: str):
        self.canvas_url = canvas_url.rstrip('/')
        self.api_token = api_token
        self.base_url = f"{self.canvas_url}/api/v1"
        self.headers = {
            "Authorization": f"Bearer {self.api_token}",
            "Content-Type": "application/json",
            "User-Agent": "EaseBoard-Canvas-Integration/1.0"
        }
        
        # HTTP client configuration for performance
        self.client_config = {
            "timeout": httpx.Timeout(settings.REQUEST_TIMEOUT),
            "limits": httpx.Limits(
                max_connections=settings.MAX_CONCURRENT_REQUESTS,
                max_keepalive_connections=5
            ),
            "retries": settings.RETRY_ATTEMPTS
        }
    
    async def _make_request(
        self, 
        endpoint: str, 
        method: str = "GET", 
        params: Optional[Dict] = None,
        data: Optional[Dict] = None,
        timeout: Optional[int] = None
    ) -> Dict[str, Any]:
        """Make HTTP request to Canvas API with retry logic"""
        url = f"{self.base_url}{endpoint}"
        
        async with httpx.AsyncClient(**self.client_config) as client:
            for attempt in range(settings.RETRY_ATTEMPTS):
                try:
                    response = await client.request(
                        method=method,
                        url=url,
                        headers=self.headers,
                        params=params,
                        json=data,
                        timeout=timeout or settings.REQUEST_TIMEOUT
                    )
                    
                    if response.status_code == 200:
                        return response.json()
                    elif response.status_code == 401:
                        raise ValueError("Invalid Canvas API token")
                    elif response.status_code == 403:
                        raise ValueError("Insufficient permissions for Canvas API")
                    elif response.status_code == 404:
                        logger.warning(f"Canvas endpoint not found: {endpoint}")
                        return {}
                    elif response.status_code == 429:
                        # Rate limit hit, wait and retry
                        wait_time = min(2 ** attempt, 60)
                        logger.warning(f"Rate limit hit, waiting {wait_time}s", attempt=attempt)
                        await asyncio.sleep(wait_time)
                        continue
                    else:
                        response.raise_for_status()
                        
                except httpx.TimeoutException:
                    if attempt == settings.RETRY_ATTEMPTS - 1:
                        raise
                    wait_time = 2 ** attempt
                    logger.warning(f"Request timeout, retrying in {wait_time}s", attempt=attempt)
                    await asyncio.sleep(wait_time)
                    
                except httpx.RequestError as e:
                    if attempt == settings.RETRY_ATTEMPTS - 1:
                        raise
                    logger.warning(f"Request error: {e}, retrying", attempt=attempt)
                    await asyncio.sleep(2 ** attempt)
            
            raise Exception(f"Failed to fetch {endpoint} after {settings.RETRY_ATTEMPTS} attempts")
    
    async def validate_connection(self) -> CanvasValidationResponse:
        """Validate Canvas API connection and get user info"""
        try:
            user_data = await self._make_request("/users/self")
            return CanvasValidationResponse(
                valid=True,
                user_info={
                    "id": user_data.get("id"),
                    "name": user_data.get("name"),
                    "email": user_data.get("email"),
                    "login_id": user_data.get("login_id")
                }
            )
        except Exception as e:
            logger.error("Canvas validation failed", error=str(e))
            return CanvasValidationResponse(
                valid=False,
                error_message=str(e)
            )
    
    async def get_courses(self) -> List[CanvasCourse]:
        """Fetch all active courses"""
        try:
            courses_data = await self._make_request(
                "/courses",
                params={
                    "enrollment_state": "active",
                    "per_page": 100,
                    "include[]": ["teachers", "term"]
                }
            )
            
            courses = []
            for course_data in courses_data:
                courses.append(CanvasCourse(**course_data))
            
            logger.info(f"Fetched {len(courses)} courses")
            return courses
            
        except Exception as e:
            logger.error("Failed to fetch courses", error=str(e))
            raise
    
    async def get_course_assignments(self, course_id: int) -> List[CanvasAssignment]:
        """Fetch assignments for a specific course"""
        try:
            assignments_data = await self._make_request(
                f"/courses/{course_id}/assignments",
                params={
                    "per_page": 100,
                    "include[]": ["submission", "score_statistics"]
                }
            )
            
            assignments = []
            for assignment_data in assignments_data:
                assignment_data["course_id"] = course_id
                assignments.append(CanvasAssignment(**assignment_data))
            
            return assignments
            
        except Exception as e:
            logger.error(f"Failed to fetch assignments for course {course_id}", error=str(e))
            return []
    
    async def get_course_grades(self, course_id: int) -> List[CanvasGrade]:
        """Fetch grades for a specific course"""
        try:
            grades_data = await self._make_request(
                f"/courses/{course_id}/enrollments",
                params={
                    "user_id": "self",
                    "include[]": ["grades"]
                }
            )
            
            grades = []
            for grade_data in grades_data:
                grade_obj = CanvasGrade(
                    id=grade_data.get("id"),
                    course_id=course_id,
                    grades=grade_data.get("grades", {})
                )
                grades.append(grade_obj)
            
            return grades
            
        except Exception as e:
            logger.error(f"Failed to fetch grades for course {course_id}", error=str(e))
            return []
    
    async def get_course_submissions(self, course_id: int, assignment_ids: List[int]) -> Dict[int, Any]:
        """Fetch submissions for multiple assignments in parallel"""
        submissions = {}
        
        async def fetch_assignment_submissions(assignment_id: int):
            try:
                submission_data = await self._make_request(
                    f"/courses/{course_id}/assignments/{assignment_id}/submissions/self",
                    params={"include[]": ["submission_comments", "rubric_assessment"]}
                )
                submissions[assignment_id] = submission_data
            except Exception as e:
                logger.warning(f"Failed to fetch submission for assignment {assignment_id}", error=str(e))
                submissions[assignment_id] = None
        
        # Parallel fetch with semaphore to limit concurrency
        semaphore = asyncio.Semaphore(settings.MAX_CONCURRENT_REQUESTS)
        
        async def limited_fetch(assignment_id: int):
            async with semaphore:
                await fetch_assignment_submissions(assignment_id)
        
        # Execute all requests in parallel
        await asyncio.gather(*[limited_fetch(aid) for aid in assignment_ids])
        return submissions
    
    async def fetch_full_data_parallel(self) -> CanvasSyncData:
        """
        Fetch all Canvas data using parallel processing for maximum performance
        """
        logger.info("Starting parallel Canvas data fetch")
        start_time = datetime.now()
        
        try:
            # Step 1: Fetch courses first
            courses = await self.get_courses()
            course_ids = [course.id for course in courses]
            
            if not course_ids:
                logger.warning("No courses found")
                return CanvasSyncData(courses=[], assignments=[], grades=[])
            
            # Step 2: Parallel fetch assignments and grades for all courses
            semaphore = asyncio.Semaphore(settings.MAX_CONCURRENT_REQUESTS)
            
            async def fetch_course_data(course_id: int):
                async with semaphore:
                    assignments, grades = await asyncio.gather(
                        self.get_course_assignments(course_id),
                        self.get_course_grades(course_id),
                        return_exceptions=True
                    )
                    
                    # Handle exceptions
                    if isinstance(assignments, Exception):
                        logger.error(f"Assignment fetch failed for course {course_id}", error=str(assignments))
                        assignments = []
                    if isinstance(grades, Exception):
                        logger.error(f"Grade fetch failed for course {course_id}", error=str(grades))
                        grades = []
                    
                    return assignments, grades
            
            # Execute parallel requests for all courses
            logger.info(f"Fetching data for {len(course_ids)} courses in parallel")
            course_data_results = await asyncio.gather(
                *[fetch_course_data(course_id) for course_id in course_ids],
                return_exceptions=True
            )
            
            # Aggregate results
            all_assignments = []
            all_grades = []
            
            for i, result in enumerate(course_data_results):
                if isinstance(result, Exception):
                    logger.error(f"Course data fetch failed for course {course_ids[i]}", error=str(result))
                    continue
                
                assignments, grades = result
                all_assignments.extend(assignments)
                all_grades.extend(grades)
            
            # Step 3: Optionally fetch submission details in parallel
            # This can be enabled for more detailed data
            submission_tasks = []
            for course in courses:
                course_assignments = [a for a in all_assignments if a.course_id == course.id]
                if course_assignments:
                    assignment_ids = [a.id for a in course_assignments]
                    submission_tasks.append(self.get_course_submissions(course.id, assignment_ids))
            
            if submission_tasks:
                logger.info(f"Fetching submissions for {len(submission_tasks)} courses")
                submissions_results = await asyncio.gather(*submission_tasks, return_exceptions=True)
                
                # Process submission results and update assignments
                for i, submissions in enumerate(submissions_results):
                    if isinstance(submissions, Exception):
                        continue
                    
                    for assignment in all_assignments:
                        if assignment.course_id == course_ids[i] and assignment.id in submissions:
                            submission_data = submissions[assignment.id]
                            if submission_data:
                                assignment.submitted_at = submission_data.get("submitted_at")
                                assignment.graded_at = submission_data.get("graded_at")
            
            end_time = datetime.now()
            duration = (end_time - start_time).total_seconds()
            
            logger.info(
                "Parallel Canvas data fetch completed",
                duration=f"{duration:.2f}s",
                courses=len(courses),
                assignments=len(all_assignments),
                grades=len(all_grades)
            )
            
            return CanvasSyncData(
                courses=courses,
                assignments=all_assignments,
                grades=all_grades
            )
            
        except Exception as e:
            logger.error("Parallel Canvas data fetch failed", error=str(e))
            raise


class CanvasWebhookService:
    """Handle Canvas webhooks for real-time updates"""
    
    def __init__(self):
        self.webhook_secret = os.getenv("CANVAS_WEBHOOK_SECRET")
    
    async def verify_webhook_signature(self, payload: bytes, signature: str) -> bool:
        """Verify webhook signature from Canvas"""
        # Implementation for webhook signature verification
        # This ensures webhooks are actually from Canvas
        pass
    
    async def process_webhook(self, event_type: str, payload: Dict[str, Any]) -> bool:
        """Process incoming Canvas webhook"""
        logger.info(f"Processing Canvas webhook: {event_type}")
        
        try:
            if event_type == "assignment_created":
                await self._handle_assignment_created(payload)
            elif event_type == "assignment_updated":
                await self._handle_assignment_updated(payload)
            elif event_type == "grade_changed":
                await self._handle_grade_changed(payload)
            elif event_type == "course_progress":
                await self._handle_course_progress(payload)
            
            return True
            
        except Exception as e:
            logger.error(f"Webhook processing failed for {event_type}", error=str(e))
            return False
    
    async def _handle_assignment_created(self, payload: Dict[str, Any]):
        """Handle new assignment webhook"""
        # Update database with new assignment
        pass
    
    async def _handle_assignment_updated(self, payload: Dict[str, Any]):
        """Handle assignment update webhook"""
        # Update assignment in database
        pass
    
    async def _handle_grade_changed(self, payload: Dict[str, Any]):
        """Handle grade change webhook"""
        # Update grade in database and trigger notifications
        pass
    
    async def _handle_course_progress(self, payload: Dict[str, Any]):
        """Handle course progress webhook"""
        # Update course progress analytics
        pass
