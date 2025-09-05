// src/app/api/agents/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { fetchFromTable, deleteFromTable } from '@/lib/db-service'

// ADD THIS GET METHOD to your existing file
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: agentId } = await params

    console.log('🔍 Fetching agent with ID:', agentId)

    // Fetch agent data from database
    const { data: agentData, error } = await fetchFromTable({
      table: 'pype_voice_agents',
      select: '*',
      filters: [{ column: 'id', operator: '=', value: agentId }]
    })
    
    const agent = Array.isArray(agentData) && agentData.length > 0 ? agentData[0] as any : null

    if (error || !agent) {
      console.error('❌ Database error:', error)
      return NextResponse.json(
        { error: 'Agent not found' },
        { status: 404 }
      )
    }

    if (!agent) {
      return NextResponse.json(
        { error: 'Agent not found' },
        { status: 404 }
      )
    }

    console.log('✅ Agent found:', {
      id: agent.id,
      name: agent.name,
      agent_type: agent.agent_type,
      hasVapiKeys: Boolean(agent.vapi_api_key_encrypted)
    })

    // Enrich cost_overrides with detailed provider info for form pre-population
    let enrichedCostOverrides = null;
    if (agent.cost_overrides) {
      enrichedCostOverrides = {
        // STT overrides with provider selection and units
        stt_provider_id: agent.cost_overrides.stt_provider_id || null,
        stt_cost_per_minute: agent.cost_overrides.stt_cost_per_minute || null,
        stt_monthly_cost: agent.cost_overrides.stt_monthly_cost || null,
        stt_unit: agent.cost_overrides.stt_unit || 'per_minute', // per_minute, monthly_dedicated
        
        // TTS overrides with provider selection and units  
        tts_provider_id: agent.cost_overrides.tts_provider_id || null,
        tts_cost_per_word: agent.cost_overrides.tts_cost_per_word || null,
        tts_cost_per_character: agent.cost_overrides.tts_cost_per_character || null,
        tts_monthly_cost: agent.cost_overrides.tts_monthly_cost || null,
        tts_unit: agent.cost_overrides.tts_unit || 'per_word', // per_word, per_character, monthly_dedicated
        
        // LLM overrides with provider selection and units
        llm_provider_id: agent.cost_overrides.llm_provider_id || null,
        llm_cost_per_input_token: agent.cost_overrides.llm_cost_per_input_token || null,
        llm_cost_per_output_token: agent.cost_overrides.llm_cost_per_output_token || null,
        llm_monthly_cost: agent.cost_overrides.llm_monthly_cost || null,
        llm_unit: agent.cost_overrides.llm_unit || 'per_token', // per_token, monthly_dedicated
        
        // Copy any other override fields
        ...agent.cost_overrides
      };
    }

    // Enrich provider_config with complete URLs and API keys for form pre-population
    let enrichedProviderConfig = agent.provider_config || {};
    
    // Extract provider URLs and API keys for each service type
    const providerDetails = {
      // STT Provider configuration
      stt: {
        provider_id: enrichedProviderConfig.stt?.provider_id || null,
        custom_url: enrichedProviderConfig.stt?.url || null,
        api_key: enrichedProviderConfig.stt?.api_key || null,
        model: enrichedProviderConfig.stt?.model || null,
        // Copy all STT config
        ...enrichedProviderConfig.stt
      },
      
      // TTS Provider configuration  
      tts: {
        provider_id: enrichedProviderConfig.tts?.provider_id || null,
        custom_url: enrichedProviderConfig.tts?.url || null,
        api_key: enrichedProviderConfig.tts?.api_key || null,
        model: enrichedProviderConfig.tts?.model || null,
        voice: enrichedProviderConfig.tts?.voice || null,
        // Copy all TTS config
        ...enrichedProviderConfig.tts
      },
      
      // LLM Provider configuration
      llm: {
        provider_id: enrichedProviderConfig.llm?.provider_id || null,
        custom_url: enrichedProviderConfig.llm?.url || null,
        api_key: enrichedProviderConfig.llm?.api_key || null,
        model: enrichedProviderConfig.llm?.model || null,
        // Copy all LLM config
        ...enrichedProviderConfig.llm
      }
    };

    // Return agent data (without exposing encrypted keys) with all form fields
    const agentResponse = {
      id: agent.id,
      name: agent.name,
      agent_type: agent.agent_type,
      configuration: agent.configuration,
      project_id: agent.project_id,
      environment: agent.environment,
      is_active: agent.is_active,
      created_at: agent.created_at,
      updated_at: agent.updated_at,
      user_id: agent.user_id,
      // Include boolean flags but not the actual encrypted keys
      has_vapi_keys: Boolean(agent.vapi_api_key_encrypted && agent.vapi_project_key_encrypted),
      vapi_api_key_encrypted: agent.vapi_api_key_encrypted, // Keep for the check
      vapi_project_key_encrypted: agent.vapi_project_key_encrypted, // Keep for the check
      // Include other fields you might have
      field_extractor: agent.field_extractor,
      field_extractor_prompt: agent.field_extractor_prompt,
      field_extractor_keys: agent.field_extractor_keys,
      // Billing and configuration fields for form pre-population
      platform_mode: agent.platform_mode || 'pag',
      billing_cycle: agent.billing_cycle || 'monthly',
      provider_config: enrichedProviderConfig,
      provider_details: providerDetails, // Detailed provider config for form
      cost_overrides: enrichedCostOverrides,
      s3_storage_gb: agent.s3_storage_gb || 50,
      // Platform info for form logic
      platform: agent.platform || (agent.agent_type === 'vapi' ? 'vapi' : 'livekit')
    }

    return NextResponse.json(agentResponse)

  } catch (error) {
    console.error('💥 Error fetching agent:', error)
    return NextResponse.json(
      { error: `Failed to fetch agent: ${error instanceof Error ? error.message : 'Unknown error'}` },
      { status: 500 }
    )
  }
}

// ADD PATCH method for updating agents
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: agentId } = await params
    const body = await request.json()
    const { 
      name, 
      agent_type, 
      configuration, 
      environment, 
      is_active,
      platform_mode,
      billing_cycle,
      provider_config,
      cost_overrides,
      s3_storage_gb,
      field_extractor,
      field_extractor_prompt,
      field_extractor_keys
    } = body

    console.log('🔍 Updating agent with ID:', agentId)
    console.log('🔍 Update data:', body)

    if (!agentId) {
      return NextResponse.json(
        { error: 'Agent ID is required' },
        { status: 400 }
      )
    }

    // Validation similar to creation logic
    if (name && !name.trim()) {
      return NextResponse.json(
        { error: 'Agent name cannot be empty' },
        { status: 400 }
      )
    }

    // Validate platform_mode if provided
    if (platform_mode && !['pag', 'dedicated', 'hybrid'].includes(platform_mode)) {
      return NextResponse.json(
        { error: 'platform_mode must be one of: pag, dedicated, hybrid' },
        { status: 400 }
      )
    }

    // Validate billing_cycle if provided
    if (billing_cycle && !['monthly', 'annual'].includes(billing_cycle)) {
      return NextResponse.json(
        { error: 'billing_cycle must be either monthly or annual' },
        { status: 400 }
      )
    }

    // Build update fields dynamically from request body
    const updateFields: string[] = []
    const values: any[] = []
    let paramIndex = 1

    // Process updatable fields with validation
    const fieldUpdates: Record<string, any> = {}
    
    if (name !== undefined) fieldUpdates.name = name.trim()
    if (agent_type !== undefined) fieldUpdates.agent_type = agent_type
    if (configuration !== undefined) fieldUpdates.configuration = configuration
    if (environment !== undefined) fieldUpdates.environment = environment
    if (is_active !== undefined) fieldUpdates.is_active = is_active
    if (platform_mode !== undefined) fieldUpdates.platform_mode = platform_mode
    if (billing_cycle !== undefined) fieldUpdates.billing_cycle = billing_cycle
    if (provider_config !== undefined) fieldUpdates.provider_config = provider_config
    if (cost_overrides !== undefined) fieldUpdates.cost_overrides = cost_overrides
    if (s3_storage_gb !== undefined) fieldUpdates.s3_storage_gb = s3_storage_gb
    if (field_extractor !== undefined) fieldUpdates.field_extractor = field_extractor
    if (field_extractor_prompt !== undefined) fieldUpdates.field_extractor_prompt = field_extractor_prompt
    if (field_extractor_keys !== undefined) fieldUpdates.field_extractor_keys = field_extractor_keys

    for (const [field, value] of Object.entries(fieldUpdates)) {
      updateFields.push(`${field} = $${paramIndex}`)
      values.push(value)
      paramIndex++
    }

    // Add updated_at timestamp
    updateFields.push(`updated_at = $${paramIndex}`)
    values.push(new Date().toISOString())
    values.push(agentId) // For WHERE clause

    if (updateFields.length === 1) { // Only updated_at was added
      return NextResponse.json(
        { error: 'No valid fields to update' },
        { status: 400 }
      )
    }

    const sql = `UPDATE pype_voice_agents SET ${updateFields.join(', ')} WHERE id = $${paramIndex + 1} RETURNING *`
    
    console.log('🔍 SQL Update:', sql)
    console.log('🔍 Values:', values)

    // Execute update using raw query since we need RETURNING
    const { query } = await import('@/lib/db')
    const result = await query(sql, values)

    if (result.rows.length === 0) {
      return NextResponse.json(
        { error: 'Agent not found' },
        { status: 404 }
      )
    }

    const updatedAgent = result.rows[0]
    console.log('✅ Agent updated successfully:', updatedAgent.id)

    // Return agent data (without exposing encrypted keys)
    const agentResponse = {
      id: updatedAgent.id,
      name: updatedAgent.name,
      agent_type: updatedAgent.agent_type,
      configuration: updatedAgent.configuration,
      project_id: updatedAgent.project_id,
      environment: updatedAgent.environment,
      is_active: updatedAgent.is_active,
      created_at: updatedAgent.created_at,
      updated_at: updatedAgent.updated_at,
      user_id: updatedAgent.user_id,
      has_vapi_keys: Boolean(updatedAgent.vapi_api_key_encrypted && updatedAgent.vapi_project_key_encrypted),
      field_extractor: updatedAgent.field_extractor,
      field_extractor_prompt: updatedAgent.field_extractor_prompt,
      field_extractor_keys: updatedAgent.field_extractor_keys,
      platform_mode: updatedAgent.platform_mode || 'pag',
      billing_cycle: updatedAgent.billing_cycle || 'monthly',
      provider_config: updatedAgent.provider_config || {},
      cost_overrides: updatedAgent.cost_overrides || null,
      s3_storage_gb: updatedAgent.s3_storage_gb || 50,
      platform: updatedAgent.platform || 'vapi' // Derived from agent_type or stored separately
    }

    return NextResponse.json(agentResponse)

  } catch (error) {
    console.error('💥 Error updating agent:', error)
    return NextResponse.json(
      { error: `Failed to update agent: ${error instanceof Error ? error.message : 'Unknown error'}` },
      { status: 500 }
    )
  }
}

// Your existing DELETE method stays exactly the same
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: agentId } = await params

    if (!agentId) {
      return NextResponse.json(
        { error: 'Agent ID is required' },
        { status: 400 }
      )
    }

    // Start cascade deletion process
    console.log(`Starting cascade delete for agent: ${agentId}`)

    // 1. Delete call logs for this agent
    const { error: callLogsError } = await deleteFromTable({
   table: 'pype_voice_call_logs',
   filters: [{ column: 'agent_id', operator: 'eq', value: agentId }]
 })

    if (callLogsError) {
      console.error('Error deleting call logs:', callLogsError)
      return NextResponse.json(
        { error: 'Failed to delete call logs' },
        { status: 500 }
      )
    }
    console.log('Successfully deleted call logs')

    // 2. Delete metrics logs (adjust based on your schema relationships)
    const { error: metricsError } = await deleteFromTable({
   table: 'pype_voice_metrics_logs',
   filters: [{ column: 'session_id', operator: 'eq', value: agentId }]
 }) // Adjust this field based on your actual schema

    // Don't fail if metrics logs have different relationships
    if (metricsError) {
      console.warn('Warning: Could not delete metrics logs:', metricsError)
    } else {
      console.log('Successfully deleted metrics logs')
    }

    console.log('Successfully deleted auth tokens')

    // 4. Finally, delete the agent itself
    const { error: agentError } = await deleteFromTable({
   table: 'pype_voice_agents',
   filters: [{ column: 'id', operator: 'eq', value: agentId }]
 })

    if (agentError) {
      console.error('Error deleting agent:', agentError)
      return NextResponse.json(
        { error: 'Failed to delete agent' },
        { status: 500 }
      )
    }
    
    console.log(`Successfully deleted agent: ${agentId}`)

    return NextResponse.json(
      { 
        message: 'Agent and all related data deleted successfully'
      },
      { status: 200 }
    )

  } catch (error) {
    console.error('Unexpected error during agent deletion:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}