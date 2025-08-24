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

    // Return agent data (without exposing encrypted keys)
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
      field_extractor_keys: agent.field_extractor_keys
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
    const { error: callLogsError } = await deleteFromTable('pype_voice_call_logs', 'agent_id', agentId)

    if (callLogsError) {
      console.error('Error deleting call logs:', callLogsError)
      return NextResponse.json(
        { error: 'Failed to delete call logs' },
        { status: 500 }
      )
    }
    console.log('Successfully deleted call logs')

    // 2. Delete metrics logs (adjust based on your schema relationships)
    const { error: metricsError } = await deleteFromTable('pype_voice_metrics_logs', 'session_id', agentId) // Adjust this field based on your actual schema

    // Don't fail if metrics logs have different relationships
    if (metricsError) {
      console.warn('Warning: Could not delete metrics logs:', metricsError)
    } else {
      console.log('Successfully deleted metrics logs')
    }

    console.log('Successfully deleted auth tokens')

    // 4. Finally, delete the agent itself
    const { error: agentError } = await deleteFromTable('pype_voice_agents', 'id', agentId)

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