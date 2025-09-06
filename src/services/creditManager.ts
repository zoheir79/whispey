import { query } from '@/lib/db';

export interface CreditBalance {
  id: string;
  workspace_id: string;
  user_id: string;
  current_balance: number;
  currency: string;
  credit_limit: number;
  low_balance_threshold: number;
  auto_recharge_enabled: boolean;
  auto_recharge_amount: number;
  auto_recharge_threshold: number;
  is_active: boolean;
  is_suspended: boolean;
  suspension_reason?: string;
}

export interface CreditTransaction {
  id: string;
  workspace_id: string;
  user_id: string;
  credits_id: string;
  transaction_type: 'deduction' | 'recharge' | 'refund' | 'adjustment' | 'suspension';
  amount: number;
  previous_balance: number;
  new_balance: number;
  service_type?: string;
  service_id?: string;
  call_log_id?: string;
  description: string;
  status: 'pending' | 'completed' | 'failed' | 'cancelled';
  created_at: string;
}

export interface DeductionRequest {
  workspace_id: string;
  amount: number;
  description: string;
  service_type?: 'agent' | 'knowledge_base' | 'workflow' | 'workspace' | 'call' | 'system';
  service_id?: string;
  call_log_id?: string;
}

export interface DeductionResult {
  success: boolean;
  transaction_id?: string;
  previous_balance?: number;
  new_balance?: number;
  amount_deducted?: number;
  error?: string;
  current_balance?: number;
  required_amount?: number;
}

export interface RechargeRequest {
  workspace_id: string;
  amount: number;
  description?: string;
}

export interface RechargeResult {
  success: boolean;
  transaction_id?: string;
  previous_balance?: number;
  new_balance?: number;
  amount_added?: number;
}

export interface UsageMetrics {
  // Agent metrics
  call_duration_minutes?: number;
  stt_duration_minutes?: number;
  tokens_used?: number;
  words_generated?: number;
  
  // KB metrics
  storage_gb?: number;
  search_tokens?: number;
  embedding_tokens?: number;
  
  // Workflow metrics
  operations?: number;
  execution_minutes?: number;
  mcp_calls?: number;
  input_tokens?: number;
  output_tokens?: number;
}

export interface CostCalculationResult {
  service_type: string;
  service_id: string;
  costs: {
    stt_cost?: number;
    tts_cost?: number;
    llm_cost?: number;
    storage_cost?: number;
    search_cost?: number;
    embedding_cost?: number;
    operation_cost?: number;
    execution_cost?: number;
    subscription_cost?: number;
    total_cost: number;
  };
  usage?: UsageMetrics;
  platform_mode?: string;
  calculated_at: string;
}

export class CreditManager {
  
  /**
   * Get current credit balance for workspace
   */
  async getWorkspaceBalance(workspaceId: string): Promise<CreditBalance | null> {
    try {
      const result = await query(`
        SELECT * FROM user_credits 
        WHERE workspace_id = $1 
        AND is_active = true
        ORDER BY created_at
        LIMIT 1
      `, [workspaceId]);

      return result.rows.length > 0 ? result.rows[0] : null;
    } catch (error) {
      console.error('Error fetching workspace balance:', error);
      throw error;
    }
  }

  /**
   * Deduct credits from workspace
   */
  async deductCredits(request: DeductionRequest): Promise<DeductionResult> {
    try {
      const result = await query(`
        SELECT deduct_credits_from_workspace($1, $2, $3, $4, $5, $6) as result
      `, [
        request.workspace_id,
        request.amount,
        request.description,
        request.service_type || null,
        request.service_id || null,
        request.call_log_id || null
      ]);

      return result.rows[0].result;
    } catch (error) {
      console.error('Error deducting credits:', error);
      throw error;
    }
  }

  /**
   * Recharge credits for workspace
   */
  async rechargeCredits(request: RechargeRequest): Promise<RechargeResult> {
    try {
      const result = await query(`
        SELECT recharge_credits_workspace($1, $2, $3) as result
      `, [
        request.workspace_id,
        request.amount,
        request.description || 'Credit recharge'
      ]);

      return result.rows[0].result;
    } catch (error) {
      console.error('Error recharging credits:', error);
      throw error;
    }
  }

  /**
   * Calculate cost for any service (agent, KB, workflow)
   */
  async calculateServiceCost(
    serviceType: 'agent' | 'knowledge_base' | 'workflow',
    serviceId: string,
    usageMetrics?: UsageMetrics,
    cycleStart?: Date,
    cycleEnd?: Date
  ): Promise<CostCalculationResult> {
    try {
      const usageParams = usageMetrics ? JSON.stringify(usageMetrics) : null;
      
      const result = await query(`
        SELECT calculate_unified_service_cost($1, $2, $3, $4, $5) as result
      `, [
        serviceType,
        serviceId,
        usageParams,
        cycleStart?.toISOString().split('T')[0] || null,
        cycleEnd?.toISOString().split('T')[0] || null
      ]);

      return result.rows[0].result;
    } catch (error) {
      console.error('Error calculating service cost:', error);
      throw error;
    }
  }

  /**
   * Process call metrics and deduct costs
   * Used by sendlog API
   */
  async processCallCosts(
    workspaceId: string,
    agentId: string,
    callId: string,
    metrics: {
      call_duration_minutes?: number;
      stt_duration_minutes?: number;
      tokens_used?: number;
      words_generated?: number;
      kb_usage?: {
        kb_id: string;
        search_tokens: number;
        embedding_tokens: number;
      };
      workflow_usage?: {
        workflow_id: string;
        operations: number;
        execution_minutes: number;
      };
    }
  ): Promise<{
    success: boolean;
    total_cost: number;
    cost_breakdown: any;
    deduction_result?: DeductionResult;
    error?: string;
  }> {
    try {
      let totalCost = 0;
      const costBreakdown: any = {};

      // 1. Calculate agent costs
      const agentCost = await this.calculateServiceCost('agent', agentId, {
        call_duration_minutes: metrics.call_duration_minutes,
        stt_duration_minutes: metrics.stt_duration_minutes,
        tokens_used: metrics.tokens_used,
        words_generated: metrics.words_generated
      });

      costBreakdown.agent = agentCost.costs;
      totalCost += agentCost.costs.total_cost;

      // 2. Calculate KB costs if used
      if (metrics.kb_usage) {
        const kbCost = await this.calculateServiceCost('knowledge_base', metrics.kb_usage.kb_id, {
          search_tokens: metrics.kb_usage.search_tokens,
          embedding_tokens: metrics.kb_usage.embedding_tokens
        });

        costBreakdown.knowledge_base = kbCost.costs;
        totalCost += kbCost.costs.total_cost;
      }

      // 3. Calculate Workflow costs if used
      if (metrics.workflow_usage) {
        const workflowCost = await this.calculateServiceCost('workflow', metrics.workflow_usage.workflow_id, {
          operations: metrics.workflow_usage.operations,
          execution_minutes: metrics.workflow_usage.execution_minutes
        });

        costBreakdown.workflow = workflowCost.costs;
        totalCost += workflowCost.costs.total_cost;
      }

      // 4. Deduct total cost from credits
      const deductionResult = await this.deductCredits({
        workspace_id: workspaceId,
        amount: totalCost,
        description: `Call costs (ID: ${callId})`,
        service_type: 'call',
        service_id: agentId,
        call_log_id: callId
      });

      if (!deductionResult.success) {
        // Suspend services if insufficient credits
        await this.suspendWorkspaceServices(workspaceId, 'Insufficient credits');
      }

      return {
        success: deductionResult.success,
        total_cost: totalCost,
        cost_breakdown: costBreakdown,
        deduction_result: deductionResult,
        error: deductionResult.error
      };

    } catch (error) {
      console.error('Error processing call costs:', error);
      return {
        success: false,
        total_cost: 0,
        cost_breakdown: {},
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Suspend all workspace services
   */
  async suspendWorkspaceServices(workspaceId: string, reason?: string): Promise<any> {
    try {
      const result = await query(`
        SELECT suspend_workspace_services($1, $2) as result
      `, [workspaceId, reason || 'Insufficient credits']);

      return result.rows[0].result;
    } catch (error) {
      console.error('Error suspending workspace services:', error);
      throw error;
    }
  }

  /**
   * Reactivate workspace services
   */
  async unsuspendWorkspaceServices(workspaceId: string): Promise<any> {
    try {
      const result = await query(`
        SELECT unsuspend_workspace_services($1) as result
      `, [workspaceId]);

      return result.rows[0].result;
    } catch (error) {
      console.error('Error unsuspending workspace services:', error);
      throw error;
    }
  }

  /**
   * Get credit transaction history
   */
  async getTransactionHistory(
    workspaceId: string,
    limit: number = 50,
    offset: number = 0,
    transactionType?: string
  ): Promise<CreditTransaction[]> {
    try {
      let whereClause = 'WHERE workspace_id = $1';
      const params: any[] = [workspaceId];

      if (transactionType) {
        whereClause += ' AND transaction_type = $' + (params.length + 1);
        params.push(transactionType);
      }

      const result = await query(`
        SELECT * FROM credit_transactions 
        ${whereClause}
        ORDER BY created_at DESC
        LIMIT $${params.length + 1} OFFSET $${params.length + 2}
      `, [...params, limit, offset]);

      return result.rows;
    } catch (error) {
      console.error('Error fetching transaction history:', error);
      throw error;
    }
  }

  /**
   * Get credit alerts for workspace
   */
  async getCreditAlerts(
    workspaceId: string,
    unreadOnly: boolean = false
  ): Promise<any[]> {
    try {
      let whereClause = 'WHERE workspace_id = $1';
      if (unreadOnly) {
        whereClause += ' AND is_read = false AND is_dismissed = false';
      }

      const result = await query(`
        SELECT * FROM credit_alerts 
        ${whereClause}
        ORDER BY created_at DESC
        LIMIT 100
      `, [workspaceId]);

      return result.rows;
    } catch (error) {
      console.error('Error fetching credit alerts:', error);
      throw error;
    }
  }

  /**
   * Mark alert as read
   */
  async markAlertAsRead(alertId: string): Promise<void> {
    try {
      await query(`
        UPDATE credit_alerts 
        SET is_read = true, read_at = NOW()
        WHERE id = $1
      `, [alertId]);
    } catch (error) {
      console.error('Error marking alert as read:', error);
      throw error;
    }
  }

  /**
   * Dismiss alert
   */
  async dismissAlert(alertId: string): Promise<void> {
    try {
      await query(`
        UPDATE credit_alerts 
        SET is_dismissed = true, dismissed_at = NOW()
        WHERE id = $1
      `, [alertId]);
    } catch (error) {
      console.error('Error dismissing alert:', error);
      throw error;
    }
  }

  /**
   * Check if workspace has sufficient credits
   */
  async checkSufficientCredits(workspaceId: string, requiredAmount: number): Promise<{
    sufficient: boolean;
    current_balance: number;
    required_amount: number;
  }> {
    try {
      const balance = await this.getWorkspaceBalance(workspaceId);
      
      if (!balance) {
        return {
          sufficient: false,
          current_balance: 0,
          required_amount: requiredAmount
        };
      }

      return {
        sufficient: balance.current_balance >= requiredAmount,
        current_balance: balance.current_balance,
        required_amount: requiredAmount
      };
    } catch (error) {
      console.error('Error checking sufficient credits:', error);
      throw error;
    }
  }

  /**
   * Initialize credits for new workspace
   */
  async initializeWorkspaceCredits(
    workspaceId: string, 
    userId: string, 
    initialAmount: number = 100
  ): Promise<CreditBalance> {
    try {
      const result = await query(`
        INSERT INTO user_credits (workspace_id, user_id, current_balance, created_by)
        VALUES ($1, $2, $3, $4)
        RETURNING *
      `, [workspaceId, userId, initialAmount, userId]);

      return result.rows[0];
    } catch (error) {
      console.error('Error initializing workspace credits:', error);
      throw error;
    }
  }
}

// Export singleton instance
export const creditManager = new CreditManager();
export default creditManager;
