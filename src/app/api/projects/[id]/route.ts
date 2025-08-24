import { NextRequest, NextResponse } from 'next/server'
import { fetchFromTable, updateTable, deleteFromTable } from '../../../../lib/db-service'
import crypto from 'crypto'

// Generate a secure API token
function generateApiToken(): string {
  // Generate a random token with prefix for easy identification
  const randomBytes = crypto.randomBytes(32).toString('hex')
  return `pype_${randomBytes}`
}

// Hash a token using SHA-256
function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex')
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: projectId } = await params
    const body = await request.json()
    const { action } = body

    if (!projectId) {
      return NextResponse.json(
        { error: 'Project ID is required' },
        { status: 400 }
      )
    }

    if (action === 'regenerate_token') {
      // Generate new API token
      const newApiToken = generateApiToken()
      const newHashedToken = hashToken(newApiToken)

      // Update the project with the new hashed token
      const { data, error } = await updateTable(
        'pype_voice_projects', 
        { token_hash: newHashedToken }, 
        'id', 
        projectId
      )

      if (error) {
        console.error('Error regenerating project token:', error)
        return NextResponse.json(
          { error: 'Failed to regenerate token' },
          { status: 500 }
        )
      }

      // Return project data with the new unhashed token
      const response = {
        ...data,
        api_token: newApiToken // Include the unhashed token for display
      }

      console.log(`Successfully regenerated token for project "${data.name}"`)
      return NextResponse.json(response, { status: 200 })
    }

    return NextResponse.json(
      { error: 'Invalid action' },
      { status: 400 }
    )

  } catch (error) {
    console.error('Unexpected error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: projectId } = await params
    const body = await request.json()
    const { retry_configuration } = body

    if (!projectId) {
      return NextResponse.json(
        { error: 'Project ID is required' },
        { status: 400 }
      )
    }

    // Validate retry_configuration if provided
    if (retry_configuration) {
      const validCodes = ['408', '480', '486', '504', '600']
      for (const [code, minutes] of Object.entries(retry_configuration)) {
        if (!validCodes.includes(code)) {
          return NextResponse.json(
            { error: `Invalid SIP code: ${code}` },
            { status: 400 }
          )
        }
        if (typeof minutes !== 'number' || minutes < 1 || minutes > 1440) {
          return NextResponse.json(
            { error: `Invalid retry minutes for ${code}: must be between 1 and 1440` },
            { status: 400 }
          )
        }
      }
    }

    // Update the project with retry configuration
    const { data, error } = await updateTable(
      'pype_voice_projects', 
      { retry_configuration }, 
      'id', 
      projectId
    )

    if (error) {
      console.error('Error updating project:', error)
      return NextResponse.json(
        { error: 'Failed to update project' },
        { status: 500 }
      )
    }

    console.log(`Successfully updated retry configuration for project "${data.name}"`)
    return NextResponse.json(data, { status: 200 })

  } catch (error) {
    console.error('Unexpected error updating project:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: projectId } = await params

    if (!projectId) {
      return NextResponse.json(
        { error: 'Project ID is required' },
        { status: 400 }
      )
    }

    // Start cascade deletion process
    console.log(`Starting cascade delete for project: ${projectId}`)

    // 1. Get all agents for this project first
    const { data: agents, error: agentsError } = await fetchFromTable({
      table: 'pype_voice_agents',
      select: 'id',
      filters: [{ column: 'project_id', operator: '=', value: projectId }]
    })

    if (agentsError) {
      console.error('Error fetching agents:', agentsError)
      return NextResponse.json(
        { error: 'Failed to fetch project agents' },
        { status: 500 }
      )
    }

    const agentIds = Array.isArray(agents) ? agents.map((agent: any) => agent.id) : []
    console.log(`Found ${agentIds.length} agents to clean up`)

    // 2. Delete call logs for all agents in this project
    if (agentIds.length > 0) {
      // Delete call logs for each agent individually
      for (const agentId of agentIds) {
        const { error: callLogError } = await deleteFromTable('pype_voice_call_logs', 'agent_id', agentId)
        if (callLogError) {
          console.error(`Error deleting call logs for agent ${agentId}:`, callLogError)
        }
      }
      console.log('Successfully deleted call logs')

      // 3. Delete metrics logs for each agent individually
      for (const agentId of agentIds) {
        const { error: metricsError } = await deleteFromTable('pype_voice_metrics_logs', 'session_id', agentId)
        if (metricsError) {
          console.warn(`Warning: Could not delete metrics logs for agent ${agentId}:`, metricsError)
        }
      }
      console.log('Successfully deleted metrics logs')
    }

    console.log('Successfully deleted auth tokens')

    // 5. Delete all agents for this project
    const { error: agentsDeleteError } = await deleteFromTable('pype_voice_agents', 'project_id', projectId)

    if (agentsDeleteError) {
      console.error('Error deleting agents:', agentsDeleteError)
      return NextResponse.json(
        { error: 'Failed to delete agents' },
        { status: 500 }
      )
    }
    console.log('Successfully deleted agents')

    // 6. Finally, delete the project itself
    const { error: projectError } = await deleteFromTable('pype_voice_projects', 'id', projectId)

    if (projectError) {
      console.error('Error deleting project:', projectError)
      return NextResponse.json(
        { error: 'Failed to delete project' },
        { status: 500 }
      )
    }
    
    console.log(`Successfully deleted project: ${projectId}`)

    return NextResponse.json(
      { 
        message: 'Project and all related data deleted successfully'
      },
      { status: 200 }
    )

  } catch (error) {
    console.error('Unexpected error during project deletion:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
} 