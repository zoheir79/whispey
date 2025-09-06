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

    const { searchParams } = new URL(request.url);
    const workspaceId = searchParams.get('workspace_id');

    // Vérifier permissions
    const userGlobalRole = await getUserGlobalRole(userId);
    
    let workflows;
    
    if (userGlobalRole?.global_role === 'super_admin') {
      // Super admin peut voir tous les workflows
      if (workspaceId) {
        workflows = await query(`
          SELECT w.*, u.email as created_by_email
          FROM pype_voice_workflows w
          LEFT JOIN pype_voice_users u ON u.user_id = w.created_by
          WHERE w.workspace_id = $1
          ORDER BY w.created_at DESC
        `, [workspaceId]);
      } else {
        workflows = await query(`
          SELECT w.*, u.email as created_by_email, p.name as workspace_name
          FROM pype_voice_workflows w
          LEFT JOIN pype_voice_users u ON u.user_id = w.created_by
          LEFT JOIN pype_voice_projects p ON p.id = w.workspace_id
          ORDER BY w.created_at DESC
        `);
      }
    } else {
      // Utilisateurs normaux - seulement leurs workspaces
      const baseQuery = `
        SELECT w.*, u.email as created_by_email
        FROM pype_voice_workflows w
        LEFT JOIN pype_voice_users u ON u.user_id = w.created_by
        INNER JOIN pype_voice_email_project_mapping epm ON epm.project_id = w.workspace_id
        INNER JOIN pype_voice_users auth_user ON auth_user.email = epm.email
        WHERE auth_user.user_id = $1 AND epm.is_active = true
      `;

      if (workspaceId) {
        workflows = await query(baseQuery + ` AND w.workspace_id = $2 ORDER BY w.created_at DESC`, [userId, workspaceId]);
      } else {
        workflows = await query(baseQuery + ` ORDER BY w.created_at DESC`, [userId]);
      }
    }

    return NextResponse.json({
      workflows: workflows.rows,
      count: workflows.rows.length
    });

  } catch (error) {
    console.error('Error fetching workflows:', error);
    return NextResponse.json(
      { error: 'Internal server error' }, 
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const { isAuthenticated, userId } = await verifyUserAuth(request);
    
    if (!isAuthenticated || !userId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const body = await request.json();
    const {
      workspace_id,
      name,
      description,
      platform_mode = 'pag',
      billing_cycle = 'monthly',
      cost_overrides = {},
      workflow_definition = {},
      trigger_conditions = {},
      mcp_server_url,
      mcp_api_key,
      mcp_tools_enabled = ['rag', 'automation', 'function_call'],
      max_execution_time_minutes = 30,
      retry_count = 3,
      timeout_seconds = 300
    } = body;

    if (!workspace_id || !name) {
      return NextResponse.json({ 
        error: 'workspace_id and name are required' 
      }, { status: 400 });
    }

    // Vérifier permissions workspace
    const userGlobalRole = await getUserGlobalRole(userId);
    
    if (userGlobalRole?.global_role !== 'super_admin') {
      const workspaceAccess = await query(`
        SELECT role FROM pype_voice_email_project_mapping epm
        INNER JOIN pype_voice_users u ON u.email = epm.email
        WHERE u.user_id = $1 AND epm.project_id = $2 AND epm.is_active = true
      `, [userId, workspace_id]);

      if (workspaceAccess.rows.length === 0 || 
          !['member', 'admin', 'owner'].includes(workspaceAccess.rows[0].role)) {
        return NextResponse.json({ 
          error: 'Member permissions required to create workflows' 
        }, { status: 403 });
      }
    }

    // Créer Workflow
    const result = await query(`
      INSERT INTO pype_voice_workflows (
        workspace_id, name, description, platform_mode, billing_cycle,
        cost_overrides, workflow_definition, trigger_conditions,
        mcp_server_url, mcp_api_key, mcp_tools_enabled,
        max_execution_time_minutes, retry_count, timeout_seconds, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
      RETURNING *
    `, [
      workspace_id, name, description, platform_mode, billing_cycle,
      JSON.stringify(cost_overrides), JSON.stringify(workflow_definition), 
      JSON.stringify(trigger_conditions), mcp_server_url, mcp_api_key, mcp_tools_enabled,
      max_execution_time_minutes, retry_count, timeout_seconds, userId
    ]);

    // Initialiser compte crédits pour ce workspace si nécessaire
    try {
      await query(`
        INSERT INTO user_credits (workspace_id, current_balance, currency, is_active)
        VALUES ($1, 0, 'USD', true)
      `, [workspace_id]);
    } catch (creditError: any) {
      // Ignore si les crédits existent déjà ou si la table n'existe pas
      console.log('Credit initialization skipped:', creditError.message);
    }

    return NextResponse.json({
      success: true,
      workflow: result.rows[0]
    }, { status: 201 });

  } catch (error: any) {
    console.error('Error creating workflow:', error);
    
    if (error.code === '23505') { // Duplicate key
      return NextResponse.json(
        { error: 'Workflow with this name already exists in workspace' }, 
        { status: 409 }
      );
    }
    
    return NextResponse.json(
      { error: 'Internal server error' }, 
      { status: 500 }
    );
  }
}
