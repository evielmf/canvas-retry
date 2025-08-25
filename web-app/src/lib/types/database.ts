// Database types for Easeboard
// Auto-generated types from Supabase schema

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type AssignmentStatus = 'upcoming' | 'in_progress' | 'completed' | 'overdue' | 'submitted'
export type NotificationType = 'assignment' | 'grade' | 'announcement' | 'reminder' | 'system'
export type SyncStatus = 'pending' | 'syncing' | 'completed' | 'failed'
export type CanvasConnectionStatus = 'connected' | 'disconnected' | 'error' | 'expired'

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          email: string
          full_name: string | null
          avatar_url: string | null
          timezone: string
          preferences: Json
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          email: string
          full_name?: string | null
          avatar_url?: string | null
          timezone?: string
          preferences?: Json
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          email?: string
          full_name?: string | null
          avatar_url?: string | null
          timezone?: string
          preferences?: Json
          created_at?: string
          updated_at?: string
        }
      }
      canvas_connections: {
        Row: {
          id: string
          user_id: string
          canvas_url: string
          canvas_name: string
          encrypted_token: string
          token_salt: string
          status: CanvasConnectionStatus
          last_sync: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          canvas_url: string
          canvas_name: string
          encrypted_token: string
          token_salt: string
          status?: CanvasConnectionStatus
          last_sync?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          canvas_url?: string
          canvas_name?: string
          encrypted_token?: string
          token_salt?: string
          status?: CanvasConnectionStatus
          last_sync?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      courses: {
        Row: {
          id: string
          user_id: string
          canvas_connection_id: string
          canvas_course_id: string
          name: string
          course_code: string | null
          instructor_name: string | null
          credits: number | null
          color: string
          is_favorite: boolean
          enrollment_status: string
          start_date: string | null
          end_date: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          canvas_connection_id: string
          canvas_course_id: string
          name: string
          course_code?: string | null
          instructor_name?: string | null
          credits?: number | null
          color?: string
          is_favorite?: boolean
          enrollment_status?: string
          start_date?: string | null
          end_date?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          canvas_connection_id?: string
          canvas_course_id?: string
          name?: string
          course_code?: string | null
          instructor_name?: string | null
          credits?: number | null
          color?: string
          is_favorite?: boolean
          enrollment_status?: string
          start_date?: string | null
          end_date?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      assignments: {
        Row: {
          id: string
          user_id: string
          course_id: string
          canvas_assignment_id: string
          title: string
          description: string | null
          due_date: string | null
          points_possible: number | null
          submission_types: string[] | null
          status: AssignmentStatus
          submitted_at: string | null
          graded_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          course_id: string
          canvas_assignment_id: string
          title: string
          description?: string | null
          due_date?: string | null
          points_possible?: number | null
          submission_types?: string[] | null
          status?: AssignmentStatus
          submitted_at?: string | null
          graded_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          course_id?: string
          canvas_assignment_id?: string
          title?: string
          description?: string | null
          due_date?: string | null
          points_possible?: number | null
          submission_types?: string[] | null
          status?: AssignmentStatus
          submitted_at?: string | null
          graded_at?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      grades: {
        Row: {
          id: string
          user_id: string
          course_id: string
          assignment_id: string | null
          canvas_grade_id: string | null
          score: number | null
          grade: string | null
          points_possible: number | null
          weight: number | null
          graded_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          course_id: string
          assignment_id?: string | null
          canvas_grade_id?: string | null
          score?: number | null
          grade?: string | null
          points_possible?: number | null
          weight?: number | null
          graded_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          course_id?: string
          assignment_id?: string | null
          canvas_grade_id?: string | null
          score?: number | null
          grade?: string | null
          points_possible?: number | null
          weight?: number | null
          graded_at?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      study_sessions: {
        Row: {
          id: string
          user_id: string
          course_id: string | null
          assignment_id: string | null
          duration_minutes: number
          focus_score: number | null
          session_type: string
          notes: string | null
          started_at: string
          ended_at: string
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          course_id?: string | null
          assignment_id?: string | null
          duration_minutes: number
          focus_score?: number | null
          session_type?: string
          notes?: string | null
          started_at: string
          ended_at: string
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          course_id?: string | null
          assignment_id?: string | null
          duration_minutes?: number
          focus_score?: number | null
          session_type?: string
          notes?: string | null
          started_at?: string
          ended_at?: string
          created_at?: string
        }
      }
      notifications: {
        Row: {
          id: string
          user_id: string
          title: string
          message: string
          type: NotificationType
          related_id: string | null
          is_read: boolean
          scheduled_for: string | null
          sent_at: string | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          title: string
          message: string
          type: NotificationType
          related_id?: string | null
          is_read?: boolean
          scheduled_for?: string | null
          sent_at?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          title?: string
          message?: string
          type?: NotificationType
          related_id?: string | null
          is_read?: boolean
          scheduled_for?: string | null
          sent_at?: string | null
          created_at?: string
        }
      }
      schedule_events: {
        Row: {
          id: string
          user_id: string
          course_id: string | null
          title: string
          description: string | null
          start_time: string
          end_time: string
          location: string | null
          event_type: string
          recurrence_rule: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          course_id?: string | null
          title: string
          description?: string | null
          start_time: string
          end_time: string
          location?: string | null
          event_type?: string
          recurrence_rule?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          course_id?: string | null
          title?: string
          description?: string | null
          start_time?: string
          end_time?: string
          location?: string | null
          event_type?: string
          recurrence_rule?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      reminders: {
        Row: {
          id: string
          user_id: string
          assignment_id: string | null
          schedule_event_id: string | null
          title: string
          message: string | null
          remind_at: string
          is_sent: boolean
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          assignment_id?: string | null
          schedule_event_id?: string | null
          title: string
          message?: string | null
          remind_at: string
          is_sent?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          assignment_id?: string | null
          schedule_event_id?: string | null
          title?: string
          message?: string | null
          remind_at?: string
          is_sent?: boolean
          created_at?: string
        }
      }
      sync_logs: {
        Row: {
          id: string
          user_id: string
          canvas_connection_id: string
          status: SyncStatus
          sync_type: string
          started_at: string
          completed_at: string | null
          error_message: string | null
          items_synced: number
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          canvas_connection_id: string
          status: SyncStatus
          sync_type: string
          started_at: string
          completed_at?: string | null
          error_message?: string | null
          items_synced?: number
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          canvas_connection_id?: string
          status?: SyncStatus
          sync_type?: string
          started_at?: string
          completed_at?: string | null
          error_message?: string | null
          items_synced?: number
          created_at?: string
        }
      }
      grade_predictions: {
        Row: {
          id: string
          user_id: string
          course_id: string
          predicted_grade: number
          confidence_score: number | null
          factors: Json | null
          prediction_date: string
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          course_id: string
          predicted_grade: number
          confidence_score?: number | null
          factors?: Json | null
          prediction_date?: string
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          course_id?: string
          predicted_grade?: number
          confidence_score?: number | null
          factors?: Json | null
          prediction_date?: string
          created_at?: string
        }
      }
      analytics_daily: {
        Row: {
          id: string
          user_id: string
          date: string
          total_study_time: number
          assignments_completed: number
          avg_focus_score: number | null
          courses_accessed: number
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          date: string
          total_study_time?: number
          assignments_completed?: number
          avg_focus_score?: number | null
          courses_accessed?: number
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          date?: string
          total_study_time?: number
          assignments_completed?: number
          avg_focus_score?: number | null
          courses_accessed?: number
          created_at?: string
        }
      }
    }
    Views: {
      user_dashboard_stats: {
        Row: {
          user_id: string | null
          total_courses: number | null
          completed_assignments: number | null
          upcoming_assignments: number | null
          overdue_assignments: number | null
          average_score: number | null
          total_study_time_week: number | null
        }
      }
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      assignment_status: AssignmentStatus
      notification_type: NotificationType
      sync_status: SyncStatus
      canvas_connection_status: CanvasConnectionStatus
    }
  }
}

// Utility types for common operations
export type Profile = Database['public']['Tables']['profiles']['Row']
export type ProfileInsert = Database['public']['Tables']['profiles']['Insert']
export type ProfileUpdate = Database['public']['Tables']['profiles']['Update']

export type CanvasConnection = Database['public']['Tables']['canvas_connections']['Row']
export type CanvasConnectionInsert = Database['public']['Tables']['canvas_connections']['Insert']
export type CanvasConnectionUpdate = Database['public']['Tables']['canvas_connections']['Update']

export type Course = Database['public']['Tables']['courses']['Row']
export type CourseInsert = Database['public']['Tables']['courses']['Insert']
export type CourseUpdate = Database['public']['Tables']['courses']['Update']

export type Assignment = Database['public']['Tables']['assignments']['Row']
export type AssignmentInsert = Database['public']['Tables']['assignments']['Insert']
export type AssignmentUpdate = Database['public']['Tables']['assignments']['Update']

export type Grade = Database['public']['Tables']['grades']['Row']
export type GradeInsert = Database['public']['Tables']['grades']['Insert']
export type GradeUpdate = Database['public']['Tables']['grades']['Update']

export type StudySession = Database['public']['Tables']['study_sessions']['Row']
export type StudySessionInsert = Database['public']['Tables']['study_sessions']['Insert']
export type StudySessionUpdate = Database['public']['Tables']['study_sessions']['Update']

export type Notification = Database['public']['Tables']['notifications']['Row']
export type NotificationInsert = Database['public']['Tables']['notifications']['Insert']
export type NotificationUpdate = Database['public']['Tables']['notifications']['Update']

export type ScheduleEvent = Database['public']['Tables']['schedule_events']['Row']
export type ScheduleEventInsert = Database['public']['Tables']['schedule_events']['Insert']
export type ScheduleEventUpdate = Database['public']['Tables']['schedule_events']['Update']

export type Reminder = Database['public']['Tables']['reminders']['Row']
export type ReminderInsert = Database['public']['Tables']['reminders']['Insert']
export type ReminderUpdate = Database['public']['Tables']['reminders']['Update']

export type SyncLog = Database['public']['Tables']['sync_logs']['Row']
export type SyncLogInsert = Database['public']['Tables']['sync_logs']['Insert']
export type SyncLogUpdate = Database['public']['Tables']['sync_logs']['Update']

export type GradePrediction = Database['public']['Tables']['grade_predictions']['Row']
export type GradePredictionInsert = Database['public']['Tables']['grade_predictions']['Insert']
export type GradePredictionUpdate = Database['public']['Tables']['grade_predictions']['Update']

export type AnalyticsDaily = Database['public']['Tables']['analytics_daily']['Row']
export type AnalyticsDailyInsert = Database['public']['Tables']['analytics_daily']['Insert']
export type AnalyticsDailyUpdate = Database['public']['Tables']['analytics_daily']['Update']

export type UserDashboardStats = Database['public']['Views']['user_dashboard_stats']['Row']

// Extended types with relations
export interface CourseWithDetails extends Course {
  assignments?: Assignment[]
  grades?: Grade[]
  study_sessions?: StudySession[]
  upcoming_assignments_count?: number
  average_grade?: number
}

export interface AssignmentWithDetails extends Assignment {
  course?: Course
  grade?: Grade
  reminders?: Reminder[]
  time_until_due?: number // in minutes
}

export interface GradeWithDetails extends Grade {
  course?: Course
  assignment?: Assignment
}

export interface StudySessionWithDetails extends StudySession {
  course?: Course
  assignment?: Assignment
}

export interface NotificationWithDetails extends Notification {
  assignment?: Assignment
  course?: Course
}

// API Response types
export interface DashboardData {
  stats: UserDashboardStats
  recent_assignments: AssignmentWithDetails[]
  upcoming_assignments: AssignmentWithDetails[]
  recent_grades: GradeWithDetails[]
  study_sessions_week: StudySession[]
  notifications: NotificationWithDetails[]
}

export interface AnalyticsData {
  daily_stats: AnalyticsDaily[]
  study_trends: {
    date: string
    total_minutes: number
    avg_focus: number
  }[]
  grade_trends: {
    course_name: string
    grades: { date: string; score: number }[]
  }[]
  course_progress: CourseWithDetails[]
}

// Form types
export interface CanvasConnectionForm {
  canvas_url: string
  canvas_name: string
  access_token: string
}

export interface StudySessionForm {
  course_id?: string
  assignment_id?: string
  duration_minutes: number
  focus_score?: number
  session_type: string
  notes?: string
  started_at: string
  ended_at: string
}

export interface ReminderForm {
  assignment_id?: string
  schedule_event_id?: string
  title: string
  message?: string
  remind_at: string
}

export interface ScheduleEventForm {
  course_id?: string
  title: string
  description?: string
  start_time: string
  end_time: string
  location?: string
  event_type: string
  recurrence_rule?: string
}
