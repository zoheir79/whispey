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

    // Simplified SQL query for debugging - start with basic calls only
    console.log(' CALLS API: Starting with basic query for debugging...');
    
    // First, just get basic calls data without complex joins
    sql = `
      SELECT 
        cl.id, 
        cl.call_id, 
        cl.agent_id, 
        cl.duration_seconds, 
        cl.created_at, 
        cl.call_ended_reason, 
        cl.customer_number, 
        cl.call_started_at,
        COALESCE(cl.avg_latency, 0) as avg_latency,
        COALESCE(cl.total_llm_cost, 0) as total_llm_cost,
        COALESCE(cl.total_tts_cost, 0) as total_tts_cost,
        COALESCE(cl.total_stt_cost, 0) as total_stt_cost,
        cl.transcript_json,
        cl.metadata,
        cl.transcription_metrics
      FROM pype_voice_call_logs cl
      ORDER BY cl.created_at DESC
      LIMIT $1
    `;
    params = [limit];

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
