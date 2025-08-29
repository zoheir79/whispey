import { NextRequest, NextResponse } from 'next/server';
import { verifyUserAuth } from '@/lib/auth';
import { query } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    // Verify authentication
    const { isAuthenticated, userId } = await verifyUserAuth(request);
    if (!isAuthenticated || !userId) {
      return NextResponse.json(
        { success: false, message: 'Authentication required' },
        { status: 401 }
      );
    }

    // Get user data by user_id
    const result = await query(
      'SELECT user_id, email, first_name, last_name, global_role, status FROM pype_voice_users WHERE user_id = $1',
      [userId]
    );

    if (result.rows.length === 0) {
      return NextResponse.json(
        { success: false, message: 'User not found' },
        { status: 404 }
      );
    }

    const user = result.rows[0];

    // Return user data (excluding sensitive information)
    return NextResponse.json({
      success: true,
      user: {
        user_id: user.user_id,
        email: user.email,
        first_name: user.first_name,
        last_name: user.last_name,
        global_role: user.global_role,
        status: user.status,
      },
    });
  } catch (error) {
    console.error('Get user error:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to get user data' },
      { status: 500 }
    );
  }
}
