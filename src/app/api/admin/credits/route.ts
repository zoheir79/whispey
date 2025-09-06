import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { getUserGlobalRole } from '@/services/getGlobalRole'

export async function GET(request: NextRequest) {
  try {
    const globalRole = await getUserGlobalRole(request)
    
    if (globalRole !== 'super_admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    // Fetch user credits with workspace and user information
    const result = await query(`
      SELECT 
        uc.*,
        p.name as workspace_name,
        u.email as user_email
      FROM user_credits uc
      LEFT JOIN pype_voice_projects p ON p.id = uc.workspace_id
      LEFT JOIN pype_voice_users u ON u.user_id = uc.user_id
      ORDER BY uc.created_at DESC
    `)

    return NextResponse.json(result.rows)
  } catch (error) {
    console.error('Error fetching user credits:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
