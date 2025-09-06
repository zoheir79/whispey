// src/hooks/useCostOverrides.ts
import { useState, useEffect } from 'react';

interface CostOverrides {
  // Builtin costs (PAG rates)
  builtin_stt_cost?: number;
  builtin_tts_cost?: number;
  builtin_llm_cost?: number;
  // External providers
  external_stt_provider?: number;
  external_stt_cost?: number;
  external_tts_provider?: number;
  external_tts_cost?: number;
  external_llm_provider?: number;
  external_llm_cost?: number;
  // S3 storage 
  s3_storage_cost_per_gb?: number;
  // Dedicated costs (compatible avec pricing_rates_dedicated)
  stt_monthly_cost?: number;
  tts_monthly_cost?: number;
  llm_monthly_cost?: number;
  // Agent subscription overrides (compatible avec subscription_costs)
  agent_monthly_cost?: number;
  agent_annual_cost?: number;
  // KB/WF overrides (compatible avec fixed_pricing)
  kb_monthly_cost?: number;
  kb_annual_cost?: number;
  workflow_monthly_cost?: number;
  workflow_annual_cost?: number;
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

// Hook pour calculer les coûts effectifs avec overrides - Compatible PricingSettings v2
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

    // Logique consolidée: Override → Global → Défaut
    if (pricingMode === 'dedicated') {
      // Mode dédié - coûts mensuels fixes depuis pricing_rates_dedicated
      costs.stt = costOverrides.stt_monthly_cost ?? 
                 globalSettings.pricing_rates_dedicated?.stt_monthly ?? 0;
      costs.tts = costOverrides.tts_monthly_cost ?? 
                 globalSettings.pricing_rates_dedicated?.tts_monthly ?? 0;
      costs.llm = costOverrides.llm_monthly_cost ?? 
                 globalSettings.pricing_rates_dedicated?.llm_monthly ?? 0;
    } else {
      // Mode PAG - coûts par unité depuis pricing_rates_pag
      const avgMinutesPerMonth = 1000; // Estimation
      const avgTokensPerMonth = 100000;
      
      costs.stt = (costOverrides.builtin_stt_cost ?? 
                  globalSettings.pricing_rates_pag?.stt_builtin_per_minute ?? 0) * avgMinutesPerMonth;
      costs.tts = (costOverrides.builtin_tts_cost ?? 
                  globalSettings.pricing_rates_pag?.tts_builtin_per_minute ?? 0) * avgMinutesPerMonth;
      costs.llm = (costOverrides.builtin_llm_cost ?? 
                  globalSettings.pricing_rates_pag?.llm_builtin_per_token ?? 0) * avgTokensPerMonth;
    }

    // Coût stockage S3 depuis s3_rates
    const avgStorageGB = 5; // Estimation 5 Go par agent
    costs.s3 = (costOverrides.s3_storage_cost_per_gb ?? 
               globalSettings.s3_rates?.storage_gb_month ?? 0) * avgStorageGB;

    // Coût subscription agent depuis subscription_costs
    if (agentType === 'voice') {
      costs.subscription = costOverrides.agent_monthly_cost ?? 
                          globalSettings.subscription_costs?.voice_agent_monthly ?? 0;
    } else if (agentType === 'textonly' || agentType === 'text') {
      costs.subscription = costOverrides.agent_monthly_cost ?? 
                          globalSettings.subscription_costs?.text_agent_monthly ?? 0;
    } else if (agentType === 'vision') {
      costs.subscription = costOverrides.agent_monthly_cost ?? 
                          globalSettings.subscription_costs?.vision_agent_monthly ?? 0;
    }

    costs.total = costs.stt + costs.tts + costs.llm + costs.s3 + costs.subscription;

    return costs;
  };

  return calculateEffectiveCosts();
}

// Hook pour coûts KB/Workflow avec overrides
export function useServiceEffectiveCosts(
  serviceType: 'knowledge_base' | 'workflow',
  costOverrides: CostOverrides,
  globalSettings: any
) {
  const calculateServiceCosts = () => {
    if (!globalSettings) return null;

    let monthlyCost = 0;
    let annualCost = 0;

    if (serviceType === 'knowledge_base') {
      monthlyCost = costOverrides.kb_monthly_cost ?? 
                   globalSettings.fixed_pricing?.kb_monthly ?? 0;
      annualCost = costOverrides.kb_annual_cost ?? 
                  globalSettings.fixed_pricing?.kb_annual ?? 0;
    } else if (serviceType === 'workflow') {
      monthlyCost = costOverrides.workflow_monthly_cost ?? 
                   globalSettings.fixed_pricing?.workflow_monthly ?? 0;
      annualCost = costOverrides.workflow_annual_cost ?? 
                  globalSettings.fixed_pricing?.workflow_annual ?? 0;
    }

    const savings = annualCost > 0 ? ((monthlyCost * 12 - annualCost) / (monthlyCost * 12)) * 100 : 0;

    return {
      monthly: monthlyCost,
      annual: annualCost,
      savings_percent: Math.round(savings * 100) / 100,
      effective_monthly: annualCost > 0 ? annualCost / 12 : monthlyCost
    };
  };

  return calculateServiceCosts();
}
