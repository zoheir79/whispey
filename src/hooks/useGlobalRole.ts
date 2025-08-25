// Hook to manage global role and permissions
import { useState, useEffect } from 'react';
import { GlobalRolePermissions } from '@/services/getGlobalRole';

interface GlobalRoleData {
  globalRole: string;
  permissions: GlobalRolePermissions;
  userId: string;
  email: string;
}

interface UseGlobalRoleReturn {
  globalRole: string | null;
  permissions: GlobalRolePermissions | null;
  isAdmin: boolean;
  isSuperAdmin: boolean;
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
}

export function useGlobalRole(): UseGlobalRoleReturn {
  const [data, setData] = useState<GlobalRoleData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchGlobalRole = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await fetch('/api/auth/global-role');
      
      if (!response.ok) {
        throw new Error('Failed to fetch global role');
      }

      const result = await response.json();
      
      if (result.success) {
        setData(result.data);
      } else {
        throw new Error(result.error || 'Unknown error');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch global role');
      setData(null);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchGlobalRole();
  }, []);

  const refetch = () => {
    fetchGlobalRole();
  };

  const isAdmin = data?.permissions?.canViewAllProjects || false;
  const isSuperAdmin = data?.permissions?.canManageGlobalSettings || false;

  return {
    globalRole: data?.globalRole || null,
    permissions: data?.permissions || null,
    isAdmin,
    isSuperAdmin,
    isLoading,
    error,
    refetch
  };
}
