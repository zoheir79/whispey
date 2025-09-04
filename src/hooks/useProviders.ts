// src/hooks/useProviders.ts
import { useState, useEffect } from 'react';

interface Provider {
  id: number;
  name: string;
  type: 'STT' | 'TTS' | 'LLM';
  api_url: string;
  unit: string;
  cost_per_unit: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface GlobalSettings {
  url: string;
  api_key: string;
  cost_per_minute: number;
}

interface UseProvidersReturn {
  providers: Provider[];
  globalSettings: GlobalSettings | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export const useProviders = (): UseProvidersReturn => {
  const [providers, setProviders] = useState<Provider[]>([]);
  const [globalSettings, setGlobalSettings] = useState<GlobalSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchProviders = async () => {
    try {
      const response = await fetch('/api/providers');
      if (!response.ok) {
        throw new Error('Failed to fetch providers');
      }
      const data = await response.json();
      return data.providers || [];
    } catch (err) {
      console.error('Error fetching providers:', err);
      return [];
    }
  };

  const fetchGlobalSettings = async () => {
    try {
      const response = await fetch('/api/settings/global?key=builtin_models');
      if (!response.ok) {
        throw new Error('Failed to fetch global settings');
      }
      const data = await response.json();
      return data.settings?.value || null;
    } catch (err) {
      console.error('Error fetching global settings:', err);
      return null;
    }
  };

  const refetch = async () => {
    setLoading(true);
    setError(null);

    try {
      const [providersData, settingsData] = await Promise.all([
        fetchProviders(),
        fetchGlobalSettings()
      ]);

      setProviders(providersData);
      setGlobalSettings(settingsData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refetch();
  }, []);

  return {
    providers,
    globalSettings,
    loading,
    error,
    refetch
  };
};

// Helper functions to filter providers by type
export const getProvidersByType = (providers: Provider[], type: 'STT' | 'TTS' | 'LLM') => {
  return providers.filter(provider => provider.type === type && provider.is_active);
};
