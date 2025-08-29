import { NextRequest, NextResponse } from 'next/server'
import { verifyUserAuth } from '@/lib/auth'
import { query } from '@/lib/db'

export async function PATCH(request: NextRequest) {
  try {
    const { isAuthenticated, userId } = await verifyUserAuth(request);
    if (!isAuthenticated || !userId) {
      return NextResponse.json({ message: 'Authentication required' }, { status: 401 })
    }

    const body = await request.json()
    const { first_name, last_name, email } = body

    // Validate email format if provided
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ message: 'Invalid email format' }, { status: 400 })
    }

    // Check if email is already taken by another user
    if (email) {
      const existingUser = await query(
        'SELECT user_id FROM pype_voice_users WHERE email = $1 AND user_id != $2',
        [email, userId]
      )
      
      if (existingUser.rows.length > 0) {
        return NextResponse.json({ message: 'Email already in use' }, { status: 400 })
      }
    }

    // Update user profile
    const updateResult = await query(
      `UPDATE pype_voice_users 
       SET first_name = $1, last_name = $2, email = $3, updated_at = CURRENT_TIMESTAMP 
       WHERE user_id = $4 
       RETURNING user_id, email, first_name, last_name, global_role, status, created_at, updated_at`,
      [first_name || null, last_name || null, email, userId]
    )

    if (updateResult.rows.length === 0) {
      return NextResponse.json({ message: 'User not found' }, { status: 404 })
    }

    const updatedUser = updateResult.rows[0]
    
    return NextResponse.json({
      message: 'Profile updated successfully',
      user: {
        user_id: updatedUser.user_id,
        email: updatedUser.email,
        first_name: updatedUser.first_name,
        last_name: updatedUser.last_name,
        global_role: updatedUser.global_role,
        status: updatedUser.status,
        created_at: updatedUser.created_at,
        updated_at: updatedUser.updated_at
      }
    })

  } catch (error) {
    console.error('Profile update error:', error)
    return NextResponse.json(
      { message: 'Internal server error' }, 
      { status: 500 }
    )
  }
}
