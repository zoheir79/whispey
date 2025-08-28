import { NextRequest, NextResponse } from 'next/server'
import { verifyToken } from '@/lib/auth-utils'
import { query } from '@/lib/db'

export async function PATCH(
  request: NextRequest,
  { params }: { params: { userId: string } }
) {
  try {
    const { action } = await request.json()
    
    // Verify authentication and super_admin role
    const token = request.cookies.get('auth-token')?.value
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const payload = verifyToken(token)
    if (!payload || !payload.userId) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
    }

    // Get admin user role
    const adminResult = await query(
      'SELECT global_role FROM pype_voice_users WHERE user_id = $1',
      [payload.userId]
    )

    if (adminResult.rows.length === 0 || adminResult.rows[0].global_role !== 'super_admin') {
      return NextResponse.json({ error: 'Forbidden - Super admin access required' }, { status: 403 })
    }

    // Validate action
    if (!['approve', 'reject'].includes(action)) {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
    }

    const { userId } = params

    // Check if user exists
    const userResult = await query(
      'SELECT user_id, email, status FROM pype_voice_users WHERE user_id = $1',
      [userId]
    )

    if (userResult.rows.length === 0) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const user = userResult.rows[0]

    // Update user status
    const newStatus = action === 'approve' ? 'active' : 'rejected'
    
    const updateResult = await query(`
      UPDATE pype_voice_users 
      SET 
        status = $1,
        approved_at = $2,
        approved_by = $3
      WHERE user_id = $4
      RETURNING user_id, email, status
    `, [
      newStatus,
      action === 'approve' ? new Date().toISOString() : null,
      action === 'approve' ? payload.userId : null,
      userId
    ])

    if (updateResult.rows.length === 0) {
      return NextResponse.json({ error: 'Failed to update user status' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      user: updateResult.rows[0],
      action
    })

  } catch (error) {
    console.error('Error updating user status:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
