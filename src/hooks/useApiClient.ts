import { useState, useCallback } from 'react';

interface ApiRequest {
  endpoint: string;
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  body?: any;
}

interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
}

export function useApiClient() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const apiCall = useCallback(async <T = any>({ 
    endpoint, 
    method = 'POST', 
    body 
  }: ApiRequest): Promise<ApiResponse<T>> => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(endpoint, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: body ? JSON.stringify(body) : undefined,
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'API call failed');
      }

      setLoading(false);
      return { success: true, data: result.data };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
      setLoading(false);
      return { success: false, error: errorMessage };
    }
  }, []);

  // Specific methods for common operations
  const fetchFromTable = useCallback(async (options: {
    table: string;
    select?: string;
    filters?: any[];
    orderBy?: any;
    limit?: number;
    offset?: number;
  }) => {
    return apiCall({
      endpoint: '/api/overview',
      body: options
    });
  }, [apiCall]);

  const callRPC = useCallback(async (method: string, params: any) => {
    return apiCall({
      endpoint: '/api/db-rpc',
      body: { method, params }
    });
  }, [apiCall]);

  return {
    loading,
    error,
    apiCall,
    fetchFromTable,
    callRPC
  };
}
