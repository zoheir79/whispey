import { NextRequest, NextResponse } from 'next/server'
import { verifyUserAuth } from '@/lib/auth'
import { getUserGlobalRole } from '@/services/getGlobalRole'
import { query } from '@/lib/db'

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { isAuthenticated, userId } = await verifyUserAuth(request)
    
    if (!isAuthenticated || !userId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const params = await context.params
    const workflowId = params.id
    const body = await request.json()
    
    const {
      operations = 1,
      execution_minutes = 5,
      mcp_calls = 1,
      input_tokens = 0,
      output_tokens = 0
    } = body

    // Vérifier permissions et récupérer workflow
    const userGlobalRole = await getUserGlobalRole(userId)
    
    let workflowQuery = `
      SELECT w.*, p.name as workspace_name
      FROM pype_voice_workflows w
      LEFT JOIN pype_voice_projects p ON p.id = w.workspace_id
      WHERE w.id = $1
    `

    if (userGlobalRole?.global_role !== 'super_admin') {
      workflowQuery += `
        AND w.workspace_id IN (
          SELECT DISTINCT epm.project_id 
          FROM pype_voice_email_project_mapping epm
          INNER JOIN pype_voice_users auth_user ON auth_user.email = epm.email
          WHERE auth_user.user_id = $2 AND epm.is_active = true
        )
      `
    }

    const workflowResult = await query(
      workflowQuery, 
      userGlobalRole?.global_role === 'super_admin' ? [workflowId] : [workflowId, userId]
    )

    if (workflowResult.rows.length === 0) {
      return NextResponse.json({ error: 'Workflow not found' }, { status: 404 })
    }

    const workflow = workflowResult.rows[0]

    // Calculer estimation des coûts
    const { creditManager } = await import('@/services/creditManager')
    
    const costEstimate = await creditManager.calculateServiceCost('workflow', workflowId, {
      operations,
      execution_minutes,
      mcp_calls,
      input_tokens,
      output_tokens
    })

    // Récupérer historique des coûts récents pour référence
    const recentCosts = await query(`
      SELECT 
        AVG(execution_cost) as avg_cost,
        MIN(execution_cost) as min_cost,
        MAX(execution_cost) as max_cost,
        COUNT(*) as executions_count
      FROM workflow_execution_logs 
      WHERE workflow_id = $1 
        AND execution_cost > 0 
        AND completed_at >= NOW() - INTERVAL '30 days'
    `, [workflowId])

    const historical = recentCosts.rows[0]

    // Calculer balance workspace actuelle
    const balanceResult = await query(`
      SELECT current_balance, currency
      FROM user_credits 
      WHERE workspace_id = $1
    `, [workflow.workspace_id])

    const currentBalance = balanceResult.rows[0]?.current_balance || 0
    const canAfford = currentBalance >= costEstimate.costs.total_cost

    return NextResponse.json({
      workflow: {
        id: workflow.id,
        name: workflow.name,
        workspace_name: workflow.workspace_name,
        platform_mode: workflow.platform_mode,
        billing_cycle: workflow.billing_cycle
      },
      cost_estimate: {
        ...costEstimate.costs,
        estimated_parameters: {
          operations,
          execution_minutes,
          mcp_calls,
          input_tokens,
          output_tokens
        }
      },
      current_balance: currentBalance,
      can_afford: canAfford,
      balance_after_execution: currentBalance - costEstimate.costs.total_cost,
      historical_costs: {
        avg_cost: parseFloat(historical.avg_cost || '0'),
        min_cost: parseFloat(historical.min_cost || '0'),
        max_cost: parseFloat(historical.max_cost || '0'),
        executions_count: parseInt(historical.executions_count || '0')
      },
      cost_breakdown: costEstimate.breakdown || {}
    })

  } catch (error: any) {
    console.error('Error estimating workflow cost:', error)
    return NextResponse.json(
      { error: 'Internal server error' }, 
      { status: 500 }
    )
  }
}
