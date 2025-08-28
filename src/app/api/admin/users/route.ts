import { NextRequest, NextResponse } from 'next/server'
import { verifyToken } from '@/lib/auth-utils'
import { query } from '@/lib/db'

export async function GET(request: NextRequest) {
  try {
    // Verify authentication and super_admin role
    const token = request.cookies.get('auth-token')?.value
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const payload = verifyToken(token)
    if (!payload || !payload.userId) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
    }

    // Get user role
    const userResult = await query(
      'SELECT global_role FROM pype_voice_users WHERE user_id = $1',
      [payload.userId]
    )

    if (userResult.rows.length === 0 || userResult.rows[0].global_role !== 'super_admin') {
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
