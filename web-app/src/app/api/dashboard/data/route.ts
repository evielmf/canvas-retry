import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:8000'

export async function GET(request: NextRequest) {
  try {
    // Get the current user - use getUser() for better security
    const supabase = await createClient()
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    
    if (userError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Try to check Canvas connection status first
    try {
      const validationResponse = await fetch(`${BACKEND_URL}/api/v1/canvas/validate-token`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${user.id}`, // Use user.id instead of session.access_token
          'Content-Type': 'application/json'
        },
        signal: AbortSignal.timeout(5000) // 5 second timeout
      })

      if (!validationResponse.ok) {
        // Backend is unreachable or Canvas not configured
        return NextResponse.json({
          connected: false,
          stats: {
            total_courses: 0,
            due_soon: 0,
            completed_this_week: 0,
            average_grade: 0
          },
          upcoming_assignments: [],
          course_progress: []
        })
      }

      const validation = await validationResponse.json()
      
      if (!validation.valid) {
        return NextResponse.json({
          connected: false,
          stats: {
            total_courses: 0,
            due_soon: 0,
            completed_this_week: 0,
            average_grade: 0
          },
          upcoming_assignments: [],
          course_progress: []
        })
      }

      // If Canvas is connected, try to fetch data
      const [coursesResponse, assignmentsResponse, gradesResponse] = await Promise.allSettled([
        fetch(`${BACKEND_URL}/api/v1/canvas/courses`, {
          headers: {
            'Authorization': `Bearer ${user.id}`,
            'Content-Type': 'application/json'
          }
        }),
        fetch(`${BACKEND_URL}/api/v1/canvas/assignments?limit=100`, {
          headers: {
            'Authorization': `Bearer ${user.id}`,
            'Content-Type': 'application/json'
          }
        }),
        fetch(`${BACKEND_URL}/api/v1/canvas/grades`, {
          headers: {
            'Authorization': `Bearer ${user.id}`,
            'Content-Type': 'application/json'
          }
        })
      ])

      // Parse successful responses
      const courses = coursesResponse.status === 'fulfilled' && coursesResponse.value.ok
        ? await coursesResponse.value.json()
        : []

      const assignments = assignmentsResponse.status === 'fulfilled' && assignmentsResponse.value.ok
        ? await assignmentsResponse.value.json()
        : []

      const grades = gradesResponse.status === 'fulfilled' && gradesResponse.value.ok
        ? await gradesResponse.value.json()
        : []

      // Calculate dashboard stats
      const now = new Date()
      const oneWeekFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)

      const dueSoon = assignments.filter((assignment: any) => {
        if (!assignment.due_date) return false
        const dueDate = new Date(assignment.due_date)
        return dueDate > now && dueDate <= oneWeekFromNow && 
               (assignment.status === 'upcoming' || assignment.status === 'in_progress')
      }).length

      const completed = assignments.filter((assignment: any) => 
        assignment.status === 'completed' || assignment.status === 'submitted'
      ).length

      const averageGrade = grades.length > 0
        ? grades.reduce((sum: number, grade: any) => {
            const percentage = grade.assignment?.points_possible > 0 
              ? (grade.score / grade.assignment.points_possible) * 100 
              : 0
            return sum + percentage
          }, 0) / grades.length
        : 0

      // Get upcoming assignments (next 5 due within 7 days)
      const upcomingAssignments = assignments
        .filter((assignment: any) => {
          if (!assignment.due_date) return false
          const dueDate = new Date(assignment.due_date)
          return dueDate > now && dueDate <= oneWeekFromNow && 
                 (assignment.status === 'upcoming' || assignment.status === 'in_progress')
        })
        .sort((a: any, b: any) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime())
        .slice(0, 5)

      // Get recent grades (last 5)
      const recentGrades = grades
        .sort((a: any, b: any) => new Date(b.graded_at || b.created_at).getTime() - new Date(a.graded_at || a.created_at).getTime())
        .slice(0, 5)

      return NextResponse.json({
        connected: true,
        canvas_info: {
          url: validation.canvas_url,
          name: validation.canvas_name,
          last_sync: validation.last_sync
        },
        courses,
        assignments,
        grades,
        stats: {
          total_courses: courses.length,
          due_soon: dueSoon,
          completed_this_week: completed,
          average_grade: Math.round(averageGrade * 10) / 10,
          total_assignments: assignments.length,
          grade_count: grades.length
        },
        upcoming_assignments: upcomingAssignments,
        course_progress: recentGrades
      })

    } catch (fetchError) {
      // Backend is not available - return default state
      console.log('Backend not available, returning graceful fallback')
      return NextResponse.json({
        connected: false,
        message: 'Canvas integration not yet configured or backend unavailable',
        stats: {
          total_courses: 0,
          due_soon: 0,
          completed_this_week: 0,
          average_grade: 0
        },
        upcoming_assignments: [],
        course_progress: []
      })
    }
    
  } catch (error) {
    console.error('Dashboard data API error:', error)
    return NextResponse.json({
      connected: false,
      stats: {
        total_courses: 0,
        due_soon: 0,
        completed_this_week: 0,
        average_grade: 0
      },
      upcoming_assignments: [],
      course_progress: []
    }, { status: 200 }) // Return 200 instead of 500 so frontend can handle gracefully
  }
}
