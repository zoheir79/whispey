import { NextRequest, NextResponse } from 'next/server'
import { verifyUserAuth } from '@/lib/auth'
import { getUserGlobalRole } from '@/services/getGlobalRole'
import { query } from '@/lib/db'
import { advancedCostManager } from '@/services/advancedCostManager'

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
      calculation_type = 'advanced', // 'advanced', 'injection', 'fixed', 'dynamic', 'hybrid'
      usage_metrics = {},
      usage_timestamp,
      usage_volume,
      base_cost,
      target_service_type,
      target_service_id
    } = body;

    // Validation
    if (!service_type || !service_id) {
      return NextResponse.json({ 
        error: 'service_type and service_id are required' 
      }, { status: 400 });
    }

    if (!['agent', 'knowledge_base', 'workflow', 'workspace'].includes(service_type)) {
      return NextResponse.json({ 
        error: 'Invalid service_type' 
      }, { status: 400 });
    }

    // Vérifier permissions service
    const userGlobalRole = await getUserGlobalRole(userId);
    
    if (userGlobalRole?.global_role !== 'super_admin') {
      let serviceAccessQuery = '';
      const queryParams = [service_id, userId];

      switch (service_type) {
        case 'agent':
          serviceAccessQuery = `
            SELECT a.project_id as workspace_id
            FROM pype_voice_agents a
            INNER JOIN pype_voice_email_project_mapping epm ON epm.project_id = a.project_id
            INNER JOIN pype_voice_users u ON u.email = epm.email
            WHERE a.id = $1 AND u.user_id = $2 AND epm.is_active = true
          `;
          break;
        case 'knowledge_base':
          serviceAccessQuery = `
            SELECT kb.workspace_id
            FROM pype_voice_knowledge_bases kb
            INNER JOIN pype_voice_email_project_mapping epm ON epm.project_id = kb.workspace_id
            INNER JOIN pype_voice_users u ON u.email = epm.email
            WHERE kb.id = $1 AND u.user_id = $2 AND epm.is_active = true
          `;
          break;
        case 'workflow':
          serviceAccessQuery = `
            SELECT w.workspace_id
            FROM pype_voice_workflows w
            INNER JOIN pype_voice_email_project_mapping epm ON epm.project_id = w.workspace_id
            INNER JOIN pype_voice_users u ON u.email = emp.email
            WHERE w.id = $1 AND u.user_id = $2 AND epm.is_active = true
          `;
          break;
        case 'workspace':
          serviceAccessQuery = `
            SELECT epm.project_id as workspace_id
            FROM pype_voice_email_project_mapping epm
            INNER JOIN pype_voice_users u ON u.email = epm.email
            WHERE epm.project_id = $1 AND u.user_id = $2 AND epm.is_active = true
          `;
          break;
      }

      const accessResult = await query(serviceAccessQuery, queryParams);
      if (accessResult.rows.length === 0) {
        return NextResponse.json({ 
          error: 'Access denied to service' 
        }, { status: 403 });
      }
    }

    let calculationResult: any = null;

    // Effectuer calcul selon le type demandé
    switch (calculation_type) {
      case 'advanced':
        calculationResult = await advancedCostManager.calculateAdvancedServiceCost(
          service_type, service_id, usage_metrics, usage_timestamp
        );
        break;

      case 'injection':
        if (!base_cost) {
          return NextResponse.json({ 
            error: 'base_cost is required for injection calculation' 
          }, { status: 400 });
        }
        calculationResult = await advancedCostManager.calculateInjectionCost(
          service_type, service_id, base_cost, target_service_type, target_service_id
        );
        break;

      case 'fixed':
        calculationResult = await advancedCostManager.calculateFixedCostWithAllowances(
          service_type, service_id, usage_metrics
        );
        break;

      case 'dynamic':
        if (!usage_volume) {
          return NextResponse.json({ 
            error: 'usage_volume is required for dynamic calculation' 
          }, { status: 400 });
        }
        calculationResult = await advancedCostManager.calculateDynamicCost(
          service_type, service_id, usage_volume, usage_timestamp
        );
        break;

      case 'hybrid':
        calculationResult = await advancedCostManager.calculateHybridCost(
          service_type, service_id, usage_metrics
        );
        break;

      default:
        return NextResponse.json({ 
          error: 'Invalid calculation_type' 
        }, { status: 400 });
    }

    if (!calculationResult) {
      return NextResponse.json({ 
        error: 'Cost calculation failed' 
      }, { status: 500 });
    }

    // Enrichir avec informations contextuelles
    const enrichedResult = {
      ...calculationResult,
      calculation_type,
      requested_by: userId,
      requested_at: new Date().toISOString(),
      input_parameters: {
        service_type,
        service_id,
        usage_metrics,
        usage_timestamp,
        usage_volume,
        base_cost,
        target_service_type,
        target_service_id
      }
    };

    return NextResponse.json({
      success: true,
      calculation: enrichedResult
    });

  } catch (error: any) {
    console.error('Error calculating cost:', error);
    return NextResponse.json(
      { error: 'Internal server error' }, 
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
    const service_type = searchParams.get('service_type');
    const service_id = searchParams.get('service_id');

    if (!service_type || !service_id) {
      return NextResponse.json({ 
        error: 'service_type and service_id are required' 
      }, { status: 400 });
    }

    // Vérifier permissions et récupérer configuration active
    const userGlobalRole = await getUserGlobalRole(userId);
    
    let configQuery = `
      SELECT cca.*, p.project_name as workspace_name
      FROM cost_configuration_advanced cca
      LEFT JOIN pype_voice_projects p ON p.id = cca.workspace_id
      WHERE cca.service_type = $1 AND cca.service_id = $2
      AND cca.is_active = true
      AND (cca.effective_until IS NULL OR cca.effective_until > NOW())
    `;
    
    const queryParams = [service_type, service_id];

    // Restriction workspace si pas super_admin
    if (userGlobalRole?.global_role !== 'super_admin') {
      configQuery += ` AND cca.workspace_id IN (
        SELECT DISTINCT epm.project_id 
        FROM pype_voice_email_project_mapping emp
        INNER JOIN pype_voice_users u ON u.email = epm.email
        WHERE u.user_id = $3 AND epm.is_active = true
      )`;
      queryParams.push(userId);
    }

    configQuery += ` ORDER BY cca.priority DESC, cca.created_at DESC LIMIT 1`;

    const configResult = await query(configQuery, queryParams);

    if (configResult.rows.length === 0) {
      return NextResponse.json({ 
        message: 'No advanced cost configuration found, using standard calculation',
        has_advanced_config: false,
        fallback_to_standard: true
      });
    }

    const config = configResult.rows[0];

    // Récupérer allowances si applicable
    let allowances = [];
    if (['fixed', 'hybrid'].includes(config.cost_mode)) {
      allowances = await advancedCostManager.getServiceAllowances(service_type, service_id);
    }

    // Récupérer scaling tiers si mode dynamic
    let scalingTiers = [];
    if (config.cost_mode === 'dynamic') {
      scalingTiers = await advancedCostManager.getScalingTiers(config.id);
    }

    return NextResponse.json({
      success: true,
      has_advanced_config: true,
      configuration: config,
      allowances,
      scaling_tiers: scalingTiers,
      supported_calculation_types: [
        'advanced',
        config.cost_mode === 'injection' ? 'injection' : null,
        config.cost_mode === 'fixed' ? 'fixed' : null,
        config.cost_mode === 'dynamic' ? 'dynamic' : null,
        config.cost_mode === 'hybrid' ? 'hybrid' : null
      ].filter(Boolean)
    });

  } catch (error: any) {
    console.error('Error fetching cost calculation info:', error);
    return NextResponse.json(
      { error: 'Internal server error' }, 
      { status: 500 }
    );
  }
}
