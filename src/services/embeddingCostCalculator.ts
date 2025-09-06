import { query } from '@/lib/db';
import { Buffer } from 'buffer';

// Interface pour le résultat de calcul d'embedding
export interface EmbeddingCostResult {
  total_tokens: number;
  chunk_count: number;
  embedding_model: string;
  cost_per_token: number;
  total_cost: number;
  estimated_processing_time_seconds: number;
}

// Estimer la longueur de texte depuis différents types de fichiers
export async function estimateTextLength(fileBuffer: Buffer, mimeType: string): Promise<number> {
  try {
    switch (mimeType) {
      case 'application/pdf':
        return await extractTextFromPDF(fileBuffer);
      
      case 'text/plain':
      case 'text/markdown':
        return fileBuffer.toString('utf-8').length;
      
      case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
      case 'application/msword':
        // Estimation approximative pour les documents Word
        return Math.floor(fileBuffer.length * 0.6); // ~60% du contenu est du texte
      
      default:
        // Fallback : essayer en tant que texte
        return fileBuffer.toString('utf-8').length;
    }
  } catch (error) {
    console.error('Error estimating text length:', error);
    // Fallback estimation basée sur la taille du fichier
    return Math.floor(fileBuffer.length * 0.5);
  }
}

// Extraire texte depuis PDF (estimation simple)
async function extractTextFromPDF(pdfBuffer: Buffer): Promise<number> {
  try {
    // Estimation simple : ~30% du PDF est du texte extractible
    // Cette estimation peut être affinée avec une vraie lib PDF plus tard
    return Math.floor(pdfBuffer.length * 0.3);
  } catch (error) {
    console.error('PDF estimation error:', error);
    return Math.floor(pdfBuffer.length * 0.25); // Fallback plus conservateur
  }
}

// Calculer le coût d'embedding pour une KB
export async function calculateEmbeddingCost(
  kbId: string, 
  totalTokens: number
): Promise<EmbeddingCostResult> {
  try {
    // Récupérer configuration KB
    const kbResult = await query(`
      SELECT 
        embedding_model, 
        chunk_size, 
        cost_overrides,
        workspace_id
      FROM pype_voice_knowledge_bases 
      WHERE id = $1
    `, [kbId]);

    if (kbResult.rows.length === 0) {
      throw new Error('Knowledge base not found');
    }

    const kb = kbResult.rows[0];
    const embeddingModel = kb.embedding_model || 'text-embedding-ada-002';
    const chunkSize = kb.chunk_size || 1000;

    // Calculer nombre de chunks
    const chunkCount = Math.ceil(totalTokens / (chunkSize / 4)); // ~4 chars par token

    // Récupérer tarif embedding depuis cost_overrides ou settings globaux
    let costPerToken = 0.0001; // Défaut text-embedding-ada-002

    // Vérifier overrides KB
    if (kb.cost_overrides && typeof kb.cost_overrides === 'object') {
      const overrides = kb.cost_overrides as any;
      if (overrides.embedding_price_per_token) {
        costPerToken = parseFloat(overrides.embedding_price_per_token);
      }
    }

    // Si pas d'override, récupérer depuis settings globaux
    if (costPerToken === 0.0001) {
      const settingsResult = await query(`
        SELECT value FROM settings_global 
        WHERE key = 'pricing_rates_pag'
      `);

      if (settingsResult.rows.length > 0) {
        const pricingRates = settingsResult.rows[0].value;
        if (pricingRates && typeof pricingRates === 'object') {
          const rates = pricingRates as any;
          
          // Chercher tarif spécifique au modèle
          const modelKey = embeddingModel.replace(/-/g, '_') + '_per_token';
          if (rates[modelKey]) {
            costPerToken = parseFloat(rates[modelKey]);
          } else if (rates.embedding_default_per_token) {
            costPerToken = parseFloat(rates.embedding_default_per_token);
          }
        }
      }
    }

    const totalCost = totalTokens * costPerToken;
    const estimatedProcessingTime = Math.ceil(totalTokens / 1000) * 2; // ~2s par 1000 tokens

    return {
      total_tokens: totalTokens,
      chunk_count: chunkCount,
      embedding_model: embeddingModel,
      cost_per_token: costPerToken,
      total_cost: totalCost,
      estimated_processing_time_seconds: estimatedProcessingTime
    };

  } catch (error) {
    console.error('Error calculating embedding cost:', error);
    
    // Fallback avec tarifs par défaut
    const costPerToken = 0.0001;
    const chunkCount = Math.ceil(totalTokens / 250);
    
    return {
      total_tokens: totalTokens,
      chunk_count: chunkCount,
      embedding_model: 'text-embedding-ada-002',
      cost_per_token: costPerToken,
      total_cost: totalTokens * costPerToken,
      estimated_processing_time_seconds: Math.ceil(totalTokens / 1000) * 2
    };
  }
}

// Enregistrer métriques d'embedding dans kb_usage_metrics
export async function recordEmbeddingMetrics(
  kbId: string,
  embeddingResult: EmbeddingCostResult,
  fileId: string
): Promise<boolean> {
  try {
    await query(`
      INSERT INTO kb_usage_metrics (
        kb_id, 
        usage_date,
        embedding_tokens_created,
        new_vectors_created,
        embedding_cost
      ) VALUES ($1, CURRENT_DATE, $2, $3, $4)
      ON CONFLICT (kb_id, usage_date) DO UPDATE SET
        embedding_tokens_created = kb_usage_metrics.embedding_tokens_created + EXCLUDED.embedding_tokens_created,
        new_vectors_created = kb_usage_metrics.new_vectors_created + EXCLUDED.new_vectors_created,
        embedding_cost = kb_usage_metrics.embedding_cost + EXCLUDED.embedding_cost
    `, [
      kbId,
      embeddingResult.total_tokens,
      embeddingResult.chunk_count,
      embeddingResult.total_cost
    ]);

    return true;
  } catch (error) {
    console.error('Error recording embedding metrics:', error);
    return false;
  }
}

// Estimer le coût avant upload (pour validation)
export async function estimateFileProcessingCost(
  kbId: string,
  fileSize: number,
  mimeType: string
): Promise<EmbeddingCostResult> {
  // Estimation rapide basée sur la taille du fichier
  let estimatedTextLength: number;
  
  switch (mimeType) {
    case 'application/pdf':
      estimatedTextLength = Math.floor(fileSize * 0.3); // ~30% du PDF est du texte
      break;
    case 'text/plain':
    case 'text/markdown':
      estimatedTextLength = fileSize;
      break;
    case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
    case 'application/msword':
      estimatedTextLength = Math.floor(fileSize * 0.6); // ~60% est du texte
      break;
    default:
      estimatedTextLength = Math.floor(fileSize * 0.5);
  }

  const estimatedTokens = Math.ceil(estimatedTextLength / 4); // ~4 chars par token
  
  return await calculateEmbeddingCost(kbId, estimatedTokens);
}
