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

    // Check user permissions
    const userGlobalRole = await getUserGlobalRole(userId);
    
    if (!userGlobalRole) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // For regular users, verify workspace access if projectId is specified
    if (projectId && projectId !== 'ALL' && !userGlobalRole.permissions.canViewAllProjects) {
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

    // Calculate date range using system timezone
    const now = new Date();
    const startDate = new Date();
    
    switch (period) {
      case '7d':
        startDate.setDate(now.getDate() - 7);
        break;
      case '30d':
        startDate.setDate(now.getDate() - 30);
        break;
      case '90d':
        startDate.setDate(now.getDate() - 90);
        break;
      case '1y':
        startDate.setFullYear(now.getFullYear() - 1);
        break;
      default:
        startDate.setDate(now.getDate() - 30);
    }
    
    // Use system timezone for database queries
    const startDateLocal = new Date(startDate.getTime() - (startDate.getTimezoneOffset() * 60000));
    const endDateLocal = new Date(now.getTime() - (now.getTimezoneOffset() * 60000));

    // Build SQL query based on user permissions and filters
    let sql = `
      SELECT 
        a.id as agent_id,
        a.name as agent_name,
        a.currency as agent_currency,
        COUNT(cl.id) as total_calls,
        COUNT(CASE WHEN cl.call_ended_reason = 'completed' THEN 1 END) as successful_calls,
        COUNT(CASE WHEN cl.call_ended_reason != 'completed' THEN 1 END) as failed_calls,
        AVG(COALESCE(cl.duration_seconds, 0)) as avg_duration,
        -- Fallback pour total_cost si les champs sont null (anciens agents)
        CASE 
          WHEN SUM(COALESCE(cl.total_llm_cost, 0) + COALESCE(cl.total_tts_cost, 0) + COALESCE(cl.total_stt_cost, 0)) > 0
          THEN SUM(COALESCE(cl.total_llm_cost, 0) + COALESCE(cl.total_tts_cost, 0) + COALESCE(cl.total_stt_cost, 0))
          ELSE SUM(COALESCE(cl.duration_seconds, 0)) / 60.0 * 0.02  -- Estimation $0.02/minute
        END as total_cost,
        ROUND(
          (COUNT(CASE WHEN cl.call_ended_reason = 'completed' THEN 1 END) * 100.0 / NULLIF(COUNT(cl.id), 0)), 2
        ) as completion_rate,
        AVG(COALESCE(cl.avg_latency, 0)) as response_time,
        SUM(COALESCE((
          SELECT SUM(
            COALESCE((turn->'llm_metrics'->>'prompt_tokens')::integer, 0) +
            COALESCE((turn->'llm_metrics'->>'completion_tokens')::integer, 0)
          ) FROM jsonb_array_elements(cl.transcript_with_metrics) AS turn
          WHERE cl.transcript_with_metrics IS NOT NULL AND jsonb_typeof(cl.transcript_with_metrics) = 'array'
        ), 0)) as total_tokens,
        SUM(COALESCE((
          SELECT SUM(COALESCE((turn->'llm_metrics'->>'prompt_tokens')::integer, 0))
          FROM jsonb_array_elements(cl.transcript_with_metrics) AS turn
          WHERE cl.transcript_with_metrics IS NOT NULL AND jsonb_typeof(cl.transcript_with_metrics) = 'array'
        ), 0)) as input_tokens,
        SUM(COALESCE((
          SELECT SUM(COALESCE((turn->'llm_metrics'->>'completion_tokens')::integer, 0))
          FROM jsonb_array_elements(cl.transcript_with_metrics) AS turn
          WHERE cl.transcript_with_metrics IS NOT NULL AND jsonb_typeof(cl.transcript_with_metrics) = 'array'
        ), 0)) as output_tokens
      FROM pype_voice_agents a
      LEFT JOIN pype_voice_call_logs cl ON a.id = cl.agent_id 
        AND cl.call_started_at >= $1 AND cl.call_started_at <= $2
      WHERE 1=1
    `;

    const params = [startDateLocal.toISOString(), endDateLocal.toISOString()];
    let paramIndex = 2;

    // Add project filter based on permissions
    if (projectId && projectId !== 'ALL') {
      sql += ` AND a.project_id = $${++paramIndex}`;
      params.push(projectId);
    } else if (!projectId && !userGlobalRole.permissions.canViewAllProjects) {
      // For regular users without project specified, get their accessible projects
      const userProjectsSql = `
        SELECT DISTINCT epm.project_id 
        FROM pype_voice_email_project_mapping epm
        INNER JOIN pype_voice_users u ON u.email = epm.email
        WHERE u.user_id = $${++paramIndex} AND epm.is_active = true
      `;
      params.push(userId);
      const userProjectsResult = await query(userProjectsSql, [userId]);
      if (userProjectsResult.rows && userProjectsResult.rows.length > 0) {
        const projectIds = userProjectsResult.rows.map((row: any) => row.project_id);
        const placeholders = projectIds.map((_, idx) => `$${paramIndex + 1 + idx}`).join(',');
        sql += ` AND a.project_id IN (${placeholders})`;
        params.push(...projectIds);
        paramIndex += projectIds.length;
      } else {
        // User has no accessible projects, return empty data
        return NextResponse.json({
          success: true,
          data: [],
          period,
          projectId,
          dateRange: {
            start: startDate.toISOString(),
            end: now.toISOString()
          }
        });
      }
    }

    sql += `
      GROUP BY a.id, a.name
      ORDER BY total_calls DESC
      LIMIT 10
    `;

    const result = await query(sql, params);

    if (!result || !result.rows) {
      console.error('Database query failed for agents comparison metrics');
      return NextResponse.json(
        { error: 'Failed to fetch agents comparison data' },
        { status: 500 }
      );
    }

    // Transform database results to expected format
    const agentsData = result.rows.map((row: any) => ({
      agent_name: row.agent_name,
      agent_id: row.agent_id,
      currency: row.agent_currency || 'USD', // Use agent's currency or fallback to USD
      metrics: {
        total_calls: parseInt(row.total_calls) || 0,
        successful_calls: parseInt(row.successful_calls) || 0,
        failed_calls: parseInt(row.failed_calls) || 0,
        avg_duration: Math.round(parseFloat(row.avg_duration) || 0),
        total_cost: Math.round((parseFloat(row.total_cost) || 0) * 100) / 100,
        completion_rate: Math.round((parseFloat(row.completion_rate) || 0) * 100) / 100,
        user_satisfaction: null, // Will be calculated from real feedback data when available
        response_time: Math.round((parseFloat(row.response_time) || 0) * 100) / 100,
        llm_usage: {
          total_tokens: parseInt(row.total_tokens) || 0,
          input_tokens: parseInt(row.input_tokens) || 0,
          output_tokens: parseInt(row.output_tokens) || 0,
          requests: parseInt(row.total_calls) || 0
        },
        tts_usage: {
          characters: 0, // Data not available in current schema
          duration: 0, // Data not available in current schema
          requests: parseInt(row.total_calls) || 0
        },
        stt_usage: {
          duration: 0, // Data not available in current schema
          requests: parseInt(row.total_calls) || 0,
          accuracy: null // Will be calculated from real STT accuracy metrics when available
        },
        trends: [] // Historical trends will be implemented with real data when needed
      }
    }));

    return NextResponse.json({
      success: true,
      data: agentsData,
      period,
      projectId,
      dateRange: {
        start: startDateLocal.toISOString(),
        end: endDateLocal.toISOString()
      }
    });

  } catch (error) {
    console.error('Agents comparison error:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to fetch agents comparison data' },
      { status: 500 }
    );
  }
}
