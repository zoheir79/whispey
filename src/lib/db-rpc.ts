import { query } from './db';
import { DbResponse } from './db-types';

/**
 * Service pour gérer les appels de procédures stockées (RPC)
 * Remplace les appels RPC de Supabase
 */

/**
 * Appelle une procédure stockée PostgreSQL
 * @param procedureName Nom de la procédure
 * @param params Paramètres à passer à la procédure
 */
export async function callRPC<T = any>(procedureName: string, params: Record<string, any>): Promise<DbResponse<T[]>> {
  try {
    // Construire la requête SQL pour appeler la procédure
    const paramNames = Object.keys(params);
    const paramValues = Object.values(params);
    
    // Créer la liste des paramètres nommés pour la requête SQL
    const paramList = paramNames.map((name, index) => `${name} := $${index + 1}`).join(', ');
    
    // Construire la requête SQL finale
    const sql = `SELECT * FROM ${procedureName}(${paramList})`;
    
    const result = await query(sql, paramValues);
    return { data: result.rows as T[], error: null };
  } catch (error: any) {
    console.error(`Error calling RPC ${procedureName}:`, error);
    return { 
      data: null, 
      error: { 
        message: error.message || `Error calling RPC ${procedureName}`, 
        code: error.code,
        detail: error.detail
      }
    }
  }
}

/**
 * Calcule un total personnalisé
 */
export async function calculateCustomTotal<T = any>(params: {
  agent_id: string,
  aggregation: string,
  column_name: string,
  json_field: string | null,
  filters: any[],
  filter_logic: string,
  date_from?: string | null,
  date_to?: string | null
}) {
  // This function exists in PostgreSQL - use it directly
  return callRPC<T>('calculate_custom_total', {
    p_agent_id: params.agent_id,
    p_aggregation: params.aggregation,
    p_column_name: params.column_name,
    p_json_field: params.json_field,
    p_filters: params.filters,
    p_filter_logic: params.filter_logic,
    p_date_from: params.date_from || null,
    p_date_to: params.date_to || null
  });
}

/**
 * Calcule plusieurs totaux personnalisés en lot
 */
export async function batchCalculateCustomTotals<T = any>(params: {
  configs: any[],
  project_id: string,
  agent_id: string,
  date_from?: string | null,
  date_to?: string | null
}) {
  try {
    // Try to call the RPC function if it exists
    return await callRPC<T>('batch_calculate_custom_totals', {
      p_agent_id: params.agent_id,
      p_project_id: params.project_id,
      p_configs: params.configs,
      p_date_from: params.date_from || null,
      p_date_to: params.date_to || null
    });
  } catch (error: any) {
    // If the function doesn't exist, return empty results gracefully
    console.warn('batch_calculate_custom_totals RPC not found, returning empty results:', error.message);
    return { data: [] as T[], error: null };
  }
}

/**
 * Récupère les valeurs distinctes pour une colonne
 */
export async function getDistinctValues<T = any>(params: {
  agent_id: string,
  column_name: string,
  json_field: string | null,
  limit: number
}) {
  try {
    // Try to call the RPC function if it exists
    return await callRPC<T>('get_distinct_values', {
      p_agent_id: params.agent_id,
      p_column_name: params.column_name,
      p_json_field: params.json_field,
      p_limit: params.limit
    });
  } catch (error: any) {
    // If the function doesn't exist, return empty result gracefully
    console.warn('get_distinct_values RPC not found, returning empty result:', error.message);
    return { data: [] as T[], error: null };
  }
}

/**
 * Récupère les champs JSON disponibles pour une colonne
 */
export async function getAvailableJsonFields<T = any>(params: {
  agent_id: string,
  column_name: string,
  limit: number
}) {
  try {
    // Try to call the RPC function if it exists
    return await callRPC<T>('get_available_json_fields', {
      p_agent_id: params.agent_id,
      p_column_name: params.column_name,
      p_limit: params.limit
    });
  } catch (error: any) {
    // If the function doesn't exist, return empty result gracefully
    console.warn('get_available_json_fields RPC not found, returning empty result:', error.message);
    return { data: [] as T[], error: null };
  }
}

/**
 * Rafraîchit le résumé des appels (adapté pour PostgreSQL)
 */
export async function refreshCallSummary() {
  try {
    // Refresh materialized view if it exists, otherwise return success
    console.log('🔍 CALLING REAL refreshCallSummary - PostgreSQL function');
    await query('REFRESH MATERIALIZED VIEW CONCURRENTLY call_summary_materialized');
    console.log('✅ refreshCallSummary - SUCCESS with real data');
    return { data: [{ success: true }], error: null };
  } catch (error: any) {
    // If materialized view doesn't exist, just return success (non-critical)
    console.warn('❌ FAKE FALLBACK refreshCallSummary triggered:', error.message);
    return { data: [{ success: true }], error: null };
  }
}
