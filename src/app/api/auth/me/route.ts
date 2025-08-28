import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth-utils';
import { query } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    // Get JWT token from cookies
    const token = request.cookies.get('auth-token')?.value;
    
    if (!token) {
      return NextResponse.json(
        { success: false, message: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Verify JWT token
    const payload = verifyToken(token);
    if (!payload || !payload.userId) {
      return NextResponse.json(
        { success: false, message: 'Invalid token' },
        { status: 401 }
      );
    }

    // Get user data by user_id
    const result = await query(
      'SELECT user_id, email, first_name, last_name, global_role, status FROM pype_voice_users WHERE user_id = $1',
      [payload.userId]
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
