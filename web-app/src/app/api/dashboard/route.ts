import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:8000'

export async function GET(request: NextRequest) {
  try {
    // Get the current user session
    const supabase = await createClient()
    const { data: { session }, error: sessionError } = await supabase.auth.getSession()
    
    if (sessionError || !session) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Forward request to FastAPI backend for dashboard data
    const response = await fetch(`${BACKEND_URL}/api/v1/dashboard`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${session.access_token}`,
        'Content-Type': 'application/json'
      }
    })

    if (!response.ok) {
      // If backend endpoint doesn't exist yet, return mock data
      if (response.status === 404) {
        return NextResponse.json({
          stats: {
            total_courses: 0,
            due_soon: 0,
            completed_this_week: 0,
            average_grade: 0
          },
          upcoming_assignments: [],
          recent_grades: [],
          course_progress: []
        })
      }
      
      const error = await response.json()
      return NextResponse.json(
        { error: error.detail || 'Failed to fetch dashboard data' },
        { status: response.status }
      )
    }

    const data = await response.json()
    return NextResponse.json(data)

  } catch (error) {
    console.error('Error fetching dashboard data:', error)
    // Return mock data if there's an error
    return NextResponse.json({
      stats: {
        total_courses: 0,
        due_soon: 0,
        completed_this_week: 0,
        average_grade: 0
      },
      upcoming_assignments: [],
      recent_grades: [],
      course_progress: []
    })
  }
}
