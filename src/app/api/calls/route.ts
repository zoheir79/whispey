import { NextRequest, NextResponse } from 'next/server';
import { verifyUserAuth } from '@/lib/auth';
import { getUserGlobalRole } from '@/services/getGlobalRole';

export async function GET(request: NextRequest) {
  try {
    console.log(' CALLS API: Starting request...');
    
    // Verify user authentication
    const { isAuthenticated, userId } = await verifyUserAuth(request);
    
    if (!isAuthenticated || !userId) {
      console.log(' CALLS API: Authentication failed');
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    console.log(' CALLS API: User authenticated:', userId);

    // Get user's global role and permissions
    const userGlobalRole = await getUserGlobalRole(userId);
    
    if (!userGlobalRole) {
      console.log(' CALLS API: User role not found');
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    console.log(' CALLS API: User role:', userGlobalRole.global_role, 'canViewAll:', userGlobalRole.permissions.canViewAllCalls);

    // For now, return mock data to ensure the API works
    // We'll implement real data fetching once this works
    const mockCalls = [
      {
        id: '1',
        call_id: 'call_1234567890',
        project_id: 'project_123',
        project_name: 'Test Project',
        duration_seconds: 120,
        status: 'completed',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        has_transcript: true
      },
      {
        id: '2', 
        call_id: 'call_0987654321',
        project_id: 'project_456',
        project_name: 'Another Project',
        duration_seconds: 85,
        status: 'completed',
        created_at: new Date(Date.now() - 86400000).toISOString(), // Yesterday
        updated_at: new Date(Date.now() - 86400000).toISOString(),
        has_transcript: false
      }
    ];

    // Filter mock data based on role
    const calls = userGlobalRole.permissions.canViewAllCalls 
      ? mockCalls 
      : mockCalls; // For now, return same data for both

    console.log(' CALLS API: Returning', calls.length, 'mock calls');

    return NextResponse.json({ 
      calls,
      total: calls.length,
      userRole: userGlobalRole.global_role,
      canViewAll: userGlobalRole.permissions.canViewAllCalls,
      note: 'This is mock data - real database integration coming next'
    });

  } catch (error) {
    console.error(' CALLS API: Unexpected error:', error);
    return NextResponse.json(
      { error: `Internal server error: ${error instanceof Error ? error.message : 'Unknown error'}` },
      { status: 500 }
    );
  }
}
