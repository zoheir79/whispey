// app/api/projects/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { verifyUserAuth } from '@/lib/auth'
import { headers } from 'next/headers'
import crypto from 'crypto'
import { fetchFromTable, insertIntoTable } from '@/lib/db-service'
import { getUserGlobalRole } from '@/services/getGlobalRole'

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

export async function POST(request: NextRequest) {
  try {
    // Check authentication (now reads JWT from cookies)
    const { isAuthenticated, userId } = await verifyUserAuth()
    
    if (!isAuthenticated || !userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Get current user details from database
    const { data: userData } = await fetchFromTable({
      table: 'pype_voice_users',
      select: 'user_id, name, email',
      filters: [{ column: 'user_id', operator: '=', value: userId }]
    })
    
    const user = Array.isArray(userData) && userData.length > 0 ? userData[0] as any : null
    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }

    const body = await request.json()
    const { 
      name, 
      description, 
      s3_config // New optional S3 configuration
    } = body

    if (!name || !name.trim()) {
      return NextResponse.json(
        { error: 'Project name is required' },
        { status: 400 }
      )
    }

    // Validate S3 config if provided
    let s3Fields = {
      s3_enabled: false,
      s3_region: null,
      s3_endpoint: null,
      s3_access_key: null,
      s3_secret_key: null,
      s3_bucket_prefix: null,
      s3_cost_per_gb: 0.023,
      s3_default_storage_gb: 50
    }

    if (s3_config) {
      const { 
        enabled, 
        region, 
        endpoint, 
        access_key, 
        secret_key, 
        bucket_prefix, 
        cost_per_gb = 0.023,
        default_storage_gb = 50
      } = s3_config

      if (enabled) {
        // Validate required S3 fields when enabled
        if (!region || !endpoint || !access_key || !secret_key || !bucket_prefix) {
          return NextResponse.json(
            { error: 'When S3 is enabled, region, endpoint, access_key, secret_key, and bucket_prefix are required' },
            { status: 400 }
          )
        }

        // TODO: Encrypt secret_key before storing
        s3Fields = {
          s3_enabled: true,
          s3_region: region.trim(),
          s3_endpoint: endpoint.trim(),
          s3_access_key: access_key.trim(),
          s3_secret_key: secret_key, // Should be encrypted in production
          s3_bucket_prefix: bucket_prefix.trim().toLowerCase(),
          s3_cost_per_gb: parseFloat(cost_per_gb),
          s3_default_storage_gb: parseInt(default_storage_gb)
        }
      }
    }

    // Generate API token
    const apiToken = generateApiToken()
    const hashedToken = hashToken(apiToken)

    const projectData = {
      name: name.trim(),
      description: description?.trim() || null,
      environment: 'dev', // Default environment
      is_active: true,
      retry_configuration: {},
      token_hash: hashedToken,
      owner_user_id: userId, // Add owner reference
      ...s3Fields // Add S3 configuration fields
    }

    // Insert project into database
    const { data: project, error: projectError } = await insertIntoTable({
        table: 'pype_voice_projects',
        data: projectData
      })

    if (projectError) {
      console.error('Error creating project:', projectError)
      return NextResponse.json(
        { error: 'Failed to create project' },
        { status: 500 }
      )
    }

    console.log(`Successfully created project "${project.name}" with ID ${project.id}`)

    // Add creator to email_project_mapping as owner
    const userEmail = user.email
    if (userEmail) {
      const { error: mappingError } = await insertIntoTable({
        table: 'pype_voice_email_project_mapping',
        data: {
        email: userEmail,
        project_id: project.id,
        role: 'owner',
        permissions: {
          read: true,
          write: true,
          delete: true,
          admin: true
        },
        added_by_user_id: userId
      }
      })

      if (mappingError) {
        console.error('Error adding creator to email mapping:', mappingError)
        // Don't fail the whole operation, just log the error
        // The user will still be added via the webhook when they sign up
      } else {
        console.log(`Added creator ${userEmail} to email mapping for project ${project.id}`)
      }
    }

    // Auto-add all super_admin users as admin to new project
    try {
      const superAdminsResult = await fetchFromTable({
        table: 'pype_voice_users',
        select: 'email',
        filters: [{ column: 'global_role', operator: '=', value: 'super_admin' }]
      });

      if (superAdminsResult.data && Array.isArray(superAdminsResult.data)) {
        for (const superAdmin of superAdminsResult.data as any[]) {
          // Add all super_admins as owners (including the creator if they're super_admin)
          const { error: superAdminMappingError } = await insertIntoTable({
            table: 'pype_voice_email_project_mapping',
            data: {
              email: superAdmin.email,
              project_id: project.id,
              role: 'owner',
              permissions: {
                read: true,
                write: true,
                delete: true,
                admin: true
              },
              added_by_user_id: userId
            }
          });

          if (superAdminMappingError) {
            console.error(`Error adding super_admin ${superAdmin.email} to project ${project.id}:`, superAdminMappingError);
          } else {
            console.log(`🔓 AUTO-ADDED super_admin ${superAdmin.email} as owner to project ${project.id}`);
          }
        }
      }
    } catch (error) {
      console.error('Error auto-adding super_admins to project:', error);
      // Don't fail the whole operation, just log
    }

    // Return project data with the unhashed token
    const response = {
      ...project,
      api_token: apiToken // Include the unhashed token for display
    }

    return NextResponse.json(response, { status: 201 })

  } catch (error) {
    console.error('Unexpected error creating project:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  try {
    // Check authentication (now reads JWT from cookies)
    const { isAuthenticated, userId } = await verifyUserAuth()
    
    console.log('🔐 AUTH DEBUG:', { isAuthenticated, userId });
    
    if (!isAuthenticated || !userId) {
      console.log('❌ AUTH FAILED:', { isAuthenticated, userId });
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    console.log('DEBUG: Authenticated userId from JWT:', userId)

    // Get current user from database to get email
    const { data: userData, error: userError } = await fetchFromTable({
      table: 'pype_voice_users',
      select: 'user_id, name, email',
      filters: [{ column: 'user_id', operator: '=', value: userId }]
    })
    
    console.log('DEBUG: User lookup result:', { userData, userError })
    
    let user = Array.isArray(userData) && userData.length > 0 ? userData[0] as any : null
    console.log('DEBUG: Parsed user:', user)
    
    // Auto-create user if not exists (similar to original Clerk behavior)
    if (!user) {
      console.log('DEBUG: User not found, auto-creating user record')
      const defaultEmail = `user-${userId.slice(-8)}@whispey.local` // Generate default email
      
      const { data: newUserData, error: createError } = await insertIntoTable({
        table: 'pype_voice_users',
        data: {
          user_id: userId,
          email: defaultEmail,
          name: `User ${userId.slice(-8)}`, // Generate default name
          created_at: new Date().toISOString()
        }
      })
      
      if (createError) {
        console.error('DEBUG: Error creating user:', createError)
        return NextResponse.json({
          projects: [],
          totalProjects: 0,
          userRole: 'user',
          canViewAll: false,
          debug: {
            userId,
            userEmail: null,
            mappings: [],
            projectsCount: 0,
            globalRole: null
          }
        })
      }
      
      user = { user_id: userId, email: defaultEmail, name: `User ${userId.slice(-8)}` }
      console.log('DEBUG: Auto-created user:', user)
    }
    
    if (!user.email) {
      console.log('DEBUG: User email not found - user:', user, 'email:', user?.email)
      return NextResponse.json({ 
        error: 'User email not found',
        debug: { userId, userData, user }
      }, { status: 400 })
    }

    // Check if request includes scope=all parameter for super_admin
    const url = new URL(request.url);
    const scope = url.searchParams.get('scope');
    
    // Get user's global role and permissions
    const userGlobalRole = await getUserGlobalRole(userId);
    
    console.log('🔍 DEBUG API PROJECTS:', {
      userId,
      userEmail: user.email,
      userGlobalRole: userGlobalRole?.global_role,
      canViewAllProjects: userGlobalRole?.permissions?.canViewAllProjects,
      scope,
      permissions: userGlobalRole?.permissions
    });
    
    let mappings: any[] = [];
    let error: any = null;
    
    // If user is super_admin, they can see ALL projects (active and inactive)
    if (userGlobalRole?.permissions?.canViewAllProjects) {
      let projectFilters: Array<{ column: string; operator: string; value: any }> = [];
      
      // Super admin can see ALL projects (including inactive ones)
      if (userGlobalRole.global_role === 'super_admin' && scope === 'all') {
        // No filter - get all projects
        projectFilters = [];
      } else {
        // Regular admin or super_admin without scope=all - only active projects
        projectFilters = [{ column: 'is_active', operator: '=', value: true }];
      }
      
      const { data: allProjects, error: projectsError } = await fetchFromTable({
        table: 'pype_voice_projects',
        select: 'id as project_id, name',
        filters: projectFilters
      });
      
      if (projectsError) {
        console.error('Error fetching all projects for admin/super_admin:', projectsError)
        return NextResponse.json({ error: 'Failed to fetch projects' }, { status: 500 })
      }
      
      console.log(`🔓 SUPER_ADMIN ACCESS: Found ${allProjects?.length || 0} projects for ${userGlobalRole.global_role}`);
      
      // Convert to mapping format with owner role for super_admin
      mappings = (allProjects || []).map((project: any) => ({
        project_id: project.project_id,
        role: userGlobalRole.global_role === 'super_admin' ? 'owner' : 'admin'
      }));
    } else {
      // Regular users - get project mappings for this user's email
      const { data: userMappings, error: mappingsError } = await fetchFromTable({
        table: 'pype_voice_email_project_mapping',
        select: 'project_id, role',
        filters: [{ column: 'email', operator: '=', value: user.email }]
      });
      
      mappings = userMappings || [];
      error = mappingsError;
      
      if (error) {
        console.error('Error fetching project mappings:', error)
        return NextResponse.json({ error: 'Failed to fetch projects' }, { status: 500 })
      }
    }

    if (!Array.isArray(mappings) || mappings.length === 0) {
      return NextResponse.json([], { status: 200 })
    }

    // Get all projects individually (avoids UUID array formatting issues)
    const projects = []
    
    for (const mapping of mappings) {
      const mappingData = mapping as any
      const { data: projectData, error: projectError } = await fetchFromTable({
        table: 'pype_voice_projects',
        select: 'id, name, description, environment, is_active, created_at, s3_enabled, s3_region, s3_endpoint, s3_bucket_prefix, s3_cost_per_gb, s3_default_storage_gb',
        filters: [{ column: 'id', operator: '=', value: mappingData.project_id }]
      })
      
      if (projectError) {
        console.error('Error fetching project:', mappingData.project_id, projectError)
        continue // Skip this project but continue with others
      }
      
      if (Array.isArray(projectData) && projectData.length > 0) {
        projects.push(projectData[0])
      }
    }
    
    console.log('DEBUG: Fetched projects:', projects.length)

    // Combine projects with user roles (matching original logic)
    const projectsWithRoles = (projects as any[] || []).map(project => {
      const mapping = mappings.find((m: any) => m.project_id === project.id) as any
      return {
        ...project,
        user_role: mapping?.role || 'member'
      }
    })

    // Return only active projects (matching original logic)
    const activeProjects = projectsWithRoles.filter(project => project.is_active)

    return NextResponse.json(activeProjects, { status: 200 })

  } catch (error) {
    console.error('Unexpected error fetching projects:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
