"""
Database Service for Canvas Integration
Handles all database operations with Supabase
"""

import asyncio
import asyncpg
import structlog
from typing import List, Dict, Any, Optional, Tuple
from datetime import datetime, timedelta
import uuid
import json

from app.config import settings
from app.models.schemas import (
    CanvasConnection, Course, Assignment, Grade, SyncLog,
    CanvasCourse, CanvasAssignment, CanvasGrade, CanvasSyncData,
    UserProfile, DashboardStats, CanvasAnnouncement, CanvasDiscussion,
    CanvasCalendarEvent, CanvasModule, CanvasModuleItem, CanvasQuiz,
    CanvasFile, CanvasPage, CanvasRubric, CanvasUserProfile
)
from app.services.canvas_service import CanvasTokenManager

logger = structlog.get_logger()


class DatabaseService:
    """Database service for Canvas integration"""
    
    def __init__(self):
        self.connection_pool = None
    
    async def init_pool(self):
        """Initialize database connection pool"""
        try:
            self.connection_pool = await asyncpg.create_pool(
                settings.DATABASE_URL,
                min_size=5,
                max_size=20,
                command_timeout=60
            )
            logger.info("Database connection pool initialized")
        except Exception as e:
            logger.error("Failed to initialize database pool", error=str(e))
            raise
    
    async def close_pool(self):
        """Close database connection pool"""
        if self.connection_pool:
            await self.connection_pool.close()
            logger.info("Database connection pool closed")
    
    async def get_user_profile(self, user_id: str) -> Optional[UserProfile]:
        """Get user profile by ID"""
        async with self.connection_pool.acquire() as conn:
            row = await conn.fetchrow(
                "SELECT * FROM profiles WHERE id = $1",
                uuid.UUID(user_id)
            )
            if row:
                return UserProfile(**dict(row))
            return None
    
    async def create_or_update_canvas_connection(
        self, 
        user_id: str, 
        canvas_url: str, 
        canvas_name: str, 
        api_token: str
    ) -> CanvasConnection:
        """Create or update Canvas connection with encrypted token"""
        
        # Encrypt the API token
        encrypted_token, encryption_key = CanvasTokenManager.encrypt_token(api_token)
        
        async with self.connection_pool.acquire() as conn:
            # Check if connection exists
            existing = await conn.fetchrow(
                "SELECT id FROM canvas_connections WHERE user_id = $1 AND canvas_url = $2",
                uuid.UUID(user_id), canvas_url
            )
            
            if existing:
                # Update existing connection
                row = await conn.fetchrow("""
                    UPDATE canvas_connections 
                    SET encrypted_token = $3, token_salt = $4, canvas_name = $5, 
                        status = 'connected', updated_at = NOW()
                    WHERE id = $1
                    RETURNING *
                """, existing['id'], encrypted_token, encryption_key, canvas_name)
            else:
                # Create new connection
                row = await conn.fetchrow("""
                    INSERT INTO canvas_connections 
                    (user_id, canvas_url, canvas_name, encrypted_token, token_salt, status)
                    VALUES ($1, $2, $3, $4, $5, 'connected')
                    RETURNING *
                """, uuid.UUID(user_id), canvas_url, canvas_name, encrypted_token, encryption_key)
            
            return CanvasConnection(**dict(row))
    
    async def get_canvas_connections(self, user_id: str) -> List[CanvasConnection]:
        """Get all Canvas connections for user"""
        async with self.connection_pool.acquire() as conn:
            rows = await conn.fetch(
                "SELECT * FROM canvas_connections WHERE user_id = $1 ORDER BY created_at DESC",
                uuid.UUID(user_id)
            )
            return [CanvasConnection(**dict(row)) for row in rows]
    
    async def get_canvas_connection_with_token(self, connection_id: str) -> Optional[Tuple[CanvasConnection, str]]:
        """Get Canvas connection and decrypt token"""
        async with self.connection_pool.acquire() as conn:
            row = await conn.fetchrow(
                "SELECT * FROM canvas_connections WHERE id = $1",
                uuid.UUID(connection_id)
            )
            if row:
                connection = CanvasConnection(**dict(row))
                # Decrypt token
                token = CanvasTokenManager.decrypt_token(
                    row['encrypted_token'], 
                    row['token_salt']
                )
                return connection, token
            return None
    
    async def create_sync_log(
        self, 
        user_id: str, 
        connection_id: str, 
        sync_type: str = "full"
    ) -> SyncLog:
        """Create new sync log entry"""
        async with self.connection_pool.acquire() as conn:
            row = await conn.fetchrow("""
                INSERT INTO sync_logs 
                (user_id, canvas_connection_id, status, sync_type, started_at)
                VALUES ($1, $2, 'syncing', $3, NOW())
                RETURNING *
            """, uuid.UUID(user_id), uuid.UUID(connection_id), sync_type)
            
            return SyncLog(**dict(row))
    
    async def update_sync_log(
        self, 
        sync_log_id: str, 
        status: str, 
        items_synced: int = 0, 
        error_message: Optional[str] = None
    ):
        """Update sync log with completion status"""
        async with self.connection_pool.acquire() as conn:
            await conn.execute("""
                UPDATE sync_logs 
                SET status = $2, completed_at = NOW(), items_synced = $3, error_message = $4
                WHERE id = $1
            """, uuid.UUID(sync_log_id), status, items_synced, error_message)
    
    async def sync_canvas_data(
        self, 
        user_id: str, 
        connection_id: str, 
        sync_data: CanvasSyncData
    ) -> int:
        """Sync comprehensive Canvas data to database with parallel processing"""
        total_synced = 0
        
        async with self.connection_pool.acquire() as conn:
            async with conn.transaction():
                # Sync user profile first
                if sync_data.user_profile:
                    await self._sync_user_profile(conn, user_id, sync_data.user_profile)
                    total_synced += 1
                
                # Sync courses and get course mapping
                course_mapping = {}
                for canvas_course in sync_data.courses:
                    row = await conn.fetchrow("""
                        INSERT INTO courses 
                        (user_id, canvas_connection_id, canvas_course_id, name, course_code, 
                         instructor_name, enrollment_status, start_date, end_date)
                        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
                        ON CONFLICT (canvas_connection_id, canvas_course_id) 
                        DO UPDATE SET
                            name = EXCLUDED.name,
                            course_code = EXCLUDED.course_code,
                            instructor_name = EXCLUDED.instructor_name,
                            enrollment_status = EXCLUDED.enrollment_status,
                            start_date = EXCLUDED.start_date,
                            end_date = EXCLUDED.end_date,
                            updated_at = NOW()
                        RETURNING id, canvas_course_id
                    """, 
                    uuid.UUID(user_id), 
                    uuid.UUID(connection_id),
                    str(canvas_course.id),
                    canvas_course.name,
                    canvas_course.course_code,
                    canvas_course.teachers[0]['display_name'] if canvas_course.teachers else None,
                    'active',
                    canvas_course.start_at,
                    canvas_course.end_at
                    )
                    
                    course_mapping[str(canvas_course.id)] = row['id']
                    total_synced += 1
                
                # Sync assignments
                assignment_mapping = {}
                for canvas_assignment in sync_data.assignments:
                    course_id = course_mapping.get(str(canvas_assignment.course_id))
                    if not course_id:
                        continue
                    
                    # Determine assignment status
                    status = 'upcoming'
                    if canvas_assignment.due_at:
                        due_date = datetime.fromisoformat(canvas_assignment.due_at.replace('Z', '+00:00'))
                        if due_date < datetime.now(due_date.tzinfo):
                            status = 'overdue'
                    
                    if canvas_assignment.submitted_at:
                        status = 'submitted'
                    if canvas_assignment.graded_at:
                        status = 'completed'
                    
                    row = await conn.fetchrow("""
                        INSERT INTO assignments 
                        (user_id, course_id, canvas_assignment_id, title, description, 
                         due_date, points_possible, submission_types, status, 
                         submitted_at, graded_at)
                        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
                        ON CONFLICT (course_id, canvas_assignment_id) 
                        DO UPDATE SET
                            title = EXCLUDED.title,
                            description = EXCLUDED.description,
                            due_date = EXCLUDED.due_date,
                            points_possible = EXCLUDED.points_possible,
                            submission_types = EXCLUDED.submission_types,
                            status = EXCLUDED.status,
                            submitted_at = EXCLUDED.submitted_at,
                            graded_at = EXCLUDED.graded_at,
                            updated_at = NOW()
                        RETURNING id
                    """,
                    uuid.UUID(user_id),
                    course_id,
                    str(canvas_assignment.id),
                    canvas_assignment.name,
                    canvas_assignment.description,
                    canvas_assignment.due_at,
                    canvas_assignment.points_possible,
                    canvas_assignment.submission_types,
                    status,
                    canvas_assignment.submitted_at,
                    canvas_assignment.graded_at
                    )
                    assignment_mapping[str(canvas_assignment.id)] = row['id']
                    total_synced += 1
                
                # Sync grades
                for canvas_grade in sync_data.grades:
                    course_id = course_mapping.get(str(canvas_grade.course_id))
                    if not course_id:
                        continue
                    
                    grades_data = canvas_grade.grades or {}
                    
                    await conn.execute("""
                        INSERT INTO grades 
                        (user_id, course_id, canvas_grade_id, score, grade, 
                         points_possible, graded_at)
                        VALUES ($1, $2, $3, $4, $5, $6, $7)
                        ON CONFLICT (user_id, course_id, canvas_grade_id) 
                        DO UPDATE SET
                            score = EXCLUDED.score,
                            grade = EXCLUDED.grade,
                            points_possible = EXCLUDED.points_possible,
                            graded_at = EXCLUDED.graded_at,
                            updated_at = NOW()
                    """,
                    uuid.UUID(user_id),
                    course_id,
                    str(canvas_grade.id) if canvas_grade.id else None,
                    grades_data.get('current_score'),
                    grades_data.get('current_grade'),
                    grades_data.get('total_points'),
                    grades_data.get('updated_at')
                    )
                    total_synced += 1
                
                # Sync announcements
                for announcement in sync_data.announcements:
                    course_id = course_mapping.get(str(announcement.course_id))
                    if not course_id:
                        continue
                    
                    await self._sync_announcement(conn, user_id, course_id, announcement)
                    total_synced += 1
                
                # Sync discussions
                for discussion in sync_data.discussions:
                    course_id = course_mapping.get(str(discussion.course_id))
                    if not course_id:
                        continue
                    
                    await self._sync_discussion(conn, user_id, course_id, discussion)
                    total_synced += 1
                
                # Sync calendar events
                for event in sync_data.calendar_events:
                    course_id = None
                    if event.course_id:
                        course_id = course_mapping.get(str(event.course_id))
                    
                    await self._sync_calendar_event(conn, user_id, course_id, event)
                    total_synced += 1
                
                # Sync modules and get module mapping
                module_mapping = {}
                for module in sync_data.modules:
                    course_id = course_mapping.get(str(module.course_id))
                    if not course_id:
                        continue
                    
                    row = await self._sync_module(conn, user_id, course_id, module)
                    module_mapping[str(module.id)] = row['id']
                    total_synced += 1
                
                # Sync module items
                for item in sync_data.module_items:
                    course_id = course_mapping.get(str(item.course_id))
                    module_id = module_mapping.get(str(item.module_id))
                    if not course_id or not module_id:
                        continue
                    
                    await self._sync_module_item(conn, user_id, course_id, module_id, item)
                    total_synced += 1
                
                # Sync quizzes
                for quiz in sync_data.quizzes:
                    course_id = course_mapping.get(str(quiz.course_id))
                    if not course_id:
                        continue
                    
                    # Find related assignment if exists
                    assignment_id = None
                    if quiz.assignment_id:
                        assignment_id = assignment_mapping.get(str(quiz.assignment_id))
                    
                    await self._sync_quiz(conn, user_id, course_id, assignment_id, quiz)
                    total_synced += 1
                
                # Sync files
                for file in sync_data.files:
                    course_id = None
                    if file.course_id:
                        course_id = course_mapping.get(str(file.course_id))
                    
                    await self._sync_file(conn, user_id, course_id, file)
                    total_synced += 1
                
                # Sync pages
                for page in sync_data.pages:
                    course_id = course_mapping.get(str(page.course_id))
                    if not course_id:
                        continue
                    
                    await self._sync_page(conn, user_id, course_id, page)
                    total_synced += 1
                
                # Sync rubrics
                for rubric in sync_data.rubrics:
                    course_id = course_mapping.get(str(rubric.course_id))
                    if not course_id:
                        continue
                    
                    await self._sync_rubric(conn, user_id, course_id, rubric)
                    total_synced += 1
                
                # Update connection last sync time
                await conn.execute("""
                    UPDATE canvas_connections 
                    SET last_sync = NOW(), status = 'connected'
                    WHERE id = $1
                """, uuid.UUID(connection_id))
        
        logger.info(f"Synced {total_synced} items for user {user_id}")
        return total_synced
    
    async def _sync_user_profile(self, conn, user_id: str, profile: CanvasUserProfile):
        """Sync Canvas user profile"""
        await conn.execute("""
            INSERT INTO canvas_user_profiles 
            (user_id, canvas_user_id, name, short_name, sortable_name, 
             avatar_url, bio, primary_email, login_id, time_zone, locale)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
            ON CONFLICT (user_id, canvas_user_id) 
            DO UPDATE SET
                name = EXCLUDED.name,
                short_name = EXCLUDED.short_name,
                sortable_name = EXCLUDED.sortable_name,
                avatar_url = EXCLUDED.avatar_url,
                bio = EXCLUDED.bio,
                primary_email = EXCLUDED.primary_email,
                login_id = EXCLUDED.login_id,
                time_zone = EXCLUDED.time_zone,
                locale = EXCLUDED.locale,
                updated_at = NOW()
        """,
        uuid.UUID(user_id), str(profile.id), profile.name, profile.short_name,
        profile.sortable_name, profile.avatar_url, profile.bio, profile.primary_email,
        profile.login_id, profile.time_zone, profile.locale)
    
    async def _sync_announcement(self, conn, user_id: str, course_id: str, announcement: CanvasAnnouncement):
        """Sync Canvas announcement"""
        author_info = announcement.author or {}
        await conn.execute("""
            INSERT INTO canvas_announcements 
            (user_id, course_id, canvas_announcement_id, title, message, 
             posted_at, delayed_post_at, author_name, author_id)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            ON CONFLICT (course_id, canvas_announcement_id) 
            DO UPDATE SET
                title = EXCLUDED.title,
                message = EXCLUDED.message,
                posted_at = EXCLUDED.posted_at,
                delayed_post_at = EXCLUDED.delayed_post_at,
                author_name = EXCLUDED.author_name,
                author_id = EXCLUDED.author_id,
                updated_at = NOW()
        """,
        uuid.UUID(user_id), course_id, str(announcement.id), announcement.title,
        announcement.message, announcement.posted_at, announcement.delayed_post_at,
        author_info.get('display_name'), str(author_info.get('id')) if author_info.get('id') else None)
    
    async def _sync_discussion(self, conn, user_id: str, course_id: str, discussion: CanvasDiscussion):
        """Sync Canvas discussion"""
        author_info = discussion.author or {}
        await conn.execute("""
            INSERT INTO canvas_discussions 
            (user_id, course_id, canvas_discussion_id, title, message, 
             posted_at, last_reply_at, discussion_type, author_name, author_id)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
            ON CONFLICT (course_id, canvas_discussion_id) 
            DO UPDATE SET
                title = EXCLUDED.title,
                message = EXCLUDED.message,
                posted_at = EXCLUDED.posted_at,
                last_reply_at = EXCLUDED.last_reply_at,
                discussion_type = EXCLUDED.discussion_type,
                author_name = EXCLUDED.author_name,
                author_id = EXCLUDED.author_id,
                updated_at = NOW()
        """,
        uuid.UUID(user_id), course_id, str(discussion.id), discussion.title,
        discussion.message, discussion.posted_at, discussion.last_reply_at,
        discussion.discussion_type, author_info.get('display_name'), 
        str(author_info.get('id')) if author_info.get('id') else None)
    
    async def _sync_calendar_event(self, conn, user_id: str, course_id: str, event: CanvasCalendarEvent):
        """Sync Canvas calendar event"""
        await conn.execute("""
            INSERT INTO canvas_calendar_events 
            (user_id, course_id, canvas_event_id, title, description, 
             start_at, end_at, location_name, context_code, workflow_state)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
            ON CONFLICT (user_id, canvas_event_id) 
            DO UPDATE SET
                course_id = EXCLUDED.course_id,
                title = EXCLUDED.title,
                description = EXCLUDED.description,
                start_at = EXCLUDED.start_at,
                end_at = EXCLUDED.end_at,
                location_name = EXCLUDED.location_name,
                context_code = EXCLUDED.context_code,
                workflow_state = EXCLUDED.workflow_state,
                updated_at = NOW()
        """,
        uuid.UUID(user_id), course_id, str(event.id), event.title,
        event.description, event.start_at, event.end_at, event.location_name,
        event.context_code, event.workflow_state)
    
    async def _sync_module(self, conn, user_id: str, course_id: str, module: CanvasModule):
        """Sync Canvas module"""
        return await conn.fetchrow("""
            INSERT INTO canvas_modules 
            (user_id, course_id, canvas_module_id, name, position, 
             unlock_at, require_sequential_progress, prerequisite_module_ids, state)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            ON CONFLICT (course_id, canvas_module_id) 
            DO UPDATE SET
                name = EXCLUDED.name,
                position = EXCLUDED.position,
                unlock_at = EXCLUDED.unlock_at,
                require_sequential_progress = EXCLUDED.require_sequential_progress,
                prerequisite_module_ids = EXCLUDED.prerequisite_module_ids,
                state = EXCLUDED.state,
                updated_at = NOW()
            RETURNING id
        """,
        uuid.UUID(user_id), course_id, str(module.id), module.name,
        module.position, module.unlock_at, module.require_sequential_progress,
        [str(pid) for pid in module.prerequisite_module_ids] if module.prerequisite_module_ids else None,
        module.state)
    
    async def _sync_module_item(self, conn, user_id: str, course_id: str, module_id: str, item: CanvasModuleItem):
        """Sync Canvas module item"""
        await conn.execute("""
            INSERT INTO canvas_module_items 
            (user_id, course_id, module_id, canvas_item_id, title, position, 
             type, content_id, html_url, url, completion_requirement)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
            ON CONFLICT (module_id, canvas_item_id) 
            DO UPDATE SET
                title = EXCLUDED.title,
                position = EXCLUDED.position,
                type = EXCLUDED.type,
                content_id = EXCLUDED.content_id,
                html_url = EXCLUDED.html_url,
                url = EXCLUDED.url,
                completion_requirement = EXCLUDED.completion_requirement,
                updated_at = NOW()
        """,
        uuid.UUID(user_id), course_id, module_id, str(item.id), item.title,
        item.position, item.type, str(item.content_id) if item.content_id else None,
        item.html_url, item.url, json.dumps(item.completion_requirement) if item.completion_requirement else None)
    
    async def _sync_quiz(self, conn, user_id: str, course_id: str, assignment_id: str, quiz: CanvasQuiz):
        """Sync Canvas quiz"""
        await conn.execute("""
            INSERT INTO canvas_quizzes 
            (user_id, course_id, canvas_quiz_id, title, description, quiz_type, 
             assignment_id, time_limit, allowed_attempts, due_at, unlock_at, 
             lock_at, points_possible)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
            ON CONFLICT (course_id, canvas_quiz_id) 
            DO UPDATE SET
                title = EXCLUDED.title,
                description = EXCLUDED.description,
                quiz_type = EXCLUDED.quiz_type,
                assignment_id = EXCLUDED.assignment_id,
                time_limit = EXCLUDED.time_limit,
                allowed_attempts = EXCLUDED.allowed_attempts,
                due_at = EXCLUDED.due_at,
                unlock_at = EXCLUDED.unlock_at,
                lock_at = EXCLUDED.lock_at,
                points_possible = EXCLUDED.points_possible,
                updated_at = NOW()
        """,
        uuid.UUID(user_id), course_id, str(quiz.id), quiz.title, quiz.description,
        quiz.quiz_type, assignment_id, quiz.time_limit, quiz.allowed_attempts,
        quiz.due_at, quiz.unlock_at, quiz.lock_at, quiz.points_possible)
    
    async def _sync_file(self, conn, user_id: str, course_id: str, file: CanvasFile):
        """Sync Canvas file"""
        await conn.execute("""
            INSERT INTO canvas_files 
            (user_id, course_id, canvas_file_id, display_name, filename, 
             content_type, url, size, folder_id)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            ON CONFLICT (user_id, canvas_file_id) 
            DO UPDATE SET
                course_id = EXCLUDED.course_id,
                display_name = EXCLUDED.display_name,
                filename = EXCLUDED.filename,
                content_type = EXCLUDED.content_type,
                url = EXCLUDED.url,
                size = EXCLUDED.size,
                folder_id = EXCLUDED.folder_id,
                updated_at = NOW()
        """,
        uuid.UUID(user_id), course_id, str(file.id), file.display_name,
        file.filename, file.content_type, file.url, file.size,
        str(file.folder_id) if file.folder_id else None)
    
    async def _sync_page(self, conn, user_id: str, course_id: str, page: CanvasPage):
        """Sync Canvas page"""
        await conn.execute("""
            INSERT INTO canvas_pages 
            (user_id, course_id, canvas_page_id, title, body, 
             published, front_page, url)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            ON CONFLICT (course_id, canvas_page_id) 
            DO UPDATE SET
                title = EXCLUDED.title,
                body = EXCLUDED.body,
                published = EXCLUDED.published,
                front_page = EXCLUDED.front_page,
                url = EXCLUDED.url,
                updated_at = NOW()
        """,
        uuid.UUID(user_id), course_id, str(page.id) if page.id else None,
        page.title, page.body, page.published, page.front_page, page.url)
    
    async def _sync_rubric(self, conn, user_id: str, course_id: str, rubric: CanvasRubric):
        """Sync Canvas rubric"""
        await conn.execute("""
            INSERT INTO canvas_rubrics 
            (user_id, course_id, canvas_rubric_id, title, context_id, 
             context_type, points_possible, criteria)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            ON CONFLICT (course_id, canvas_rubric_id) 
            DO UPDATE SET
                title = EXCLUDED.title,
                context_id = EXCLUDED.context_id,
                context_type = EXCLUDED.context_type,
                points_possible = EXCLUDED.points_possible,
                criteria = EXCLUDED.criteria,
                updated_at = NOW()
        """,
        uuid.UUID(user_id), course_id, str(rubric.id), rubric.title,
        str(rubric.context_id) if rubric.context_id else None, rubric.context_type,
        rubric.points_possible, json.dumps(rubric.criteria) if rubric.criteria else None)
    
    async def get_user_courses(self, user_id: str) -> List[Course]:
        """Get all courses for user"""
        async with self.connection_pool.acquire() as conn:
            rows = await conn.fetch("""
                SELECT * FROM courses 
                WHERE user_id = $1 
                ORDER BY name
            """, uuid.UUID(user_id))
            
            return [Course(**dict(row)) for row in rows]
    
    async def get_user_assignments(
        self, 
        user_id: str, 
        course_id: Optional[str] = None,
        status: Optional[str] = None,
        limit: int = 50,
        offset: int = 0
    ) -> List[Assignment]:
        """Get assignments for user with filtering"""
        
        query = """
            SELECT a.*, c.name as course_name, c.course_code 
            FROM assignments a
            JOIN courses c ON a.course_id = c.id
            WHERE a.user_id = $1
        """
        params = [uuid.UUID(user_id)]
        param_count = 1
        
        if course_id:
            param_count += 1
            query += f" AND a.course_id = ${param_count}"
            params.append(uuid.UUID(course_id))
        
        if status:
            param_count += 1
            query += f" AND a.status = ${param_count}"
            params.append(status)
        
        query += " ORDER BY a.due_date ASC NULLS LAST"
        
        param_count += 1
        query += f" LIMIT ${param_count}"
        params.append(limit)
        
        param_count += 1
        query += f" OFFSET ${param_count}"
        params.append(offset)
        
        async with self.connection_pool.acquire() as conn:
            rows = await conn.fetch(query, *params)
            
            assignments = []
            for row in rows:
                assignment_dict = dict(row)
                # Remove course fields from assignment dict
                course_name = assignment_dict.pop('course_name', None)
                course_code = assignment_dict.pop('course_code', None)
                
                assignment = Assignment(**assignment_dict)
                # Add course info if needed
                if course_name:
                    assignment.course = Course(
                        id=assignment.course_id,
                        name=course_name,
                        course_code=course_code,
                        **{}  # Other course fields would need to be queried separately
                    )
                
                assignments.append(assignment)
            
            return assignments
    
    async def get_user_grades(self, user_id: str, course_id: Optional[str] = None) -> List[Grade]:
        """Get grades for user"""
        query = "SELECT * FROM grades WHERE user_id = $1"
        params = [uuid.UUID(user_id)]
        
        if course_id:
            query += " AND course_id = $2"
            params.append(uuid.UUID(course_id))
        
        query += " ORDER BY graded_at DESC"
        
        async with self.connection_pool.acquire() as conn:
            rows = await conn.fetch(query, *params)
            return [Grade(**dict(row)) for row in rows]
    
    async def get_dashboard_stats(self, user_id: str) -> DashboardStats:
        """Get dashboard statistics for user"""
        async with self.connection_pool.acquire() as conn:
            row = await conn.fetchrow("""
                SELECT 
                    COUNT(DISTINCT c.id) as total_courses,
                    COUNT(DISTINCT CASE WHEN a.status = 'completed' THEN a.id END) as completed_assignments,
                    COUNT(DISTINCT CASE WHEN a.status = 'upcoming' AND a.due_date > NOW() THEN a.id END) as upcoming_assignments,
                    COUNT(DISTINCT CASE WHEN a.status = 'overdue' THEN a.id END) as overdue_assignments,
                    COALESCE(AVG(g.score), 0) as average_score,
                    COALESCE(SUM(ss.duration_minutes), 0) as total_study_time_week
                FROM profiles p
                LEFT JOIN courses c ON c.user_id = p.id
                LEFT JOIN assignments a ON a.user_id = p.id
                LEFT JOIN grades g ON g.user_id = p.id
                LEFT JOIN study_sessions ss ON ss.user_id = p.id AND ss.started_at >= NOW() - INTERVAL '7 days'
                WHERE p.id = $1
                GROUP BY p.id
            """, uuid.UUID(user_id))
            
            if row:
                return DashboardStats(**dict(row))
            else:
                return DashboardStats(
                    total_courses=0,
                    completed_assignments=0,
                    upcoming_assignments=0,
                    overdue_assignments=0,
                    average_score=0.0,
                    total_study_time_week=0
                )
    
    async def get_recent_sync_logs(self, user_id: str, limit: int = 10) -> List[SyncLog]:
        """Get recent sync logs for user"""
        async with self.connection_pool.acquire() as conn:
            rows = await conn.fetch("""
                SELECT sl.* FROM sync_logs sl
                JOIN canvas_connections cc ON sl.canvas_connection_id = cc.id
                WHERE cc.user_id = $1
                ORDER BY sl.started_at DESC
                LIMIT $2
            """, uuid.UUID(user_id), limit)
            
            return [SyncLog(**dict(row)) for row in rows]
    
    # New methods for comprehensive Canvas data retrieval
    async def get_user_announcements(
        self, 
        user_id: str, 
        course_id: Optional[str] = None,
        limit: int = 50,
        offset: int = 0
    ):
        """Get Canvas announcements for user"""
        query = """
            SELECT ca.*, c.name as course_name 
            FROM canvas_announcements ca
            JOIN courses c ON ca.course_id = c.id
            WHERE ca.user_id = $1
        """
        params = [uuid.UUID(user_id)]
        param_count = 1
        
        if course_id:
            param_count += 1
            query += f" AND ca.course_id = ${param_count}"
            params.append(uuid.UUID(course_id))
        
        query += " ORDER BY ca.posted_at DESC NULLS LAST"
        
        param_count += 1
        query += f" LIMIT ${param_count}"
        params.append(limit)
        
        param_count += 1
        query += f" OFFSET ${param_count}"
        params.append(offset)
        
        async with self.connection_pool.acquire() as conn:
            rows = await conn.fetch(query, *params)
            return [dict(row) for row in rows]
    
    async def get_user_discussions(
        self, 
        user_id: str, 
        course_id: Optional[str] = None,
        limit: int = 50,
        offset: int = 0
    ):
        """Get Canvas discussions for user"""
        query = """
            SELECT cd.*, c.name as course_name 
            FROM canvas_discussions cd
            JOIN courses c ON cd.course_id = c.id
            WHERE cd.user_id = $1
        """
        params = [uuid.UUID(user_id)]
        param_count = 1
        
        if course_id:
            param_count += 1
            query += f" AND cd.course_id = ${param_count}"
            params.append(uuid.UUID(course_id))
        
        query += " ORDER BY cd.posted_at DESC NULLS LAST"
        
        param_count += 1
        query += f" LIMIT ${param_count}"
        params.append(limit)
        
        param_count += 1
        query += f" OFFSET ${param_count}"
        params.append(offset)
        
        async with self.connection_pool.acquire() as conn:
            rows = await conn.fetch(query, *params)
            return [dict(row) for row in rows]
    
    async def get_user_calendar_events(
        self,
        user_id: str,
        course_id: Optional[str] = None,
        start_date: Optional[str] = None,
        end_date: Optional[str] = None,
        limit: int = 100,
        offset: int = 0
    ):
        """Get Canvas calendar events for user"""
        query = """
            SELECT ce.*, c.name as course_name 
            FROM canvas_calendar_events ce
            LEFT JOIN courses c ON ce.course_id = c.id
            WHERE ce.user_id = $1
        """
        params = [uuid.UUID(user_id)]
        param_count = 1
        
        if course_id:
            param_count += 1
            query += f" AND ce.course_id = ${param_count}"
            params.append(uuid.UUID(course_id))
        
        if start_date:
            param_count += 1
            query += f" AND ce.start_at >= ${param_count}"
            params.append(start_date)
        
        if end_date:
            param_count += 1
            query += f" AND ce.end_at <= ${param_count}"
            params.append(end_date)
        
        query += " ORDER BY ce.start_at ASC NULLS LAST"
        
        param_count += 1
        query += f" LIMIT ${param_count}"
        params.append(limit)
        
        param_count += 1
        query += f" OFFSET ${param_count}"
        params.append(offset)
        
        async with self.connection_pool.acquire() as conn:
            rows = await conn.fetch(query, *params)
            return [dict(row) for row in rows]
    
    async def get_user_modules(
        self, 
        user_id: str, 
        course_id: Optional[str] = None
    ):
        """Get Canvas modules for user"""
        query = """
            SELECT cm.*, c.name as course_name 
            FROM canvas_modules cm
            JOIN courses c ON cm.course_id = c.id
            WHERE cm.user_id = $1
        """
        params = [uuid.UUID(user_id)]
        
        if course_id:
            query += " AND cm.course_id = $2"
            params.append(uuid.UUID(course_id))
        
        query += " ORDER BY c.name, cm.position ASC NULLS LAST"
        
        async with self.connection_pool.acquire() as conn:
            rows = await conn.fetch(query, *params)
            return [dict(row) for row in rows]
    
    async def get_user_module_items(
        self, 
        user_id: str, 
        course_id: Optional[str] = None,
        module_id: Optional[str] = None
    ):
        """Get Canvas module items for user"""
        query = """
            SELECT cmi.*, c.name as course_name, cm.name as module_name 
            FROM canvas_module_items cmi
            JOIN courses c ON cmi.course_id = c.id
            JOIN canvas_modules cm ON cmi.module_id = cm.id
            WHERE cmi.user_id = $1
        """
        params = [uuid.UUID(user_id)]
        param_count = 1
        
        if course_id:
            param_count += 1
            query += f" AND cmi.course_id = ${param_count}"
            params.append(uuid.UUID(course_id))
        
        if module_id:
            param_count += 1
            query += f" AND cmi.module_id = ${param_count}"
            params.append(uuid.UUID(module_id))
        
        query += " ORDER BY c.name, cm.position, cmi.position ASC NULLS LAST"
        
        async with self.connection_pool.acquire() as conn:
            rows = await conn.fetch(query, *params)
            return [dict(row) for row in rows]
    
    async def get_user_quizzes(
        self, 
        user_id: str, 
        course_id: Optional[str] = None,
        limit: int = 50,
        offset: int = 0
    ):
        """Get Canvas quizzes for user"""
        query = """
            SELECT cq.*, c.name as course_name 
            FROM canvas_quizzes cq
            JOIN courses c ON cq.course_id = c.id
            WHERE cq.user_id = $1
        """
        params = [uuid.UUID(user_id)]
        param_count = 1
        
        if course_id:
            param_count += 1
            query += f" AND cq.course_id = ${param_count}"
            params.append(uuid.UUID(course_id))
        
        query += " ORDER BY cq.due_at ASC NULLS LAST"
        
        param_count += 1
        query += f" LIMIT ${param_count}"
        params.append(limit)
        
        param_count += 1
        query += f" OFFSET ${param_count}"
        params.append(offset)
        
        async with self.connection_pool.acquire() as conn:
            rows = await conn.fetch(query, *params)
            return [dict(row) for row in rows]
    
    async def get_user_files(
        self, 
        user_id: str, 
        course_id: Optional[str] = None,
        limit: int = 50,
        offset: int = 0
    ):
        """Get Canvas files for user"""
        query = """
            SELECT cf.*, c.name as course_name 
            FROM canvas_files cf
            LEFT JOIN courses c ON cf.course_id = c.id
            WHERE cf.user_id = $1
        """
        params = [uuid.UUID(user_id)]
        param_count = 1
        
        if course_id:
            param_count += 1
            query += f" AND cf.course_id = ${param_count}"
            params.append(uuid.UUID(course_id))
        
        query += " ORDER BY cf.updated_at DESC NULLS LAST"
        
        param_count += 1
        query += f" LIMIT ${param_count}"
        params.append(limit)
        
        param_count += 1
        query += f" OFFSET ${param_count}"
        params.append(offset)
        
        async with self.connection_pool.acquire() as conn:
            rows = await conn.fetch(query, *params)
            return [dict(row) for row in rows]
    
    async def get_user_pages(
        self, 
        user_id: str, 
        course_id: Optional[str] = None,
        limit: int = 50,
        offset: int = 0
    ):
        """Get Canvas pages for user"""
        query = """
            SELECT cp.*, c.name as course_name 
            FROM canvas_pages cp
            JOIN courses c ON cp.course_id = c.id
            WHERE cp.user_id = $1
        """
        params = [uuid.UUID(user_id)]
        param_count = 1
        
        if course_id:
            param_count += 1
            query += f" AND cp.course_id = ${param_count}"
            params.append(uuid.UUID(course_id))
        
        query += " ORDER BY cp.updated_at DESC NULLS LAST"
        
        param_count += 1
        query += f" LIMIT ${param_count}"
        params.append(limit)
        
        param_count += 1
        query += f" OFFSET ${param_count}"
        params.append(offset)
        
        async with self.connection_pool.acquire() as conn:
            rows = await conn.fetch(query, *params)
            return [dict(row) for row in rows]
    
    async def get_user_rubrics(
        self, 
        user_id: str, 
        course_id: Optional[str] = None
    ):
        """Get Canvas rubrics for user"""
        query = """
            SELECT cr.*, c.name as course_name 
            FROM canvas_rubrics cr
            JOIN courses c ON cr.course_id = c.id
            WHERE cr.user_id = $1
        """
        params = [uuid.UUID(user_id)]
        
        if course_id:
            query += " AND cr.course_id = $2"
            params.append(uuid.UUID(course_id))
        
        query += " ORDER BY c.name, cr.title"
        
        async with self.connection_pool.acquire() as conn:
            rows = await conn.fetch(query, *params)
            return [dict(row) for row in rows]
    
    async def get_canvas_user_profile(self, user_id: str):
        """Get Canvas user profile for user"""
        async with self.connection_pool.acquire() as conn:
            row = await conn.fetchrow("""
                SELECT * FROM canvas_user_profiles 
                WHERE user_id = $1
                ORDER BY updated_at DESC
                LIMIT 1
            """, uuid.UUID(user_id))
            
            if row:
                return dict(row)
            return None


# Global database service instance
db_service = DatabaseService()
