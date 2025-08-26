import { NextRequest, NextResponse } from 'next/server';
import { fetchFromTable } from '@/lib/db-service';
import { query } from '@/lib/db';
import { verifyUserAuth } from '@/lib/auth';
import { getUserGlobalRole } from '@/services/getGlobalRole';

interface TranscriptRecord {
  transcript_json: any;
  transcript_with_metrics: any;
  call_id: string;
  duration_seconds: number;
}

export async function GET(request: NextRequest) {
  try {
    // Verify authentication using cookie-based auth (consistent with other endpoints)
    const authResult = await verifyUserAuth(request);
    if (!authResult.isAuthenticated || !authResult.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user's global role and permissions
    const userGlobalRole = await getUserGlobalRole(authResult.userId);
    
    if (!userGlobalRole) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const { searchParams } = new URL(request.url);
    const session_id = searchParams.get('session_id');

    console.log('🔍 TRANSCRIPT API: Received session_id:', session_id);

    if (!session_id) {
      console.log('❌ TRANSCRIPT API: No session_id provided');
      return NextResponse.json({ error: 'session_id is required' }, { status: 400 });
    }

    // Use direct SQL query for role-based filtering (fetchFromTable can't handle complex subqueries)
    console.log('🔍 TRANSCRIPT API: Trying exact match for call_id:', session_id, 'with role:', userGlobalRole.global_role);
    
    let transcriptData: any[] = [];
    let queryError: any = null;
    
    try {
      let sql = '';
      let params: any[] = [];
      
      if (userGlobalRole.permissions.canViewAllCalls) {
        // Admin can access all call transcripts
        sql = `
          SELECT transcript_json, transcript_with_metrics, call_id, duration_seconds
          FROM pype_voice_call_logs 
          WHERE call_id = $1 
          LIMIT 1
        `;
        params = [session_id];
      } else {
        // Regular users - only access calls from their projects
        sql = `
          SELECT DISTINCT cl.transcript_json, cl.transcript_with_metrics, cl.call_id, cl.duration_seconds
          FROM pype_voice_call_logs cl
          INNER JOIN pype_voice_agents a ON cl.agent_id = a.id
          INNER JOIN pype_voice_email_project_mapping epm ON a.project_id = epm.project_id
          INNER JOIN pype_voice_users u ON u.email = epm.email
          WHERE u.user_id = $2 AND cl.call_id = $1
          LIMIT 1
        `;
        params = [session_id, authResult.userId];
      }
      
      const result = await query(sql, params);
      transcriptData = result.rows || [];
    } catch (error) {
      console.error('🔍 TRANSCRIPT API: Query error:', error);
      queryError = error;
    }

    console.log('🔍 TRANSCRIPT API: Exact match result:', {
      found: transcriptData?.length || 0,
      error: queryError,
      data: transcriptData
    });

    // If no exact match found, try searching by UUID pattern (for cases where frontend passes UUID only)
    if (!queryError && (!transcriptData || transcriptData.length === 0)) {
      console.log('🔍 TRANSCRIPT API: Trying pattern match for call_id LIKE:', `${session_id}%`);
      
      try {
        let sql = '';
        let params: any[] = [];
        
        if (userGlobalRole.permissions.canViewAllCalls) {
          // Admin can access all call transcripts  
          sql = `
            SELECT transcript_json, transcript_with_metrics, call_id, duration_seconds
            FROM pype_voice_call_logs 
            WHERE call_id LIKE $1 
            LIMIT 1
          `;
          params = [`${session_id}%`];
        } else {
          // Regular users - only access calls from their projects
          sql = `
            SELECT DISTINCT cl.transcript_json, cl.transcript_with_metrics, cl.call_id, cl.duration_seconds
            FROM pype_voice_call_logs cl
            INNER JOIN pype_voice_agents a ON cl.agent_id = a.id
            INNER JOIN pype_voice_email_project_mapping epm ON a.project_id = epm.project_id
            INNER JOIN pype_voice_users u ON u.email = epm.email
            WHERE u.user_id = $2 AND cl.call_id LIKE $1
            LIMIT 1
          `;
          params = [`${session_id}%`, authResult.userId];
        }
        
        const result = await query(sql, params);
        const patternData = result.rows || [];
        
        console.log('🔍 TRANSCRIPT API: Pattern match result:', {
          found: patternData?.length || 0,
          data: patternData
        });
        
        if (patternData && patternData.length > 0) {
          transcriptData = patternData;
        }
      } catch (error) {
        console.error('🔍 TRANSCRIPT API: Pattern match error:', error);
      }
    }

    // Third fallback: try searching by 'id' field (as per memory of previous fix)
    if (!queryError && (!transcriptData || transcriptData.length === 0)) {
      console.log('🔍 TRANSCRIPT API: Trying fallback search by id field:', session_id);
      
      try {
        let sql = '';
        let params: any[] = [];
        
        if (userGlobalRole.permissions.canViewAllCalls) {
          // Admin can access all call transcripts
          sql = `
            SELECT transcript_json, transcript_with_metrics, call_id, duration_seconds
            FROM pype_voice_call_logs 
            WHERE id = $1 
            LIMIT 1
          `;
          params = [session_id];
        } else {
          // Regular users - only access calls from their projects
          sql = `
            SELECT DISTINCT cl.transcript_json, cl.transcript_with_metrics, cl.call_id, cl.duration_seconds
            FROM pype_voice_call_logs cl
            INNER JOIN pype_voice_agents a ON cl.agent_id = a.id
            INNER JOIN pype_voice_email_project_mapping epm ON a.project_id = epm.project_id
            INNER JOIN pype_voice_users u ON u.email = epm.email
            WHERE u.user_id = $2 AND cl.id = $1
            LIMIT 1
          `;
          params = [session_id, authResult.userId];
        }
        
        const result = await query(sql, params);
        const idData = result.rows || [];
        
        console.log('🔍 TRANSCRIPT API: ID fallback result:', {
          found: idData?.length || 0,
          data: idData
        });
        
        if (idData && idData.length > 0) {
          transcriptData = idData;
        }
      } catch (error) {
        console.error('🔍 TRANSCRIPT API: ID fallback error:', error);
      }
    }

    if (queryError) {
      console.error('Transcript query error:', queryError);
      return NextResponse.json(
        { error: 'Failed to fetch transcript data', details: queryError },
        { status: 500 }
      );
    }

    if (!transcriptData || transcriptData.length === 0) {
      return NextResponse.json({ error: 'Transcript not found' }, { status: 404 });
    }

    const record = transcriptData[0] as unknown as TranscriptRecord;
    
    // Try to parse transcript_json properly
    let transcript = null;
    try {
      // Check if transcript_json is already an object or needs parsing
      if (typeof record.transcript_json === 'string') {
        transcript = JSON.parse(record.transcript_json);
      } else if (record.transcript_json && typeof record.transcript_json === 'object') {
        transcript = record.transcript_json;
      }
    } catch (parseError) {
      console.warn('Failed to parse transcript_json:', parseError);
      // Try transcript_with_metrics as fallback
      try {
        if (typeof record.transcript_with_metrics === 'string') {
          transcript = JSON.parse(record.transcript_with_metrics);
        } else if (record.transcript_with_metrics && typeof record.transcript_with_metrics === 'object') {
          transcript = record.transcript_with_metrics;
        }
      } catch (fallbackError) {
        console.warn('Failed to parse transcript_with_metrics:', fallbackError);
        return NextResponse.json({ error: 'Invalid transcript format' }, { status: 422 });
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        transcript: transcript || {},
        call_id: record.call_id,
        duration_seconds: record.duration_seconds
      }
    });

  } catch (error) {
    console.error('Transcript API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
