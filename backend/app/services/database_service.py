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
    UserProfile, DashboardStats
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
        """Sync Canvas data to database with parallel processing"""
        total_synced = 0
        
        async with self.connection_pool.acquire() as conn:
            async with conn.transaction():
                # Sync courses
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
                    
                    await conn.execute("""
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
                
                # Update connection last sync time
                await conn.execute("""
                    UPDATE canvas_connections 
                    SET last_sync = NOW(), status = 'connected'
                    WHERE id = $1
                """, uuid.UUID(connection_id))
        
        logger.info(f"Synced {total_synced} items for user {user_id}")
        return total_synced
    
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


# Global database service instance
db_service = DatabaseService()
