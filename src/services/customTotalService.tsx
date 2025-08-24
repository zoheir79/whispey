import { insertIntoTable, fetchFromTable, updateTable, deleteFromTable } from '../lib/db-service'
import { calculateCustomTotal as rpcCalculateCustomTotal, batchCalculateCustomTotals as rpcBatchCalculateCustomTotals, getDistinctValues as rpcGetDistinctValues, getAvailableJsonFields as rpcGetAvailableJsonFields } from '../lib/db-rpc'
import { CustomTotalConfig, CustomFilter, CustomTotalResult } from '../types/customTotals'
import { DbResponse } from '../lib/db-types'

export class CustomTotalsService {
  // Save custom total configuration to database (unchanged)
  static async saveCustomTotal(
    config: CustomTotalConfig, 
    projectId: string, 
    agentId: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const { error } = await insertIntoTable({
        table: 'pype_voice_custom_totals_configs',
        data: {
        project_id: projectId,
        agent_id: agentId,
        name: config.name,
        description: config.description,
        aggregation: config.aggregation,
        column_name: config.column,
        json_field: config.jsonField,
        filters: config.filters,
        filter_logic: config.filterLogic,
        icon: config.icon,
        color: config.color,
        created_by: config.createdBy
      }
      })

      if (error) {
        console.error('Error saving custom total:', error)
        return { success: false, error: error.message }
      }

      return { success: true }
    } catch (error) {
      console.error('Error saving custom total:', error)
      return { success: false, error: 'Failed to save custom total' }
    }
  }

  // Get all custom totals for an agent 
  static async getCustomTotals(projectId: string, agentId: string): Promise<CustomTotalConfig[]> {
    try {
      const { data, error } = await fetchFromTable<Record<string, any>>('pype_voice_custom_totals_configs', {
        filters: [
          { column: 'project_id', operator: 'eq', value: projectId },
          { column: 'agent_id', operator: 'eq', value: agentId }
        ],
        orderBy: { column: 'created_at', ascending: true }
      })

      if (error || !data) {
        console.error('Error fetching custom totals:', error)
        return []
      }

      return data.map((row: Record<string, any>) => ({
        id: row.id,
        name: row.name,
        description: row.description || '',
        aggregation: row.aggregation,
        column: row.column_name,
        jsonField: row.json_field,
        filters: typeof row.filters === 'string' ? (JSON.parse(row.filters) || []) : (row.filters || []),
        filterLogic: row.filter_logic,
        icon: row.icon || 'calculator',
        color: row.color || 'blue',
        createdBy: row.created_by,
        createdAt: row.created_at,
        updatedAt: row.updated_at
      }))
    } catch (error) {
      console.error('Error fetching custom totals:', error)
      return []
    }
  }

  // Calculate custom total value using RPC - UPDATED TO USE RPC
 
// In your CustomTotalsService.calculateCustomTotal method:

static async calculateCustomTotal(
  config: CustomTotalConfig,
  agentId: string,
  dateFrom?: string,
  dateTo?: string
): Promise<CustomTotalResult> {
  try {
    // Ensure proper null handling for json_field
    const jsonField = config.jsonField && config.jsonField.trim() !== '' 
      ? config.jsonField 
      : null;

    const { data, error } = await rpcCalculateCustomTotal({
      agent_id: agentId,
      aggregation: config.aggregation,
      column_name: config.column,
      json_field: jsonField, // Pass null instead of empty string
      filters: config.filters,
      filter_logic: config.filterLogic,
      date_from: dateFrom || null,
      date_to: dateTo || null
    })

    if (error || !data) {
      console.error('Error calculating custom total:', error)
      return {
        configId: config.id,
        value: 0,
        label: config.name,
        error: error?.message || 'Calculation failed'
      }
    }


    // RPC returns array with one result
    const result = data?.[0]
    if (result?.error_message) {
      return {
        configId: config.id,
        value: 0,
        label: config.name,
        error: result.error_message
      }
    }

    return {
      configId: config.id,
      value: result?.result || 0,
      label: config.name
    }
  } catch (error) {
    console.error('Error calculating custom total:', error)
    return {
      configId: config.id,
      value: 0,
      label: config.name,
      error: 'Calculation failed'
    }
  }
}

  // NEW: Batch  // Calculate multiple custom totals in batch
  static async batchCalculateCustomTotals(
    configs: CustomTotalConfig[], 
    projectId: string, 
    agentId: string
  ): Promise<CustomTotalResult[]> {
    try {
      // Prepare batch params
      const batchParams = {
        configs: configs.map(config => ({
          config_id: config.id,
          aggregation: config.aggregation,
          column_name: config.column,
          json_field: config.jsonField,
          filters: config.filters,
          filter_logic: config.filterLogic
        })),
        project_id: projectId,
        agent_id: agentId
      }

      // Call batch RPC function
      const { data, error } = await rpcBatchCalculateCustomTotals(batchParams)

      if (error || !data) {
        console.error('Error batch calculating custom totals:', error)
        return configs.map(config => ({
          configId: config.id,
          value: 0,
          label: config.name,
          error: 'Calculation failed'
        }))
      }

      // Map results back to CustomTotalResult format
      return data.map((result: Record<string, any>) => {
        const config = configs.find(c => c.id === result.config_id)
        return {
          configId: result.config_id,
          value: result.result || 0,
          label: config?.name || 'Unknown',
          error: result.error_message || undefined
        }
      })
    } catch (error) {
      console.error('Error batch calculating custom totals:', error)
      return configs.map(config => ({
        configId: config.id,
        value: 0,
        label: config.name,
        error: 'Calculation failed'
      }))
    }
  }

  // NEW: Get distinct values for a column
  static async getDistinctValues(
    agentId: string,
    columnName: string,
    jsonField: string | null,
    limit = 50
  ): Promise<Array<{ value: string; count: number }>> {
    try {
      const { data, error } = await rpcGetDistinctValues({
        agent_id: agentId,
        column_name: columnName,
        json_field: jsonField,
        limit: limit
      })

      if (error || !data) {
        console.error('Error getting distinct values:', error)
        return []
      }

      return data.map((row: Record<string, any>) => ({
        value: row.distinct_value,
        count: parseInt(row.count_occurrences)
      }))
    } catch (error) {
      console.error('Error getting distinct values:', error)
      return []
    }
  }

  // NEW: Get available JSON fields dynamically
  static async getAvailableJsonFields(
    agentId: string,
    columnName: string,
    limit = 50
  ): Promise<Array<{ fieldName: string; sampleValue: string; occurrences: number }>> {
    try {
      const { data, error } = await rpcGetAvailableJsonFields({
        agent_id: agentId,
        column_name: columnName,
        limit: limit
      })

      if (error || !data) {
        console.error('Error getting JSON fields:', error)
        return []
      }

      return data.map((row: Record<string, any>) => ({
        fieldName: row.field_name,
        sampleValue: row.sample_value,
        occurrences: parseInt(row.occurrences)
      }))
    } catch (error) {
      console.error('Error getting JSON fields:', error)
      return []
    }
  }

  // Delete custom total (unchanged)
  static async deleteCustomTotal(
    configId: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const { error } = await deleteFromTable({
   table: 'pype_voice_custom_totals_configs',
   filters: [{ column: 'id', operator: 'eq', value: configId }]
 })

      if (error) {
        return { success: false, error: error.message }
      }

      return { success: true }
    } catch (error) {
      return { success: false, error: 'Failed to delete custom total' }
    }
  }

  // Update custom total (unchanged)
  static async updateCustomTotal(
    configId: string,
    updates: Partial<CustomTotalConfig>
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const { error } = await updateTable({
        table: 'pype_voice_custom_totals_configs',
        data: {
          name: updates.name,
          description: updates.description,
          aggregation: updates.aggregation,
          column_name: updates.column,
          json_field: updates.jsonField,
          filters: updates.filters,
          filter_logic: updates.filterLogic,
          icon: updates.icon,
          color: updates.color,
          updated_at: new Date().toISOString()
        },
        filters: [{ column: 'id', operator: 'eq', value: configId }]
      })

      if (error) {
        return { success: false, error: error.message }
      }

      return { success: true }
    } catch (error) {
      return { success: false, error: 'Failed to update custom total' }
    }
  }
}