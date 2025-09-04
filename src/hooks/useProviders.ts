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
  builtin_stt: {
    url: string;
    api_key: string;
    cost_per_minute: number;
    cost_dedicated_monthly: number;
  };
  builtin_tts: {
    url: string;
    api_key: string;
    cost_per_word: number;
    cost_dedicated_monthly: number;
  };
  builtin_llm: {
    url: string;
    api_key: string;
    cost_per_token: number;
    cost_dedicated_monthly: number;
  };
  s3_config: {
    endpoint: string;
    access_key: string;
    secret_key: string;
    region: string;
    bucket_prefix: string;
    cost_per_gb: number;
  };
  agent_subscription_costs: {
    voice_per_minute: number;
    textonly_per_month: number;
  };
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
      const [sttRes, ttsRes, llmRes, s3Res, subscriptionRes] = await Promise.all([
        fetch('/api/settings/global?key=builtin_stt'),
        fetch('/api/settings/global?key=builtin_tts'),
        fetch('/api/settings/global?key=builtin_llm'),
        fetch('/api/settings/global?key=s3_config'),
        fetch('/api/settings/global?key=agent_subscription_costs')
      ]);

      const settings: GlobalSettings = {
        builtin_stt: {
          url: 'http://localhost:8000/stt',
          api_key: '',
          cost_per_minute: 0.02,
          cost_dedicated_monthly: 50.00
        },
        builtin_tts: {
          url: 'http://localhost:8000/tts',
          api_key: '',
          cost_per_word: 0.0001,
          cost_dedicated_monthly: 30.00
        },
        builtin_llm: {
          url: 'http://localhost:8000/llm',
          api_key: '',
          cost_per_token: 0.00005,
          cost_dedicated_monthly: 100.00
        },
        s3_config: {
          endpoint: 'https://s3.example.com',
          access_key: '',
          secret_key: '',
          region: 'us-east-1',
          bucket_prefix: 'whispey-agent-',
          cost_per_gb: 0.023
        },
        agent_subscription_costs: {
          voice_per_minute: 0.10,
          textonly_per_month: 25.00
        }
      };

      if (sttRes.ok) {
        const sttData = await sttRes.json();
        if (sttData.settings?.value) {
          settings.builtin_stt = sttData.settings.value;
        }
      }

      if (ttsRes.ok) {
        const ttsData = await ttsRes.json();
        if (ttsData.settings?.value) {
          settings.builtin_tts = ttsData.settings.value;
        }
      }

      if (llmRes.ok) {
        const llmData = await llmRes.json();
        if (llmData.settings?.value) {
          settings.builtin_llm = llmData.settings.value;
        }
      }

      if (s3Res.ok) {
        const s3Data = await s3Res.json();
        if (s3Data.settings?.value) {
          settings.s3_config = s3Data.settings.value;
        }
      }

      if (subscriptionRes.ok) {
        const subscriptionData = await subscriptionRes.json();
        if (subscriptionData.settings?.value) {
          settings.agent_subscription_costs = subscriptionData.settings.value;
        }
      }

      return settings;
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
