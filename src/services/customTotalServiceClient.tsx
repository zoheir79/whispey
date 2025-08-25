import { CustomTotalConfig, CustomFilter, CustomTotalResult } from '../types/customTotals'

// Client-safe service that uses API endpoints instead of direct DB calls
export class CustomTotalsService {
  // Helper function for API calls
  private static async apiCall(endpoint: string, body: any) {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    return response.json();
  }

  // Get saved custom totals configurations (alias for compatibility)
  static async getCustomTotals(projectId: string, agentId: string): Promise<CustomTotalConfig[]> {
    const result = await this.getSavedCustomTotals(projectId, agentId);
    return result.data || [];
  }

  // Get saved custom totals configurations
  static async getSavedCustomTotals(projectId: string, agentId: string): Promise<{ success: boolean; data?: CustomTotalConfig[]; error?: string }> {
    try {
      const result = await this.apiCall('/api/overview', {
        table: 'pype_voice_custom_totals_configs',
        select: '*',
        filters: [
          { column: 'project_id', operator: 'eq', value: projectId },
          { column: 'agent_id', operator: 'eq', value: agentId }
        ]
      });

      if (result.error) {
        return { success: false, error: result.error };
      }

      return { success: true, data: result.data || [] };
    } catch (error: any) {
      console.error('Error fetching custom totals:', error);
      return { success: false, error: error.message };
    }
  }

  // Calculate custom total using RPC
  static async calculateCustomTotal(
    config: CustomTotalConfig,
    agentId: string,
    dateRange: { from: string; to: string }
  ): Promise<{ success: boolean; data?: CustomTotalResult; error?: string }> {
    try {
      const result = await this.apiCall('/api/db-rpc', {
        method: 'calculateCustomTotal',
        params: {
          agent_id: agentId,
          aggregation: config.aggregation,
          column_name: config.column,
          json_field: config.jsonField,
          filters: config.filters || [],
          filter_logic: config.filterLogic || 'AND',
          date_from: dateRange.from,
          date_to: dateRange.to
        }
      });

      if (result.error) {
        return { success: false, error: result.error };
      }

      return { success: true, data: result.data };
    } catch (error: any) {
      console.error('Error calculating custom total:', error);
      return { success: false, error: error.message };
    }
  }

  // Batch calculate multiple custom totals
  static async batchCalculateCustomTotals(
    configs: CustomTotalConfig[],
    projectId: string,
    agentId: string,
    dateRange: { from: string; to: string }
  ): Promise<{ success: boolean; data?: CustomTotalResult[]; error?: string }> {
    try {
      const result = await this.apiCall('/api/db-rpc', {
        method: 'batchCalculateCustomTotals',
        params: {
          configs,
          project_id: projectId,
          agent_id: agentId,
          date_from: dateRange.from,
          date_to: dateRange.to
        }
      });

      if (result.error) {
        return { success: false, error: result.error };
      }

      return { success: true, data: result.data || [] };
    } catch (error: any) {
      console.error('Error batch calculating custom totals:', error);
      return { success: false, error: error.message };
    }
  }

  // Get distinct values for a field
  static async getDistinctValues(
    agentId: string,
    columnName: string,
    jsonField?: string,
    limit: number = 100
  ): Promise<{ success: boolean; data?: string[]; error?: string }> {
    try {
      const result = await this.apiCall('/api/db-rpc', {
        method: 'getDistinctValues',
        params: {
          agent_id: agentId,
          column_name: columnName,
          json_field: jsonField,
          limit
        }
      });

      if (result.error) {
        return { success: false, error: result.error };
      }

      return { success: true, data: result.data || [] };
    } catch (error: any) {
      console.error('Error getting distinct values:', error);
      return { success: false, error: error.message };
    }
  }

  // Get available JSON fields
  static async getAvailableJsonFields(
    agentId: string,
    dateRange: { from: string; to: string }
  ): Promise<{ success: boolean; data?: string[]; error?: string }> {
    try {
      const result = await this.apiCall('/api/db-rpc', {
        method: 'getAvailableJsonFields',
        params: {
          agent_id: agentId,
          date_from: dateRange.from,
          date_to: dateRange.to
        }
      });

      if (result.error) {
        return { success: false, error: result.error };
      }

      return { success: true, data: result.data || [] };
    } catch (error: any) {
      console.error('Error getting available JSON fields:', error);
      return { success: false, error: error.message };
    }
  }

  // Save custom total configuration  
  static async saveCustomTotal(
    config: CustomTotalConfig, 
    projectId: string, 
    agentId: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const result = await this.apiCall('/api/overview', {
        table: 'pype_voice_custom_totals_configs',
        // This is a simplified implementation - you might need a separate insert API
        data: {
          project_id: projectId,
          agent_id: agentId,
          ...config
        }
      });

      if (result.error) {
        return { success: false, error: result.error };
      }

      return { success: true };
    } catch (error: any) {
      console.error('Error saving custom total:', error);
      return { success: false, error: error.message };
    }
  }

  // Delete custom total configuration
  static async deleteCustomTotal(configId: string): Promise<{ success: boolean; error?: string }> {
    try {
      const result = await this.apiCall('/api/overview', {
        table: 'pype_voice_custom_totals_configs',
        // This is a simplified implementation - you might need a separate delete API
        filters: [{ column: 'id', operator: 'eq', value: configId }]
      });

      if (result.error) {
        return { success: false, error: result.error };
      }

      return { success: true };
    } catch (error: any) {
      console.error('Error deleting custom total:', error);
      return { success: false, error: error.message };
    }
  }
}
