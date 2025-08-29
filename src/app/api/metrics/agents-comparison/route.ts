import { NextRequest, NextResponse } from 'next/server';
import { verifyUserAuth } from '@/lib/auth';
import { query } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    // Verify authentication
    const { isAuthenticated, userId } = await verifyUserAuth(request);
    if (!isAuthenticated || !userId) {
      return NextResponse.json(
        { success: false, message: 'Authentication required' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get('projectId');
    const period = searchParams.get('period') || '30d'; // 7d, 30d, 90d, 1y

    // Calculate date range
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

    // Mock agents comparison data - replace with real database queries
    const agentsData = generateAgentsComparisonData(projectId, period);

    return NextResponse.json({
      success: true,
      data: agentsData,
      period,
      projectId,
      dateRange: {
        start: startDate.toISOString(),
        end: now.toISOString()
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

function generateAgentsComparisonData(projectId: string | null, period: string) {
  const agents = [
    'Support Agent',
    'Sales Representative', 
    'Technical Support',
    'Customer Care',
    'General Assistant',
    'Specialized AI'
  ];

  const agentsData = agents.slice(0, Math.floor(Math.random() * 4) + 2).map(agentName => {
    const basePerformance = Math.random() * 0.4 + 0.6; // 0.6 to 1.0
    
    return {
      agent_name: agentName,
      agent_id: `agent_${agentName.toLowerCase().replace(/\s+/g, '_')}`,
      metrics: {
        total_calls: Math.floor((Math.random() * 200 + 50) * basePerformance),
        successful_calls: 0,
        failed_calls: 0,
        avg_duration: Math.round((Math.random() * 120 + 60) * basePerformance),
        total_cost: Math.round((Math.random() * 50 + 10) * basePerformance * 100) / 100,
        completion_rate: Math.round((0.85 + Math.random() * 0.15) * basePerformance * 100) / 100,
        user_satisfaction: Math.round((4.0 + Math.random() * 1.0) * basePerformance * 10) / 10,
        response_time: Math.round((Math.random() * 2 + 1) / basePerformance * 100) / 100,
        llm_usage: {
          total_tokens: Math.floor((Math.random() * 50000 + 10000) * basePerformance),
          input_tokens: 0,
          output_tokens: 0,
          requests: Math.floor((Math.random() * 300 + 50) * basePerformance)
        },
        tts_usage: {
          characters: Math.floor((Math.random() * 20000 + 5000) * basePerformance),
          duration: Math.floor((Math.random() * 1200 + 300) * basePerformance),
          requests: Math.floor((Math.random() * 150 + 30) * basePerformance)
        },
        stt_usage: {
          duration: Math.floor((Math.random() * 2400 + 600) * basePerformance),
          requests: Math.floor((Math.random() * 100 + 25) * basePerformance),
          accuracy: Math.round((0.85 + Math.random() * 0.15) * basePerformance * 100) / 100
        },
        trends: generateAgentTrends(period)
      }
    };
  });

  // Calculate dependent values
  agentsData.forEach(agent => {
    agent.metrics.successful_calls = Math.floor(agent.metrics.total_calls * agent.metrics.completion_rate);
    agent.metrics.failed_calls = agent.metrics.total_calls - agent.metrics.successful_calls;
    agent.metrics.llm_usage.input_tokens = Math.floor(agent.metrics.llm_usage.total_tokens * 0.7);
    agent.metrics.llm_usage.output_tokens = agent.metrics.llm_usage.total_tokens - agent.metrics.llm_usage.input_tokens;
  });

  return agentsData;
}

function generateAgentTrends(period: string) {
  const points = period === '7d' ? 7 : period === '30d' ? 15 : 10;
  const trends = [];
  
  for (let i = 0; i < points; i++) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    
    trends.unshift({
      date: date.toISOString().split('T')[0],
      calls: Math.floor(Math.random() * 20 + 5),
      satisfaction: Math.round((4.0 + Math.random() * 1.0) * 10) / 10,
      response_time: Math.round((Math.random() * 2 + 1) * 100) / 100,
      completion_rate: Math.round((0.85 + Math.random() * 0.15) * 100) / 100
    });
  }
  
  return trends;
}
