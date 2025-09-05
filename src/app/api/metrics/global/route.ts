import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { verifyUserAuth } from '@/lib/auth'
import { getUserGlobalRole } from '@/services/getGlobalRole'

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

    // Check user permissions for global metrics
    const userGlobalRole = await getUserGlobalRole(userId);
    
    if (!userGlobalRole) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    console.log(`🔓 GLOBAL METRICS ACCESS: ${userGlobalRole.global_role} accessing global metrics`);

    let sql;
    let queryParams: any[] = [];
    
    if (userGlobalRole.permissions.canViewAllCalls) {
      // Admin/Super admin - get all calls across all projects
      sql = `
        SELECT cl.*, a.project_id
        FROM pype_voice_call_logs cl
        INNER JOIN pype_voice_agents a ON cl.agent_id = a.id
      `;
    } else {
      // Regular user - get only calls from their accessible projects
      sql = `
        SELECT cl.*, a.project_id
        FROM pype_voice_call_logs cl
        INNER JOIN pype_voice_agents a ON cl.agent_id = a.id
        INNER JOIN pype_voice_email_project_mapping epm ON a.project_id = epm.project_id
        INNER JOIN pype_voice_users u ON u.email = epm.email
        WHERE u.user_id = $1 AND epm.is_active = true
      `;
      queryParams = [userId];
    }
    
    const callsResult = await query(sql, queryParams)
    
    if (!callsResult || !callsResult.rows) {
      console.error('Error fetching global calls:', callsResult)
      return NextResponse.json({ error: 'Failed to fetch calls' }, { status: 500 })
    }

    const calls = callsResult.rows || []

    // Calculate global metrics
    const callsList = Array.isArray(calls) ? calls : []
    const totalCalls = callsList.length || 0
    const successfulCalls = callsList.filter((call: any) => call.call_ended_reason === 'completed').length || 0
    const successRate = totalCalls > 0 ? Math.round((successfulCalls / totalCalls) * 100) : 0
    
    // Total duration in seconds
    const totalDurationSeconds = callsList.reduce((sum: number, call: any) => {
      return sum + (Number(call.duration_seconds) || 0)
    }, 0) || 0
    
    const averageDuration = totalCalls > 0 ? totalDurationSeconds / totalCalls : 0

    // Today's calls using system timezone
    const today = new Date()
    const todayLocal = new Date(today.getTime() - (today.getTimezoneOffset() * 60000))
    const todayStart = new Date(todayLocal.getFullYear(), todayLocal.getMonth(), todayLocal.getDate())
    const todayCalls = callsList.filter((call: any) => 
      call.call_started_at && new Date(call.call_started_at) >= todayStart
    ).length || 0

    // Total cost using backend calculated total_cost field (includes dedicated prorated costs)
    const totalCost = callsList.reduce((sum: number, call: any) => {
      let callCost = parseFloat(call.total_cost || 0)
      
      // FALLBACK: Si total_cost est null/0, calculer à partir des champs individuels ou duration
      if (callCost === 0 && call.duration_seconds > 0) {
        const sttCost = parseFloat(call.total_stt_cost || 0)
        const ttsCost = parseFloat(call.total_tts_cost || 0) 
        const llmCost = parseFloat(call.total_llm_cost || 0)
        
        // Si les champs individuels existent, les utiliser
        if (sttCost > 0 || ttsCost > 0 || llmCost > 0) {
          callCost = sttCost + ttsCost + llmCost
        } else {
          // FALLBACK ultime: estimation basée sur durée (tarifs moyens)
          const durationMinutes = call.duration_seconds / 60
          callCost = durationMinutes * 0.02 // ~$0.02/minute estimation conservative
        }
      }
      
      return sum + callCost
    }, 0) || 0

    // Average response time
    const avgResponseTime = callsList.reduce((sum: number, call: any) => {
      return sum + (parseFloat(call.avg_latency || 0))
    }, 0) / (totalCalls || 1) || 0

    // Weekly growth calculation using system timezone
    const now = new Date()
    const nowLocal = new Date(now.getTime() - (now.getTimezoneOffset() * 60000))
    const oneWeekAgo = new Date(nowLocal.getTime() - 7 * 24 * 60 * 60 * 1000)
    const twoWeeksAgo = new Date(nowLocal.getTime() - 14 * 24 * 60 * 60 * 1000)
    
    const thisWeekCalls = callsList.filter((call: any) => 
      call.call_started_at && new Date(call.call_started_at) >= oneWeekAgo
    ).length || 0
    
    const lastWeekCalls = callsList.filter((call: any) => 
      call.call_started_at && 
      new Date(call.call_started_at) >= twoWeeksAgo && 
      new Date(call.call_started_at) < oneWeekAgo
    ).length || 0
    
    const weeklyGrowth = lastWeekCalls > 0 
      ? Math.round(((thisWeekCalls - lastWeekCalls) / lastWeekCalls) * 100) 
      : (thisWeekCalls > 0 ? 100 : 0);

    // Get active agents based on user permissions
    let agentsSql;
    let agentsParams: any[] = [];
    
    if (userGlobalRole.permissions.canViewAllCalls) {
      // Admin/Super admin - get all active agents
      agentsSql = `
        SELECT id
        FROM pype_voice_agents
        WHERE is_active = true
      `;
    } else {
      // Regular user - get only agents from their accessible projects
      agentsSql = `
        SELECT DISTINCT a.id
        FROM pype_voice_agents a
        INNER JOIN pype_voice_email_project_mapping epm ON a.project_id = epm.project_id
        INNER JOIN pype_voice_users u ON u.email = epm.email
        WHERE u.user_id = $1 AND epm.is_active = true AND a.is_active = true
      `;
      agentsParams = [userId];
    }
    
    const agentsResult = await query(agentsSql, agentsParams)
    const activeAgents = (agentsResult?.rows || []).length

    // Get unique projects count
    const uniqueProjects = callsList ? [...new Set(callsList.map((call: any) => call.project_id))].length : 0

    const metrics = {
      totalCalls,
      successRate,
      averageDuration: Math.round(averageDuration * 100) / 100,
      totalCost: Math.round(totalCost * 100) / 100,
      todayCalls,
      avgResponseTime: Math.round(avgResponseTime * 100) / 100,
      weeklyGrowth,
      activeAgents,
      totalProjects: uniqueProjects
    }

    return NextResponse.json(metrics)

  } catch (error) {
    console.error('Error calculating global metrics:', error)
    return NextResponse.json(
      { error: 'Failed to calculate global metrics' },
      { status: 500 }
    )
  }
}
