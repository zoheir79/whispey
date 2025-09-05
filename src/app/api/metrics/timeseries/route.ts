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

    // Calculate date range based on period using system timezone
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
    
    // Use system timezone for database queries
    const startDateLocal = new Date(startDate.getTime() - (startDate.getTimezoneOffset() * 60000))
    const endDateLocal = new Date(now.getTime() - (now.getTimezoneOffset() * 60000))

    let sql = `
      SELECT 
        csm.call_date as date,
        csm.calls,
        -- Use materialized view complete cost calculation (usage + dedicated prorated)
        COALESCE((get_complete_daily_cost(csm.agent_id, csm.call_date))->>'total_cost', '0')::NUMERIC as total_cost,
        -- Individual cost breakdown from call logs
        SUM(COALESCE(cl.total_llm_cost, 0)) as llm_cost,
        SUM(COALESCE(cl.total_tts_cost, 0)) as tts_cost,
        SUM(COALESCE(cl.total_stt_cost, 0)) as stt_cost,
        csm.total_call_minutes * 60 as total_call_duration,
        AVG(COALESCE(cl.avg_latency, 0)) as avg_response_time,
        SUM(COALESCE((cl.metadata->'usage'->>'llm_prompt_tokens')::integer, 0)) as llm_tokens_input,
        SUM(COALESCE((cl.metadata->'usage'->>'llm_completion_tokens')::integer, 0)) as llm_tokens_output,
        SUM(COALESCE((cl.metadata->'usage'->>'stt_audio_duration')::numeric, 0)) as stt_duration,
        SUM(COALESCE((cl.metadata->'usage'->>'tts_characters')::integer, 0)) as tts_characters,
        csm.success_rate as completion_rate
      FROM call_summary_materialized csm
      LEFT JOIN pype_voice_call_logs cl ON csm.agent_id = cl.agent_id AND DATE(cl.call_started_at) = csm.call_date
      INNER JOIN pype_voice_agents a ON csm.agent_id = a.id
      WHERE csm.call_date >= DATE($1) AND csm.call_date <= DATE($2)
    `

    const params = [startDateLocal.toISOString(), endDateLocal.toISOString()]
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
      sql += ` AND csm.agent_id = $${++paramIndex}`
      params.push(agentId)
      console.log('🎯 Agent filter applied:', agentId)
    }

    sql += `
      GROUP BY csm.call_date, csm.agent_id, csm.calls, csm.total_call_minutes, csm.success_rate
      ORDER BY csm.call_date ASC
    `

    console.log(' Executing SQL query:', sql)
    console.log(' Query params:', params)

    const result = await query(sql, params);
    
    // Debug: Log raw database results
    console.log('🔍 Raw DB results count:', result.rows.length)
    console.log('🔍 Raw DB results (first row):', result.rows[0])
    if (agentId) {
      console.log('🎯 Agent filter results for agentId:', agentId)
      console.log('🎯 Found', result.rows.length, 'rows for this agent')
    }
    if (result.rows[0]) {
      console.log('🎤 STT Debug - stt_duration from DB:', result.rows[0].stt_duration)
      console.log('🔊 TTS Debug - tts_characters from DB:', result.rows[0].tts_characters)  
      console.log('🧠 LLM Debug - llm_tokens_input from DB:', result.rows[0].llm_tokens_input)
      console.log('🧠 LLM Debug - llm_tokens_output from DB:', result.rows[0].llm_tokens_output)
    }
    
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
      // Direct fields for WorkspaceMetrics compatibility
      llm_tokens_input: parseInt(row.llm_tokens_input) || 0,
      llm_tokens_output: parseInt(row.llm_tokens_output) || 0,
      stt_duration: parseFloat(row.stt_duration) || 0,
      tts_characters: parseInt(row.tts_characters) || 0,
      llm_usage: {
        total_tokens: (parseInt(row.llm_tokens_input) || 0) + (parseInt(row.llm_tokens_output) || 0),
        input_tokens: parseInt(row.llm_tokens_input) || 0,
        output_tokens: parseInt(row.llm_tokens_output) || 0,
        requests: parseInt(row.calls) || 0
      },
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
