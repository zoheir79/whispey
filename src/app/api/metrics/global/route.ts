import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(request: NextRequest) {
  try {
    // Get all calls across all projects (for superadmin global view)
    const { data: calls, error: callsError } = await supabase
      .from('pype_voice_call_logs')
      .select('*')

    if (callsError) {
      console.error('Error fetching global calls:', callsError)
      return NextResponse.json({ error: 'Failed to fetch calls' }, { status: 500 })
    }

    // Calculate global metrics
    const totalCalls = calls?.length || 0
    const successfulCalls = calls?.filter(call => call.call_ended_reason === 'completed').length || 0
    const successRate = totalCalls > 0 ? Math.round((successfulCalls / totalCalls) * 100) : 0
    
    // Total duration in minutes
    const totalDurationMinutes = calls?.reduce((sum, call) => {
      return sum + (call.duration_seconds || 0)
    }, 0) / 60 || 0
    
    const averageDuration = totalCalls > 0 ? totalDurationMinutes / totalCalls : 0

    // Today's calls
    const today = new Date()
    const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate())
    const todayCalls = calls?.filter(call => 
      call.call_started_at && new Date(call.call_started_at) >= todayStart
    ).length || 0

    // Total cost (sum of all cost fields)
    const totalCost = calls?.reduce((sum, call) => {
      const llmCost = parseFloat(call.total_llm_cost || 0)
      const ttsCost = parseFloat(call.total_tts_cost || 0)  
      const sttCost = parseFloat(call.total_stt_cost || 0)
      return sum + llmCost + ttsCost + sttCost
    }, 0) || 0

    // Average response time
    const avgResponseTime = calls?.reduce((sum, call) => {
      return sum + (parseFloat(call.avg_latency || 0))
    }, 0) / (totalCalls || 1) || 0

    // Weekly growth calculation
    const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
    const lastWeekCalls = calls?.filter(call => 
      call.call_started_at && new Date(call.call_started_at) >= oneWeekAgo
    ).length || 0
    
    const weeklyGrowth = totalCalls > 0 ? Math.round((lastWeekCalls / totalCalls) * 100) : 0

    // Get all active agents across all projects
    const { data: agents, error: agentsError } = await supabase
      .from('pype_voice_agents')
      .select('id')
      .eq('is_active', true)

    if (agentsError) {
      console.error('Error fetching global agents:', agentsError)
    }

    const activeAgents = agents?.length || 0

    // Get unique projects count
    const uniqueProjects = calls ? [...new Set(calls.map(call => call.project_id))].length : 0

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
