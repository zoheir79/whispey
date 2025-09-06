import { NextRequest, NextResponse } from 'next/server'
import { verifyUserAuth } from '@/lib/auth'
import { getUserGlobalRole } from '@/services/getGlobalRole'
import { query } from '@/lib/db'
import { webhookNotifier } from '@/services/webhookNotifier'

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
    const webhookId = params.id;

    // Récupérer webhook avec permissions
    const result = await query(`
      SELECT 
        wc.*,
        p.project_name as workspace_name
      FROM webhook_configurations wc
      LEFT JOIN pype_voice_projects p ON p.id = wc.workspace_id
      WHERE wc.id = $1
    `, [webhookId]);

    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Webhook not found' }, { status: 404 });
    }

    const webhook = result.rows[0];

    // Vérifier permissions
    const userGlobalRole = await getUserGlobalRole(userId);
    const isAdmin = userGlobalRole && ['admin', 'super_admin'].includes(userGlobalRole.global_role);

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

    return NextResponse.json({
      success: true,
      webhook
    });

  } catch (error: any) {
    console.error('Error fetching webhook:', error);
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
    const webhookId = params.id;

    const body = await request.json();
    const {
      webhook_name,
      webhook_url,
      event_types,
      balance_threshold,
      severity_threshold,
      http_method,
      headers,
      auth_type,
      auth_config,
      timeout_seconds,
      max_retries,
      retry_delay_seconds,
      is_active
    } = body;

    // Récupérer webhook existant
    const existingResult = await query(`
      SELECT * FROM webhook_configurations WHERE id = $1
    `, [webhookId]);

    if (existingResult.rows.length === 0) {
      return NextResponse.json({ error: 'Webhook not found' }, { status: 404 });
    }

    const existingWebhook = existingResult.rows[0];

    // Vérifier permissions
    const userGlobalRole = await getUserGlobalRole(userId);
    const isAdmin = userGlobalRole && ['admin', 'super_admin'].includes(userGlobalRole.global_role);

    if (existingWebhook.is_global && userGlobalRole?.global_role !== 'super_admin') {
      return NextResponse.json({ error: 'Only super_admin can modify global webhooks' }, { status: 403 });
    }

    if (!existingWebhook.is_global && !isAdmin) {
      const workspaceAccess = await query(`
        SELECT epm.role 
        FROM pype_voice_email_project_mapping epm
        INNER JOIN pype_voice_users u ON u.email = epm.email
        WHERE epm.project_id = $1 AND u.user_id = $2 AND epm.is_active = true
        AND epm.role IN ('admin', 'owner')
      `, [existingWebhook.workspace_id, userId]);

      if (workspaceAccess.rows.length === 0) {
        return NextResponse.json({ error: 'Access denied to webhook' }, { status: 403 });
      }
    }

    // Validation des champs modifiés
    if (webhook_url && !/^https?:\/\//.test(webhook_url)) {
      return NextResponse.json({ 
        error: 'webhook_url must be a valid HTTP/HTTPS URL' 
      }, { status: 400 });
    }

    if (event_types) {
      const validEventTypes = ['low_balance', 'critical_balance', 'auto_suspension', 'recharge', 'reactivation'];
      const invalidEvents = event_types.filter((et: string) => !validEventTypes.includes(et));
      if (invalidEvents.length > 0) {
        return NextResponse.json({ 
          error: `Invalid event types: ${invalidEvents.join(', ')}` 
        }, { status: 400 });
      }
    }

    // Construire requête UPDATE dynamique
    const updates: string[] = [];
    const values: any[] = [];
    let paramCount = 1;

    const fields = {
      webhook_name,
      webhook_url,
      event_types,
      balance_threshold,
      severity_threshold,
      http_method,
      headers: headers ? JSON.stringify(headers) : undefined,
      auth_type,
      auth_config: auth_config ? JSON.stringify(auth_config) : undefined,
      timeout_seconds,
      max_retries,
      retry_delay_seconds,
      is_active
    };

    Object.entries(fields).forEach(([key, value]) => {
      if (value !== undefined) {
        updates.push(`${key} = $${paramCount}`);
        values.push(value);
        paramCount++;
      }
    });

    if (updates.length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
    }

    updates.push(`updated_at = NOW()`);
    values.push(webhookId);

    const updateQuery = `
      UPDATE webhook_configurations 
      SET ${updates.join(', ')}
      WHERE id = $${paramCount}
      RETURNING *
    `;

    const result = await query(updateQuery, values);

    return NextResponse.json({
      success: true,
      message: 'Webhook updated successfully',
      webhook: result.rows[0]
    });

  } catch (error: any) {
    console.error('Error updating webhook:', error);
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
    const webhookId = params.id;

    // Récupérer webhook existant
    const existingResult = await query(`
      SELECT * FROM webhook_configurations WHERE id = $1
    `, [webhookId]);

    if (existingResult.rows.length === 0) {
      return NextResponse.json({ error: 'Webhook not found' }, { status: 404 });
    }

    const existingWebhook = existingResult.rows[0];

    // Vérifier permissions
    const userGlobalRole = await getUserGlobalRole(userId);
    const isAdmin = userGlobalRole && ['admin', 'super_admin'].includes(userGlobalRole.global_role);

    if (existingWebhook.is_global && userGlobalRole?.global_role !== 'super_admin') {
      return NextResponse.json({ error: 'Only super_admin can delete global webhooks' }, { status: 403 });
    }

    if (!existingWebhook.is_global && !isAdmin) {
      const workspaceAccess = await query(`
        SELECT epm.role 
        FROM pype_voice_email_project_mapping epm
        INNER JOIN pype_voice_users u ON u.email = epm.email
        WHERE epm.project_id = $1 AND u.user_id = $2 AND epm.is_active = true
        AND epm.role IN ('admin', 'owner')
      `, [existingWebhook.workspace_id, userId]);

      if (workspaceAccess.rows.length === 0) {
        return NextResponse.json({ error: 'Access denied to webhook' }, { status: 403 });
      }
    }

    // Supprimer webhook
    await query(`DELETE FROM webhook_configurations WHERE id = $1`, [webhookId]);

    return NextResponse.json({
      success: true,
      message: 'Webhook deleted successfully'
    });

  } catch (error: any) {
    console.error('Error deleting webhook:', error);
    return NextResponse.json(
      { error: 'Internal server error' }, 
      { status: 500 }
    );
  }
}
