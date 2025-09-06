import { NextRequest, NextResponse } from 'next/server'
import { verifyUserAuth } from '@/lib/auth'
import { getUserGlobalRole } from '@/services/getGlobalRole'
import { creditManager } from '@/services/creditManager'

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { isAuthenticated, userId } = await verifyUserAuth(request);
    
    if (!isAuthenticated || !userId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const params = await context.params;
    const alertId = params.id;
    const body = await request.json();
    const { action } = body; // 'read' | 'dismiss'

    if (!['read', 'dismiss'].includes(action)) {
      return NextResponse.json({ 
        error: 'Invalid action. Must be "read" or "dismiss"' 
      }, { status: 400 });
    }

    // Vérifier que l'alerte appartient à un workspace accessible
    const userGlobalRole = await getUserGlobalRole(userId);
    
    if (userGlobalRole?.global_role !== 'super_admin') {
      const { query } = await import('@/lib/db');
      const alertAccess = await query(`
        SELECT ca.workspace_id 
        FROM credit_alerts ca
        INNER JOIN pype_voice_email_project_mapping epm ON epm.project_id = ca.workspace_id
        INNER JOIN pype_voice_users u ON u.email = epm.email
        WHERE ca.id = $1 AND u.user_id = $2 AND epm.is_active = true
      `, [alertId, userId]);

      if (alertAccess.rows.length === 0) {
        return NextResponse.json({ error: 'Alert not found or access denied' }, { status: 404 });
      }
    }

    // Effectuer l'action
    if (action === 'read') {
      await creditManager.markAlertAsRead(alertId);
    } else if (action === 'dismiss') {
      await creditManager.dismissAlert(alertId);
    }

    return NextResponse.json({
      success: true,
      alert_id: alertId,
      action
    });

  } catch (error) {
    console.error('Error updating credit alert:', error);
    return NextResponse.json(
      { error: 'Internal server error' }, 
      { status: 500 }
    );
  }
}
