import { NextRequest, NextResponse } from 'next/server';
import { fetchFromTable } from '@/lib/db-service';
import { verifyUserAuth } from '@/lib/auth';
import { getUserGlobalRole } from '@/services/getGlobalRole';

export async function GET(request: NextRequest) {
  try {
    // Verify user authentication
    const authResult = await verifyUserAuth(request);
    
    if (!authResult.isAuthenticated || !authResult.userId) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Get user's global role and permissions
    const userGlobalRole = await getUserGlobalRole(authResult.userId);
    
    if (!userGlobalRole) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');
    const projectId = searchParams.get('project_id');

    let filters: any[] = [];

    // Apply role-based filtering
    if (userGlobalRole.permissions.canViewAllCalls) {
      // Admin can see all calls, optionally filtered by project
      if (projectId) {
        filters.push({ column: 'project_id', operator: 'eq', value: projectId });
      }
    } else {
      // Regular users can only see calls from projects they have access to
      if (projectId) {
        // If specific project is requested, filter by it
        filters.push({ column: 'project_id', operator: 'eq', value: projectId });
      } else {
        // Get all projects user has access to
        const { data: userProjects, error: projectsError } = await fetchFromTable({
          table: 'pype_voice_email_project_mapping',
          select: 'project_id',
          filters: [
            { column: 'email', operator: 'eq', value: userGlobalRole.email },
            { column: 'is_active', operator: 'eq', value: true }
          ]
        });

        if (projectsError) {
          console.error('Error fetching user projects:', projectsError);
          return NextResponse.json(
            { error: 'Failed to fetch user projects' },
            { status: 500 }
          );
        }

        const projectIds = userProjects?.map((p: any) => p.project_id) || [];
        
        if (projectIds.length === 0) {
          return NextResponse.json({ 
            calls: [],
            total: 0,
            userRole: userGlobalRole.global_role,
            canViewAll: false
          });
        }

        filters.push({ column: 'project_id', operator: 'in', value: projectIds });
      }
    }

    // Fetch calls from call logs table
    const { data: calls, error } = await fetchFromTable({
      table: 'pype_voice_call_logs',
      select: 'id, call_id, project_id, duration_seconds, created_at, updated_at, transcript_json',
      filters,
      orderBy: { column: 'created_at', ascending: false },
      limit,
      offset
    });

    if (error) {
      console.error('Error fetching calls:', error);
      return NextResponse.json(
        { error: 'Failed to fetch calls' },
        { status: 500 }
      );
    }

    // Transform calls data to include additional metadata
    const transformedCalls = (calls || []).map((call: any) => ({
      id: call.id,
      call_id: call.call_id,
      project_id: call.project_id,
      duration_seconds: call.duration_seconds || 0,
      status: 'completed', // Default status
      created_at: call.created_at,
      updated_at: call.updated_at,
      has_transcript: !!call.transcript_json
    }));

    // Get total count for pagination (simplified for now)
    let total = transformedCalls.length;
    if (limit > 0 && transformedCalls.length === limit) {
      // If we got a full page, there might be more - approximate
      total = offset + limit + 1;
    }

    return NextResponse.json({ 
      calls: transformedCalls,
      total,
      userRole: userGlobalRole.global_role,
      canViewAll: userGlobalRole.permissions.canViewAllCalls
    });

  } catch (error) {
    console.error('Unexpected error fetching calls:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
