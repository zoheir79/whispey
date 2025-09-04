// src/hooks/useCostOverrides.ts
import { useState, useEffect } from 'react';

interface CostOverrides {
  builtin_stt_cost?: number;
  builtin_tts_cost?: number;
  builtin_llm_cost?: number;
  external_stt_provider?: number;
  external_stt_cost?: number;
  external_tts_provider?: number;
  external_tts_cost?: number;
  external_llm_provider?: number;
  external_llm_cost?: number;
  s3_storage_cost_per_gb?: number;
}

interface AgentCostData {
  id: number;
  name: string;
  agent_type: string;
  pricing_mode: string;
  cost_overrides: CostOverrides;
  s3_bucket_name?: string;
}

interface UseCostOverridesReturn {
  agent: AgentCostData | null;
  loading: boolean;
  error: string | null;
  updateOverrides: (overrides: CostOverrides) => Promise<boolean>;
  resetOverrides: () => Promise<boolean>;
  refetch: () => Promise<void>;
}

export function useCostOverrides(agentId: number | null): UseCostOverridesReturn {
  const [agent, setAgent] = useState<AgentCostData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAgentCostData = async () => {
    if (!agentId) {
      setAgent(null);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`/api/agents/${agentId}/cost-overrides`);
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to fetch agent cost data');
      }

      const data = await response.json();
      setAgent(data.agent);
      
    } catch (err) {
      console.error('Error fetching agent cost data:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch agent cost data');
    } finally {
      setLoading(false);
    }
  };

  const updateOverrides = async (overrides: CostOverrides): Promise<boolean> => {
    if (!agentId) return false;

    try {
      const response = await fetch(`/api/agents/${agentId}/cost-overrides`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ cost_overrides: overrides }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update cost overrides');
      }

      const data = await response.json();
      setAgent(data.agent);
      return true;
      
    } catch (err) {
      console.error('Error updating cost overrides:', err);
      setError(err instanceof Error ? err.message : 'Failed to update cost overrides');
      return false;
    }
  };

  const resetOverrides = async (): Promise<boolean> => {
    if (!agentId) return false;

    try {
      const response = await fetch(`/api/agents/${agentId}/cost-overrides`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to reset cost overrides');
      }

      const data = await response.json();
      setAgent(data.agent);
      return true;
      
    } catch (err) {
      console.error('Error resetting cost overrides:', err);
      setError(err instanceof Error ? err.message : 'Failed to reset cost overrides');
      return false;
    }
  };

  const refetch = async () => {
    await fetchAgentCostData();
  };

  useEffect(() => {
    fetchAgentCostData();
  }, [agentId]);

  return {
    agent,
    loading,
    error,
    updateOverrides,
    resetOverrides,
    refetch
  };
}

// Hook pour calculer les coûts effectifs avec overrides
export function useEffectiveCosts(
  agentType: string,
  pricingMode: string,
  costOverrides: CostOverrides,
  globalSettings: any,
  providers: any[]
) {
  const calculateEffectiveCosts = () => {
    if (!globalSettings) return null;

    const costs = {
      stt: 0,
      tts: 0,
      llm: 0,
      s3: 0,
      subscription: 0,
      total: 0
    };

    if (pricingMode === 'dedicated') {
      // Mode dédié - coûts mensuels fixes
      costs.stt = costOverrides.builtin_stt_cost ?? globalSettings.builtin_stt?.cost_dedicated_monthly ?? 0;
      costs.tts = costOverrides.builtin_tts_cost ?? globalSettings.builtin_tts?.cost_dedicated_monthly ?? 0;
      costs.llm = costOverrides.builtin_llm_cost ?? globalSettings.builtin_llm?.cost_dedicated_monthly ?? 0;
    } else {
      // Mode PAG - coûts par unité (estimation basée sur usage moyen)
      const avgMinutesPerMonth = 1000; // Estimation
      const avgWordsPerMonth = 50000;
      const avgTokensPerMonth = 100000;
      
      costs.stt = (costOverrides.builtin_stt_cost ?? globalSettings.builtin_stt?.cost_per_minute ?? 0) * avgMinutesPerMonth;
      costs.tts = (costOverrides.builtin_tts_cost ?? globalSettings.builtin_tts?.cost_per_word ?? 0) * avgWordsPerMonth;
      costs.llm = (costOverrides.builtin_llm_cost ?? globalSettings.builtin_llm?.cost_per_token ?? 0) * avgTokensPerMonth;
    }

    // Coût stockage S3 (par Go/mois)
    const avgStorageGB = 5; // Estimation 5 Go par agent
    costs.s3 = (costOverrides.s3_storage_cost_per_gb ?? globalSettings.s3_config?.cost_per_gb ?? 0) * avgStorageGB;

    // Coût subscription agent
    if (agentType === 'voice') {
      const avgMinutesPerMonth = 1000;
      costs.subscription = (globalSettings.agent_subscription_costs?.voice_per_minute ?? 0) * avgMinutesPerMonth;
    } else if (agentType === 'text_only') {
      costs.subscription = globalSettings.agent_subscription_costs?.textonly_per_month ?? 0;
    }

    costs.total = costs.stt + costs.tts + costs.llm + costs.s3 + costs.subscription;

    return costs;
  };

  return calculateEffectiveCosts();
}
