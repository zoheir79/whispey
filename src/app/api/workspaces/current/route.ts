import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { verifyUserAuth } from '@/lib/auth'

export async function GET(request: NextRequest) {
  try {
    const { isAuthenticated, userId: userEmail } = await verifyUserAuth(request)
    if (!isAuthenticated || !userEmail) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    // Get user's current workspace (first one for now)
    const workspaces = await query(`
      SELECT w.id, w.name, w.created_at
      FROM pype_voice_projects w
      JOIN pype_voice_email_project_mapping m ON w.id = m.project_id
      WHERE m.email = $1
      ORDER BY w.created_at DESC
      LIMIT 1
    `, [userEmail])

    if (!workspaces || workspaces.rows?.length === 0) {
      return NextResponse.json({ workspace: null })
    }

    return NextResponse.json({ workspace: workspaces.rows[0] })
  } catch (error) {
    console.error('Error in current workspace API:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
