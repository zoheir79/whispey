// src/app/api/agents/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { encryptApiKey } from '@/lib/vapi-encryption'
import { fetchFromTable, insertIntoTable } from '@/lib/db-service'
import { verifyUserAuth } from '@/lib/auth'
import { getUserGlobalRole } from '@/services/getGlobalRole'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { name, agent_type, configuration, project_id, environment, platform } = body

    console.log('📥 Received agent creation request:', {
      name,
      agent_type, 
      platform,
      project_id,
      environment
    })

    // Validation
    if (!name || !name.trim()) {
      return NextResponse.json(
        { error: 'Agent name is required' },
        { status: 400 }
      )
    }

    if (!agent_type) {
      return NextResponse.json(
        { error: 'Agent type is required' },
        { status: 400 }
      )
    }

    if (!project_id) {
      return NextResponse.json(
        { error: 'Project ID is required' },
        { status: 400 }
      )
    }

    if (!platform || !['livekit', 'vapi'].includes(platform)) {
      return NextResponse.json(
        { error: 'Platform must be either "livekit" or "vapi"' },
        { status: 400 }
      )
    }

    // Additional validation for Vapi agents
    if (platform === 'vapi') {
      if (!configuration?.vapi?.apiKey || !configuration?.vapi?.assistantId || !configuration?.vapi?.projectApiKey) {
        return NextResponse.json(
          { error: 'Vapi configuration is incomplete. Required: apiKey, assistantId, projectApiKey' },
          { status: 400 }
        )
      }
    }

    // Verify project exists
    const { data: project, error: projectError } = await fetchFromTable({
      table: 'pype_voice_projects',
      select: 'id',
      filters: [{ column: 'id', operator: 'eq', value: project_id }],
      limit: 1
    })

    if (projectError || !project || project.length === 0) {
      console.error('Project lookup error:', projectError)
      return NextResponse.json(
        { error: 'Invalid project ID' },
        { status: 400 }
      )
    }

    // Check if agent with same name already exists in this project  
    const { data: existingAgents, error: checkError } = await fetchFromTable({
      table: 'pype_voice_agents',
      select: 'id, name',
      filters: [
        { column: 'project_id', operator: 'eq', value: project_id },
        { column: 'name', operator: 'eq', value: name.trim() }
      ],
      limit: 1
    })

    if (checkError) {
      console.error('❌ Error checking existing agent:', checkError)
      return NextResponse.json(
        { error: 'Failed to validate agent name' },
        { status: 500 }
      )
    }

    if (existingAgents && existingAgents.length > 0) {
      return NextResponse.json(
        { error: `Agent with name "${name.trim()}" already exists in this project. Please choose a different name.` },
        { status: 409 }
      )
    }

    // Create agent data with proper typing
    const agentData: any = {
      name: name.trim(),
      agent_type,
      configuration: configuration || {},
      project_id,
      environment: environment || 'dev',
      is_active: true
    }

    // If it's a Vapi agent, encrypt and store the API keys
    if (platform === 'vapi' && configuration?.vapi) {
      // Encrypt the API keys with project-specific encryption
      agentData.vapi_api_key_encrypted = encryptApiKey(
        configuration.vapi.apiKey, 
        project_id
      )
      agentData.vapi_project_key_encrypted = encryptApiKey(
        configuration.vapi.projectApiKey, 
        project_id
      )
      
      // Remove the plain text API keys from configuration before storing
      const cleanConfiguration = { ...configuration }
      if (cleanConfiguration.vapi) {
        delete cleanConfiguration.vapi.apiKey
        delete cleanConfiguration.vapi.projectApiKey
        agentData.configuration = cleanConfiguration
      }
      
      console.log('🔐 Vapi API keys encrypted and stored securely')
    }

    console.log('💾 Inserting agent data:', {
      ...agentData,
      vapi_api_key_encrypted: agentData.vapi_api_key_encrypted ? '[ENCRYPTED]' : undefined,
      vapi_project_key_encrypted: agentData.vapi_project_key_encrypted ? '[ENCRYPTED]' : undefined
    })

    // Insert agent into pype_voice_agents
    const { data: agent, error: agentError } = await insertIntoTable({
        table: 'pype_voice_agents',
        data: agentData
      })

    if (agentError) {
      console.error('❌ Error creating agent:', agentError)
      return NextResponse.json(
        { error: `Failed to create agent: ${agentError instanceof Error ? agentError.message : 'Unknown error'}` },
        { status: 500 }
      )
    }

    console.log(`✅ Successfully created ${platform} agent "${agent.name}" with ID: ${agent.id}`)
    
    return NextResponse.json(agent, { status: 201 })

  } catch (error) {
    console.error('💥 Unexpected error creating agent:', error)
    return NextResponse.json(
      { error: `Internal server error: ${error instanceof Error ? error.message : 'Unknown error'}` },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  try {
    // Verify user authentication
    const { isAuthenticated, userId } = await verifyUserAuth(request);
    
    if (!isAuthenticated || !userId) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Get user's global role and permissions
    const userGlobalRole = await getUserGlobalRole(userId);
    
    if (!userGlobalRole) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    const { searchParams } = new URL(request.url)
    const projectId = searchParams.get('project_id')

    let filters: any[] = [
      { column: 'is_active', operator: 'eq', value: true }
    ];

    // If user is admin, they can see all agents
    if (userGlobalRole.permissions.canViewAllAgents) {
      // Admin can see all agents, optionally filtered by project
      if (projectId) {
        filters.push({ column: 'project_id', operator: 'eq', value: projectId });
      }
    } else {
      // Regular users can only see agents from projects they have access to
      if (projectId) {
        // If specific project is requested, filter by it
        filters.push({ column: 'project_id', operator: 'eq', value: projectId });
      } else {
        // Get all projects user has access to
        const { data: userProjects, error: projectsError } = await fetchFromTable({
          table: 'pype_voice_email_project_mapping',
          select: 'project_id',
          filters: [
            { column: 'email', operator: 'eq', value: userGlobalRole.email },
            { column: 'is_active', operator: 'eq', value: true }
          ]
        });

        if (projectsError) {
          console.error('Error fetching user projects:', projectsError);
          return NextResponse.json(
            { error: 'Failed to fetch user projects' },
            { status: 500 }
          );
        }

        const projectIds = userProjects?.map((p: any) => p.project_id) || [];
        
        if (projectIds.length === 0) {
          return NextResponse.json({ 
            agents: [],
            userRole: userGlobalRole.global_role,
            canViewAll: false
          });
        }

        filters.push({ column: 'project_id', operator: 'in', value: projectIds });
      }
    }

    const { data: agents, error } = await fetchFromTable({
      table: 'pype_voice_agents',
      select: '*',
      filters,
      orderBy: { column: 'created_at', ascending: false }
    });

    if (error) {
      console.error('Error fetching agents:', error)
      return NextResponse.json(
        { error: 'Failed to fetch agents' },
        { status: 500 }
      );
    }

    return NextResponse.json({ 
      agents,
      userRole: userGlobalRole.global_role,
      canViewAll: userGlobalRole.permissions.canViewAllAgents
    });

  } catch (error) {
    console.error('Unexpected error fetching agents:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}