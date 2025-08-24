import { query } from './db';
import { DbResponse, QueryOptions } from './db-types';

/**
 * Service pour gérer les opérations de base de données
 * Remplace les appels directs à Supabase
 */

// Types déplacés vers db-types.ts

/**
 * Récupère des données d'une table avec filtres et options
 */
export async function fetchFromTable<T = any[]>(options: { table: string } & QueryOptions): Promise<DbResponse<T[]>> {
  const { table, ...queryOptions } = options;
  const { select = '*', filters = [], orderBy, limit, offset } = queryOptions;
  
  // Construire la requête SQL de base
  let sql = `SELECT ${select} FROM ${table}`;
  const params: any[] = [];
  
  // Ajouter les filtres WHERE
  if (filters.length > 0) {
    sql += ' WHERE ';
    const whereClauses = filters.map((filter, index) => {
      params.push(filter.value);
      let operator = '=';
      
      // Convertir les opérateurs Supabase en opérateurs SQL
      switch (filter.operator) {
        case 'eq': operator = '='; break;
        case 'neq': operator = '!='; break;
        case 'gt': operator = '>'; break;
        case 'gte': operator = '>='; break;
        case 'lt': operator = '<'; break;
        case 'lte': operator = '<='; break;
        case 'like': operator = 'LIKE'; break;
        case 'ilike': operator = 'ILIKE'; break;
        default: operator = '=';
      }
      
      return `${filter.column} ${operator} $${index + 1}`;
    });
    
    sql += whereClauses.join(' AND ');
  }
  
  // Ajouter ORDER BY
  if (orderBy) {
    sql += ` ORDER BY ${orderBy.column} ${orderBy.ascending ? 'ASC' : 'DESC'}`;
  }
  
  // Ajouter LIMIT
  if (limit !== undefined) {
    sql += ` LIMIT ${limit}`;
  }
  
  // Ajouter OFFSET
  if (offset !== undefined) {
    sql += ` OFFSET ${offset}`;
  }
  
  try {
    const result = await query(sql, params);
    return { data: result.rows as T[], error: null };
  } catch (error: any) {
    console.error('Database query error:', error);
    return { 
      data: null, 
      error: { 
        message: error.message || 'Database query error', 
        code: error.code,
        detail: error.detail
      }
    }
  }
}

/**
 * Insère des données dans une table
 */
export async function insertIntoTable<T = any>(options: { table: string; data: Record<string, any> }): Promise<DbResponse<T>> {
  const { table, data } = options;
  const columns = Object.keys(data);
  const values = Object.values(data);
  
  const placeholders = values.map((_, i) => `$${i + 1}`).join(', ');
  const sql = `INSERT INTO ${table} (${columns.join(', ')}) VALUES (${placeholders}) RETURNING *`;
  
  try {
    const result = await query(sql, values);
    return { data: result.rows[0] as T, error: null };
  } catch (error: any) {
    console.error('Database insert error:', error);
    return { 
      data: null, 
      error: { 
        message: error.message || 'Database insert error', 
        code: error.code,
        detail: error.detail
      }
    }
  }
}

/**
 * Met à jour des données dans une table
 */
export async function updateTable<T = any>(options: { table: string; data: Record<string, any>; filters: Array<{ column: string; operator: string; value: any }> }): Promise<DbResponse<T>> {
  const { table, data, filters } = options;
  const columns = Object.keys(data);
  const values = Object.values(data);
  
  const setClause = columns.map((col, i) => `${col} = $${i + 1}`).join(', ');
  
  // Construire la clause WHERE à partir des filtres
  let whereClause = '';
  const whereParams: any[] = [];
  
  if (filters && filters.length > 0) {
    const whereParts = filters.map((filter, index) => {
      whereParams.push(filter.value);
      let operator = '=';
      
      // Convertir les opérateurs Supabase en opérateurs SQL
      switch (filter.operator) {
        case 'eq': operator = '='; break;
        case 'neq': operator = '!='; break;
        case 'gt': operator = '>'; break;
        case 'gte': operator = '>='; break;
        case 'lt': operator = '<'; break;
        case 'lte': operator = '<='; break;
        case 'like': operator = 'LIKE'; break;
        case 'ilike': operator = 'ILIKE'; break;
        default: operator = '=';
      }
      
      return `${filter.column} ${operator} $${values.length + index + 1}`;
    });
    
    whereClause = ` WHERE ${whereParts.join(' AND ')}`;
  }
  
  const sql = `UPDATE ${table} SET ${setClause}${whereClause} RETURNING *`;
  
  try {
    const result = await query(sql, [...values, ...whereParams]);
    return { data: result.rows[0] as T, error: null };
  } catch (error: any) {
    console.error('Database update error:', error);
    return { 
      data: null, 
      error: { 
        message: error.message || 'Database update error', 
        code: error.code,
        detail: error.detail
      }
    }
  }
}

/**
 * Supprime des données d'une table
 */
export async function deleteFromTable<T = any>(table: string, whereColumn: string, whereValue: any): Promise<DbResponse<T>> {
  const sql = `DELETE FROM ${table} WHERE ${whereColumn} = $1 RETURNING *`;
  
  try {
    const result = await query(sql, [whereValue]);
    return { data: result.rows[0] as T, error: null };
  } catch (error: any) {
    console.error('Database delete error:', error);
    return { 
      data: null, 
      error: { 
        message: error.message || 'Database delete error', 
        code: error.code,
        detail: error.detail
      }
    }
  }
}

/**
 * Exécute une procédure stockée
 */
export async function callStoredProcedure<T = any>(procedureName: string, params: any[] = []): Promise<DbResponse<T[]>> {
  const placeholders = params.map((_, i) => `$${i + 1}`).join(', ');
  const sql = `CALL ${procedureName}(${placeholders})`;
  
  try {
    const result = await query(sql, params);
    return { data: result.rows as T[], error: null };
  } catch (error: any) {
    console.error('Stored procedure error:', error);
    return { 
      data: null, 
      error: { 
        message: error.message || 'Stored procedure error', 
        code: error.code,
        detail: error.detail
      }
    }
  }
}

/**
 * Exécute une fonction SQL
 */
export async function callFunction<T = any>(functionName: string, params: any[] = []): Promise<DbResponse<T[]>> {
  const placeholders = params.map((_, i) => `$${i + 1}`).join(', ');
  const sql = `SELECT * FROM ${functionName}(${placeholders})`;
  
  try {
    const result = await query(sql, params);
    return { data: result.rows as T[], error: null };
  } catch (error: any) {
    console.error('Function call error:', error);
    return { 
      data: null, 
      error: { 
        message: error.message || 'Function call error', 
        code: error.code,
        detail: error.detail
      }
    }
  }
}
