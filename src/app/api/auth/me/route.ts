import { NextRequest, NextResponse } from 'next/server';
import { getUserById } from '@/lib/auth-utils';
import { verifyUserAuth } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    // Check authentication (now reads JWT from cookies)
    const { isAuthenticated, userId } = await verifyUserAuth();

    if (!isAuthenticated || !userId) {
      return NextResponse.json(
        { success: false, message: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get user data
    const user = await getUserById(userId);

    if (!user) {
      return NextResponse.json(
        { success: false, message: 'User not found' },
        { status: 404 }
      );
    }

    // Return user data (excluding sensitive information)
    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        first_name: user.first_name,
        last_name: user.last_name,
        profile_image_url: user.profile_image_url,
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
