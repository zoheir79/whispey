import { NextRequest, NextResponse } from 'next/server'
import { fetchFromTable } from '@/lib/db-service'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: projectId } = await params

    // Calculate workspace metrics
    const { data: calls, error: callsError } = await fetchFromTable({
      table: 'pype_voice_call_logs',
      select: '*',
      filters: [{ column: 'project_id', operator: '=', value: projectId }]
    })

    if (callsError) {
      console.error('Error fetching calls:', callsError)
      return NextResponse.json({ error: 'Failed to fetch calls' }, { status: 500 })
    }

    // Calculate metrics
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

    // Weekly growth calculation (simplified)
    const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
    const lastWeekCalls = callsList.filter((call: any) => 
      call.call_started_at && new Date(call.call_started_at) >= oneWeekAgo
    ).length || 0
    
    const weeklyGrowth = totalCalls > 0 ? Math.round((lastWeekCalls / totalCalls) * 100) : 0

    // Get active agents count for this project
    const { data: agents, error: agentsError } = await fetchFromTable({
      table: 'pype_voice_agents',
      select: 'id',
      filters: [
        { column: 'project_id', operator: '=', value: projectId },
        { column: 'is_active', operator: '=', value: true }
      ]
    })

    if (agentsError) {
      console.error('Error fetching agents:', agentsError)
    }

    const agentsList = Array.isArray(agents) ? agents : []
    const activeAgents = agentsList.length || 0

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
