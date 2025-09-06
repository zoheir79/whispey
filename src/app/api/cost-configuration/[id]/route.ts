import { NextRequest, NextResponse } from 'next/server'
import { verifyUserAuth } from '@/lib/auth'
import { getUserGlobalRole } from '@/services/getGlobalRole'
import { query } from '@/lib/db'
import { advancedCostManager } from '@/services/advancedCostManager'

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
    const configId = params.id;

    // Vérifier permissions
    const userGlobalRole = await getUserGlobalRole(userId);
    
    let accessQuery = `
      SELECT 
        cca.*,
        u.email as created_by_email,
        p.project_name as workspace_name
      FROM cost_configuration_advanced cca
      LEFT JOIN pype_voice_users u ON u.user_id = cca.created_by
      LEFT JOIN pype_voice_projects p ON p.id = cca.workspace_id
      WHERE cca.id = $1
    `;
    
    const queryParams = [configId];

    // Restriction workspace si pas super_admin
    if (userGlobalRole?.global_role !== 'super_admin') {
      accessQuery += ` AND cca.workspace_id IN (
        SELECT DISTINCT epm.project_id 
        FROM pype_voice_email_project_mapping epm
        INNER JOIN pype_voice_users u ON u.email = epm.email
        WHERE u.user_id = $2 AND emp.is_active = true
      )`;
      queryParams.push(userId);
    }

    const result = await query(accessQuery, queryParams);

    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Configuration not found' }, { status: 404 });
    }

    const configuration = result.rows[0];

    // Récupérer scaling tiers si mode dynamic
    let scalingTiers = [];
    if (configuration.cost_mode === 'dynamic') {
      scalingTiers = await advancedCostManager.getScalingTiers(configId);
    }

    // Allowances removed - no quota management

    return NextResponse.json({
      success: true,
      configuration,
      scaling_tiers: scalingTiers
      // allowances removed - no quota management
    });

  } catch (error: any) {
    console.error('Error fetching cost configuration:', error);
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
    const configId = params.id;
    const body = await request.json();

    // Vérifier que la configuration existe et permissions
    const userGlobalRole = await getUserGlobalRole(userId);
    
    let accessQuery = `
      SELECT workspace_id FROM cost_configuration_advanced WHERE id = $1
    `;
    const queryParams = [configId];

    if (userGlobalRole?.global_role !== 'super_admin') {
      accessQuery += ` AND workspace_id IN (
        SELECT DISTINCT epm.project_id 
        FROM pype_voice_email_project_mapping epm
        INNER JOIN pype_voice_users u ON u.email = epm.email
        WHERE u.user_id = $2 AND epm.is_active = true
      )`;
      queryParams.push(userId);
    }

    const accessResult = await query(accessQuery, queryParams);

    if (accessResult.rows.length === 0) {
      return NextResponse.json({ error: 'Configuration not found or access denied' }, { status: 404 });
    }

    const workspaceId = accessResult.rows[0].workspace_id;

    // Vérifier permissions modification (admin/owner)
    if (userGlobalRole?.global_role !== 'super_admin') {
      const permissionCheck = await query(`
        SELECT epm.role 
        FROM pype_voice_email_project_mapping epm
        INNER JOIN pype_voice_users u ON u.email = epm.email
        WHERE u.user_id = $1 AND epm.project_id = $2 AND epm.is_active = true
      `, [userId, workspaceId]);

      if (permissionCheck.rows.length === 0 || 
          !['admin', 'owner'].includes(permissionCheck.rows[0].role)) {
        return NextResponse.json({ 
          error: 'Admin permissions required to modify configuration' 
        }, { status: 403 });
      }
    }

    // Mettre à jour la configuration
    const success = await advancedCostManager.updateCostConfiguration(configId, body);

    if (!success) {
      return NextResponse.json({ 
        error: 'Failed to update configuration' 
      }, { status: 500 });
    }

    // Mettre à jour scaling tiers si fournis
    if (body.scaling_tiers && Array.isArray(body.scaling_tiers)) {
      await advancedCostManager.createScalingTiers(configId, body.scaling_tiers);
    }

    // Récupérer configuration mise à jour
    const updatedConfig = await query(`
      SELECT * FROM cost_configuration_advanced WHERE id = $1
    `, [configId]);

    return NextResponse.json({
      success: true,
      configuration: updatedConfig.rows[0],
      message: 'Configuration updated successfully'
    });

  } catch (error: any) {
    console.error('Error updating cost configuration:', error);
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
    const configId = params.id;

    // Vérifier permissions
    const userGlobalRole = await getUserGlobalRole(userId);
    
    let accessQuery = `
      SELECT workspace_id FROM cost_configuration_advanced WHERE id = $1
    `;
    const queryParams = [configId];

    if (userGlobalRole?.global_role !== 'super_admin') {
      accessQuery += ` AND workspace_id IN (
        SELECT DISTINCT emp.project_id 
        FROM pype_voice_email_project_mapping epm
        INNER JOIN pype_voice_users u ON u.email = epm.email
        WHERE u.user_id = $2 AND epm.is_active = true
      )`;
      queryParams.push(userId);
    }

    const accessResult = await query(accessQuery, queryParams);

    if (accessResult.rows.length === 0) {
      return NextResponse.json({ error: 'Configuration not found or access denied' }, { status: 404 });
    }

    const workspaceId = accessResult.rows[0].workspace_id;

    // Vérifier permissions suppression (owner seulement)
    if (userGlobalRole?.global_role !== 'super_admin') {
      const permissionCheck = await query(`
        SELECT epm.role 
        FROM pype_voice_email_project_mapping epm
        INNER JOIN pype_voice_users u ON u.email = epm.email
        WHERE u.user_id = $1 AND epm.project_id = $2 AND epm.is_active = true
      `, [userId, workspaceId]);

      if (permissionCheck.rows.length === 0 || 
          permissionCheck.rows[0].role !== 'owner') {
        return NextResponse.json({ 
          error: 'Owner permissions required to delete configuration' 
        }, { status: 403 });
      }
    }

    // Désactiver plutôt que supprimer (soft delete)
    const result = await query(`
      UPDATE cost_configuration_advanced 
      SET is_active = false, updated_at = NOW()
      WHERE id = $1
    `, [configId]);

    if ((result.rowCount || 0) === 0) {
      return NextResponse.json({ 
        error: 'Failed to delete configuration' 
      }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: 'Configuration deleted successfully'
    });

  } catch (error: any) {
    console.error('Error deleting cost configuration:', error);
    return NextResponse.json(
      { error: 'Internal server error' }, 
      { status: 500 }
    );
  }
}
