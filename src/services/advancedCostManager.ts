import { query } from '@/lib/db';

// Types pour les configurations de coûts avancés
export interface CostConfigurationAdvanced {
  id: string;
  service_type: 'agent' | 'knowledge_base' | 'workflow' | 'workspace';
  service_id: string;
  workspace_id: string;
  cost_mode: 'pag' | 'dedicated' | 'injection' | 'hybrid' | 'fixed' | 'dynamic';
  injection_config?: InjectionConfig;
  fixed_cost_config?: FixedCostConfig;
  dynamic_cost_config?: DynamicCostConfig;
  hybrid_config?: HybridConfig;
  usage_limits?: Record<string, any>;
  cost_caps?: Record<string, any>;
  effective_from: string;
  effective_until?: string;
  is_active: boolean;
  priority: number;
}

export interface InjectionConfig {
  target_service: 'agent' | 'knowledge_base' | 'workflow';
  target_id: string;
  injection_ratio: number; // 0.15 = 15%
  max_injection_amount?: number;
  injection_frequency: 'per_call' | 'daily' | 'monthly';
}

export interface FixedCostConfig {
  monthly_fixed: number;
  quarterly_fixed?: number;
  yearly_fixed?: number;
  activation_fee?: number;
  includes_allowance?: {
    calls?: number;
    tokens?: number;
    storage_gb?: number;
    executions?: number;
    searches?: number;
  };
}

export interface DynamicCostConfig {
  base_cost: number;
  scaling_tiers: Array<{
    threshold: number;
    multiplier: number;
  }>;
  peak_hours_multiplier?: number;
  off_peak_discount?: number;
}

export interface HybridConfig {
  base_monthly: number;
  included_allowance: {
    calls?: number;
    tokens?: number;
    storage_gb?: number;
    executions?: number;
    searches?: number;
  };
  overage_rates: {
    per_call?: number;
    per_token?: number;
    per_gb?: number;
    per_execution?: number;
    per_search?: number;
  };
  burst_protection?: {
    max_overage: number;
  };
}

export interface CostCalculationResult {
  service_type: string;
  service_id: string;
  cost_mode: string;
  workspace_id: string;
  calculation_timestamp: string;
  usage_metrics: Record<string, any>;
  total_cost: number;
  breakdown?: Record<string, any>;
  has_injection?: boolean;
  injection_details?: Record<string, any>;
}

export interface ServiceAllowance {
  id: string;
  service_type: string;
  service_id: string;
  workspace_id: string;
  allowance_type: string;
  monthly_allowance: number;
  current_usage: number;
  overage_usage: number;
  overage_rate: number;
  overage_cost: number;
  period_start: string;
  period_end: string;
  is_active: boolean;
}

export class AdvancedCostManager {
  
  // ========================================
  // CONFIGURATION MANAGEMENT
  // ========================================
  
  async createCostConfiguration(config: {
    service_type: string;
    service_id: string;
    workspace_id: string;
    cost_mode: string;
    injection_config?: InjectionConfig;
    fixed_cost_config?: FixedCostConfig;
    dynamic_cost_config?: DynamicCostConfig;
    hybrid_config?: HybridConfig;
    usage_limits?: Record<string, any>;
    cost_caps?: Record<string, any>;
    effective_from?: string;
    effective_until?: string;
    priority?: number;
    user_id: string;
  }): Promise<CostConfigurationAdvanced | null> {
    try {
      const result = await query(`
        INSERT INTO cost_configuration_advanced (
          service_type, service_id, workspace_id, cost_mode,
          injection_config, fixed_cost_config, dynamic_cost_config, hybrid_config,
          usage_limits, cost_caps, effective_from, effective_until, priority, created_by
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
        RETURNING *
      `, [
        config.service_type, config.service_id, config.workspace_id, config.cost_mode,
        JSON.stringify(config.injection_config || {}),
        JSON.stringify(config.fixed_cost_config || {}),
        JSON.stringify(config.dynamic_cost_config || {}),
        JSON.stringify(config.hybrid_config || {}),
        JSON.stringify(config.usage_limits || {}),
        JSON.stringify(config.cost_caps || {}),
        config.effective_from || new Date().toISOString(),
        config.effective_until,
        config.priority || 0,
        config.user_id
      ]);

      return result.rows[0] || null;
    } catch (error) {
      console.error('Failed to create cost configuration:', error);
      return null;
    }
  }

  async getCostConfiguration(
    service_type: string, 
    service_id: string
  ): Promise<CostConfigurationAdvanced | null> {
    try {
      const result = await query(`
        SELECT * FROM cost_configuration_advanced
        WHERE service_type = $1 AND service_id = $2
        AND is_active = true
        AND (effective_until IS NULL OR effective_until > NOW())
        ORDER BY priority DESC, created_at DESC
        LIMIT 1
      `, [service_type, service_id]);

      return result.rows[0] || null;
    } catch (error) {
      console.error('Failed to get cost configuration:', error);
      return null;
    }
  }

  async updateCostConfiguration(
    config_id: string,
    updates: Partial<CostConfigurationAdvanced>
  ): Promise<boolean> {
    try {
      const setClauses: string[] = [];
      const values: any[] = [];
      let paramCount = 1;

      // Build dynamic UPDATE query
      Object.entries(updates).forEach(([key, value]) => {
        if (key !== 'id' && value !== undefined) {
          if (['injection_config', 'fixed_cost_config', 'dynamic_cost_config', 'hybrid_config', 'usage_limits', 'cost_caps'].includes(key)) {
            setClauses.push(`${key} = $${paramCount}`);
            values.push(JSON.stringify(value));
          } else {
            setClauses.push(`${key} = $${paramCount}`);
            values.push(value);
          }
          paramCount++;
        }
      });

      if (setClauses.length === 0) return false;

      setClauses.push(`updated_at = NOW()`);
      values.push(config_id);

      const result = await query(`
        UPDATE cost_configuration_advanced 
        SET ${setClauses.join(', ')}
        WHERE id = $${paramCount}
      `, values);

      return (result.rowCount || 0) > 0;
    } catch (error) {
      console.error('Failed to update cost configuration:', error);
      return false;
    }
  }

  // ========================================
  // ALLOWANCES MANAGEMENT
  // ========================================

  async createServiceAllowance(allowance: {
    service_type: string;
    service_id: string;
    workspace_id: string;
    allowance_type: string;
    monthly_allowance: number;
    overage_rate: number;
    period_start?: string;
    period_end?: string;
  }): Promise<ServiceAllowance | null> {
    try {
      const result = await query(`
        INSERT INTO service_allowances (
          service_type, service_id, workspace_id, allowance_type,
          monthly_allowance, overage_rate, period_start, period_end
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING *
      `, [
        allowance.service_type, allowance.service_id, allowance.workspace_id, allowance.allowance_type,
        allowance.monthly_allowance, allowance.overage_rate,
        allowance.period_start || new Date().toISOString(),
        allowance.period_end || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
      ]);

      return result.rows[0] || null;
    } catch (error) {
      console.error('Failed to create service allowance:', error);
      return null;
    }
  }

  async getServiceAllowances(
    service_type: string, 
    service_id: string
  ): Promise<ServiceAllowance[]> {
    try {
      const result = await query(`
        SELECT * FROM service_allowances
        WHERE service_type = $1 AND service_id = $2
        AND is_active = true
        AND period_start <= CURRENT_DATE
        AND period_end >= CURRENT_DATE
        ORDER BY allowance_type
      `, [service_type, service_id]);

      return result.rows || [];
    } catch (error) {
      console.error('Failed to get service allowances:', error);
      return [];
    }
  }

  async updateAllowanceUsage(
    service_type: string,
    service_id: string,
    allowance_type: string,
    usage_amount: number
  ): Promise<boolean> {
    try {
      const result = await query(`
        UPDATE service_allowances
        SET current_usage = current_usage + $4,
            overage_usage = GREATEST(current_usage + $4 - monthly_allowance, 0),
            overage_cost = GREATEST(current_usage + $4 - monthly_allowance, 0) * overage_rate,
            updated_at = NOW()
        WHERE service_type = $1 AND service_id = $2 AND allowance_type = $3
        AND is_active = true
        AND period_start <= CURRENT_DATE
        AND period_end >= CURRENT_DATE
      `, [service_type, service_id, allowance_type, usage_amount]);

      return (result.rowCount || 0) > 0;
    } catch (error) {
      console.error('Failed to update allowance usage:', error);
      return false;
    }
  }

  // ========================================
  // COST CALCULATION METHODS
  // ========================================

  async calculateAdvancedServiceCost(
    service_type: string,
    service_id: string,
    usage_metrics: Record<string, any> = {},
    usage_timestamp?: string
  ): Promise<CostCalculationResult | null> {
    try {
      const result = await query(`
        SELECT calculate_advanced_service_cost($1, $2, $3, $4) as cost_result
      `, [
        service_type, 
        service_id, 
        JSON.stringify(usage_metrics),
        usage_timestamp || new Date().toISOString()
      ]);

      return result.rows[0]?.cost_result || null;
    } catch (error) {
      console.error('Failed to calculate advanced service cost:', error);
      return null;
    }
  }

  async calculateInjectionCost(
    source_service_type: string,
    source_service_id: string,
    base_cost: number,
    target_service_type?: string,
    target_service_id?: string
  ): Promise<any> {
    try {
      const result = await query(`
        SELECT calculate_injection_cost($1, $2, $3, $4, $5) as injection_result
      `, [source_service_type, source_service_id, base_cost, target_service_type, target_service_id]);

      return result.rows[0]?.injection_result || null;
    } catch (error) {
      console.error('Failed to calculate injection cost:', error);
      return null;
    }
  }

  async calculateFixedCostWithAllowances(
    service_type: string,
    service_id: string,
    usage_metrics: Record<string, any> = {}
  ): Promise<any> {
    try {
      const result = await query(`
        SELECT calculate_fixed_cost_with_allowances($1, $2, $3) as fixed_result
      `, [service_type, service_id, JSON.stringify(usage_metrics)]);

      return result.rows[0]?.fixed_result || null;
    } catch (error) {
      console.error('Failed to calculate fixed cost with allowances:', error);
      return null;
    }
  }

  async calculateDynamicCost(
    service_type: string,
    service_id: string,
    usage_volume: number,
    usage_timestamp?: string
  ): Promise<any> {
    try {
      const result = await query(`
        SELECT calculate_dynamic_cost($1, $2, $3, $4) as dynamic_result
      `, [service_type, service_id, usage_volume, usage_timestamp || new Date().toISOString()]);

      return result.rows[0]?.dynamic_result || null;
    } catch (error) {
      console.error('Failed to calculate dynamic cost:', error);
      return null;
    }
  }

  async calculateHybridCost(
    service_type: string,
    service_id: string,
    usage_metrics: Record<string, any> = {}
  ): Promise<any> {
    try {
      const result = await query(`
        SELECT calculate_hybrid_cost($1, $2, $3) as hybrid_result
      `, [service_type, service_id, JSON.stringify(usage_metrics)]);

      return result.rows[0]?.hybrid_result || null;
    } catch (error) {
      console.error('Failed to calculate hybrid cost:', error);
      return null;
    }
  }

  // ========================================
  // INJECTION PROCESSING
  // ========================================

  async processPendingInjections(): Promise<any> {
    try {
      const result = await query(`
        SELECT process_pending_cost_injections() as process_result
      `);

      return result.rows[0]?.process_result || null;
    } catch (error) {
      console.error('Failed to process pending injections:', error);
      return null;
    }
  }

  async getCostInjections(
    workspace_id: string,
    limit: number = 50,
    offset: number = 0
  ): Promise<any[]> {
    try {
      const result = await query(`
        SELECT * FROM cost_injections
        WHERE source_workspace_id = $1 OR target_workspace_id = $1
        ORDER BY created_at DESC
        LIMIT $2 OFFSET $3
      `, [workspace_id, limit, offset]);

      return result.rows || [];
    } catch (error) {
      console.error('Failed to get cost injections:', error);
      return [];
    }
  }

  // ========================================
  // SCALING TIERS MANAGEMENT
  // ========================================

  async createScalingTiers(
    cost_config_id: string,
    tiers: Array<{
      tier_level: number;
      usage_threshold: number;
      cost_multiplier: number;
      flat_rate?: number;
    }>
  ): Promise<boolean> {
    try {
      for (const tier of tiers) {
        await query(`
          INSERT INTO cost_scaling_tiers (
            cost_config_id, tier_level, usage_threshold, cost_multiplier, flat_rate
          ) VALUES ($1, $2, $3, $4, $5)
          ON CONFLICT (cost_config_id, tier_level) DO UPDATE SET
            usage_threshold = EXCLUDED.usage_threshold,
            cost_multiplier = EXCLUDED.cost_multiplier,
            flat_rate = EXCLUDED.flat_rate
        `, [cost_config_id, tier.tier_level, tier.usage_threshold, tier.cost_multiplier, tier.flat_rate]);
      }

      return true;
    } catch (error) {
      console.error('Failed to create scaling tiers:', error);
      return false;
    }
  }

  async getScalingTiers(cost_config_id: string): Promise<any[]> {
    try {
      const result = await query(`
        SELECT * FROM cost_scaling_tiers
        WHERE cost_config_id = $1
        ORDER BY tier_level
      `, [cost_config_id]);

      return result.rows || [];
    } catch (error) {
      console.error('Failed to get scaling tiers:', error);
      return [];
    }
  }

  // ========================================
  // UTILITIES
  // ========================================

  async getWorkspaceCostSummary(workspace_id: string): Promise<any> {
    try {
      const result = await query(`
        SELECT 
          service_type,
          COUNT(*) as service_count,
          SUM(CASE WHEN cost_mode = 'fixed' THEN 1 ELSE 0 END) as fixed_services,
          SUM(CASE WHEN cost_mode = 'dynamic' THEN 1 ELSE 0 END) as dynamic_services,
          SUM(CASE WHEN cost_mode = 'hybrid' THEN 1 ELSE 0 END) as hybrid_services,
          SUM(CASE WHEN cost_mode = 'injection' THEN 1 ELSE 0 END) as injection_services
        FROM cost_configuration_advanced
        WHERE workspace_id = $1 AND is_active = true
        GROUP BY service_type
      `, [workspace_id]);

      return result.rows || [];
    } catch (error) {
      console.error('Failed to get workspace cost summary:', error);
      return [];
    }
  }

  async resetMonthlyAllowances(workspace_id: string): Promise<boolean> {
    try {
      const result = await query(`
        UPDATE service_allowances
        SET current_usage = 0,
            overage_usage = 0,
            overage_cost = 0,
            period_start = CURRENT_DATE,
            period_end = CURRENT_DATE + INTERVAL '1 month',
            updated_at = NOW()
        WHERE workspace_id = $1 
        AND reset_on_billing_cycle = true
        AND is_active = true
      `, [workspace_id]);

      return (result.rowCount || 0) > 0;
    } catch (error) {
      console.error('Failed to reset monthly allowances:', error);
      return false;
    }
  }
}

// Instance singleton
export const advancedCostManager = new AdvancedCostManager();
