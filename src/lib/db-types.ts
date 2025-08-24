/**
 * Types communs pour les opérations de base de données
 */

export interface DbError {
  message: string;
  code?: string;
  detail?: string;
}

export interface DbResponse<T = any> {
  data: T | null;
  error: DbError | null;
}

export interface QueryOptions {
  select?: string;
  filters?: Array<{ column: string; operator: string; value: any }>;
  orderBy?: { column: string; ascending: boolean };
  limit?: number;
  offset?: number;
}
