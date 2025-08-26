import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
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

    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '10000'); // Get ALL calls by default
    const projectId = searchParams.get('project_id');

    let sql: string;
    let params: any[];

    // Build SQL query based on user role - REAL DATA ONLY
    if (userGlobalRole.permissions.canViewAllCalls) {
      // Admin/Super Admin: see ALL calls from ALL projects
      if (projectId) {
        // Optional filter by specific project
        sql = `
          SELECT cl.id, cl.call_id, cl.project_id, cl.duration_seconds, cl.created_at, cl.updated_at, 
                 cl.transcript_json, cl.call_ended_reason, cl.customer_number, cl.call_started_at,
                 p.name as project_name
          FROM pype_voice_call_logs cl
          LEFT JOIN pype_voice_projects p ON cl.project_id = p.id
          WHERE cl.project_id = $1
          ORDER BY cl.created_at DESC
          LIMIT $2
        `;
        params = [projectId, limit];
      } else {
        // All calls from all projects
        sql = `
          SELECT cl.id, cl.call_id, cl.project_id, cl.duration_seconds, cl.created_at, cl.updated_at, 
                 cl.transcript_json, cl.call_ended_reason, cl.customer_number, cl.call_started_at,
                 p.name as project_name
          FROM pype_voice_call_logs cl
          LEFT JOIN pype_voice_projects p ON cl.project_id = p.id
          ORDER BY cl.created_at DESC
          LIMIT $1
        `;
        params = [limit];
      }
    } else {
      // Owner: see ALL calls from ALL their accessible projects
      if (projectId) {
        // Specific project (with access check)
        sql = `
          SELECT cl.id, cl.call_id, cl.project_id, cl.duration_seconds, cl.created_at, cl.updated_at, 
                 cl.transcript_json, cl.call_ended_reason, cl.customer_number, cl.call_started_at,
                 p.name as project_name
          FROM pype_voice_call_logs cl
          LEFT JOIN pype_voice_projects p ON cl.project_id = p.id
          INNER JOIN pype_voice_email_project_mapping epm ON cl.project_id = epm.project_id
          INNER JOIN pype_voice_users u ON u.email = epm.email
          WHERE cl.project_id = $1 AND u.user_id = $2 AND epm.is_active = true
          ORDER BY cl.created_at DESC
          LIMIT $3
        `;
        params = [projectId, userId, limit];
      } else {
        // ALL calls from ALL accessible projects
        sql = `
          SELECT DISTINCT cl.id, cl.call_id, cl.project_id, cl.duration_seconds, cl.created_at, cl.updated_at, 
                          cl.transcript_json, cl.call_ended_reason, cl.customer_number, cl.call_started_at,
                          p.name as project_name
          FROM pype_voice_call_logs cl
          LEFT JOIN pype_voice_projects p ON cl.project_id = p.id
          INNER JOIN pype_voice_email_project_mapping epm ON cl.project_id = epm.project_id
          INNER JOIN pype_voice_users u ON u.email = epm.email
          WHERE u.user_id = $1 AND epm.is_active = true
          ORDER BY cl.created_at DESC
          LIMIT $2
        `;
        params = [userId, limit];
      }
    }

    console.log(' CALLS API: Executing SQL for', userGlobalRole.global_role, 'role');
    console.log(' CALLS API: SQL Query:', sql);
    console.log(' CALLS API: Parameters:', params);
    
    const result = await query(sql, params);
    const callsData = result.rows || [];
    
    console.log(' CALLS API: Raw query result:', result);

    // Transform calls data - NO HARDCODED FIELDS
    const calls = callsData.map((call: any) => ({
      id: call.id,
      call_id: call.call_id,
      project_id: call.project_id,
      project_name: call.project_name, // Real project name from DB
      duration_seconds: parseInt(call.duration_seconds) || 0,
      status: call.call_ended_reason || 'unknown',
      call_ended_reason: call.call_ended_reason,
      customer_number: call.customer_number,
      created_at: call.created_at,
      updated_at: call.updated_at,
      call_started_at: call.call_started_at,
      has_transcript: !!call.transcript_json
    }));

    console.log(' CALLS API: Found', calls.length, 'REAL calls for', userGlobalRole.global_role);

    return NextResponse.json({ 
      calls,
      total: calls.length,
      userRole: userGlobalRole.global_role,
      canViewAll: userGlobalRole.permissions.canViewAllCalls
    });

  } catch (error) {
    console.error(' CALLS API: Unexpected error:', error);
    return NextResponse.json(
      { error: `Internal server error: ${error instanceof Error ? error.message : 'Unknown error'}` },
      { status: 500 }
    );
  }
}
