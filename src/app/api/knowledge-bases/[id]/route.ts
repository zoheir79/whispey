import { NextRequest, NextResponse } from 'next/server'
import { verifyUserAuth } from '@/lib/auth'
import { getUserGlobalRole } from '@/services/getGlobalRole'
import { query } from '@/lib/db'

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
    const kbId = params.id;

    // Vérifier permissions et récupérer KB
    const userGlobalRole = await getUserGlobalRole(userId);
    
    let kbQuery = `
      SELECT kb.*, u.email as created_by_email, p.name as workspace_name,
             p.s3_enabled, p.s3_region, p.s3_endpoint, p.s3_access_key, p.s3_secret_key, kb.s3_bucket_name
      FROM pype_voice_knowledge_bases kb
      LEFT JOIN pype_voice_users u ON u.user_id = kb.created_by
      LEFT JOIN pype_voice_projects p ON p.id = kb.workspace_id
      WHERE kb.id = $1
    `;

    if (userGlobalRole?.global_role !== 'super_admin') {
      kbQuery += `
        AND kb.workspace_id IN (
          SELECT DISTINCT epm.project_id 
          FROM pype_voice_email_project_mapping epm
          INNER JOIN pype_voice_users auth_user ON auth_user.email = epm.email
          WHERE auth_user.user_id = $2 AND epm.is_active = true
        )
      `;
    }

    const kbResult = await query(
      kbQuery, 
      userGlobalRole?.global_role === 'super_admin' ? [kbId] : [kbId, userId]
    );

    if (kbResult.rows.length === 0) {
      return NextResponse.json({ error: 'Knowledge base not found' }, { status: 404 });
    }

    const kb = kbResult.rows[0];

    // Récupérer statistiques fichiers
    const fileStats = await query(`
      SELECT 
        COUNT(*) as total_files,
        SUM(file_size_bytes) as total_size_bytes,
        SUM(chunks_count) as total_chunks,
        SUM(vectors_count) as total_vectors
      FROM kb_files 
      WHERE kb_id = $1
    `, [kbId]);

    // Récupérer métriques récentes
    const recentMetrics = await query(`
      SELECT 
        usage_date,
        SUM(search_queries) as daily_searches,
        SUM(search_tokens_used) as daily_tokens,
        SUM(search_cost + embedding_cost + storage_cost) as daily_cost
      FROM kb_usage_metrics 
      WHERE kb_id = $1 AND usage_date >= CURRENT_DATE - INTERVAL '7 days'
      GROUP BY usage_date
      ORDER BY usage_date DESC
    `, [kbId]);

    return NextResponse.json({
      knowledge_base: kb,
      statistics: fileStats.rows[0],
      recent_metrics: recentMetrics.rows
    });

  } catch (error: any) {
    console.error('Error fetching knowledge base:', error);
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
    const kbId = params.id;
    const body = await request.json();

    // Vérifier permissions
    const userGlobalRole = await getUserGlobalRole(userId);
    
    if (userGlobalRole?.global_role !== 'super_admin') {
      const kbAccess = await query(`
        SELECT kb.workspace_id, epm.role 
        FROM pype_voice_knowledge_bases kb
        INNER JOIN pype_voice_email_project_mapping epm ON epm.project_id = kb.workspace_id
        INNER JOIN pype_voice_users u ON u.email = epm.email
        WHERE kb.id = $1 AND u.user_id = $2 AND epm.is_active = true
      `, [kbId, userId]);

      if (kbAccess.rows.length === 0 || 
          !['member', 'admin', 'owner'].includes(kbAccess.rows[0].role)) {
        return NextResponse.json({ error: 'Access denied' }, { status: 403 });
      }
    }

    // Préparer les champs à mettre à jour
    const allowedFields = [
      'name', 'description', 'platform_mode', 'billing_cycle', 'cost_overrides',
      'embedding_model', 'vector_dimensions', 'chunk_size', 'chunk_overlap',
      'search_similarity_threshold', 'max_search_results', 'is_active'
    ];

    const updates = [];
    const values = [];
    let paramIndex = 1;

    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        if (field === 'cost_overrides') {
          updates.push(`${field} = $${paramIndex}`);
          values.push(JSON.stringify(body[field]));
        } else {
          updates.push(`${field} = $${paramIndex}`);
          values.push(body[field]);
        }
        paramIndex++;
      }
    }

    if (updates.length === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
    }

    // Mettre à jour
    values.push(kbId);
    const result = await query(`
      UPDATE pype_voice_knowledge_bases 
      SET ${updates.join(', ')}, updated_at = NOW()
      WHERE id = $${paramIndex}
      RETURNING *
    `, values);

    return NextResponse.json({
      success: true,
      knowledge_base: result.rows[0]
    });

  } catch (error: any) {
    console.error('Error updating knowledge base:', error);
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
    const kbId = params.id;

    // Vérifier permissions
    const userGlobalRole = await getUserGlobalRole(userId);
    
    if (userGlobalRole?.global_role !== 'super_admin') {
      const kbAccess = await query(`
        SELECT kb.workspace_id, epm.role 
        FROM pype_voice_knowledge_bases kb
        INNER JOIN pype_voice_email_project_mapping epm ON epm.project_id = kb.workspace_id
        INNER JOIN pype_voice_users u ON u.email = epm.email
        WHERE kb.id = $1 AND u.user_id = $2 AND epm.is_active = true
      `, [kbId, userId]);

      if (kbAccess.rows.length === 0 || 
          !['admin', 'owner'].includes(kbAccess.rows[0].role)) {
        return NextResponse.json({ 
          error: 'Admin permissions required to delete knowledge bases' 
        }, { status: 403 });
      }
    }

    // Vérifier si utilisée par des agents
    const agentUsage = await query(`
      SELECT COUNT(*) as count FROM pype_voice_agents 
      WHERE associated_kb_id = $1
    `, [kbId]);

    if (parseInt(agentUsage.rows[0].count) > 0) {
      return NextResponse.json({ 
        error: 'Cannot delete knowledge base: still associated with agents' 
      }, { status: 409 });
    }

    // Supprimer (CASCADE supprimera fichiers et métriques)
    await query(`DELETE FROM pype_voice_knowledge_bases WHERE id = $1`, [kbId]);

    return NextResponse.json({
      success: true,
      message: 'Knowledge base deleted successfully'
    });

  } catch (error: any) {
    console.error('Error deleting knowledge base:', error);
    return NextResponse.json(
      { error: 'Internal server error' }, 
      { status: 500 }
    );
  }
}
