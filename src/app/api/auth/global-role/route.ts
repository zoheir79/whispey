// API to get user's global role and permissions
import { NextRequest, NextResponse } from 'next/server';
import { verifyUserAuth } from '@/lib/auth';
import { getUserGlobalRole } from '@/services/getGlobalRole';

export async function GET(request: NextRequest) {
  try {
    // Verify user authentication
    const { isAuthenticated, userId } = await verifyUserAuth(request);
    
    if (!isAuthenticated || !userId) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Get user's global role and permissions
    const userGlobalRole = await getUserGlobalRole(userId);
    
    if (!userGlobalRole) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        globalRole: userGlobalRole.global_role,
        permissions: userGlobalRole.permissions,
        userId: userGlobalRole.user_id,
        email: userGlobalRole.email
      }
    });

  } catch (error) {
    console.error('Error fetching global role:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
