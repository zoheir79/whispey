import { NextRequest, NextResponse } from 'next/server'
import { verifyUserAuth } from '@/lib/auth'
import { getUserGlobalRole } from '@/services/getGlobalRole'
import { query } from '@/lib/db'
import { webhookNotifier } from '@/services/webhookNotifier'

export async function GET(request: NextRequest) {
  try {
    const { isAuthenticated, userId } = await verifyUserAuth(request);
    
    if (!isAuthenticated || !userId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const workspace_id = searchParams.get('workspace_id');

    // Vérifier permissions
    const userGlobalRole = await getUserGlobalRole(userId);
    const isAdmin = userGlobalRole && ['admin', 'super_admin'].includes(userGlobalRole.global_role);

    let whereClause = 'WHERE 1=1';
    let params: any[] = [];
    let paramCount = 1;

    if (workspace_id) {
      // Vérifier accès au workspace spécifique
      if (!isAdmin) {
        const workspaceAccess = await query(`
          SELECT epm.role 
          FROM pype_voice_email_project_mapping epm
          INNER JOIN pype_voice_users u ON u.email = epm.email
          WHERE epm.project_id = $1 AND u.user_id = $2 AND epm.is_active = true
          AND epm.role IN ('admin', 'owner')
        `, [workspace_id, userId]);

        if (workspaceAccess.rows.length === 0) {
          return NextResponse.json({ error: 'Access denied to workspace' }, { status: 403 });
        }
      }

      whereClause += ` AND workspace_id = $${paramCount}`;
      params.push(workspace_id);
      paramCount++;
    } else {
      // Sans workspace_id, montrer webhooks utilisateur peut voir
      if (isAdmin) {
        // Admin peut voir tous les webhooks
        whereClause += ` AND (is_global = true OR workspace_id IS NOT NULL)`;
      } else {
        // User normal voit seulement ses workspaces
        whereClause += ` AND workspace_id IN (
          SELECT epm.project_id
          FROM pype_voice_email_project_mapping epm
          INNER JOIN pype_voice_users u ON u.email = epm.email
          WHERE u.user_id = $${paramCount} AND epm.is_active = true
          AND epm.role IN ('admin', 'owner')
        )`;
        params.push(userId);
        paramCount++;
      }
    }

    const result = await query(`
      SELECT 
        wc.*,
        p.project_name as workspace_name,
        (wc.last_success_at > wc.last_error_at OR wc.last_error_at IS NULL) as is_healthy
      FROM webhook_configurations wc
      LEFT JOIN pype_voice_projects p ON p.id = wc.workspace_id
      ${whereClause}
      ORDER BY wc.is_global DESC, wc.created_at DESC
    `, params);

    return NextResponse.json({
      success: true,
      webhooks: result.rows,
      total: result.rows.length
    });

  } catch (error: any) {
    console.error('Error fetching webhooks:', error);
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
      webhook_name,
      webhook_url,
      event_types,
      balance_threshold,
      severity_threshold = 'warning',
      http_method = 'POST',
      headers = {},
      auth_type = 'none',
      auth_config = {},
      timeout_seconds = 30,
      max_retries = 3,
      retry_delay_seconds = 60,
      is_global = false
    } = body;

    // Validation
    if (!webhook_name || !webhook_url || !event_types || !Array.isArray(event_types)) {
      return NextResponse.json({ 
        error: 'webhook_name, webhook_url, and event_types are required' 
      }, { status: 400 });
    }

    if (!/^https?:\/\//.test(webhook_url)) {
      return NextResponse.json({ 
        error: 'webhook_url must be a valid HTTP/HTTPS URL' 
      }, { status: 400 });
    }

    const validEventTypes = ['low_balance', 'critical_balance', 'auto_suspension', 'recharge', 'reactivation'];
    const invalidEvents = event_types.filter((et: string) => !validEventTypes.includes(et));
    if (invalidEvents.length > 0) {
      return NextResponse.json({ 
        error: `Invalid event types: ${invalidEvents.join(', ')}` 
      }, { status: 400 });
    }

    // Vérifier permissions
    const userGlobalRole = await getUserGlobalRole(userId);
    const isAdmin = userGlobalRole && ['admin', 'super_admin'].includes(userGlobalRole.global_role);

    if (is_global && userGlobalRole?.global_role !== 'super_admin') {
      return NextResponse.json({ error: 'Only super_admin can create global webhooks' }, { status: 403 });
    }

    if (workspace_id && !isAdmin) {
      // Vérifier permissions workspace
      const workspaceAccess = await query(`
        SELECT epm.role 
        FROM pype_voice_email_project_mapping epm
        INNER JOIN pype_voice_users u ON u.email = epm.email
        WHERE epm.project_id = $1 AND u.user_id = $2 AND epm.is_active = true
        AND epm.role IN ('admin', 'owner')
      `, [workspace_id, userId]);

      if (workspaceAccess.rows.length === 0) {
        return NextResponse.json({ error: 'Access denied to workspace' }, { status: 403 });
      }
    }

    // Créer webhook
    const result = await query(`
      INSERT INTO webhook_configurations (
        workspace_id, is_global, webhook_name, webhook_url,
        event_types, balance_threshold, severity_threshold,
        http_method, headers, auth_type, auth_config,
        timeout_seconds, max_retries, retry_delay_seconds,
        is_active, created_by, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, true, $15, NOW(), NOW())
      RETURNING *
    `, [
      is_global ? null : workspace_id,
      is_global,
      webhook_name,
      webhook_url,
      event_types,
      balance_threshold,
      severity_threshold,
      http_method,
      JSON.stringify(headers),
      auth_type,
      JSON.stringify(auth_config),
      timeout_seconds,
      max_retries,
      retry_delay_seconds,
      userId
    ]);

    return NextResponse.json({
      success: true,
      message: 'Webhook created successfully',
      webhook: result.rows[0]
    });

  } catch (error: any) {
    console.error('Error creating webhook:', error);
    return NextResponse.json(
      { error: 'Internal server error' }, 
      { status: 500 }
    );
  }
}
