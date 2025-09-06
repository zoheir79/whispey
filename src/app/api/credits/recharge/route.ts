import { NextRequest, NextResponse } from 'next/server'
import { verifyUserAuth } from '@/lib/auth'
import { getUserGlobalRole } from '@/services/getGlobalRole'
import { creditManager } from '@/services/creditManager'

export async function POST(request: NextRequest) {
  try {
    const { isAuthenticated, userId } = await verifyUserAuth(request);
    
    if (!isAuthenticated || !userId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const body = await request.json();
    const { workspace_id, amount, description } = body;

    if (!workspace_id || !amount) {
      return NextResponse.json({ 
        error: 'workspace_id and amount are required' 
      }, { status: 400 });
    }

    if (amount <= 0) {
      return NextResponse.json({ 
        error: 'Amount must be positive' 
      }, { status: 400 });
    }

    // Vérifier permissions
    const userGlobalRole = await getUserGlobalRole(userId);
    
    // Seuls admin+ peuvent recharger des crédits
    if (userGlobalRole?.global_role !== 'super_admin' && userGlobalRole?.global_role !== 'admin') {
      // Vérifier si l'utilisateur est admin/owner du workspace
      const { query } = await import('@/lib/db');
      const workspaceAccess = await query(`
        SELECT role FROM pype_voice_email_project_mapping epm
        INNER JOIN pype_voice_users u ON u.email = epm.email
        WHERE u.user_id = $1 AND epm.project_id = $2 AND epm.is_active = true
      `, [userId, workspace_id]);

      if (workspaceAccess.rows.length === 0 || 
          !['admin', 'owner'].includes(workspaceAccess.rows[0].role)) {
        return NextResponse.json({ 
          error: 'Admin permissions required to recharge credits' 
        }, { status: 403 });
      }
    }

    // Recharger crédits
    const result = await creditManager.rechargeCredits({
      workspace_id,
      amount,
      description: description || `Credit recharge by ${userId}`
    });

    if (result.success) {
      return NextResponse.json({
        success: true,
        transaction_id: result.transaction_id,
        previous_balance: result.previous_balance,
        new_balance: result.new_balance,
        amount_added: result.amount_added,
        workspace_id
      });
    } else {
      return NextResponse.json({ 
        error: 'Failed to recharge credits' 
      }, { status: 500 });
    }

  } catch (error) {
    console.error('Error recharging credits:', error);
    return NextResponse.json(
      { error: 'Internal server error' }, 
      { status: 500 }
    );
  }
}
