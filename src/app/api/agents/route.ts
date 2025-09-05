// src/app/api/agents/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { encryptApiKey } from '@/lib/vapi-encryption';
import { fetchFromTable, insertIntoTable } from '@/lib/db-service';
import { query } from '@/lib/db';
import { verifyUserAuth } from '@/lib/auth';
import { getUserGlobalRole } from '@/services/getGlobalRole';

export async function POST(request: NextRequest) {
  try {
    // Verify user authentication and permissions
    const { isAuthenticated, userId } = await verifyUserAuth(request);
    
    if (!isAuthenticated || !userId) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const body = await request.json()
    const { 
      name, 
      agent_type, 
      configuration, 
      project_id, 
      environment, 
      platform,
      billing_cycle,
      s3_enabled,
      s3_storage_gb,
      s3_cost_override,
      platform_mode,
      provider_config,
      cost_overrides
    } = body

    console.log('📥 Received agent creation request:', {
      name,
      agent_type, 
      platform,
      project_id,
      environment,
      userId
    })

    // Check user permissions for agent creation
    const userGlobalRole = await getUserGlobalRole(userId);
    
    if (!userGlobalRole) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Check if user has permission to create agents in this project
    // Super admin can always create agents, otherwise check project membership
    if (userGlobalRole.global_role !== 'super_admin') {
      // For regular users, verify they have access to this specific project with member role or higher
      const accessCheck = await query(`
        SELECT epm.id 
        FROM pype_voice_email_project_mapping epm
        INNER JOIN pype_voice_users u ON u.email = epm.email
        WHERE u.user_id = $1 AND epm.project_id = $2 AND epm.is_active = true
        AND epm.role IN ('member', 'admin', 'owner')
      `, [userId, project_id]);

      if (!accessCheck.rows || accessCheck.rows.length === 0) {
        return NextResponse.json(
          { error: 'You need at least member role to create agents in this project' },
          { status: 403 }
        );
      }
    }

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

    // Verify project exists and get S3 configuration
    const { data: project, error: projectError } = await fetchFromTable({
      table: 'pype_voice_projects',
      select: 'id, s3_enabled, s3_region, s3_endpoint, s3_access_key, s3_secret_key, s3_bucket_prefix',
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

    // Get project S3 configuration  
    const projectS3Config = project && project.length > 0 ? project[0] as any : null
    const isS3Available = projectS3Config?.s3_enabled && projectS3Config?.s3_bucket_prefix

    // Create agent data with proper typing
    const agentData: any = {
      name: name.trim(),
      agent_type,
      configuration: configuration || {},
      project_id,
      environment: environment || 'dev',
      is_active: true,
      billing_cycle: billing_cycle || 'monthly',
      s3_enabled: agent_type === 'voice' && s3_enabled && isS3Available ? true : false,
      s3_storage_gb: agent_type === 'voice' && s3_enabled && isS3Available ? (s3_storage_gb || 50) : 0,
      s3_cost_override: agent_type === 'voice' && s3_enabled && isS3Available ? s3_cost_override : null,
      platform_mode: platform_mode || 'pag',
      provider_config: provider_config || {},
      cost_overrides: cost_overrides || null
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

    // Create S3 bucket if S3 is enabled for voice agent
    if (agent_type === 'voice' && s3_enabled && isS3Available && projectS3Config) {
      try {
        const bucketName = `${projectS3Config.s3_bucket_prefix}-${agent.id}`
        
        console.log(`🪣 Creating S3 bucket: ${bucketName}`)
        
        // Insert S3 bucket record
        const { error: bucketError } = await insertIntoTable({
          table: 'pype_voice_agent_s3_buckets',
          data: {
            agent_id: agent.id,
            project_id: project_id,
            bucket_name: bucketName,
            region: projectS3Config.s3_region,
            storage_gb: agentData.s3_storage_gb,
            cost_per_gb: agentData.s3_cost_override || projectS3Config.s3_cost_per_gb || 0.023,
            is_active: true,
            created_at: new Date().toISOString()
          }
        })

        if (bucketError) {
          console.error('❌ Error creating S3 bucket record:', bucketError)
          // Don't fail the agent creation, just log the error
        } else {
          console.log(`✅ S3 bucket record created: ${bucketName}`)
        }

        // TODO: Implement actual S3 bucket creation using AWS SDK
        // This would require AWS credentials and SDK integration
        
      } catch (bucketCreationError) {
        console.error('❌ Error in S3 bucket creation process:', bucketCreationError)
        // Don't fail the agent creation, just log the error
      }
    }
    
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

    let sql: string;
    let params: any[];

    // Build SQL query based on user role
    if (userGlobalRole.permissions.canViewAllAgents) {
      // Admin/Super Admin: see ALL agents from ALL projects
      if (projectId) {
        // Optional filter by specific project
        sql = `
          SELECT a.*, p.name as project_name
          FROM pype_voice_agents a
          LEFT JOIN pype_voice_projects p ON a.project_id = p.id
          WHERE a.is_active = true AND a.project_id = $1
          ORDER BY a.created_at DESC
        `;
        params = [projectId];
      } else {
        // All agents from all projects
        sql = `
          SELECT a.*, p.name as project_name
          FROM pype_voice_agents a
          LEFT JOIN pype_voice_projects p ON a.project_id = p.id
          WHERE a.is_active = true
          ORDER BY a.created_at DESC
        `;
        params = [];
      }
    } else {
      // Owner: see ALL agents from ALL their accessible projects
      if (projectId) {
        // Specific project (with access check)
        sql = `
          SELECT a.*, p.name as project_name
          FROM pype_voice_agents a
          LEFT JOIN pype_voice_projects p ON a.project_id = p.id
          INNER JOIN pype_voice_email_project_mapping epm ON a.project_id = epm.project_id
          INNER JOIN pype_voice_users u ON u.email = epm.email
          WHERE a.is_active = true AND a.project_id = $1 AND u.user_id = $2 AND epm.is_active = true
          ORDER BY a.created_at DESC
        `;
        params = [projectId, userId];
      } else {
        // ALL agents from ALL accessible projects
        sql = `
          SELECT DISTINCT a.*, p.name as project_name
          FROM pype_voice_agents a
          LEFT JOIN pype_voice_projects p ON a.project_id = p.id
          INNER JOIN pype_voice_email_project_mapping epm ON a.project_id = epm.project_id
          INNER JOIN pype_voice_users u ON u.email = epm.email
          WHERE a.is_active = true AND u.user_id = $1 AND epm.is_active = true
          ORDER BY a.created_at DESC
        `;
        params = [userId];
      }
    }

    console.log('🤖 AGENTS API: Executing SQL for', userGlobalRole.global_role, 'role');
    
    try {
      const result = await query(sql, params);
      const agents = result.rows || [];
      
      console.log('🤖 AGENTS API: Found', agents.length, 'agents for', userGlobalRole.global_role);
      
      return NextResponse.json({ 
        agents,
        userRole: userGlobalRole.global_role,
        canViewAll: userGlobalRole.permissions.canViewAllAgents
      });
    } catch (error) {
      console.error('Error fetching agents:', error);
      return NextResponse.json(
        { error: 'Failed to fetch agents' },
        { status: 500 }
      );
    }

  } catch (error) {
    console.error('Unexpected error fetching agents:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}