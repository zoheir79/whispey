import { NextRequest, NextResponse } from 'next/server'
import { verifyUserAuth } from '@/lib/auth'
import { getUserGlobalRole } from '@/services/getGlobalRole'
import { creditMonitor } from '@/services/creditMonitor'
import { query } from '@/lib/db'

export async function POST(request: NextRequest) {
  try {
    const { isAuthenticated, userId } = await verifyUserAuth(request);
    
    if (!isAuthenticated || !userId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    // Vérifier permissions - seulement admin/super_admin
    const userGlobalRole = await getUserGlobalRole(userId);
    
    if (!userGlobalRole || !['admin', 'super_admin'].includes(userGlobalRole.global_role)) {
      return NextResponse.json({ error: 'Access denied - admin rights required' }, { status: 403 });
    }

    const body = await request.json();
    const { 
      force_run = false,
      workspace_ids = [], // Pour monitoring spécifique
      enable_auto_actions = true 
    } = body;

    // Vérifier si monitoring récent si pas force
    if (!force_run) {
      const recentRun = await query(`
        SELECT execution_timestamp 
        FROM credit_monitoring_logs 
        WHERE execution_timestamp > NOW() - INTERVAL '5 minutes'
        ORDER BY execution_timestamp DESC 
        LIMIT 1
      `);

      if (recentRun.rows.length > 0) {
        return NextResponse.json({
          message: 'Monitoring already executed recently',
          last_run: recentRun.rows[0].execution_timestamp,
          suggestion: 'Use force_run=true to override'
        }, { status: 429 });
      }
    }

    const startTime = Date.now();
    
    // Exécuter monitoring global ou spécifique
    let monitoringResult;
    if (workspace_ids.length > 0) {
      monitoringResult = await creditMonitor.monitorSpecificWorkspaces(workspace_ids, enable_auto_actions);
    } else {
      monitoringResult = await creditMonitor.monitorAllWorkspaces();
    }

    const executionTime = Date.now() - startTime;

    // Enregistrer log du monitoring
    const monitoringRunId = crypto.randomUUID();
    await query(`
      INSERT INTO credit_monitoring_logs (
        monitoring_run_id,
        execution_timestamp,
        total_workspaces_checked,
        alerts_generated,
        suspensions_triggered,
        workspace_results,
        execution_duration_ms,
        errors_encountered,
        created_at
      ) VALUES ($1, NOW(), $2, $3, $4, $5, $6, 0, NOW())
    `, [
      monitoringRunId,
      monitoringResult.total_workspaces_checked,
      monitoringResult.alerts_generated,
      monitoringResult.suspensions_triggered,
      JSON.stringify(monitoringResult.alerts),
      executionTime
    ]);

    return NextResponse.json({
      success: true,
      monitoring_run_id: monitoringRunId,
      execution_time_ms: executionTime,
      results: monitoringResult,
      triggered_by: userId,
      timestamp: new Date().toISOString()
    });

  } catch (error: any) {
    console.error('Error running credit monitoring:', error);
    return NextResponse.json(
      { error: 'Internal server error', message: error.message }, 
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { isAuthenticated, userId } = await verifyUserAuth(request);
    
    if (!isAuthenticated || !userId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const workspace_id = searchParams.get('workspace_id');
    const include_resolved = searchParams.get('include_resolved') === 'true';
    const limit = parseInt(searchParams.get('limit') || '50');

    // Permissions check
    const userGlobalRole = await getUserGlobalRole(userId);
    const isAdmin = userGlobalRole && ['admin', 'super_admin'].includes(userGlobalRole.global_role);

    if (workspace_id) {
      // Vérifier accès au workspace spécifique
      if (!isAdmin) {
        const workspaceAccess = await query(`
          SELECT epm.role 
          FROM pype_voice_email_project_mapping epm
          INNER JOIN pype_voice_users u ON u.email = epm.email
          WHERE epm.project_id = $1 AND u.user_id = $2 AND epm.is_active = true
        `, [workspace_id, userId]);

        if (workspaceAccess.rows.length === 0) {
          return NextResponse.json({ error: 'Access denied to workspace' }, { status: 403 });
        }
      }

      // Récupérer alertes pour le workspace
      const alerts = await creditMonitor.getWorkspaceAlerts(workspace_id, include_resolved);
      
      return NextResponse.json({
        success: true,
        workspace_id,
        alerts,
        total_alerts: alerts.length
      });

    } else {
      // Récupérer toutes les alertes (admin seulement)
      if (!isAdmin) {
        return NextResponse.json({ error: 'Access denied - admin rights required' }, { status: 403 });
      }

      const alerts = await creditMonitor.getAllActiveAlerts();

      // Récupérer statistiques récentes
      const statsResult = await query(`
        SELECT 
          COUNT(*) as total_workspaces,
          SUM(CASE WHEN uc.is_suspended THEN 1 ELSE 0 END) as suspended_workspaces,
          SUM(CASE WHEN uc.current_balance <= uc.low_balance_threshold THEN 1 ELSE 0 END) as low_balance_workspaces,
          SUM(CASE WHEN uc.current_balance < 0 THEN 1 ELSE 0 END) as negative_balance_workspaces,
          AVG(uc.current_balance) as average_balance
        FROM user_credits uc
        WHERE uc.is_active = true
      `);

      const recentRunsResult = await query(`
        SELECT 
          monitoring_run_id,
          execution_timestamp,
          total_workspaces_checked,
          alerts_generated,
          suspensions_triggered,
          execution_duration_ms
        FROM credit_monitoring_logs 
        ORDER BY execution_timestamp DESC 
        LIMIT 10
      `);

      return NextResponse.json({
        success: true,
        active_alerts: alerts,
        statistics: statsResult.rows[0],
        recent_monitoring_runs: recentRunsResult.rows,
        total_active_alerts: alerts.length
      });
    }

  } catch (error: any) {
    console.error('Error fetching monitoring data:', error);
    return NextResponse.json(
      { error: 'Internal server error' }, 
      { status: 500 }
    );
  }
}
