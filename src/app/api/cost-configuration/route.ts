import { NextRequest, NextResponse } from 'next/server'
import { verifyUserAuth } from '@/lib/auth'
import { getUserGlobalRole } from '@/services/getGlobalRole'
import { query } from '@/lib/db'
import { advancedCostManager } from '@/services/advancedCostManager'

export async function GET(request: NextRequest) {
  try {
    const { isAuthenticated, userId } = await verifyUserAuth(request);
    
    if (!isAuthenticated || !userId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const service_type = searchParams.get('service_type');
    const service_id = searchParams.get('service_id');
    const workspace_id = searchParams.get('workspace_id');
    const cost_mode = searchParams.get('cost_mode');

    // Vérifier permissions
    const userGlobalRole = await getUserGlobalRole(userId);
    
    let whereConditions = ['is_active = true'];
    let queryParams: any[] = [];
    let paramCount = 1;

    // Filtres
    if (service_type) {
      whereConditions.push(`service_type = $${paramCount}`);
      queryParams.push(service_type);
      paramCount++;
    }

    if (service_id) {
      whereConditions.push(`service_id = $${paramCount}`);
      queryParams.push(service_id);
      paramCount++;
    }

    if (workspace_id) {
      whereConditions.push(`workspace_id = $${paramCount}`);
      queryParams.push(workspace_id);
      paramCount++;
    }

    if (cost_mode) {
      whereConditions.push(`cost_mode = $${paramCount}`);
      queryParams.push(cost_mode);
      paramCount++;
    }

    // Restriction workspace si pas super_admin
    if (userGlobalRole?.global_role !== 'super_admin') {
      whereConditions.push(`workspace_id IN (
        SELECT DISTINCT epm.project_id 
        FROM pype_voice_email_project_mapping epm
        INNER JOIN pype_voice_users u ON u.email = epm.email
        WHERE u.user_id = $${paramCount} AND epm.is_active = true
      )`);
      queryParams.push(userId);
      paramCount++;
    }

    const result = await query(`
      SELECT 
        cca.*,
        u.email as created_by_email,
        p.project_name as workspace_name
      FROM cost_configuration_advanced cca
      LEFT JOIN pype_voice_users u ON u.user_id = cca.created_by
      LEFT JOIN pype_voice_projects p ON p.id = cca.workspace_id
      WHERE ${whereConditions.join(' AND ')}
      ORDER BY cca.priority DESC, cca.created_at DESC
    `, queryParams);

    return NextResponse.json({
      success: true,
      configurations: result.rows,
      count: result.rows.length
    });

  } catch (error: any) {
    console.error('Error fetching cost configurations:', error);
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
      service_type,
      service_id,
      workspace_id,
      cost_mode,
      injection_config,
      fixed_cost_config,
      dynamic_cost_config,
      hybrid_config,
      usage_limits,
      cost_caps,
      effective_from,
      effective_until,
      priority = 0
    } = body;

    // Validation
    if (!service_type || !service_id || !workspace_id || !cost_mode) {
      return NextResponse.json({ 
        error: 'service_type, service_id, workspace_id, and cost_mode are required' 
      }, { status: 400 });
    }

    if (!['agent', 'knowledge_base', 'workflow', 'workspace'].includes(service_type)) {
      return NextResponse.json({ 
        error: 'Invalid service_type' 
      }, { status: 400 });
    }

    if (!['pag', 'dedicated', 'injection', 'hybrid', 'fixed', 'dynamic'].includes(cost_mode)) {
      return NextResponse.json({ 
        error: 'Invalid cost_mode' 
      }, { status: 400 });
    }

    // Vérifier permissions workspace
    const userGlobalRole = await getUserGlobalRole(userId);
    
    if (userGlobalRole?.global_role !== 'super_admin') {
      const workspaceAccess = await query(`
        SELECT epm.role 
        FROM pype_voice_email_project_mapping epm
        INNER JOIN pype_voice_users u ON u.email = epm.email
        WHERE u.user_id = $1 AND epm.project_id = $2 AND epm.is_active = true
      `, [userId, workspace_id]);

      if (workspaceAccess.rows.length === 0 || 
          !['admin', 'owner'].includes(workspaceAccess.rows[0].role)) {
        return NextResponse.json({ 
          error: 'Admin permissions required for workspace' 
        }, { status: 403 });
      }
    }

    // Vérifier que le service existe
    let serviceExists = false;
    switch (service_type) {
      case 'agent':
        const agentCheck = await query('SELECT id FROM pype_voice_agents WHERE id = $1', [service_id]);
        serviceExists = agentCheck.rows.length > 0;
        break;
      case 'knowledge_base':
        const kbCheck = await query('SELECT id FROM pype_voice_knowledge_bases WHERE id = $1', [service_id]);
        serviceExists = kbCheck.rows.length > 0;
        break;
      case 'workflow':
        const workflowCheck = await query('SELECT id FROM pype_voice_workflows WHERE id = $1', [service_id]);
        serviceExists = workflowCheck.rows.length > 0;
        break;
      case 'workspace':
        const workspaceCheck = await query('SELECT id FROM pype_voice_projects WHERE id = $1', [service_id]);
        serviceExists = workspaceCheck.rows.length > 0;
        break;
    }

    if (!serviceExists) {
      return NextResponse.json({ 
        error: `${service_type} not found` 
      }, { status: 404 });
    }

    // Créer configuration
    const configuration = await advancedCostManager.createCostConfiguration({
      service_type,
      service_id,
      workspace_id,
      cost_mode,
      injection_config,
      fixed_cost_config,
      dynamic_cost_config,
      hybrid_config,
      usage_limits,
      cost_caps,
      effective_from,
      effective_until,
      priority,
      user_id: userId
    });

    if (!configuration) {
      return NextResponse.json({ 
        error: 'Failed to create cost configuration' 
      }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      configuration,
      message: 'Cost configuration created successfully'
    }, { status: 201 });

  } catch (error: any) {
    console.error('Error creating cost configuration:', error);
    return NextResponse.json(
      { error: 'Internal server error' }, 
      { status: 500 }
    );
  }
}
