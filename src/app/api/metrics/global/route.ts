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
    
    if (!userGlobalRole?.permissions?.canViewAllCalls) {
      return NextResponse.json(
        { error: 'Insufficient permissions to view global metrics' },
        { status: 403 }
      );
    }

    console.log(`🔓 GLOBAL METRICS ACCESS: ${userGlobalRole.global_role} accessing global metrics`);

    // Get all calls across all projects with agent project_id for global view
    const sql = `
      SELECT cl.*, a.project_id
      FROM pype_voice_call_logs cl
      INNER JOIN pype_voice_agents a ON cl.agent_id = a.id
    `
    
    const callsResult = await query(sql, [])
    
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
    
    // Total duration in minutes
    const totalDurationMinutes = callsList.reduce((sum: number, call: any) => {
      return sum + (Number(call.duration_seconds) || 0)
    }, 0) / 60 || 0
    
    const averageDuration = totalCalls > 0 ? totalDurationMinutes / totalCalls : 0

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

    // Weekly growth calculation
    const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
    const lastWeekCalls = callsList.filter((call: any) => 
      call.call_started_at && new Date(call.call_started_at) >= oneWeekAgo
    ).length || 0
    
    const weeklyGrowth = totalCalls > 0 ? Math.round((lastWeekCalls / totalCalls) * 100) : 0

    // Get all active agents across all projects using direct SQL
    const agentsSql = `
      SELECT id
      FROM pype_voice_agents
      WHERE is_active = true
    `
    
    const agentsResult = await query(agentsSql, [])
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
