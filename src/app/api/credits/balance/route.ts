import { NextRequest, NextResponse } from 'next/server'
import { verifyUserAuth } from '@/lib/auth'
import { getUserGlobalRole } from '@/services/getGlobalRole'
import { creditManager } from '@/services/creditManager'

export async function GET(request: NextRequest) {
  try {
    const { isAuthenticated, userId } = await verifyUserAuth(request);
    
    if (!isAuthenticated || !userId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const workspaceId = searchParams.get('workspace_id');

    if (!workspaceId) {
      return NextResponse.json({ error: 'workspace_id is required' }, { status: 400 });
    }

    // Vérifier permissions workspace
    const userGlobalRole = await getUserGlobalRole(userId);
    
    // Super admin peut accéder à tous les workspaces
    if (userGlobalRole?.global_role !== 'super_admin') {
      // Vérifier accès au workspace pour les autres utilisateurs
      const { query } = await import('@/lib/db');
      const workspaceAccess = await query(`
        SELECT role FROM pype_voice_email_project_mapping epm
        INNER JOIN pype_voice_users u ON u.email = epm.email
        WHERE u.user_id = $1 AND epm.project_id = $2 AND epm.is_active = true
      `, [userId, workspaceId]);

      if (workspaceAccess.rows.length === 0) {
        return NextResponse.json({ error: 'Access denied to workspace' }, { status: 403 });
      }
    }

    // Récupérer balance
    const balance = await creditManager.getWorkspaceBalance(workspaceId);
    
    if (!balance) {
      return NextResponse.json({ 
        workspace_id: workspaceId,
        current_balance: 0,
        currency: 'USD',
        is_active: false,
        message: 'No credits account found for this workspace'
      });
    }

    return NextResponse.json({
      workspace_id: workspaceId,
      current_balance: balance.current_balance,
      currency: balance.currency,
      credit_limit: balance.credit_limit,
      low_balance_threshold: balance.low_balance_threshold,
      auto_recharge_enabled: balance.auto_recharge_enabled,
      auto_recharge_amount: balance.auto_recharge_amount,
      auto_recharge_threshold: balance.auto_recharge_threshold,
      is_active: balance.is_active,
      is_suspended: balance.is_suspended,
      suspension_reason: balance.suspension_reason
    });

  } catch (error) {
    console.error('Error fetching credit balance:', error);
    return NextResponse.json(
      { error: 'Internal server error' }, 
      { status: 500 }
    );
  }
}
