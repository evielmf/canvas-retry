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
        { error: 'Unauthorized', connected: false },
        { status: 401 }
      )
    }

    // Check if user has Canvas token configured
    const response = await fetch(`${BACKEND_URL}/api/v1/canvas/validate-token`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${session.access_token}`,
        'Content-Type': 'application/json'
      }
    })

    if (!response.ok) {
      if (response.status === 404) {
        // No Canvas integration found
        return NextResponse.json({ connected: false })
      }
      const error = await response.json()
      return NextResponse.json(
        { error: error.detail || 'Validation failed', connected: false },
        { status: response.status }
      )
    }

    const data = await response.json()
    return NextResponse.json({ 
      connected: data.valid || false,
      canvas_url: data.canvas_url || null,
      canvas_name: data.canvas_name || null,
      last_sync: data.last_sync || null
    })

  } catch (error) {
    console.error('Canvas validation API error:', error)
    return NextResponse.json(
      { error: 'Internal server error', connected: false },
      { status: 500 }
    )
  }
}
