import { NextRequest, NextResponse } from 'next/server'
import { verifyUserAuth } from '@/lib/auth'
import { getUserGlobalRole } from '@/services/getGlobalRole'
import { query } from '@/lib/db'

export async function GET(request: NextRequest) {
  try {
    const { isAuthenticated, userId } = await verifyUserAuth(request);
    
    if (!isAuthenticated || !userId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const workspaceId = searchParams.get('workspace_id');

    // Vérifier permissions
    const userGlobalRole = await getUserGlobalRole(userId);
    
    let knowledgeBases;
    
    if (userGlobalRole?.global_role === 'super_admin') {
      // Super admin peut voir toutes les KB
      if (workspaceId) {
        knowledgeBases = await query(`
          SELECT kb.*, u.email as created_by_email
          FROM pype_voice_knowledge_bases kb
          LEFT JOIN pype_voice_users u ON u.user_id = kb.created_by
          WHERE kb.workspace_id = $1
          ORDER BY kb.created_at DESC
        `, [workspaceId]);
      } else {
        knowledgeBases = await query(`
          SELECT kb.*, u.email as created_by_email, p.name as workspace_name
          FROM pype_voice_knowledge_bases kb
          LEFT JOIN pype_voice_users u ON u.user_id = kb.created_by
          LEFT JOIN pype_voice_projects p ON p.id = kb.workspace_id
          ORDER BY kb.created_at DESC
        `);
      }
    } else {
      // Utilisateurs normaux - seulement leurs workspaces
      const baseQuery = `
        SELECT kb.*, u.email as created_by_email
        FROM pype_voice_knowledge_bases kb
        LEFT JOIN pype_voice_users u ON u.user_id = kb.created_by
        INNER JOIN pype_voice_email_project_mapping epm ON epm.project_id = kb.workspace_id
        INNER JOIN pype_voice_users auth_user ON auth_user.email = epm.email
        WHERE auth_user.user_id = $1 AND epm.is_active = true
      `;

      if (workspaceId) {
        knowledgeBases = await query(baseQuery + ` AND kb.workspace_id = $2 ORDER BY kb.created_at DESC`, [userId, workspaceId]);
      } else {
        knowledgeBases = await query(baseQuery + ` ORDER BY kb.created_at DESC`, [userId]);
      }
    }

    return NextResponse.json({
      knowledge_bases: knowledgeBases.rows,
      count: knowledgeBases.rows.length
    });

  } catch (error) {
    console.error('Error fetching knowledge bases:', error);
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
      name,
      description,
      platform_mode = 'pag',
      billing_cycle = 'monthly',
      cost_overrides = {},
      embedding_model = 'text-embedding-ada-002',
      vector_dimensions = 1536,
      chunk_size = 1000,
      chunk_overlap = 200,
      search_similarity_threshold = 0.80,
      max_search_results = 10
    } = body;

    if (!workspace_id || !name) {
      return NextResponse.json({ 
        error: 'workspace_id and name are required' 
      }, { status: 400 });
    }

    // Vérifier permissions workspace
    const userGlobalRole = await getUserGlobalRole(userId);
    
    if (userGlobalRole?.global_role !== 'super_admin') {
      const workspaceAccess = await query(`
        SELECT role FROM pype_voice_email_project_mapping epm
        INNER JOIN pype_voice_users u ON u.email = epm.email
        WHERE u.user_id = $1 AND epm.project_id = $2 AND epm.is_active = true
      `, [userId, workspace_id]);

      if (workspaceAccess.rows.length === 0 || 
          !['member', 'admin', 'owner'].includes(workspaceAccess.rows[0].role)) {
        return NextResponse.json({ 
          error: 'Member permissions required to create knowledge bases' 
        }, { status: 403 });
      }
    }

    // Créer Knowledge Base
    const result = await query(`
      INSERT INTO pype_voice_knowledge_bases (
        workspace_id, name, description, platform_mode, billing_cycle,
        cost_overrides, embedding_model, vector_dimensions, chunk_size,
        chunk_overlap, search_similarity_threshold, max_search_results, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      RETURNING *
    `, [
      workspace_id, name, description, platform_mode, billing_cycle,
      JSON.stringify(cost_overrides), embedding_model, vector_dimensions,
      chunk_size, chunk_overlap, search_similarity_threshold, max_search_results, userId
    ]);

    const newKB = result.rows[0];

    // Créer bucket S3 pour cette KB
    const { s3Manager } = await import('@/services/s3Manager');
    await s3Manager.initialize();
    const bucketCreated = await s3Manager.createBucketForKB(newKB.id, workspace_id);
    
    if (bucketCreated) {
      // Mettre à jour avec le nom du bucket généré
      const bucketName = `whispey-kb-${newKB.id}-${workspace_id}`.toLowerCase();
      await query(`
        UPDATE pype_voice_knowledge_bases 
        SET s3_bucket_name = $1, s3_region = 'us-east-1'
        WHERE id = $2
      `, [bucketName, newKB.id]);
      
      newKB.s3_bucket_name = bucketName;
    }

    // Initialiser compte crédits pour ce workspace si nécessaire
    try {
      await query(`
        INSERT INTO user_credits (workspace_id, user_id, current_balance, currency, is_active)
        VALUES ($1, $2, 0, 'USD', true)
      `, [workspace_id, userId]);
    } catch (creditError: any) {
      // Ignore si les crédits existent déjà ou si la table n'existe pas
      console.log('Credit initialization skipped:', creditError.message);
    }

    return NextResponse.json({
      success: true,
      knowledge_base: result.rows[0]
    }, { status: 201 });

  } catch (error: any) {
    console.error('Error creating knowledge base:', error);
    
    if (error.code === '23505') { // Duplicate key
      return NextResponse.json(
        { error: 'Knowledge base with this name already exists in workspace' }, 
        { status: 409 }
      );
    }
    
    return NextResponse.json(
      { error: 'Internal server error' }, 
      { status: 500 }
    );
  }
}
