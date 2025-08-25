import crypto from 'crypto'
import { CanvasConnection, Course, Assignment, Grade } from '@/lib/types/database'

// Canvas API types
interface CanvasCourse {
  id: number
  name: string
  course_code: string
  enrollment_term_id?: number
  start_at?: string
  end_at?: string
  teachers?: Array<{ display_name: string }>
}

interface CanvasAssignment {
  id: number
  name: string
  description?: string
  due_at?: string
  points_possible?: number
  submission_types?: string[]
  submitted_at?: string
  graded_at?: string
  course_id: number
}

interface CanvasGrade {
  id?: number
  course_id: number
  grades?: {
    current_score?: number
    current_grade?: string
    total_points?: number
    updated_at?: string
  }
}

interface CanvasSyncData {
  courses: CanvasCourse[]
  assignments: CanvasAssignment[]
  grades: CanvasGrade[]
}

// Encryption utilities for Canvas tokens
const ENCRYPTION_ALGORITHM = 'aes-256-gcm'
const ENCRYPTION_KEY = process.env.CANVAS_ENCRYPTION_KEY || crypto.randomBytes(32).toString('hex')

export class CanvasTokenManager {
  static generateSalt(): string {
    return crypto.randomBytes(16).toString('hex')
  }

  static encryptToken(token: string, salt: string): string {
    const cipher = crypto.createCipher(ENCRYPTION_ALGORITHM, ENCRYPTION_KEY + salt)
    let encrypted = cipher.update(token, 'utf8', 'hex')
    encrypted += cipher.final('hex')
    return encrypted
  }

  static decryptToken(encryptedToken: string, salt: string): string {
    try {
      const decipher = crypto.createDecipher(ENCRYPTION_ALGORITHM, ENCRYPTION_KEY + salt)
      let decrypted = decipher.update(encryptedToken, 'hex', 'utf8')
      decrypted += decipher.final('utf8')
      return decrypted
    } catch (error) {
      throw new Error('Failed to decrypt Canvas token')
    }
  }
}

// Canvas API client
export class CanvasAPI {
  private baseUrl: string
  private token: string

  constructor(canvasUrl: string, token: string) {
    this.baseUrl = canvasUrl.endsWith('/') ? canvasUrl.slice(0, -1) : canvasUrl
    this.token = token
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = `${this.baseUrl}/api/v1${endpoint}`
    const headers = {
      'Authorization': `Bearer ${this.token}`,
      'Content-Type': 'application/json',
      ...options.headers,
    }

    try {
      const response = await fetch(url, {
        ...options,
        headers,
      })

      if (!response.ok) {
        throw new Error(`Canvas API error: ${response.status} ${response.statusText}`)
      }

      return await response.json()
    } catch (error) {
      console.error('Canvas API request failed:', error)
      throw error
    }
  }

  // Test connection
  async testConnection(): Promise<boolean> {
    try {
      await this.request('/users/self')
      return true
    } catch {
      return false
    }
  }

  // Get user profile
  async getProfile() {
    return this.request('/users/self')
  }

  // Get courses
  async getCourses(): Promise<CanvasCourse[]> {
    return this.request<CanvasCourse[]>('/courses?enrollment_state=active&per_page=100')
  }

  // Get course details
  async getCourse(courseId: string): Promise<CanvasCourse> {
    return this.request<CanvasCourse>(`/courses/${courseId}`)
  }

  // Get assignments for a course
  async getAssignments(courseId: string): Promise<CanvasAssignment[]> {
    return this.request<CanvasAssignment[]>(`/courses/${courseId}/assignments?per_page=100`)
  }

  // Get grades for a course
  async getGrades(courseId: string): Promise<CanvasGrade[]> {
    return this.request<CanvasGrade[]>(`/courses/${courseId}/enrollments?user_id=self&include[]=grades`)
  }

  // Get submissions for assignments
  async getSubmissions(courseId: string, assignmentId: string) {
    return this.request(`/courses/${courseId}/assignments/${assignmentId}/submissions?user_id=self`)
  }

  // Get all data for full sync
  async getFullSyncData(): Promise<CanvasSyncData> {
    const courses = await this.getCourses()
    const syncData: CanvasSyncData = {
      courses: [],
      assignments: [],
      grades: []
    }

    for (const course of courses) {
      try {
        const [assignments, grades] = await Promise.all([
          this.getAssignments(course.id.toString()),
          this.getGrades(course.id.toString())
        ])

        syncData.courses.push(course)
        syncData.assignments.push(...assignments.map((a) => ({ ...a, course_id: course.id })))
        syncData.grades.push(...grades.map((g) => ({ ...g, course_id: course.id })))
      } catch (error) {
        console.error(`Failed to sync course ${course.id}:`, error)
      }
    }

    return syncData
  }
}

// Canvas sync service
export class CanvasSyncService {
  private supabase: any

  constructor(supabaseClient: any) {
    this.supabase = supabaseClient
  }

  async syncCanvasData(connection: CanvasConnection, syncType: 'full' | 'incremental' = 'incremental') {
    const { user_id, canvas_url, encrypted_token, token_salt } = connection

    // Log sync start
    const { data: syncLog } = await this.supabase
      .from('sync_logs')
      .insert({
        user_id,
        canvas_connection_id: connection.id,
        status: 'syncing',
        sync_type: syncType,
        started_at: new Date().toISOString(),
      })
      .select()
      .single()

    try {
      // Decrypt token
      const token = CanvasTokenManager.decryptToken(encrypted_token, token_salt)
      const canvasAPI = new CanvasAPI(canvas_url, token)

      // Test connection
      const isConnected = await canvasAPI.testConnection()
      if (!isConnected) {
        throw new Error('Canvas connection failed')
      }

      // Get sync data
      const syncData = await canvasAPI.getFullSyncData()
      let itemsSynced = 0

      // Sync courses
      for (const canvasCourse of syncData.courses) {
        await this.supabase
          .from('courses')
          .upsert({
            user_id,
            canvas_connection_id: connection.id,
            canvas_course_id: canvasCourse.id.toString(),
            name: canvasCourse.name,
            course_code: canvasCourse.course_code,
            instructor_name: canvasCourse.teachers?.[0]?.display_name,
            enrollment_status: canvasCourse.enrollment_term_id ? 'active' : 'completed',
            start_date: canvasCourse.start_at,
            end_date: canvasCourse.end_at,
          }, {
            onConflict: 'canvas_connection_id,canvas_course_id'
          })
        itemsSynced++
      }

      // Get course mappings for assignments and grades
      const { data: courses } = await this.supabase
        .from('courses')
        .select('id, canvas_course_id')
        .eq('canvas_connection_id', connection.id)

      const courseMap = new Map(courses.map((c: any) => [c.canvas_course_id, c.id]))

      // Sync assignments
      for (const canvasAssignment of syncData.assignments) {
        const courseId = courseMap.get(canvasAssignment.course_id.toString())
        if (!courseId) continue

        // Determine assignment status
        let status = 'upcoming'
        const dueDate = canvasAssignment.due_at ? new Date(canvasAssignment.due_at) : null
        const now = new Date()
        
        if (dueDate && dueDate < now) {
          status = 'overdue'
        }
        if (canvasAssignment.submitted_at) {
          status = 'submitted'
        }
        if (canvasAssignment.graded_at) {
          status = 'completed'
        }

        await this.supabase
          .from('assignments')
          .upsert({
            user_id,
            course_id: courseId,
            canvas_assignment_id: canvasAssignment.id.toString(),
            title: canvasAssignment.name,
            description: canvasAssignment.description,
            due_date: canvasAssignment.due_at,
            points_possible: canvasAssignment.points_possible,
            submission_types: canvasAssignment.submission_types,
            status,
            submitted_at: canvasAssignment.submitted_at,
            graded_at: canvasAssignment.graded_at,
          }, {
            onConflict: 'course_id,canvas_assignment_id'
          })
        itemsSynced++
      }

      // Sync grades
      for (const canvasGrade of syncData.grades) {
        const courseId = courseMap.get(canvasGrade.course_id.toString())
        if (!courseId) continue

        await this.supabase
          .from('grades')
          .upsert({
            user_id,
            course_id: courseId,
            canvas_grade_id: canvasGrade.id?.toString(),
            score: canvasGrade.grades?.current_score,
            grade: canvasGrade.grades?.current_grade,
            points_possible: canvasGrade.grades?.total_points,
            graded_at: canvasGrade.grades?.updated_at,
          }, {
            onConflict: 'user_id,course_id,canvas_grade_id'
          })
        itemsSynced++
      }

      // Update connection last sync
      await this.supabase
        .from('canvas_connections')
        .update({
          last_sync: new Date().toISOString(),
          status: 'connected'
        })
        .eq('id', connection.id)

      // Update sync log
      await this.supabase
        .from('sync_logs')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString(),
          items_synced: itemsSynced,
        })
        .eq('id', syncLog.id)

      return { success: true, itemsSynced }

    } catch (error) {
      console.error('Canvas sync failed:', error)

      // Update sync log with error
      await this.supabase
        .from('sync_logs')
        .update({
          status: 'failed',
          completed_at: new Date().toISOString(),
          error_message: error instanceof Error ? error.message : 'Unknown error',
        })
        .eq('id', syncLog.id)

      // Update connection status
      await this.supabase
        .from('canvas_connections')
        .update({ status: 'error' })
        .eq('id', connection.id)

      throw error
    }
  }

  // Background sync scheduler
  async scheduleBackgroundSync(userId: string) {
    const { data: connections } = await this.supabase
      .from('canvas_connections')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'connected')

    for (const connection of connections || []) {
      const lastSync = connection.last_sync ? new Date(connection.last_sync) : new Date(0)
      const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000)

      if (lastSync < twoHoursAgo) {
        try {
          await this.syncCanvasData(connection, 'incremental')
        } catch (error) {
          console.error(`Background sync failed for connection ${connection.id}:`, error)
        }
      }
    }
  }
}

// Conflict resolution service
export class ConflictResolutionService {
  private supabase: any

  constructor(supabaseClient: any) {
    this.supabase = supabaseClient
  }

  async detectConflicts(userId: string) {
    // Check for assignment conflicts (local vs Canvas)
    const { data: assignments } = await this.supabase
      .from('assignments')
      .select(`
        *,
        course:courses(name, canvas_course_id),
        canvas_connection:courses(canvas_connections(*))
      `)
      .eq('user_id', userId)

    const conflicts = []

    for (const assignment of assignments || []) {
      // Check if Canvas data differs from local data
      try {
        const connection = assignment.course.canvas_connection
        const token = CanvasTokenManager.decryptToken(
          connection.encrypted_token,
          connection.token_salt
        )
        const canvasAPI = new CanvasAPI(connection.canvas_url, token)
        
        const canvasAssignment = await canvasAPI.getAssignments(assignment.course.canvas_course_id)
          .then(assignments => assignments.find((a: any) => a.id.toString() === assignment.canvas_assignment_id))

        if (canvasAssignment) {
          const hasConflict = 
            assignment.title !== canvasAssignment.name ||
            assignment.due_date !== canvasAssignment.due_at ||
            assignment.points_possible !== canvasAssignment.points_possible

          if (hasConflict) {
            conflicts.push({
              type: 'assignment',
              local: assignment,
              remote: canvasAssignment,
              conflictFields: this.identifyConflictFields(assignment, canvasAssignment)
            })
          }
        }
      } catch (error) {
        console.error(`Failed to check conflicts for assignment ${assignment.id}:`, error)
      }
    }

    return conflicts
  }

  private identifyConflictFields(local: any, remote: any) {
    const conflicts = []
    
    if (local.title !== remote.name) conflicts.push('title')
    if (local.due_date !== remote.due_at) conflicts.push('due_date')
    if (local.points_possible !== remote.points_possible) conflicts.push('points_possible')
    if (local.description !== remote.description) conflicts.push('description')

    return conflicts
  }

  async resolveConflict(conflictId: string, resolution: 'local' | 'remote' | 'merge', mergeData?: any) {
    // Implementation for conflict resolution
    // This would update the local data based on the resolution choice
    
    switch (resolution) {
      case 'local':
        // Keep local version, update Canvas if possible
        break
      case 'remote':
        // Accept remote version, update local data
        break
      case 'merge':
        // Merge both versions using provided merge data
        break
    }
  }
}
