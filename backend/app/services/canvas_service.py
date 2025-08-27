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
    CanvasValidationResponse, CanvasAnnouncement, CanvasDiscussion,
    CanvasCalendarEvent, CanvasModule, CanvasModuleItem, CanvasQuiz,
    CanvasFile, CanvasPage, CanvasRubric, CanvasUserProfile
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
                    "include[]": ["teachers", "term", "total_scores", "course_progress"]
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
    
    async def get_user_profile(self) -> CanvasUserProfile:
        """Fetch user profile information"""
        try:
            profile_data = await self._make_request(
                "/users/self/profile",
                params={"include[]": ["avatar_url", "bio", "primary_email"]}
            )
            return CanvasUserProfile(**profile_data)
        except Exception as e:
            logger.error("Failed to fetch user profile", error=str(e))
            return None
    
    async def get_course_announcements(self, course_id: int) -> List[CanvasAnnouncement]:
        """Fetch announcements for a specific course"""
        try:
            announcements_data = await self._make_request(
                f"/courses/{course_id}/discussion_topics",
                params={
                    "only_announcements": "true",
                    "per_page": 100,
                    "include[]": ["author"]
                }
            )
            
            announcements = []
            for announcement_data in announcements_data:
                announcement_data["course_id"] = course_id
                announcements.append(CanvasAnnouncement(**announcement_data))
            
            return announcements
            
        except Exception as e:
            logger.error(f"Failed to fetch announcements for course {course_id}", error=str(e))
            return []
    
    async def get_course_discussions(self, course_id: int) -> List[CanvasDiscussion]:
        """Fetch discussions for a specific course"""
        try:
            discussions_data = await self._make_request(
                f"/courses/{course_id}/discussion_topics",
                params={
                    "per_page": 100,
                    "include[]": ["author", "last_reply_at"]
                }
            )
            
            discussions = []
            for discussion_data in discussions_data:
                discussion_data["course_id"] = course_id
                discussions.append(CanvasDiscussion(**discussion_data))
            
            return discussions
            
        except Exception as e:
            logger.error(f"Failed to fetch discussions for course {course_id}", error=str(e))
            return []
    
    async def get_calendar_events(self, course_ids: List[int] = None) -> List[CanvasCalendarEvent]:
        """Fetch calendar events"""
        try:
            params = {
                "per_page": 100,
                "start_date": (datetime.now() - timedelta(days=30)).isoformat(),
                "end_date": (datetime.now() + timedelta(days=90)).isoformat()
            }
            
            if course_ids:
                params["context_codes[]"] = [f"course_{cid}" for cid in course_ids]
            
            events_data = await self._make_request("/calendar_events", params=params)
            
            events = []
            for event_data in events_data:
                # Extract course_id from context_code if available
                context_code = event_data.get("context_code", "")
                if context_code.startswith("course_"):
                    event_data["course_id"] = int(context_code.split("_")[1])
                events.append(CanvasCalendarEvent(**event_data))
            
            return events
            
        except Exception as e:
            logger.error("Failed to fetch calendar events", error=str(e))
            return []
    
    async def get_course_modules(self, course_id: int) -> List[CanvasModule]:
        """Fetch modules for a specific course"""
        try:
            modules_data = await self._make_request(
                f"/courses/{course_id}/modules",
                params={
                    "per_page": 100,
                    "include[]": ["items", "content_details"]
                }
            )
            
            modules = []
            for module_data in modules_data:
                module_data["course_id"] = course_id
                modules.append(CanvasModule(**module_data))
            
            return modules
            
        except Exception as e:
            logger.error(f"Failed to fetch modules for course {course_id}", error=str(e))
            return []
    
    async def get_course_module_items(self, course_id: int, module_id: int) -> List[CanvasModuleItem]:
        """Fetch module items for a specific module"""
        try:
            items_data = await self._make_request(
                f"/courses/{course_id}/modules/{module_id}/items",
                params={
                    "per_page": 100,
                    "include[]": ["content_details", "mastery_paths"]
                }
            )
            
            items = []
            for item_data in items_data:
                item_data["module_id"] = module_id
                item_data["course_id"] = course_id
                items.append(CanvasModuleItem(**item_data))
            
            return items
            
        except Exception as e:
            logger.error(f"Failed to fetch module items for course {course_id}, module {module_id}", error=str(e))
            return []
    
    async def get_course_quizzes(self, course_id: int) -> List[CanvasQuiz]:
        """Fetch quizzes for a specific course"""
        try:
            quizzes_data = await self._make_request(
                f"/courses/{course_id}/quizzes",
                params={"per_page": 100}
            )
            
            quizzes = []
            for quiz_data in quizzes_data:
                quiz_data["course_id"] = course_id
                quizzes.append(CanvasQuiz(**quiz_data))
            
            return quizzes
            
        except Exception as e:
            logger.error(f"Failed to fetch quizzes for course {course_id}", error=str(e))
            return []
    
    async def get_course_files(self, course_id: int) -> List[CanvasFile]:
        """Fetch files for a specific course"""
        try:
            files_data = await self._make_request(
                f"/courses/{course_id}/files",
                params={
                    "per_page": 100,
                    "sort": "updated_at",
                    "order": "desc"
                }
            )
            
            files = []
            for file_data in files_data:
                file_data["course_id"] = course_id
                files.append(CanvasFile(**file_data))
            
            return files
            
        except Exception as e:
            logger.error(f"Failed to fetch files for course {course_id}", error=str(e))
            return []
    
    async def get_course_pages(self, course_id: int) -> List[CanvasPage]:
        """Fetch pages for a specific course"""
        try:
            pages_data = await self._make_request(
                f"/courses/{course_id}/pages",
                params={
                    "per_page": 100,
                    "sort": "updated_at",
                    "order": "desc"
                }
            )
            
            pages = []
            for page_data in pages_data:
                page_data["course_id"] = course_id
                pages.append(CanvasPage(**page_data))
            
            return pages
            
        except Exception as e:
            logger.error(f"Failed to fetch pages for course {course_id}", error=str(e))
            return []
    
    async def get_course_rubrics(self, course_id: int) -> List[CanvasRubric]:
        """Fetch rubrics for a specific course"""
        try:
            rubrics_data = await self._make_request(
                f"/courses/{course_id}/rubrics",
                params={"per_page": 100}
            )
            
            rubrics = []
            for rubric_data in rubrics_data:
                rubric_data["course_id"] = course_id
                rubrics.append(CanvasRubric(**rubric_data))
            
            return rubrics
            
        except Exception as e:
            logger.error(f"Failed to fetch rubrics for course {course_id}", error=str(e))
            return []
    
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
        logger.info("Starting comprehensive parallel Canvas data fetch")
        start_time = datetime.now()
        
        try:
            # Step 1: Fetch user profile and courses first
            user_profile, courses = await asyncio.gather(
                self.get_user_profile(),
                self.get_courses(),
                return_exceptions=True
            )
            
            if isinstance(user_profile, Exception):
                logger.error("User profile fetch failed", error=str(user_profile))
                user_profile = None
            
            if isinstance(courses, Exception):
                logger.error("Courses fetch failed", error=str(courses))
                courses = []
            
            course_ids = [course.id for course in courses]
            
            if not course_ids:
                logger.warning("No courses found")
                return CanvasSyncData(
                    courses=[], assignments=[], grades=[], announcements=[],
                    discussions=[], calendar_events=[], modules=[],
                    module_items=[], quizzes=[], files=[], pages=[],
                    rubrics=[], user_profile=user_profile
                )
            
            # Step 2: Fetch calendar events (global, not course-specific)
            calendar_events_task = self.get_calendar_events(course_ids)
            
            # Step 3: Parallel fetch all course-specific data
            semaphore = asyncio.Semaphore(settings.MAX_CONCURRENT_REQUESTS)
            
            async def fetch_course_data(course_id: int):
                async with semaphore:
                    # Fetch all course data in parallel
                    results = await asyncio.gather(
                        self.get_course_assignments(course_id),
                        self.get_course_grades(course_id),
                        self.get_course_announcements(course_id),
                        self.get_course_discussions(course_id),
                        self.get_course_modules(course_id),
                        self.get_course_quizzes(course_id),
                        self.get_course_files(course_id),
                        self.get_course_pages(course_id),
                        self.get_course_rubrics(course_id),
                        return_exceptions=True
                    )
                    
                    # Handle exceptions and unpack results
                    assignments, grades, announcements, discussions, modules, quizzes, files, pages, rubrics = results
                    
                    # Convert exceptions to empty lists
                    if isinstance(assignments, Exception):
                        logger.error(f"Assignment fetch failed for course {course_id}", error=str(assignments))
                        assignments = []
                    if isinstance(grades, Exception):
                        logger.error(f"Grade fetch failed for course {course_id}", error=str(grades))
                        grades = []
                    if isinstance(announcements, Exception):
                        logger.error(f"Announcements fetch failed for course {course_id}", error=str(announcements))
                        announcements = []
                    if isinstance(discussions, Exception):
                        logger.error(f"Discussions fetch failed for course {course_id}", error=str(discussions))
                        discussions = []
                    if isinstance(modules, Exception):
                        logger.error(f"Modules fetch failed for course {course_id}", error=str(modules))
                        modules = []
                    if isinstance(quizzes, Exception):
                        logger.error(f"Quizzes fetch failed for course {course_id}", error=str(quizzes))
                        quizzes = []
                    if isinstance(files, Exception):
                        logger.error(f"Files fetch failed for course {course_id}", error=str(files))
                        files = []
                    if isinstance(pages, Exception):
                        logger.error(f"Pages fetch failed for course {course_id}", error=str(pages))
                        pages = []
                    if isinstance(rubrics, Exception):
                        logger.error(f"Rubrics fetch failed for course {course_id}", error=str(rubrics))
                        rubrics = []
                    
                    return assignments, grades, announcements, discussions, modules, quizzes, files, pages, rubrics
            
            # Execute parallel requests for all courses
            logger.info(f"Fetching comprehensive data for {len(course_ids)} courses in parallel")
            course_data_results, calendar_events = await asyncio.gather(
                asyncio.gather(*[fetch_course_data(course_id) for course_id in course_ids], return_exceptions=True),
                calendar_events_task,
                return_exceptions=True
            )
            
            # Handle calendar events exception
            if isinstance(calendar_events, Exception):
                logger.error("Calendar events fetch failed", error=str(calendar_events))
                calendar_events = []
            
            # Aggregate all results
            all_assignments = []
            all_grades = []
            all_announcements = []
            all_discussions = []
            all_modules = []
            all_quizzes = []
            all_files = []
            all_pages = []
            all_rubrics = []
            all_module_items = []
            
            for i, result in enumerate(course_data_results):
                if isinstance(result, Exception):
                    logger.error(f"Course data fetch failed for course {course_ids[i]}", error=str(result))
                    continue
                
                assignments, grades, announcements, discussions, modules, quizzes, files, pages, rubrics = result
                all_assignments.extend(assignments)
                all_grades.extend(grades)
                all_announcements.extend(announcements)
                all_discussions.extend(discussions)
                all_modules.extend(modules)
                all_quizzes.extend(quizzes)
                all_files.extend(files)
                all_pages.extend(pages)
                all_rubrics.extend(rubrics)
            
            # Step 4: Fetch module items for all modules
            if all_modules:
                logger.info(f"Fetching module items for {len(all_modules)} modules")
                module_items_tasks = []
                for module in all_modules:
                    module_items_tasks.append(self.get_course_module_items(module.course_id, module.id))
                
                module_items_results = await asyncio.gather(*module_items_tasks, return_exceptions=True)
                
                for items_result in module_items_results:
                    if isinstance(items_result, Exception):
                        continue
                    all_module_items.extend(items_result)
            
            # Step 5: Optionally fetch submission details in parallel
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
                "Comprehensive parallel Canvas data fetch completed",
                duration=f"{duration:.2f}s",
                courses=len(courses),
                assignments=len(all_assignments),
                grades=len(all_grades),
                announcements=len(all_announcements),
                discussions=len(all_discussions),
                calendar_events=len(calendar_events),
                modules=len(all_modules),
                module_items=len(all_module_items),
                quizzes=len(all_quizzes),
                files=len(all_files),
                pages=len(all_pages),
                rubrics=len(all_rubrics)
            )
            
            return CanvasSyncData(
                courses=courses,
                assignments=all_assignments,
                grades=all_grades,
                announcements=all_announcements,
                discussions=all_discussions,
                calendar_events=calendar_events,
                modules=all_modules,
                module_items=all_module_items,
                quizzes=all_quizzes,
                files=all_files,
                pages=all_pages,
                rubrics=all_rubrics,
                user_profile=user_profile
            )
            
        except Exception as e:
            logger.error("Comprehensive parallel Canvas data fetch failed", error=str(e))
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
