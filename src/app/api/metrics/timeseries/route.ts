import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { verifyUserAuth } from '@/lib/auth'
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

    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get('projectId');
    const period = searchParams.get('period') || '7d';
    const metric = searchParams.get('metric') || 'calls';
    const agentId = searchParams.get('agentId'); // Filter by specific agent

    // Check user permissions
    const userGlobalRole = await getUserGlobalRole(userId);
    
    if (!userGlobalRole) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // For regular users, verify workspace access if projectId is specified
    if (projectId && !userGlobalRole.permissions.canViewAllProjects) {
      const accessCheck = await query(`
        SELECT epm.id 
        FROM pype_voice_email_project_mapping epm
        INNER JOIN pype_voice_users u ON u.email = epm.email
        WHERE u.user_id = $1 AND epm.project_id = $2 AND epm.is_active = true
      `, [userId, projectId]);

      if (!accessCheck.rows || accessCheck.rows.length === 0) {
        return NextResponse.json(
          { error: 'You do not have permission to view metrics for this project' },
          { status: 403 }
        );
      }
    };

    // Calculate date range based on period
    const now = new Date()
    const startDate = new Date()
    
    switch (period) {
      case '7d':
        startDate.setDate(now.getDate() - 7)
        break
      case '30d':
        startDate.setDate(now.getDate() - 30)
        break
      case '90d':
        startDate.setDate(now.getDate() - 90)
        break
      default:
        startDate.setDate(now.getDate() - 7)
    }

    let sql = `
      SELECT 
        DATE(cl.call_started_at) as date,
        COUNT(*) as calls,
        SUM(COALESCE(cl.total_llm_cost, 0) + COALESCE(cl.total_tts_cost, 0) + COALESCE(cl.total_stt_cost, 0)) as total_cost,
        SUM(COALESCE(cl.total_llm_cost, 0)) as llm_cost,
        SUM(COALESCE(cl.total_tts_cost, 0)) as tts_cost,
        SUM(COALESCE(cl.total_stt_cost, 0)) as stt_cost,
        SUM(COALESCE(cl.llm_tokens_input, 0)) as llm_tokens_input,
        SUM(COALESCE(cl.llm_tokens_output, 0)) as llm_tokens_output,
        SUM(COALESCE(cl.tts_characters, 0)) as tts_characters,
        SUM(COALESCE(cl.stt_duration, 0)) as stt_duration,
        SUM(COALESCE(cl.duration_seconds, 0)) as total_call_duration,
        AVG(COALESCE(cl.avg_latency, 0)) as avg_response_time,
        ROUND(
          (COUNT(CASE WHEN cl.call_ended_reason = 'completed' THEN 1 END) * 100.0 / COUNT(*)), 2
        ) as completion_rate
      FROM pype_voice_call_logs cl
      INNER JOIN pype_voice_agents a ON cl.agent_id = a.id
      WHERE cl.call_started_at >= $1 AND cl.call_started_at <= $2
    `

    const params = [startDate.toISOString(), now.toISOString()]
    let paramIndex = 2

    // Add project filter if specified and user has access
    if (projectId && projectId !== 'ALL') {
      sql += ` AND a.project_id = $${++paramIndex}`
      params.push(projectId)
    } else if (!projectId && !userGlobalRole.permissions.canViewAllProjects) {
      // For regular users without project specified, get their accessible projects
      const userProjectsSql = `
        SELECT DISTINCT epm.project_id 
        FROM pype_voice_email_project_mapping epm
        INNER JOIN pype_voice_users u ON u.email = epm.email
        WHERE u.user_id = $${++paramIndex} AND epm.is_active = true
      `
      params.push(userId)
      const userProjectsResult = await query(userProjectsSql, [userId])
      if (userProjectsResult.rows && userProjectsResult.rows.length > 0) {
        const projectIds = userProjectsResult.rows.map((row: any) => row.project_id)
        const placeholders = projectIds.map((_, idx) => `$${paramIndex + 1 + idx}`).join(',')
        sql += ` AND a.project_id IN (${placeholders})`
        params.push(...projectIds)
        paramIndex += projectIds.length
      }
    }

    // Add agent filter if specified
    if (agentId) {
      sql += ` AND cl.agent_id = $${++paramIndex}`
      params.push(agentId)
    }

    sql += `
      GROUP BY DATE(cl.call_started_at)
      ORDER BY DATE(cl.call_started_at) ASC
    `

    const result = await query(sql, params)
    
    if (!result || !result.rows) {
      console.error('Database query failed for timeseries metrics');
      return NextResponse.json(
        { error: 'Failed to fetch metrics data' },
        { status: 500 }
      );
    }

    // Transform database results to match expected format
    const data = result.rows.map((row: any) => ({
      date: row.date,
      timestamp: new Date(row.date).getTime(),
      calls: parseInt(row.calls) || 0,
      total_cost: parseFloat(row.total_cost) || 0,
      llm_cost: parseFloat(row.llm_cost) || 0,
      tts_cost: parseFloat(row.tts_cost) || 0,
      stt_cost: parseFloat(row.stt_cost) || 0,
      llm_tokens_input: parseInt(row.llm_tokens_input) || 0,
      llm_tokens_output: parseInt(row.llm_tokens_output) || 0,
      tts_characters: parseInt(row.tts_characters) || 0,
      stt_duration: parseInt(row.stt_duration) || 0,
      total_call_duration: parseInt(row.total_call_duration) || 0,
      avg_response_time: parseFloat(row.avg_response_time) || 0,
      completion_rate: parseFloat(row.completion_rate) || 0
    }))

    return NextResponse.json({
      data,
      period,
      projectId,
      metric,
      agentId
    })
  } catch (error) {
    console.error('Time series metrics error:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to fetch time series metrics' },
      { status: 500 }
    );
  }
}
