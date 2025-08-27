import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  try {
    // Get the current user session - use getUser() for better security
    const supabase = await createClient()
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    
    if (userError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { canvas_url, canvas_name, api_token } = body

    if (!canvas_url || !canvas_name || !api_token) {
      return NextResponse.json(
        { error: 'Missing required fields: canvas_url, canvas_name, and api_token are required' },
        { status: 400 }
      )
    }

    // For now, we'll just validate the token format and return success
    // In a full implementation, you would:
    // 1. Test the Canvas API connection with the token
    // 2. Store the encrypted token in the database
    // 3. Create initial sync job

    const cleanUrl = canvas_url.startsWith('http') ? canvas_url : `https://${canvas_url}`
    
    // Basic validation - Canvas tokens are usually quite long
    if (api_token.length < 20) {
      return NextResponse.json(
        { error: 'Canvas API token appears to be too short. Please check your token.' },
        { status: 400 }
      )
    }

    // Simulate successful connection (replace with actual database storage later)
    const mockConnection = {
      id: 'temp-' + Date.now(),
      user_id: user.id,
      canvas_url: cleanUrl,
      canvas_name: canvas_name.trim(),
      status: 'connected',
      created_at: new Date().toISOString()
    }

    return NextResponse.json({
      success: true,
      message: 'Canvas connection configured successfully!',
      connection: mockConnection
    })

  } catch (error) {
    console.error('Canvas setup API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
