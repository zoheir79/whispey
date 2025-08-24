// app/api/user/projects/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { verifyUserAuth } from '../../../../lib/auth'
import { fetchFromTable } from '../../../../lib/db-service'

// Force Node.js runtime for PostgreSQL compatibility
export const runtime = 'nodejs'

function mapProject(
  project: any,
  role: string,
  permissions: any,
  joined_at: string,
  access_type: string
) {
  return {
    ...project,
    user_role: role,
    user_permissions: permissions,
    joined_at,
    access_type
  }
}

export async function GET(request: NextRequest) {
  try {
    // Verify JWT authentication (now reads JWT from cookies)
    const { isAuthenticated, userId } = await verifyUserAuth()
    
    if (!isAuthenticated || !userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get user info from database using userId
    const { data: userData, error: userError } = await fetchFromTable({
      table: 'pype_voice_users',
      select: 'id, email, name',
      filters: [{ column: 'id', operator: '=', value: userId }]
    })

    if (userError || !userData || !Array.isArray(userData) || userData.length === 0) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const user = (userData as any[])[0]
    const userEmail = user.email

    if (!userEmail) {
      return NextResponse.json({ error: 'User email not found' }, { status: 404 })
    }

    // Get projects for existing users
    const { data: userProjects, error: userProjectsError } = await fetchFromTable({
      table: 'pype_voice_email_project_mapping',
      select: `
        id,
        user_id,
        project_id,
        role,
        permissions,
        joined_at,
        is_active
      `,
      filters: [
        { column: 'user_id', operator: '=', value: userId },
        { column: 'is_active', operator: '=', value: true }
      ]
    })

    if (userProjectsError) {
      console.error('Error fetching user projects:', userProjectsError)
      return NextResponse.json({ error: 'Failed to fetch projects' }, { status: 500 })
    }

    // Get projects for pending email mappings
    const { data: emailMappings, error: emailMappingError } = await fetchFromTable({
      table: 'pype_voice_email_project_mapping',
      select: `
        id,
        email,
        project_id,
        role,
        permissions,
        created_at
      `,
      filters: [{ column: 'email', operator: '=', value: userEmail }]
    })

    if (emailMappingError) {
      console.error('Error fetching email mappings:', emailMappingError)
      // Don't fail the request on email mapping errors
    }

    // Get unique project IDs from both sources
    const projectIdsSet = new Set<string>()
    const mappings: any[] = []

    if (Array.isArray(userProjects)) {
      userProjects.forEach((up: any) => {
        projectIdsSet.add(up.project_id)
        mappings.push({ ...up, access_type: 'member' })
      })
    }

    if (Array.isArray(emailMappings)) {
      emailMappings.forEach((em: any) => {
        if (!projectIdsSet.has(em.project_id)) {
          projectIdsSet.add(em.project_id)
          mappings.push({ ...em, access_type: 'email_mapped' })
        }
      })
    }

    // Fetch project details for all project IDs
    const allProjects: any[] = []
    
    for (const projectId of projectIdsSet) {
      const { data: projectData, error: projectError } = await fetchFromTable({
        table: 'pype_voice_projects',
        select: 'id, name, description, environment, created_at, is_active',
        filters: [{ column: 'id', operator: '=', value: projectId }]
      })

      if (!projectError && Array.isArray(projectData) && projectData.length > 0) {
        const project = projectData[0]
        const mapping = mappings.find(m => m.project_id === projectId)
        
        if (mapping) {
          allProjects.push(
            mapProject(
              project, 
              mapping.role, 
              mapping.permissions, 
              mapping.joined_at || mapping.created_at, 
              mapping.access_type
            )
          )
        }
      }
    }

    // Sort by newest project created_at first
    allProjects.sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    )

    return NextResponse.json(allProjects, { status: 200 })
  } catch (error) {
    console.error('Unexpected error fetching user projects:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
