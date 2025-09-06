import { NextRequest, NextResponse } from 'next/server'
import { verifyUserAuth } from '@/lib/auth'
import { getUserGlobalRole } from '@/services/getGlobalRole'
import { query } from '@/lib/db'

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { isAuthenticated, userId } = await verifyUserAuth(request);
    
    if (!isAuthenticated || !userId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const params = await context.params;
    const workflowId = params.id;

    // Vérifier permissions et récupérer workflow
    const userGlobalRole = await getUserGlobalRole(userId);
    
    let workflowQuery = `
      SELECT w.*, u.email as created_by_email, p.name as workspace_name
      FROM pype_voice_workflows w
      LEFT JOIN pype_voice_users u ON u.user_id = w.created_by
      LEFT JOIN pype_voice_projects p ON p.id = w.workspace_id
      WHERE w.id = $1
    `;

    if (userGlobalRole?.global_role !== 'super_admin') {
      workflowQuery += `
        AND w.workspace_id IN (
          SELECT DISTINCT epm.project_id 
          FROM pype_voice_email_project_mapping epm
          INNER JOIN pype_voice_users auth_user ON auth_user.email = epm.email
          WHERE auth_user.user_id = $2 AND epm.is_active = true
        )
      `;
    }

    const workflowResult = await query(
      workflowQuery, 
      userGlobalRole?.global_role === 'super_admin' ? [workflowId] : [workflowId, userId]
    );

    if (workflowResult.rows.length === 0) {
      return NextResponse.json({ error: 'Workflow not found' }, { status: 404 });
    }

    const workflow = workflowResult.rows[0];

    // Récupérer statistiques exécutions
    const executionStats = await query(`
      SELECT 
        COUNT(*) as total_executions,
        COUNT(CASE WHEN status = 'completed' THEN 1 END) as successful_executions,
        COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed_executions,
        AVG(execution_time_seconds) as avg_execution_time,
        SUM(execution_cost) as total_cost
      FROM workflow_execution_logs 
      WHERE workflow_id = $1
    `, [workflowId]);

    // Récupérer exécutions récentes
    const recentExecutions = await query(`
      SELECT 
        id, started_at, completed_at, status, execution_time_seconds,
        operations_executed, mcp_calls_made, execution_cost
      FROM workflow_execution_logs 
      WHERE workflow_id = $1
      ORDER BY started_at DESC
      LIMIT 10
    `, [workflowId]);

    return NextResponse.json({
      workflow: workflow,
      statistics: executionStats.rows[0],
      recent_executions: recentExecutions.rows
    });

  } catch (error: any) {
    console.error('Error fetching workflow:', error);
    return NextResponse.json(
      { error: 'Internal server error' }, 
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { isAuthenticated, userId } = await verifyUserAuth(request);
    
    if (!isAuthenticated || !userId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const params = await context.params;
    const workflowId = params.id;
    const body = await request.json();

    // Vérifier permissions
    const userGlobalRole = await getUserGlobalRole(userId);
    
    if (userGlobalRole?.global_role !== 'super_admin') {
      const workflowAccess = await query(`
        SELECT w.workspace_id, epm.role 
        FROM pype_voice_workflows w
        INNER JOIN pype_voice_email_project_mapping epm ON epm.project_id = w.workspace_id
        INNER JOIN pype_voice_users u ON u.email = epm.email
        WHERE w.id = $1 AND u.user_id = $2 AND epm.is_active = true
      `, [workflowId, userId]);

      if (workflowAccess.rows.length === 0 || 
          !['member', 'admin', 'owner'].includes(workflowAccess.rows[0].role)) {
        return NextResponse.json({ error: 'Access denied' }, { status: 403 });
      }
    }

    // Préparer les champs à mettre à jour
    const allowedFields = [
      'name', 'description', 'platform_mode', 'billing_cycle', 'cost_overrides',
      'workflow_definition', 'trigger_conditions', 'mcp_server_url', 'mcp_api_key',
      'mcp_tools_enabled', 'max_execution_time_minutes', 'retry_count', 'timeout_seconds', 'is_active',
      'workflow_per_execution_override', 'workflow_per_cpu_minute_override'
    ];

    const updates = [];
    const values = [];
    let paramIndex = 1;

    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        if (['cost_overrides', 'workflow_definition', 'trigger_conditions'].includes(field)) {
          updates.push(`${field} = $${paramIndex}`);
          values.push(JSON.stringify(body[field]));
        } else {
          updates.push(`${field} = $${paramIndex}`);
          values.push(body[field]);
        }
        paramIndex++;
      }
    }

    if (updates.length === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
    }

    // Mettre à jour
    values.push(workflowId);
    const result = await query(`
      UPDATE pype_voice_workflows 
      SET ${updates.join(', ')}, updated_at = NOW()
      WHERE id = $${paramIndex}
      RETURNING *
    `, values);

    return NextResponse.json({
      success: true,
      workflow: result.rows[0]
    });

  } catch (error: any) {
    console.error('Error updating workflow:', error);
    return NextResponse.json(
      { error: 'Internal server error' }, 
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { isAuthenticated, userId } = await verifyUserAuth(request);
    
    if (!isAuthenticated || !userId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const params = await context.params;
    const workflowId = params.id;

    // Vérifier permissions
    const userGlobalRole = await getUserGlobalRole(userId);
    
    if (userGlobalRole?.global_role !== 'super_admin') {
      const workflowAccess = await query(`
        SELECT w.workspace_id, epm.role 
        FROM pype_voice_workflows w
        INNER JOIN pype_voice_email_project_mapping epm ON epm.project_id = w.workspace_id
        INNER JOIN pype_voice_users u ON u.email = epm.email
        WHERE w.id = $1 AND u.user_id = $2 AND epm.is_active = true
      `, [workflowId, userId]);

      if (workflowAccess.rows.length === 0 || 
          !['admin', 'owner'].includes(workflowAccess.rows[0].role)) {
        return NextResponse.json({ 
          error: 'Admin permissions required to delete workflows' 
        }, { status: 403 });
      }
    }

    // Vérifier si utilisé par des agents
    const agentUsage = await query(`
      SELECT COUNT(*) as count FROM pype_voice_agents 
      WHERE associated_workflow_id = $1
    `, [workflowId]);

    if (parseInt(agentUsage.rows[0].count) > 0) {
      return NextResponse.json({ 
        error: 'Cannot delete workflow: still associated with agents' 
      }, { status: 409 });
    }

    // Supprimer (CASCADE supprimera logs d'exécution)
    await query(`DELETE FROM pype_voice_workflows WHERE id = $1`, [workflowId]);

    return NextResponse.json({
      success: true,
      message: 'Workflow deleted successfully'
    });

  } catch (error: any) {
    console.error('Error deleting workflow:', error);
    return NextResponse.json(
      { error: 'Internal server error' }, 
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { isAuthenticated, userId } = await verifyUserAuth(request);
    
    if (!isAuthenticated || !userId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const params = await context.params;
    const workflowId = params.id;
    const body = await request.json();
    const { action, input_data = {} } = body;

    if (action !== 'execute') {
      return NextResponse.json({ error: 'Invalid action. Only "execute" is supported' }, { status: 400 });
    }

    // Vérifier permissions
    const userGlobalRole = await getUserGlobalRole(userId);
    
    if (userGlobalRole?.global_role !== 'super_admin') {
      const workflowAccess = await query(`
        SELECT w.workspace_id, epm.role 
        FROM pype_voice_workflows w
        INNER JOIN pype_voice_email_project_mapping epm ON epm.project_id = w.workspace_id
        INNER JOIN pype_voice_users u ON u.email = epm.email
        WHERE w.id = $1 AND u.user_id = $2 AND epm.is_active = true
      `, [workflowId, userId]);

      if (workflowAccess.rows.length === 0 || 
          !['member', 'admin', 'owner'].includes(workflowAccess.rows[0].role)) {
        return NextResponse.json({ error: 'Access denied' }, { status: 403 });
      }
    }

    // Créer log d'exécution
    const executionResult = await query(`
      INSERT INTO workflow_execution_logs (
        workflow_id, execution_trigger, input_data, status
      ) VALUES ($1, 'manual', $2, 'running')
      RETURNING id, started_at
    `, [workflowId, JSON.stringify(input_data)]);

    const executionId = executionResult.rows[0].id;

    // TODO: Ici sera intégrée l'exécution via MCP
    // Pour l'instant, on simule une exécution réussie

    return NextResponse.json({
      success: true,
      execution_id: executionId,
      status: 'started',
      started_at: executionResult.rows[0].started_at,
      message: 'Workflow execution started'
    });

  } catch (error: any) {
    console.error('Error executing workflow:', error);
    return NextResponse.json(
      { error: 'Internal server error' }, 
      { status: 500 }
    );
  }
}
