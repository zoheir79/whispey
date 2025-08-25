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
    const { name, description } = body

    if (!name || !name.trim()) {
      return NextResponse.json(
        { error: 'Project name is required' },
        { status: 400 }
      )
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
      owner_user_id: userId // Add owner reference
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
    
    if (!isAuthenticated || !userId) {
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

    // Get user's global role and permissions
    const userGlobalRole = await getUserGlobalRole(userId);
    
    let mappings: any[] = [];
    let error: any = null;
    
    // If user is admin, they can see all projects
    if (userGlobalRole?.permissions?.canViewAllProjects) {
      // Admin can see all projects - get all active projects
      const { data: allProjects, error: projectsError } = await fetchFromTable({
        table: 'pype_voice_projects',
        select: 'id as project_id, name',
        filters: [{ column: 'is_active', operator: '=', value: true }]
      });
      
      if (projectsError) {
        console.error('Error fetching all projects for admin:', projectsError)
        return NextResponse.json({ error: 'Failed to fetch projects' }, { status: 500 })
      }
      
      // Convert to mapping format with admin role
      mappings = (allProjects || []).map((project: any) => ({
        project_id: project.project_id,
        role: 'admin' // Admin has admin role on all projects
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
        select: 'id, name, description, environment, is_active, created_at',
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
