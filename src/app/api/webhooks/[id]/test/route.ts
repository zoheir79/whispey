import { NextRequest, NextResponse } from 'next/server'
import { verifyUserAuth } from '@/lib/auth'
import { getUserGlobalRole } from '@/services/getGlobalRole'
import { query } from '@/lib/db'
import { webhookNotifier } from '@/services/webhookNotifier'

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
    const webhookId = params.id;

    // Récupérer webhook avec permissions
    const result = await query(`
      SELECT * FROM webhook_configurations WHERE id = $1
    `, [webhookId]);

    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Webhook not found' }, { status: 404 });
    }

    const webhook = result.rows[0];

    // Vérifier permissions
    const userGlobalRole = await getUserGlobalRole(userId);
    const isAdmin = userGlobalRole && ['admin', 'super_admin'].includes(userGlobalRole.global_role);

    if (webhook.is_global && userGlobalRole?.global_role !== 'super_admin') {
      return NextResponse.json({ error: 'Only super_admin can test global webhooks' }, { status: 403 });
    }

    if (!webhook.is_global && !isAdmin) {
      const workspaceAccess = await query(`
        SELECT epm.role 
        FROM pype_voice_email_project_mapping epm
        INNER JOIN pype_voice_users u ON u.email = epm.email
        WHERE epm.project_id = $1 AND u.user_id = $2 AND epm.is_active = true
        AND epm.role IN ('admin', 'owner')
      `, [webhook.workspace_id, userId]);

      if (workspaceAccess.rows.length === 0) {
        return NextResponse.json({ error: 'Access denied to webhook' }, { status: 403 });
      }
    }

    // Tester le webhook
    const testResult = await webhookNotifier.testWebhook(webhookId);

    return NextResponse.json({
      success: true,
      message: 'Webhook test completed',
      test_result: testResult
    });

  } catch (error: any) {
    console.error('Error testing webhook:', error);
    return NextResponse.json(
      { error: 'Internal server error' }, 
      { status: 500 }
    );
  }
}
