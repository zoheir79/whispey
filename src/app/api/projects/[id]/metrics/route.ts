import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { verifyUserAuth } from '@/lib/auth'
import { getUserGlobalRole } from '@/services/getGlobalRole'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: projectId } = await params

    // Verify user authentication
    const { isAuthenticated, userId } = await verifyUserAuth(request);
    
    if (!isAuthenticated || !userId) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Check user permissions for project metrics
    const userGlobalRole = await getUserGlobalRole(userId);
    
    if (!userGlobalRole) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Check if user has permission to view project metrics
    if (!userGlobalRole.permissions.canViewAllProjects) {
      // For regular users, verify they have access to this specific project
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
    }

    console.log(`🔓 PROJECT METRICS ACCESS: ${userGlobalRole.global_role} accessing project ${projectId} metrics`);

    // Calculate workspace metrics using JOIN since pype_voice_call_logs doesn't have project_id
    const sql = `
      SELECT cl.*
      FROM pype_voice_call_logs cl
      INNER JOIN pype_voice_agents a ON cl.agent_id = a.id
      WHERE a.project_id = $1
    `
    
    const callsResult = await query(sql, [projectId])
    
    // Handle query errors (query function returns { rows, error })
    if (!callsResult || !callsResult.rows) {
      console.error('Error fetching calls:', callsResult)
      return NextResponse.json({ error: 'Failed to fetch calls' }, { status: 500 })
    }

    const calls = callsResult.rows || []

    // Calculate metrics
    const callsList = Array.isArray(calls) ? calls : []
    const totalCalls = callsList.length || 0
    const successfulCalls = callsList.filter((call: any) => call.call_ended_reason === 'completed').length || 0
    const successRate = totalCalls > 0 ? Math.round((successfulCalls / totalCalls) * 100) : 0
    
    // Total duration in seconds
    const totalDurationSeconds = callsList.reduce((sum: number, call: any) => {
      return sum + (Number(call.duration_seconds) || 0)
    }, 0) || 0
    
    const averageDuration = totalCalls > 0 ? totalDurationSeconds / totalCalls : 0

    // Today's calls
    const today = new Date()
    const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate())
    const todayCalls = callsList.filter((call: any) => 
      call.call_started_at && new Date(call.call_started_at) >= todayStart
    ).length || 0

    // Total cost (sum of all cost fields)
    const totalCost = callsList.reduce((sum: number, call: any) => {
      const llmCost = parseFloat(call.total_llm_cost || 0)
      const ttsCost = parseFloat(call.total_tts_cost || 0)  
      const sttCost = parseFloat(call.total_stt_cost || 0)
      return sum + llmCost + ttsCost + sttCost
    }, 0) || 0

    // Average response time
    const avgResponseTime = callsList.reduce((sum: number, call: any) => {
      return sum + (parseFloat(call.avg_latency || 0))
    }, 0) / (totalCalls || 1) || 0

    // Weekly growth calculation - compare this week vs previous week
    const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
    const twoWeeksAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000)
    
    const thisWeekCalls = callsList.filter((call: any) => 
      call.call_started_at && new Date(call.call_started_at) >= oneWeekAgo
    ).length || 0
    
    const lastWeekCalls = callsList.filter((call: any) => 
      call.call_started_at && 
      new Date(call.call_started_at) >= twoWeeksAgo && 
      new Date(call.call_started_at) < oneWeekAgo
    ).length || 0
    
    const weeklyGrowth = lastWeekCalls > 0 ? Math.round(((thisWeekCalls - lastWeekCalls) / lastWeekCalls) * 100) : (thisWeekCalls > 0 ? 100 : 0)

    // Get active agents count for this project using direct SQL
    const agentsSql = `
      SELECT id
      FROM pype_voice_agents
      WHERE project_id = $1 AND is_active = true
    `
    
    const agentsResult = await query(agentsSql, [projectId])
    const activeAgents = (agentsResult?.rows || []).length

    const metrics = {
      totalCalls,
      successRate,
      averageDuration: Math.round(averageDuration * 100) / 100,
      totalCost: Math.round(totalCost * 100) / 100,
      todayCalls,
      avgResponseTime: Math.round(avgResponseTime * 100) / 100,
      weeklyGrowth,
      activeAgents
    }

    return NextResponse.json(metrics)

  } catch (error) {
    console.error('Error calculating workspace metrics:', error)
    return NextResponse.json(
      { error: 'Failed to calculate workspace metrics' },
      { status: 500 }
    )
  }
}
