import { NextRequest, NextResponse } from 'next/server'
import { verifyToken } from '@/lib/auth-utils'
import { query } from '@/lib/db'

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ userId: string }> }
) {
  try {
    const { action } = await request.json()
    const { userId } = await context.params
    
    // Verify authentication and super_admin role
    const token = request.headers.get('authorization')?.replace('Bearer ', '') || 
                  request.cookies.get('token')?.value
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const payload = verifyToken(token)
    if (!payload.valid || !payload.userId) {
      console.error('Token verification failed:', payload)
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

    // Validate action - update to support suspend/unsuspend
    if (!['suspend', 'unsuspend'].includes(action)) {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
    }

    // Check if user exists
    const userResult = await query(
      'SELECT user_id, email, status FROM pype_voice_users WHERE user_id = $1',
      [userId]
    )

    if (userResult.rows.length === 0) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const user = userResult.rows[0]
    console.log('Found user:', user)

    // Update user status
    const newStatus = action === 'unsuspend' ? 'active' : 'suspended'
    
    console.log('Attempting to update user:', { userId, newStatus, currentStatus: user.status })
    
    // Try different approaches for the update
    let updateResult;
    try {
      // First try with updated_at only
      updateResult = await query(`
        UPDATE pype_voice_users 
        SET status = $1, updated_at = CURRENT_TIMESTAMP
        WHERE user_id = $2
        RETURNING user_id, email, status
      `, [newStatus, userId])
      
      console.log('Update query executed, rows affected:', updateResult.rowCount)
      console.log('Update result:', updateResult.rows)
      
    } catch (updateError: any) {
      console.error('Update error:', updateError)
      return NextResponse.json({ error: 'Database update failed: ' + (updateError?.message || 'Unknown error') }, { status: 500 })
    }

    if (updateResult.rows.length === 0) {
      console.error('No rows returned after update for userId:', userId)
      return NextResponse.json({ error: 'Failed to update user status - no rows affected' }, { status: 500 })
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
