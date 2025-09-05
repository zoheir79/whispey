import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { verifyUserAuth } from '@/lib/auth'
import { getUserGlobalRole } from '@/services/getGlobalRole'

export async function GET(request: NextRequest) {
  try {
    const { isAuthenticated, userId } = await verifyUserAuth(request);
    
    if (!isAuthenticated || !userId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    // Check user's global role
    const userGlobalRole = await getUserGlobalRole(userId);
    
    let workspaces;
    
    if (userGlobalRole?.global_role === 'super_admin') {
      // Super admin can see ALL workspaces
      workspaces = await query(`
        SELECT id, name, created_at 
        FROM pype_voice_workspaces 
        ORDER BY created_at DESC
      `);
    } else {
      // Regular users see only workspaces they have access to
      workspaces = await query(`
        SELECT DISTINCT w.id, w.name, w.created_at 
        FROM pype_voice_workspaces w
        LEFT JOIN pype_voice_email_project_mapping epm ON w.id = epm.workspace_id
        LEFT JOIN pype_voice_users u ON u.email = epm.email
        WHERE u.user_id = $1 AND epm.is_active = true
        ORDER BY w.created_at DESC
      `, [userId]);
    }

    return NextResponse.json({ workspaces: workspaces.rows || [] })
  } catch (error) {
    console.error('Error in workspaces API:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
