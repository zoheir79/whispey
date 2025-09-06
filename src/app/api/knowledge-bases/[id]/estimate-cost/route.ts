import { NextRequest, NextResponse } from 'next/server'
import { verifyUserAuth } from '@/lib/auth'
import { getUserGlobalRole } from '@/services/getGlobalRole'
import { query } from '@/lib/db'
import { estimateFileProcessingCost } from '@/services/embeddingCostCalculator'

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

    const body = await request.json();
    const { files } = body;

    // Validation
    if (!files || !Array.isArray(files) || files.length === 0) {
      return NextResponse.json({ 
        error: 'files array is required with at least one file' 
      }, { status: 400 });
    }

    // Vérifier que la KB existe
    const kbResult = await query(`
      SELECT 
        kb.*,
        uc.current_balance,
        uc.currency
      FROM pype_voice_knowledge_bases kb
      LEFT JOIN user_credits uc ON uc.workspace_id = kb.workspace_id AND uc.is_active = true
      WHERE kb.id = $1
    `, [kbId]);

    if (kbResult.rows.length === 0) {
      return NextResponse.json({ error: 'Knowledge base not found' }, { status: 404 });
    }

    const kb = kbResult.rows[0];
    const currentBalance = kb.current_balance || 0;

    let totalEstimatedCost = 0;
    const fileEstimations = [];

    // Traiter chaque fichier pour estimation
    for (const file of files) {
      const { name, size, type } = file;

      // Validation du fichier
      if (!name || !size || !type) {
        return NextResponse.json({ 
          error: `File missing required properties: name, size, type` 
        }, { status: 400 });
      }

      const allowedTypes = [
        'application/pdf', 
        'text/plain', 
        'text/markdown',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/msword'
      ];

      if (!allowedTypes.includes(type)) {
        return NextResponse.json({ 
          error: `File type ${type} not supported for file ${name}` 
        }, { status: 400 });
      }

      // Vérifier la taille (max 50MB)
      const maxSize = 50 * 1024 * 1024; // 50MB
      if (size > maxSize) {
        return NextResponse.json({ 
          error: `File ${name} too large. Maximum size is 50MB` 
        }, { status: 400 });
      }

      try {
        // Estimer coût d'embedding pour ce fichier
        const estimation = await estimateFileProcessingCost(kbId, size, type);
        
        totalEstimatedCost += estimation.total_cost;
        
        fileEstimations.push({
          filename: name,
          filesize_bytes: size,
          mime_type: type,
          estimated_tokens: estimation.total_tokens,
          estimated_chunks: estimation.chunk_count,
          embedding_model: estimation.embedding_model,
          cost_per_token: estimation.cost_per_token,
          estimated_cost: estimation.total_cost,
          processing_time_seconds: estimation.estimated_processing_time_seconds
        });

      } catch (error) {
        console.error(`Error estimating cost for file ${name}:`, error);
        return NextResponse.json({ 
          error: `Failed to estimate cost for file ${name}` 
        }, { status: 500 });
      }
    }

    // Vérifier si les crédits sont suffisants
    const hasSufficientCredits = currentBalance >= totalEstimatedCost;
    const creditShortfall = hasSufficientCredits ? 0 : totalEstimatedCost - currentBalance;

    return NextResponse.json({
      success: true,
      kb_id: kbId,
      kb_name: kb.name,
      current_credit_balance: currentBalance,
      currency: kb.currency || 'USD',
      file_count: files.length,
      total_estimated_cost: totalEstimatedCost,
      has_sufficient_credits: hasSufficientCredits,
      credit_shortfall: creditShortfall,
      files: fileEstimations,
      cost_breakdown: {
        total_files: files.length,
        total_tokens: fileEstimations.reduce((sum, f) => sum + f.estimated_tokens, 0),
        total_chunks: fileEstimations.reduce((sum, f) => sum + f.estimated_chunks, 0),
        average_cost_per_token: fileEstimations.length > 0 ? 
          fileEstimations.reduce((sum, f) => sum + f.cost_per_token, 0) / fileEstimations.length : 0,
        total_processing_time_seconds: fileEstimations.reduce((sum, f) => sum + f.processing_time_seconds, 0)
      },
      can_proceed: hasSufficientCredits,
      message: hasSufficientCredits ? 
        'Sufficient credits available for processing' : 
        `Insufficient credits. Need additional $${creditShortfall.toFixed(4)}`
    });

  } catch (error: any) {
    console.error('Error estimating KB file costs:', error);
    return NextResponse.json(
      { error: 'Internal server error' }, 
      { status: 500 }
    );
  }
}

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

    // Récupérer tarifs actuels pour cette KB
    const kbResult = await query(`
      SELECT 
        kb.*,
        uc.current_balance,
        uc.currency
      FROM pype_voice_knowledge_bases kb
      LEFT JOIN user_credits uc ON uc.workspace_id = kb.workspace_id AND uc.is_active = true
      WHERE kb.id = $1
    `, [kbId]);

    if (kbResult.rows.length === 0) {
      return NextResponse.json({ error: 'Knowledge base not found' }, { status: 404 });
    }

    const kb = kbResult.rows[0];

    // Récupérer tarifs embedding
    let embeddingRate = 0.0001; // Défaut
    const embeddingModel = kb.embedding_model || 'text-embedding-ada-002';

    // Vérifier overrides KB
    if (kb.cost_overrides && typeof kb.cost_overrides === 'object') {
      const overrides = kb.cost_overrides as any;
      if (overrides.embedding_price_per_token) {
        embeddingRate = parseFloat(overrides.embedding_price_per_token);
      }
    }

    // Si pas d'override, récupérer depuis settings globaux
    if (embeddingRate === 0.0001) {
      const settingsResult = await query(`
        SELECT value FROM settings_global WHERE key = 'pricing_rates_pag'
      `);

      if (settingsResult.rows.length > 0) {
        const pricingRates = settingsResult.rows[0].value;
        if (pricingRates && typeof pricingRates === 'object') {
          const rates = pricingRates as any;
          const modelKey = embeddingModel.replace(/-/g, '_') + '_per_token';
          if (rates[modelKey]) {
            embeddingRate = parseFloat(rates[modelKey]);
          } else if (rates.embedding_default_per_token) {
            embeddingRate = parseFloat(rates.embedding_default_per_token);
          }
        }
      }
    }

    return NextResponse.json({
      success: true,
      kb_id: kbId,
      kb_name: kb.name,
      current_credit_balance: kb.current_balance || 0,
      currency: kb.currency || 'USD',
      embedding_model: embeddingModel,
      chunk_size: kb.chunk_size || 1000,
      pricing: {
        embedding_rate_per_token: embeddingRate,
        currency: kb.currency || 'USD'
      },
      supported_file_types: [
        'application/pdf',
        'text/plain', 
        'text/markdown',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/msword'
      ],
      max_file_size_mb: 50,
      estimation_notes: {
        pdf: "~30% of file size estimated as extractable text",
        text: "Full file size counted as text",
        doc: "~60% of file size estimated as text content"
      }
    });

  } catch (error: any) {
    console.error('Error getting cost estimation info:', error);
    return NextResponse.json(
      { error: 'Internal server error' }, 
      { status: 500 }
    );
  }
}
