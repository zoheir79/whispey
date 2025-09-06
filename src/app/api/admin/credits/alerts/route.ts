import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { getUserGlobalRole } from '@/services/getGlobalRole'

export async function GET(request: NextRequest) {
  try {
    const globalRole = await getUserGlobalRole(request)
    
    if (globalRole !== 'super_admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    // Fetch credit alerts with user information
    const result = await query(`
      SELECT 
        ca.*,
        u.email as user_email,
        p.name as workspace_name
      FROM credit_alerts ca
      LEFT JOIN pype_voice_users u ON u.user_id = ca.user_id
      LEFT JOIN pype_voice_projects p ON p.id = ca.workspace_id
      ORDER BY ca.created_at DESC
      LIMIT 100
    `)

    return NextResponse.json(result.rows)
  } catch (error) {
    console.error('Error fetching credit alerts:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
