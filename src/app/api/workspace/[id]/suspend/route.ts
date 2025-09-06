import { NextRequest, NextResponse } from 'next/server'
import { verifyUserAuth } from '@/lib/auth'
import { getUserGlobalRole } from '@/services/getGlobalRole'
import { query } from '@/lib/db'

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
    const workspaceId = params.id;

    // Vérifier permissions - seulement super_admin ou admin du workspace
    const userGlobalRole = await getUserGlobalRole(userId);
    
    if (userGlobalRole?.global_role !== 'super_admin') {
      const workspaceAccess = await query(`
        SELECT epm.role 
        FROM pype_voice_email_project_mapping epm
        INNER JOIN pype_voice_users u ON u.email = epm.email
        WHERE epm.project_id = $1 AND u.user_id = $2 AND epm.is_active = true
        AND epm.role IN ('admin', 'owner')
      `, [workspaceId, userId]);

      if (workspaceAccess.rows.length === 0) {
        return NextResponse.json({ error: 'Access denied - admin rights required' }, { status: 403 });
      }
    }

    const body = await request.json();
    const { 
      suspension_reason, 
      suspend_agents = true,
      suspend_kb = true, 
      suspend_workflows = true,
      auto_suspension = false
    } = body;

    // Validation
    if (!suspension_reason || suspension_reason.trim().length === 0) {
      return NextResponse.json({ 
        error: 'suspension_reason is required' 
      }, { status: 400 });
    }

    // Vérifier que le workspace existe
    const workspaceResult = await query(`
      SELECT p.*, uc.current_balance, uc.is_suspended, uc.suspension_reason 
      FROM pype_voice_projects p
      LEFT JOIN user_credits uc ON uc.workspace_id = p.id AND uc.is_active = true
      WHERE p.id = $1
    `, [workspaceId]);

    if (workspaceResult.rows.length === 0) {
      return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });
    }

    const workspace = workspaceResult.rows[0];

    if (workspace.is_suspended) {
      return NextResponse.json({ 
        error: 'Workspace is already suspended',
        current_suspension_reason: workspace.suspension_reason
      }, { status: 400 });
    }

    // Commencer la transaction de suspension
    await query('BEGIN');

    try {
      // 1. Suspendre les crédits du workspace
      await query(`
        UPDATE user_credits 
        SET is_suspended = true,
            suspension_reason = $2,
            suspended_at = NOW(),
            updated_at = NOW()
        WHERE workspace_id = $1 AND is_active = true
      `, [workspaceId, suspension_reason]);

      let suspendedServices = {
        agents: 0,
        knowledge_bases: 0,
        workflows: 0
      };

      // 2. Suspendre les agents si demandé
      if (suspend_agents) {
        const agentResult = await query(`
          UPDATE pype_voice_agents 
          SET is_active = false,
              updated_at = NOW()
          WHERE project_id = $1 AND is_active = true
        `, [workspaceId]);
        
        suspendedServices.agents = agentResult.rowCount || 0;
      }

      // 3. Suspendre les KB si demandé
      if (suspend_kb) {
        const kbResult = await query(`
          UPDATE pype_voice_knowledge_bases 
          SET is_active = false,
              updated_at = NOW()
          WHERE workspace_id = $1 AND is_active = true
        `, [workspaceId]);
        
        suspendedServices.knowledge_bases = kbResult.rowCount || 0;
      }

      // 4. Suspendre les workflows si demandé (table hypothétique)
      if (suspend_workflows) {
        const workflowResult = await query(`
          UPDATE pype_voice_workflows 
          SET is_active = false,
              updated_at = NOW()
          WHERE workspace_id = $1 AND is_active = true
        `).catch(() => ({ rowCount: 0 })); // Ignore si table n'existe pas
        
        suspendedServices.workflows = workflowResult.rowCount || 0;
      }

      // 5. Enregistrer événement de suspension
      await query(`
        INSERT INTO credit_transactions (
          workspace_id, user_id, credits_id, transaction_type, amount,
          previous_balance, new_balance, description, status, created_at
        )
        SELECT 
          $1, $2, uc.id, 'suspension', 0,
          uc.current_balance, uc.current_balance,
          $3, 'completed', NOW()
        FROM user_credits uc
        WHERE uc.workspace_id = $1 AND uc.is_active = true
      `, [workspaceId, userId, `Workspace suspended: ${suspension_reason}`]);

      await query('COMMIT');

      return NextResponse.json({
        success: true,
        message: 'Workspace suspended successfully',
        workspace_id: workspaceId,
        workspace_name: workspace.project_name,
        suspension_reason,
        suspended_services: suspendedServices,
        auto_suspension,
        suspended_at: new Date().toISOString(),
        suspended_by: auto_suspension ? 'system' : userId
      });

    } catch (error) {
      await query('ROLLBACK');
      throw error;
    }

  } catch (error: any) {
    console.error('Error suspending workspace:', error);
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
    const workspaceId = params.id;

    // Vérifier permissions - seulement super_admin ou admin du workspace
    const userGlobalRole = await getUserGlobalRole(userId);
    
    if (userGlobalRole?.global_role !== 'super_admin') {
      const workspaceAccess = await query(`
        SELECT epm.role 
        FROM pype_voice_email_project_mapping epm
        INNER JOIN pype_voice_users u ON u.email = epm.email
        WHERE epm.project_id = $1 AND u.user_id = $2 AND epm.is_active = true
        AND epm.role IN ('admin', 'owner')
      `, [workspaceId, userId]);

      if (workspaceAccess.rows.length === 0) {
        return NextResponse.json({ error: 'Access denied - admin rights required' }, { status: 403 });
      }
    }

    // Vérifier que le workspace est suspendu
    const workspaceResult = await query(`
      SELECT p.*, uc.current_balance, uc.is_suspended, uc.suspension_reason 
      FROM pype_voice_projects p
      LEFT JOIN user_credits uc ON uc.workspace_id = p.id AND uc.is_active = true
      WHERE p.id = $1
    `, [workspaceId]);

    if (workspaceResult.rows.length === 0) {
      return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });
    }

    const workspace = workspaceResult.rows[0];

    if (!workspace.is_suspended) {
      return NextResponse.json({ 
        error: 'Workspace is not suspended' 
      }, { status: 400 });
    }

    // Commencer la transaction de réactivation
    await query('BEGIN');

    try {
      // 1. Réactiver les crédits du workspace
      await query(`
        UPDATE user_credits 
        SET is_suspended = false,
            suspension_reason = NULL,
            suspended_at = NULL,
            updated_at = NOW()
        WHERE workspace_id = $1 AND is_active = true
      `, [workspaceId]);

      let reactivatedServices = {
        agents: 0,
        knowledge_bases: 0,
        workflows: 0
      };

      // 2. Réactiver les agents (optionnel - peut nécessiter validation manuelle)
      const agentResult = await query(`
        UPDATE pype_voice_agents 
        SET is_active = true,
            updated_at = NOW()
        WHERE project_id = $1 AND is_active = false
      `, [workspaceId]);
      
      reactivatedServices.agents = agentResult.rowCount || 0;

      // 3. Réactiver les KB
      const kbResult = await query(`
        UPDATE pype_voice_knowledge_bases 
        SET is_active = true,
            updated_at = NOW()
        WHERE workspace_id = $1 AND is_active = false
      `, [workspaceId]);
      
      reactivatedServices.knowledge_bases = kbResult.rowCount || 0;

      // 4. Enregistrer événement de réactivation
      await query(`
        INSERT INTO credit_transactions (
          workspace_id, user_id, credits_id, transaction_type, amount,
          previous_balance, new_balance, description, status, created_at
        )
        SELECT 
          $1, $2, uc.id, 'reactivation', 0,
          uc.current_balance, uc.current_balance,
          'Workspace reactivated manually', 'completed', NOW()
        FROM user_credits uc
        WHERE uc.workspace_id = $1 AND uc.is_active = true
      `, [workspaceId, userId]);

      await query('COMMIT');

      return NextResponse.json({
        success: true,
        message: 'Workspace reactivated successfully',
        workspace_id: workspaceId,
        workspace_name: workspace.project_name,
        reactivated_services: reactivatedServices,
        reactivated_at: new Date().toISOString(),
        reactivated_by: userId
      });

    } catch (error) {
      await query('ROLLBACK');
      throw error;
    }

  } catch (error: any) {
    console.error('Error reactivating workspace:', error);
    return NextResponse.json(
      { error: 'Internal server error' }, 
      { status: 500 }
    );
  }
}

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
    const workspaceId = params.id;

    // Récupérer statut de suspension du workspace
    const statusResult = await query(`
      SELECT 
        p.id,
        p.project_name,
        uc.current_balance,
        uc.currency,
        uc.is_suspended,
        uc.suspension_reason,
        uc.suspended_at,
        uc.low_balance_threshold,
        uc.credit_limit,
        (SELECT COUNT(*) FROM pype_voice_agents WHERE project_id = p.id AND is_active = true) as active_agents,
        (SELECT COUNT(*) FROM pype_voice_agents WHERE project_id = p.id AND is_active = false) as suspended_agents,
        (SELECT COUNT(*) FROM pype_voice_knowledge_bases WHERE workspace_id = p.id AND is_active = true) as active_kb,
        (SELECT COUNT(*) FROM pype_voice_knowledge_bases WHERE workspace_id = p.id AND is_active = false) as suspended_kb
      FROM pype_voice_projects p
      LEFT JOIN user_credits uc ON uc.workspace_id = p.id AND uc.is_active = true
      WHERE p.id = $1
    `, [workspaceId]);

    if (statusResult.rows.length === 0) {
      return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });
    }

    const workspace = statusResult.rows[0];

    // Récupérer historique des suspensions récentes
    const historyResult = await query(`
      SELECT 
        ct.transaction_type,
        ct.description,
        ct.created_at,
        u.email as performed_by
      FROM credit_transactions ct
      LEFT JOIN pype_voice_users u ON u.user_id = ct.user_id
      WHERE ct.workspace_id = $1 
        AND ct.transaction_type IN ('suspension', 'reactivation')
      ORDER BY ct.created_at DESC
      LIMIT 10
    `, [workspaceId]);

    return NextResponse.json({
      success: true,
      workspace: {
        id: workspace.id,
        name: workspace.project_name,
        is_suspended: workspace.is_suspended,
        suspension_reason: workspace.suspension_reason,
        suspended_at: workspace.suspended_at,
        credit_status: {
          current_balance: workspace.current_balance,
          currency: workspace.currency,
          low_balance_threshold: workspace.low_balance_threshold,
          credit_limit: workspace.credit_limit,
          is_low_balance: workspace.current_balance < workspace.low_balance_threshold
        },
        services: {
          agents: {
            active: workspace.active_agents,
            suspended: workspace.suspended_agents,
            total: workspace.active_agents + workspace.suspended_agents
          },
          knowledge_bases: {
            active: workspace.active_kb,
            suspended: workspace.suspended_kb,
            total: workspace.active_kb + workspace.suspended_kb
          }
        }
      },
      suspension_history: historyResult.rows
    });

  } catch (error: any) {
    console.error('Error fetching workspace suspension status:', error);
    return NextResponse.json(
      { error: 'Internal server error' }, 
      { status: 500 }
    );
  }
}
