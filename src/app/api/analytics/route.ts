import { NextRequest, NextResponse } from 'next/server'
import { verifyUserAuth } from '@/lib/auth'
import { getUserGlobalRole } from '@/services/getGlobalRole'
import { query } from '@/lib/db'

export async function GET(request: NextRequest) {
  try {
    const { isAuthenticated, userId } = await verifyUserAuth(request);
    
    if (!isAuthenticated || !userId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const range = searchParams.get('range') || '7d';

    // Parse time range
    let days = 7;
    switch (range) {
      case '1d': days = 1; break;
      case '7d': days = 7; break;
      case '30d': days = 30; break;
      case '90d': days = 90; break;
    }

    const userGlobalRole = await getUserGlobalRole(userId);
    
    // Get workspace filter for non-super-admins
    let workspaceFilter = '';
    let queryParams: (number | string)[] = [days];
    
    if (userGlobalRole?.global_role !== 'super_admin') {
      workspaceFilter = `AND c.workspace_id IN (
        SELECT DISTINCT epm.project_id 
        FROM pype_voice_email_project_mapping epm
        INNER JOIN pype_voice_users auth_user ON auth_user.email = epm.email
        WHERE auth_user.user_id = $2 AND epm.is_active = true
      )`;
      queryParams.push(userId);
    }

    // Get basic metrics
    const metricsQuery = `
      SELECT 
        COUNT(c.id) as total_calls,
        COALESCE(SUM(c.cost), 0) as total_cost,
        COUNT(DISTINCT a.id) as active_agents,
        COUNT(DISTINCT c.caller_id) as total_users,
        COALESCE(AVG(c.duration_seconds), 0) as avg_response_time,
        COALESCE(AVG(CASE WHEN c.status = 'completed' THEN 1.0 ELSE 0.0 END) * 100, 0) as success_rate
      FROM pype_voice_calls c
      LEFT JOIN pype_voice_agents a ON a.id = c.agent_id
      WHERE c.created_at >= NOW() - INTERVAL '$1 days'
      ${workspaceFilter}
    `;

    const metrics = await query(metricsQuery, queryParams);

    // Get trends (compare with previous period)
    const currentQuery = `
      SELECT 
        COUNT(c.id) as calls,
        COALESCE(SUM(c.cost), 0) as cost,
        COUNT(DISTINCT c.caller_id) as users
      FROM pype_voice_calls c
      WHERE c.created_at >= NOW() - INTERVAL '$1 days'
      ${workspaceFilter}
    `;

    const previousQuery = `
      SELECT 
        COUNT(c.id) as calls,
        COALESCE(SUM(c.cost), 0) as cost,
        COUNT(DISTINCT c.caller_id) as users
      FROM pype_voice_calls c
      WHERE c.created_at >= NOW() - INTERVAL '$1 days'
        AND c.created_at < NOW() - INTERVAL '$2 days'
      ${workspaceFilter}
    `;

    const currentParams = userGlobalRole?.global_role === 'super_admin' ? [days] : [days, userId];
    const previousParams = userGlobalRole?.global_role === 'super_admin' ? [days * 2, days] : [days * 2, days, userId];

    const currentTrends = await query(currentQuery, currentParams);
    const previousTrends = await query(previousQuery, previousParams);

    // Calculate growth percentages
    const currentPeriod = currentTrends.rows[0] || { calls: 0, cost: 0, users: 0 };
    const previousPeriod = previousTrends.rows[0] || { calls: 0, cost: 0, users: 0 };

    const calculateGrowth = (current: number, previous: number) => {
      if (previous === 0) return current > 0 ? 100 : 0;
      return ((current - previous) / previous) * 100;
    };

    const analytics = {
      totalCalls: parseInt(metrics.rows[0]?.total_calls || '0'),
      totalCost: parseFloat(metrics.rows[0]?.total_cost || '0'),
      activeAgents: parseInt(metrics.rows[0]?.active_agents || '0'),
      totalUsers: parseInt(metrics.rows[0]?.total_users || '0'),
      avgResponseTime: parseFloat(metrics.rows[0]?.avg_response_time || '0'),
      successRate: parseFloat(metrics.rows[0]?.success_rate || '0'),
      trends: {
        callsGrowth: calculateGrowth(
          parseInt(currentPeriod.calls), 
          parseInt(previousPeriod.calls)
        ),
        costGrowth: calculateGrowth(
          parseFloat(currentPeriod.cost), 
          parseFloat(previousPeriod.cost)
        ),
        usersGrowth: calculateGrowth(
          parseInt(currentPeriod.users), 
          parseInt(previousPeriod.users)
        )
      }
    };

    return NextResponse.json(analytics);

  } catch (error: any) {
    console.error('Error fetching analytics:', error);
    return NextResponse.json(
      { error: 'Internal server error' }, 
      { status: 500 }
    );
  }
}
