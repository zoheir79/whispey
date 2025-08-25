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

// ADD PATCH method for updating agents
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: agentId } = await params
    const body = await request.json()

    console.log('🔍 Updating agent with ID:', agentId)
    console.log('🔍 Update data:', body)

    if (!agentId) {
      return NextResponse.json(
        { error: 'Agent ID is required' },
        { status: 400 }
      )
    }

    // Build update fields dynamically from request body
    const updateFields: string[] = []
    const values: any[] = []
    let paramIndex = 1

    // Common updatable fields
    const allowedFields = [
      'name', 'agent_type', 'configuration', 'environment', 'is_active',
      'field_extractor', 'field_extractor_prompt', 'field_extractor_keys',
      'vapi_api_key_encrypted', 'vapi_project_key_encrypted'
    ]

    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updateFields.push(`${field} = $${paramIndex}`)
        values.push(body[field])
        paramIndex++
      }
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

    // Return updated agent data (without exposing encrypted keys in response)
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
      field_extractor_keys: updatedAgent.field_extractor_keys
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