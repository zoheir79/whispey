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
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');
    const transactionType = searchParams.get('transaction_type');

    if (!workspaceId) {
      return NextResponse.json({ error: 'workspace_id is required' }, { status: 400 });
    }

    // Vérifier permissions workspace
    const userGlobalRole = await getUserGlobalRole(userId);
    
    if (userGlobalRole?.global_role !== 'super_admin') {
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

    // Récupérer historique transactions
    const transactions = await creditManager.getTransactionHistory(
      workspaceId,
      Math.min(limit, 100), // Limiter à max 100
      offset,
      transactionType || undefined
    );

    return NextResponse.json({
      workspace_id: workspaceId,
      transactions,
      pagination: {
        limit,
        offset,
        count: transactions.length
      }
    });

  } catch (error) {
    console.error('Error fetching credit transactions:', error);
    return NextResponse.json(
      { error: 'Internal server error' }, 
      { status: 500 }
    );
  }
}
