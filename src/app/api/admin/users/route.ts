import { NextRequest, NextResponse } from 'next/server'
import { verifyUserAuth } from '@/lib/auth'
import { getUserGlobalRole } from '@/services/getGlobalRole'
import { query } from '@/lib/db'

export async function GET(request: NextRequest) {
  try {
    // Verify authentication
    const { isAuthenticated, userId } = await verifyUserAuth(request);
    if (!isAuthenticated || !userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if user has super_admin role
    const userGlobalRole = await getUserGlobalRole(userId);
    if (!userGlobalRole || userGlobalRole.global_role !== 'super_admin') {
      return NextResponse.json({ error: 'Forbidden - Super admin access required' }, { status: 403 })
    }

    // Fetch all users with their status
    const usersResult = await query(`
      SELECT 
        user_id,
        email,
        first_name,
        last_name,
        global_role,
        COALESCE(status, 'active') as status,
        created_at,
        approved_at,
        approved_by
      FROM pype_voice_users 
      ORDER BY 
        CASE 
          WHEN COALESCE(status, 'active') = 'pending' THEN 1 
          ELSE 2 
        END,
        created_at DESC
    `)

    return NextResponse.json(usersResult.rows)
  } catch (error) {
    console.error('Error fetching users:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
