// app/api/projects/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { verifyUserAuth } from '@/lib/auth'
import { headers } from 'next/headers'
import crypto from 'crypto'
import { fetchFromTable, insertIntoTable } from '@/lib/db-service'

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
    // Check authentication
    const headersList = await headers()
    const authorization = headersList.get('authorization')
    
    const { isAuthenticated, userId } = await verifyUserAuth(authorization)
    
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
    const { data: project, error: projectError } = await insertIntoTable('pype_voice_projects', projectData)


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
      const { error: mappingError } = await insertIntoTable('pype_voice_email_project_mapping', {
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
    // Check authentication
    const headersList = await headers()
    const authorization = headersList.get('authorization')
    
    const { isAuthenticated, userId } = await verifyUserAuth(authorization)
    
    if (!isAuthenticated || !userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get current user from database
    const { data: userData } = await fetchFromTable({
      table: 'pype_voice_users',
      select: 'user_id, name, email',
      filters: [{ column: 'user_id', operator: '=', value: userId }]
    })
    
    const user = Array.isArray(userData) && userData.length > 0 ? userData[0] as any : null
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const userEmail = user.email
    // Fetch projects linked to user email
    // Note: This is a more complex query with joins that our simple db-service doesn't handle yet
    // We'll need to do this in two steps
    
    // 1. Get the project mappings for this user
    const { data: mappings, error } = await fetchFromTable({
      table: 'pype_voice_email_project_mapping',
      select: 'project_id, role, is_active',
      filters: [{ column: 'email', operator: '=', value: userEmail }]
    })
    
    if (error) {
      console.error('Error fetching project mappings:', error)
      return NextResponse.json({ error: 'Failed to fetch projects' }, { status: 500 })
    }
    
    // 2. Get the project details for each mapping
    const projectMappings = []
    
    if (Array.isArray(mappings) && mappings.length > 0) {
      for (const mapping of mappings) {
        const mappingData = mapping as any
        const { data: projectData, error: projectError } = await fetchFromTable({
          table: 'pype_voice_projects',
          select: 'id, name, description, environment, is_active, owner_user_id, created_at',
          filters: [{ column: 'id', operator: '=', value: mappingData.project_id }]
        })
        
        if (projectError || !Array.isArray(projectData) || projectData.length === 0) {
          console.error('Error fetching project data:', projectError)
          continue
        }

        const project = projectData[0] as any
        projectMappings.push({
          ...project,
          role: mappingData.role,
          is_active: mappingData.is_active
        })
      }
    }

    if (error) {
      console.error('Error fetching projects:', error)
      return NextResponse.json({ error: 'Failed to fetch projects' }, { status: 500 })
    }




    // Return only active projects with user role included
    const activeProjects = projectMappings
      .filter(mapping => mapping.is_active)
      .map(mapping => ({
        ...mapping,
        user_role: mapping.role
      }))

    return NextResponse.json(activeProjects, { status: 200 })

  } catch (error) {
    console.error('Unexpected error fetching projects:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
