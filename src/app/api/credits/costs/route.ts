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
    const { 
      service_type, 
      service_id, 
      usage_metrics, 
      cycle_start, 
      cycle_end 
    } = body;

    if (!service_type || !service_id) {
      return NextResponse.json({ 
        error: 'service_type and service_id are required' 
      }, { status: 400 });
    }

    if (!['agent', 'knowledge_base', 'workflow'].includes(service_type)) {
      return NextResponse.json({ 
        error: 'Invalid service_type. Must be agent, knowledge_base, or workflow' 
      }, { status: 400 });
    }

    // Vérifier permissions - l'utilisateur doit avoir accès au service
    const userGlobalRole = await getUserGlobalRole(userId);
    
    if (userGlobalRole?.global_role !== 'super_admin') {
      const { query } = await import('@/lib/db');
      
      let accessQuery = '';
      let tableName = '';
      
      switch (service_type) {
        case 'agent':
          tableName = 'pype_voice_agents';
          accessQuery = `
            SELECT a.project_id 
            FROM pype_voice_agents a
            INNER JOIN pype_voice_email_project_mapping epm ON epm.project_id = a.project_id
            INNER JOIN pype_voice_users u ON u.email = epm.email
            WHERE a.id = $1 AND u.user_id = $2 AND epm.is_active = true
          `;
          break;
        case 'knowledge_base':
          tableName = 'pype_voice_knowledge_bases';
          accessQuery = `
            SELECT kb.workspace_id as project_id
            FROM pype_voice_knowledge_bases kb
            INNER JOIN pype_voice_email_project_mapping epm ON epm.project_id = kb.workspace_id
            INNER JOIN pype_voice_users u ON u.email = epm.email
            WHERE kb.id = $1 AND u.user_id = $2 AND epm.is_active = true
          `;
          break;
        case 'workflow':
          tableName = 'pype_voice_workflows';
          accessQuery = `
            SELECT w.workspace_id as project_id
            FROM pype_voice_workflows w
            INNER JOIN pype_voice_email_project_mapping epm ON epm.project_id = w.workspace_id
            INNER JOIN pype_voice_users u ON u.email = epm.email
            WHERE w.id = $1 AND u.user_id = $2 AND epm.is_active = true
          `;
          break;
      }

      try {
        const serviceAccess = await query(accessQuery, [service_id, userId]);
        if (serviceAccess.rows.length === 0) {
          return NextResponse.json({ error: 'Service not found or access denied' }, { status: 404 });
        }
      } catch (dbError) {
        // Si table n'existe pas encore (KB/Workflow), retourner erreur appropriée
        return NextResponse.json({ error: `${service_type} service not available yet` }, { status: 404 });
      }
    }

    // Calculer coûts
    const costResult = await creditManager.calculateServiceCost(
      service_type as 'agent' | 'knowledge_base' | 'workflow',
      service_id,
      usage_metrics,
      cycle_start ? new Date(cycle_start) : undefined,
      cycle_end ? new Date(cycle_end) : undefined
    );

    return NextResponse.json({
      service_type,
      service_id,
      cost_calculation: costResult,
      calculated_at: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error calculating service costs:', error);
    return NextResponse.json(
      { error: 'Internal server error' }, 
      { status: 500 }
    );
  }
}
