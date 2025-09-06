import { NextRequest, NextResponse } from 'next/server'
import { verifyUserAuth } from '@/lib/auth'
import { getUserGlobalRole } from '@/services/getGlobalRole'
import { query } from '@/lib/db'
import { s3Manager } from '@/services/s3Manager'

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

    // Vérifier permissions KB
    const userGlobalRole = await getUserGlobalRole(userId);
    
    if (userGlobalRole?.global_role !== 'super_admin') {
      const kbAccess = await query(`
        SELECT kb.workspace_id 
        FROM pype_voice_knowledge_bases kb
        INNER JOIN pype_voice_email_project_mapping epm ON epm.project_id = kb.workspace_id
        INNER JOIN pype_voice_users u ON u.email = epm.email
        WHERE kb.id = $1 AND u.user_id = $2 AND epm.is_active = true
      `, [kbId, userId]);

      if (kbAccess.rows.length === 0) {
        return NextResponse.json({ error: 'Access denied to knowledge base' }, { status: 403 });
      }
    }

    // Récupérer fichiers KB
    const files = await query(`
      SELECT 
        kf.*,
        u.email as uploaded_by_email
      FROM kb_files kf
      LEFT JOIN pype_voice_users u ON u.user_id = kf.created_by
      WHERE kf.kb_id = $1
      ORDER BY kf.uploaded_at DESC
    `, [kbId]);

    return NextResponse.json({
      kb_id: kbId,
      files: files.rows,
      count: files.rows.length
    });

  } catch (error: any) {
    console.error('Error fetching KB files:', error);
    return NextResponse.json(
      { error: 'Internal server error' }, 
      { status: 500 }
    );
  }
}

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
    const kbId = params.id;

    // Vérifier permissions KB
    const userGlobalRole = await getUserGlobalRole(userId);
    
    if (userGlobalRole?.global_role !== 'super_admin') {
      const kbAccess = await query(`
        SELECT kb.workspace_id, epm.role 
        FROM pype_voice_knowledge_bases kb
        INNER JOIN pype_voice_email_project_mapping epm ON epm.project_id = kb.workspace_id
        INNER JOIN pype_voice_users u ON u.email = emp.email
        WHERE kb.id = $1 AND u.user_id = $2 AND epm.is_active = true
      `, [kbId, userId]);

      if (kbAccess.rows.length === 0 || 
          !['member', 'admin', 'owner'].includes(kbAccess.rows[0].role)) {
        return NextResponse.json({ 
          error: 'Member permissions required to upload files' 
        }, { status: 403 });
      }
    }

    // Vérifier que la KB existe et récupérer ses informations
    const kbResult = await query(`
      SELECT * FROM pype_voice_knowledge_bases WHERE id = $1
    `, [kbId]);

    if (kbResult.rows.length === 0) {
      return NextResponse.json({ error: 'Knowledge base not found' }, { status: 404 });
    }

    const kb = kbResult.rows[0];

    // Parse form data
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const metadata = formData.get('metadata') ? JSON.parse(formData.get('metadata') as string) : {};

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    // Vérifier le type de fichier
    const allowedTypes = [
      'application/pdf', 
      'text/plain', 
      'text/markdown',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/msword'
    ];

    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json({ 
        error: 'File type not supported. Allowed: PDF, TXT, MD, DOC, DOCX' 
      }, { status: 400 });
    }

    // Vérifier la taille (max 50MB)
    const maxSize = 50 * 1024 * 1024; // 50MB
    if (file.size > maxSize) {
      return NextResponse.json({ 
        error: 'File too large. Maximum size is 50MB' 
      }, { status: 400 });
    }

    // Initialiser S3Manager si nécessaire avec la config du workspace
    if (!(await s3Manager.initialize(kb.workspace_id))) {
      return NextResponse.json({ 
        error: 'S3 storage not configured' 
      }, { status: 500 });
    }

    // Créer bucket S3 pour cette KB si pas encore fait
    let bucketName = kb.s3_bucket_name;
    if (!bucketName) {
      const bucketCreated = await s3Manager.createBucketForKB(kbId, kb.workspace_id);
      if (!bucketCreated) {
        return NextResponse.json({ 
          error: 'Failed to create S3 bucket for KB' 
        }, { status: 500 });
      }
      
      // Générer nom du bucket et mettre à jour la KB
      const prefix = 'whispey-'; // Devrait venir de la config
      bucketName = `${prefix}kb-${kbId}-${kb.workspace_id}`.toLowerCase();
      
      await query(`
        UPDATE pype_voice_knowledge_bases 
        SET s3_bucket_name = $1, s3_region = $2 
        WHERE id = $3
      `, [bucketName, 'us-east-1', kbId]);
    }

    // Upload vers S3
    const fileBuffer = Buffer.from(await file.arrayBuffer());
    const fileName = `${Date.now()}-${file.name}`;
    
    const uploadResult = await s3Manager.uploadKBFile(
      bucketName, 
      fileName, 
      fileBuffer, 
      file.type
    );

    if (!uploadResult.success) {
      return NextResponse.json({ 
        error: 'Failed to upload file to storage' 
      }, { status: 500 });
    }

    // Calculer coût d'embedding estimé
    const { estimateTextLength, calculateEmbeddingCost, recordEmbeddingMetrics } = await import('@/services/embeddingCostCalculator');
    
    const textLength = await estimateTextLength(fileBuffer, file.type);
    const chunkCount = Math.ceil(textLength / 1000); // Chunks de 1000 chars
    const tokensPerChunk = Math.ceil(1000 / 4); // ~250 tokens par chunk
    const totalTokens = chunkCount * tokensPerChunk;
    
    // Récupérer tarif embedding depuis KB config ou settings globaux
    const embeddingCost = await calculateEmbeddingCost(kbId, totalTokens);

    // Déduire coût d'embedding immédiatement
    const { creditManager } = await import('@/services/creditManager');
    const deductionResult = await creditManager.deductCredits({
      workspace_id: kb.workspace_id,
      amount: embeddingCost.total_cost,
      description: `KB file embedding: ${file.name} (${totalTokens} tokens)`,
      service_type: 'knowledge_base',
      service_id: kbId
    });

    if (!deductionResult.success) {
      return NextResponse.json({ 
        error: `Insufficient credits for embedding. Required: $${embeddingCost.total_cost}, Available: $${deductionResult.previous_balance || 0}` 
      }, { status: 402 }); // Payment Required
    }

    // Enregistrer métriques d'embedding
    await recordEmbeddingMetrics(kbId, embeddingCost, 'temp-file-id');

    // Enregistrer métadonnées du fichier en base avec coûts
    const fileRecord = await query(`
      INSERT INTO kb_files (
        kb_id, filename, original_filename, file_type, file_size_bytes,
        mime_type, s3_key, s3_bucket, s3_etag, metadata, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING *
    `, [
      kbId, fileName, file.name, file.type, file.size,
      file.type, fileName, bucketName, 'uploaded', 
      JSON.stringify({
        ...metadata,
        estimated_chunks: chunkCount,
        estimated_tokens: totalTokens,
        embedding_cost: embeddingCost.total_cost,
        credits_deducted: deductionResult.amount_deducted
      }), userId
    ]);

    // Mettre à jour les statistiques de la KB
    await query(`
      UPDATE pype_voice_knowledge_bases 
      SET 
        total_files = total_files + 1,
        storage_used_mb = storage_used_mb + $1,
        updated_at = NOW()
      WHERE id = $2
    `, [file.size / (1024 * 1024), kbId]);

    return NextResponse.json({
      success: true,
      file: fileRecord.rows[0],
      upload_url: uploadResult.url,
      message: 'File uploaded successfully'
    }, { status: 201 });

  } catch (error: any) {
    console.error('Error uploading KB file:', error);
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
    
    const { searchParams } = new URL(request.url);
    const fileId = searchParams.get('file_id');

    if (!fileId) {
      return NextResponse.json({ error: 'file_id is required' }, { status: 400 });
    }

    // Vérifier permissions
    const userGlobalRole = await getUserGlobalRole(userId);
    
    if (userGlobalRole?.global_role !== 'super_admin') {
      const fileAccess = await query(`
        SELECT kf.*, kb.workspace_id, epm.role
        FROM kb_files kf
        INNER JOIN pype_voice_knowledge_bases kb ON kb.id = kf.kb_id
        INNER JOIN pype_voice_email_project_mapping epm ON epm.project_id = kb.workspace_id
        INNER JOIN pype_voice_users u ON u.email = epm.email
        WHERE kf.id = $1 AND kf.kb_id = $2 AND u.user_id = $3 AND epm.is_active = true
      `, [fileId, kbId, userId]);

      if (fileAccess.rows.length === 0 || 
          !['admin', 'owner'].includes(fileAccess.rows[0].role)) {
        return NextResponse.json({ 
          error: 'Admin permissions required to delete files' 
        }, { status: 403 });
      }
    }

    // Récupérer informations du fichier
    const fileInfo = await query(`
      SELECT * FROM kb_files WHERE id = $1 AND kb_id = $2
    `, [fileId, kbId]);

    if (fileInfo.rows.length === 0) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 });
    }

    const file = fileInfo.rows[0];

    // Supprimer de la base de données
    await query(`DELETE FROM kb_files WHERE id = $1`, [fileId]);

    // Mettre à jour les statistiques de la KB
    await query(`
      UPDATE pype_voice_knowledge_bases 
      SET 
        total_files = GREATEST(total_files - 1, 0),
        storage_used_mb = GREATEST(storage_used_mb - $1, 0),
        updated_at = NOW()
      WHERE id = $2
    `, [file.file_size_bytes / (1024 * 1024), kbId]);

    return NextResponse.json({
      success: true,
      message: 'File deleted successfully'
    });

  } catch (error: any) {
    console.error('Error deleting KB file:', error);
    return NextResponse.json(
      { error: 'Internal server error' }, 
      { status: 500 }
    );
  }
}
