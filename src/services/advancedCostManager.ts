import { query } from '@/lib/db';

// Types pour les configurations de coûts avancés
export interface CostConfigurationAdvanced {
  id: string;
  service_type: 'agent' | 'knowledge_base' | 'workflow' | 'workspace';
  service_id: string;
  workspace_id: string;
  cost_mode: 'pag' | 'dedicated' | 'hybrid' | 'fixed' | 'dynamic';
  // injection_config removed - embedding costs handled in file upload
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

// InjectionConfig removed - embedding costs handled in file upload

export interface FixedCostConfig {
  monthly_fixed: number;
  quarterly_fixed?: number;
  yearly_fixed?: number;
  activation_fee?: number;
  // includes_allowance removed - no quota management
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
  // included_allowance removed - no quota management
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

// ServiceAllowance interface removed - no quota management needed

export class AdvancedCostManager {
  
  // ========================================
  // CONFIGURATION MANAGEMENT
  // ========================================
  
  async createCostConfiguration(config: {
    service_type: string;
    service_id: string;
    workspace_id: string;
    cost_mode: string;
    // injection_config removed
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
          fixed_cost_config, dynamic_cost_config, hybrid_config,
          usage_limits, cost_caps, effective_from, effective_until, priority, created_by
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
        RETURNING *
      `, [
        config.service_type, config.service_id, config.workspace_id, config.cost_mode,
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
          if (['fixed_cost_config', 'dynamic_cost_config', 'hybrid_config', 'usage_limits', 'cost_caps'].includes(key)) {
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
  // ALLOWANCE METHODS REMOVED - NO QUOTA MANAGEMENT
  // ========================================

  // updateAllowanceUsage removed - no quota management

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

  // calculateInjectionCost removed - embedding costs handled in file upload
  // calculateFixedCostWithAllowances removed - no allowance management

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
          SUM(CASE WHEN cost_mode = 'injection' THEN 0 ELSE 0 END) as injection_services -- injection mode removed
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

  // resetMonthlyAllowances removed - no allowance management
}

// Instance singleton
export const advancedCostManager = new AdvancedCostManager();
