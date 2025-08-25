import { createClient } from '@/lib/supabase/client'
import { 
  Profile, 
  CanvasConnection, 
  Course, 
  Assignment, 
  Grade, 
  StudySession, 
  Notification, 
  ScheduleEvent,
  Reminder,
  UserDashboardStats,
  DashboardData,
  AnalyticsData,
  AssignmentWithDetails,
  CourseWithDetails,
  NotificationWithDetails,
  Database
} from '@/lib/types/database'

export class DataService {
  private supabase = createClient()

  // Profile operations
  async getProfile(userId: string): Promise<Profile | null> {
    const { data, error } = await (this.supabase as any)
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single()

    if (error) throw error
    return data as Profile
  }

  async updateProfile(userId: string, updates: Partial<Profile>): Promise<Profile> {
    const { data, error } = await (this.supabase as any)
      .from('profiles')
      .update(updates)
      .eq('id', userId)
      .select()
      .single()

    if (error) throw error
    return data as Profile
  }

  // Canvas connections
  async getCanvasConnections(userId: string): Promise<CanvasConnection[]> {
    const { data, error } = await (this.supabase as any)
      .from('canvas_connections')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })

    if (error) throw error
    return data || []
  }

  async addCanvasConnection(connection: Omit<CanvasConnection, 'id' | 'created_at' | 'updated_at'>): Promise<CanvasConnection> {
    const { data, error } = await (this.supabase as any)
      .from('canvas_connections')
      .insert(connection)
      .select()
      .single()

    if (error) throw error
    return data as CanvasConnection
  }

  async removeCanvasConnection(connectionId: string): Promise<void> {
    const { error } = await (this.supabase as any)
      .from('canvas_connections')
      .delete()
      .eq('id', connectionId)

    if (error) throw error
  }

  // Dashboard data
  async getDashboardData(userId: string): Promise<DashboardData> {
    const [
      statsResult,
      recentAssignmentsResult,
      upcomingAssignmentsResult,
      recentGradesResult,
      studySessionsResult,
      notificationsResult
    ] = await Promise.all([
      (this.supabase as any).from('user_dashboard_stats').select('*').eq('user_id', userId).single(),
      (this.supabase as any)
        .from('assignments')
        .select(`
          *,
          course:courses(name, color),
          grade:grades(score, grade)
        `)
        .eq('user_id', userId)
        .order('updated_at', { ascending: false })
        .limit(5),
      (this.supabase as any)
        .from('assignments')
        .select(`
          *,
          course:courses(name, color),
          grade:grades(score, grade)
        `)
        .eq('user_id', userId)
        .in('status', ['upcoming', 'in_progress'])
        .not('due_date', 'is', null)
        .order('due_date', { ascending: true })
        .limit(7),
      (this.supabase as any)
        .from('grades')
        .select(`
          *,
          course:courses(name, color),
          assignment:assignments(title)
        `)
        .eq('user_id', userId)
        .order('graded_at', { ascending: false })
        .limit(10),
      (this.supabase as any)
        .from('study_sessions')
        .select(`
          *,
          course:courses(name, color),
          assignment:assignments(title)
        `)
        .eq('user_id', userId)
        .gte('started_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
        .order('started_at', { ascending: false }),
      (this.supabase as any)
        .from('notifications')
        .select(`
          *,
          assignment:assignments(title),
          course:courses(name)
        `)
        .eq('user_id', userId)
        .eq('is_read', false)
        .order('created_at', { ascending: false })
        .limit(10)
    ])

    return {
      stats: statsResult.data || {} as UserDashboardStats,
      recent_assignments: (recentAssignmentsResult.data || []) as AssignmentWithDetails[],
      upcoming_assignments: (upcomingAssignmentsResult.data || []) as AssignmentWithDetails[],
      recent_grades: recentGradesResult.data || [],
      study_sessions_week: studySessionsResult.data || [],
      notifications: (notificationsResult.data || []) as NotificationWithDetails[]
    }
  }

  // Courses
  async getCourses(userId: string): Promise<CourseWithDetails[]> {
    const { data, error } = await (this.supabase as any)
      .from('courses')
      .select(`
        *,
        assignments(id, status, due_date),
        grades(score, points_possible),
        study_sessions(duration_minutes)
      `)
      .eq('user_id', userId)
      .order('name')

    if (error) throw error

    return (data || []).map((course: any) => ({
      ...course,
      upcoming_assignments_count: course.assignments?.filter((a: any) => 
        a.status === 'upcoming' || a.status === 'in_progress'
      ).length || 0,
      average_grade: course.grades?.length ? 
        course.grades.reduce((sum: number, g: any) => sum + (g.score || 0), 0) / course.grades.length : 
        null
    })) as CourseWithDetails[]
  }

  async updateCourse(courseId: string, updates: Partial<Course>): Promise<Course> {
    const { data, error } = await (this.supabase as any)
      .from('courses')
      .update(updates)
      .eq('id', courseId)
      .select()
      .single()

    if (error) throw error
    return data as Course
  }

  // Assignments
  async getAssignments(userId: string, filters?: {
    courseId?: string
    status?: string[]
    dueDateRange?: { start: string; end: string }
  }): Promise<AssignmentWithDetails[]> {
    let query = (this.supabase as any)
      .from('assignments')
      .select(`
        *,
        course:courses(name, color),
        grade:grades(score, grade),
        reminders(remind_at)
      `)
      .eq('user_id', userId)

    if (filters?.courseId) {
      query = query.eq('course_id', filters.courseId)
    }

    if (filters?.status) {
      query = query.in('status', filters.status)
    }

    if (filters?.dueDateRange) {
      query = query
        .gte('due_date', filters.dueDateRange.start)
        .lte('due_date', filters.dueDateRange.end)
    }

    const { data, error } = await query.order('due_date', { ascending: true })

    if (error) throw error

    return (data || []).map((assignment: any) => ({
      ...assignment,
      time_until_due: assignment.due_date ? 
        Math.max(0, Math.floor((new Date(assignment.due_date).getTime() - Date.now()) / (1000 * 60))) :
        null
    })) as AssignmentWithDetails[]
  }

  async updateAssignmentStatus(assignmentId: string, status: string): Promise<Assignment> {
    const { data, error } = await (this.supabase as any)
      .from('assignments')
      .update({ status })
      .eq('id', assignmentId)
      .select()
      .single()

    if (error) throw error
    return data as Assignment
  }

  // Study sessions
  async getStudySessions(userId: string, dateRange?: { start: string; end: string }): Promise<StudySession[]> {
    let query = (this.supabase as any)
      .from('study_sessions')
      .select(`
        *,
        course:courses(name, color),
        assignment:assignments(title)
      `)
      .eq('user_id', userId)

    if (dateRange) {
      query = query
        .gte('started_at', dateRange.start)
        .lte('started_at', dateRange.end)
    }

    const { data, error } = await query.order('started_at', { ascending: false })

    if (error) throw error
    return data || []
  }

  async createStudySession(session: Omit<StudySession, 'id' | 'created_at'>): Promise<StudySession> {
    const { data, error } = await (this.supabase as any)
      .from('study_sessions')
      .insert(session)
      .select()
      .single()

    if (error) throw error
    return data as StudySession
  }

  // Analytics
  async getAnalyticsData(userId: string, dateRange: { start: string; end: string }): Promise<AnalyticsData> {
    const [dailyStatsResult, studyTrendsResult, gradesTrendsResult, courseProgressResult] = await Promise.all([
      // Daily analytics
      (this.supabase as any)
        .from('analytics_daily')
        .select('*')
        .eq('user_id', userId)
        .gte('date', dateRange.start)
        .lte('date', dateRange.end)
        .order('date'),

      // Study trends
      (this.supabase as any)
        .from('study_sessions')
        .select('started_at, duration_minutes, focus_score')
        .eq('user_id', userId)
        .gte('started_at', dateRange.start)
        .lte('started_at', dateRange.end),

      // Grade trends by course
      (this.supabase as any)
        .from('grades')
        .select(`
          score,
          graded_at,
          course:courses(name)
        `)
        .eq('user_id', userId)
        .not('score', 'is', null)
        .gte('graded_at', dateRange.start)
        .lte('graded_at', dateRange.end)
        .order('graded_at'),

      // Course progress
      this.getCourses(userId)
    ])

    // Process study trends
    const studyTrends = this.processStudyTrends(studyTrendsResult.data || [])
    
    // Process grade trends
    const gradeTrends = this.processGradeTrends(gradesTrendsResult.data || [])

    return {
      daily_stats: dailyStatsResult.data || [],
      study_trends: studyTrends,
      grade_trends: gradeTrends,
      course_progress: courseProgressResult
    }
  }

  private processStudyTrends(sessions: any[]) {
    const dailyData = new Map()

    sessions.forEach(session => {
      const date = new Date(session.started_at).toISOString().split('T')[0]
      
      if (!dailyData.has(date)) {
        dailyData.set(date, { total_minutes: 0, focus_scores: [] })
      }

      const data = dailyData.get(date)
      data.total_minutes += session.duration_minutes
      if (session.focus_score) {
        data.focus_scores.push(session.focus_score)
      }
    })

    return Array.from(dailyData.entries()).map(([date, data]) => ({
      date,
      total_minutes: data.total_minutes,
      avg_focus: data.focus_scores.length > 0 ? 
        data.focus_scores.reduce((sum: number, score: number) => sum + score, 0) / data.focus_scores.length : 
        0
    }))
  }

  private processGradeTrends(grades: any[]) {
    const courseData = new Map()

    grades.forEach(grade => {
      const courseName = grade.course.name
      
      if (!courseData.has(courseName)) {
        courseData.set(courseName, [])
      }

      courseData.get(courseName).push({
        date: grade.graded_at,
        score: grade.score
      })
    })

    return Array.from(courseData.entries()).map(([course_name, grades]) => ({
      course_name,
      grades
    }))
  }

  // Notifications
  async getNotifications(userId: string, unreadOnly = false): Promise<NotificationWithDetails[]> {
    let query = (this.supabase as any)
      .from('notifications')
      .select(`
        *,
        assignment:assignments(title),
        course:courses(name)
      `)
      .eq('user_id', userId)

    if (unreadOnly) {
      query = query.eq('is_read', false)
    }

    const { data, error } = await query.order('created_at', { ascending: false })

    if (error) throw error
    return data || []
  }

  async markNotificationAsRead(notificationId: string): Promise<void> {
    const { error } = await (this.supabase as any)
      .from('notifications')
      .update({ is_read: true })
      .eq('id', notificationId)

    if (error) throw error
  }

  async createNotification(notification: Omit<Notification, 'id' | 'created_at'>): Promise<Notification> {
    const { data, error } = await (this.supabase as any)
      .from('notifications')
      .insert(notification)
      .select()
      .single()

    if (error) throw error
    return data as Notification
  }

  // Schedule events
  async getScheduleEvents(userId: string, dateRange?: { start: string; end: string }): Promise<ScheduleEvent[]> {
    let query = (this.supabase as any)
      .from('schedule_events')
      .select(`
        *,
        course:courses(name, color)
      `)
      .eq('user_id', userId)

    if (dateRange) {
      query = query
        .gte('start_time', dateRange.start)
        .lte('start_time', dateRange.end)
    }

    const { data, error } = await query.order('start_time')

    if (error) throw error
    return data || []
  }

  async createScheduleEvent(event: Omit<ScheduleEvent, 'id' | 'created_at' | 'updated_at'>): Promise<ScheduleEvent> {
    const { data, error } = await (this.supabase as any)
      .from('schedule_events')
      .insert(event)
      .select()
      .single()

    if (error) throw error
    return data as ScheduleEvent
  }

  async updateScheduleEvent(eventId: string, updates: Partial<ScheduleEvent>): Promise<ScheduleEvent> {
    const { data, error } = await (this.supabase as any)
      .from('schedule_events')
      .update(updates)
      .eq('id', eventId)
      .select()
      .single()

    if (error) throw error
    return data as ScheduleEvent
  }

  async deleteScheduleEvent(eventId: string): Promise<void> {
    const { error } = await (this.supabase as any)
      .from('schedule_events')
      .delete()
      .eq('id', eventId)

    if (error) throw error
  }

  // Reminders
  async getReminders(userId: string, upcoming = true): Promise<Reminder[]> {
    let query = (this.supabase as any)
      .from('reminders')
      .select(`
        *,
        assignment:assignments(title),
        schedule_event:schedule_events(title)
      `)
      .eq('user_id', userId)

    if (upcoming) {
      query = query
        .gte('remind_at', new Date().toISOString())
        .eq('is_sent', false)
    }

    const { data, error } = await query.order('remind_at')

    if (error) throw error
    return data || []
  }

  async createReminder(reminder: Omit<Reminder, 'id' | 'created_at'>): Promise<Reminder> {
    const { data, error } = await (this.supabase as any)
      .from('reminders')
      .insert(reminder)
      .select()
      .single()

    if (error) throw error
    return data as Reminder
  }

  async deleteReminder(reminderId: string): Promise<void> {
    const { error } = await (this.supabase as any)
      .from('reminders')
      .delete()
      .eq('id', reminderId)

    if (error) throw error
  }

  // Utility methods
  async searchAssignments(userId: string, query: string): Promise<AssignmentWithDetails[]> {
    const { data, error } = await this.supabase
      .from('assignments')
      .select(`
        *,
        course:courses(name, color),
        grade:grades(score, grade)
      `)
      .eq('user_id', userId)
      .or(`title.ilike.%${query}%,description.ilike.%${query}%`)
      .order('due_date', { ascending: true })
      .limit(20)

    if (error) throw error
    return data || []
  }

  async getGpaCalculation(userId: string): Promise<{ currentGpa: number; projectedGpa: number }> {
    const { data: grades, error } = await (this.supabase as any)
      .from('grades')
      .select(`
        score,
        points_possible,
        course:courses(credits)
      `)
      .eq('user_id', userId)
      .not('score', 'is', null)

    if (error) throw error

    let totalPoints = 0
    let totalCredits = 0

    grades?.forEach((grade: any) => {
      const gradePoints = this.convertScoreToGradePoints(grade.score || 0)
      const credits = grade.course?.credits || 3 // Default 3 credits if not specified
      
      totalPoints += gradePoints * credits
      totalCredits += credits
    })

    const currentGpa = totalCredits > 0 ? totalPoints / totalCredits : 0

    // For projected GPA, we'd need additional logic to factor in pending assignments
    const projectedGpa = currentGpa // Simplified for now

    return { currentGpa, projectedGpa }
  }

  private convertScoreToGradePoints(score: number): number {
    if (score >= 97) return 4.0
    if (score >= 93) return 3.7
    if (score >= 90) return 3.3
    if (score >= 87) return 3.0
    if (score >= 83) return 2.7
    if (score >= 80) return 2.3
    if (score >= 77) return 2.0
    if (score >= 73) return 1.7
    if (score >= 70) return 1.3
    if (score >= 67) return 1.0
    if (score >= 65) return 0.7
    return 0.0
  }
}
