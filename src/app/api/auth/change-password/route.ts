import { NextRequest, NextResponse } from 'next/server'
import { verifyToken } from '@/lib/auth-utils'
import { query } from '@/lib/db'
import * as bcrypt from 'bcrypt'

export async function PATCH(request: NextRequest) {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '') || 
                  request.cookies.get('token')?.value

    if (!token) {
      return NextResponse.json({ message: 'Authentication required' }, { status: 401 })
    }

    const verification = verifyToken(token)
    if (!verification.valid || !verification.userId) {
      return NextResponse.json({ message: 'Invalid token' }, { status: 401 })
    }

    const body = await request.json()
    const { current_password, new_password } = body

    if (!current_password || !new_password) {
      return NextResponse.json({ message: 'Current password and new password are required' }, { status: 400 })
    }

    if (new_password.length < 6) {
      return NextResponse.json({ message: 'New password must be at least 6 characters long' }, { status: 400 })
    }

    // Get current user data
    const userResult = await query(
      'SELECT user_id, email, password_hash, status FROM pype_voice_users WHERE user_id = $1',
      [verification.userId]
    )

    if (userResult.rows.length === 0) {
      return NextResponse.json({ message: 'User not found' }, { status: 404 })
    }

    const user = userResult.rows[0]

    // Check if user is active
    if (user.status !== 'active') {
      return NextResponse.json({ message: 'Account is not active' }, { status: 403 })
    }

    // Verify current password
    const isCurrentPasswordValid = await bcrypt.compare(current_password, user.password_hash)
    if (!isCurrentPasswordValid) {
      return NextResponse.json({ message: 'Current password is incorrect' }, { status: 400 })
    }

    // Hash new password
    const saltRounds = 10
    const newPasswordHash = await bcrypt.hash(new_password, saltRounds)

    // Update password
    const updateResult = await query(
      'UPDATE pype_voice_users SET password_hash = $1, updated_at = CURRENT_TIMESTAMP WHERE user_id = $2',
      [newPasswordHash, verification.userId]
    )

    if (updateResult.rowCount === 0) {
      return NextResponse.json({ message: 'Failed to update password' }, { status: 500 })
    }

    return NextResponse.json({
      message: 'Password changed successfully'
    })

  } catch (error) {
    console.error('Password change error:', error)
    return NextResponse.json(
      { message: 'Internal server error' }, 
      { status: 500 }
    )
  }
}
