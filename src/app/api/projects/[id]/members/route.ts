import { NextRequest, NextResponse } from 'next/server'
import { verifyUserAuth } from '@/lib/auth'
import { fetchFromTable, insertIntoTable, updateTable, deleteFromTable } from '@/lib/db-service'
import { headers } from 'next/headers'
import { getUserGlobalRole, isSuperAdmin } from '@/services/getGlobalRole'

export async function POST(
  request: NextRequest,
  { params }: { params:any }
) {
  try {    const { isAuthenticated, userId } = await verifyUserAuth()
    
    if (!isAuthenticated || !userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get user data for email
    const { data: userData, error: userError } = await fetchFromTable({
      table: 'pype_voice_users',
      select: 'email',
      filters: [{ column: 'user_id', operator: '=', value: userId }]
    })
    
    if (userError || !userData || !Array.isArray(userData) || userData.length === 0) {
      return NextResponse.json({ error: 'User not found' }, { status: 401 })
    }
    
    const userEmail = (userData[0] as any).email

    const { id: projectId } = await params // UUID, no parseInt()

    console.log("projectId",projectId)

    const body = await request.json()
    const { email, role = 'member' } = body

    if (!email || !email.trim()) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 })
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email.trim())) {
      return NextResponse.json({ error: 'Invalid email format' }, { status: 400 })
    }

    console.log("userEmail", userEmail)
    
    // Check if user is super admin (bypasses project-level restrictions)
    const isSuperAdminUser = await isSuperAdmin(userId)
    let hasAdminAccess = isSuperAdminUser

    if (!hasAdminAccess) {
      // Check current user access to project
      const { data: userProject } = await fetchFromTable({
        table: 'pype_voice_email_project_mapping',
        select: 'role',
        filters: [
          { column: 'email', operator: '=', value: userEmail },
          { column: 'project_id', operator: '=', value: projectId }
        ]
      })
      
      const userProjectData = Array.isArray(userProject) && userProject.length > 0 ? userProject[0] as any : null

      console.log("userProjects", userProject)

      if (userProjectData && ['admin', 'owner'].includes(userProjectData.role)) {
        hasAdminAccess = true
      } 
    }

    if (!hasAdminAccess) {
      return NextResponse.json(
        { error: 'Admin access required to add members' },
        { status: 403 }
      )
    }

    // Check if email is already added to project
    const { data: existingMapping } = await fetchFromTable({
      table: 'pype_voice_email_project_mapping',
      select: 'id',
      filters: [
        { column: 'email', operator: '=', value: email.trim() },
        { column: 'project_id', operator: '=', value: projectId }
      ]
    })

    if (existingMapping && Array.isArray(existingMapping) && existingMapping.length > 0) {
      return NextResponse.json({ error: 'Email already added to project' }, { status: 400 })
    }

    // Check if user already exists in users table
    const { data: existingUser } = await fetchFromTable({
      table: 'pype_voice_users',
      select: 'user_id',
      filters: [{ column: 'email', operator: '=', value: email.trim() }]
    })
    
    const existingUserData = Array.isArray(existingUser) && existingUser.length > 0 ? existingUser[0] as any : null

    const permissions = getPermissionsByRole(role)

    if (existingUserData?.user_id) {
      // If the user exists, check if they're already mapped
      const { data: existingUserProject } = await fetchFromTable({
        table: 'pype_voice_email_project_mapping',
        select: 'id',
        filters: [
          { column: 'user_id', operator: '=', value: existingUserData.user_id },
          { column: 'project_id', operator: '=', value: projectId }
        ]
      })
      
      const existingUserProjectData = Array.isArray(existingUserProject) && existingUserProject.length > 0 ? existingUserProject[0] : null

      if (existingUserProjectData) {
        return NextResponse.json(
          { error: 'User is already a member of this project' },
          { status: 400 }
        )
      }

      // Insert mapping using user_id
      const { data: newMapping, error } = await insertIntoTable({
        table: 'pype_voice_email_project_mapping',
        data: {
          user_id: existingUserData.user_id,
          email: email.trim(),
          project_id: projectId,
          role,
          permissions,
          added_by_user_id: userId,
          is_active: true,
        }
      })

      if (error) {
        console.error(error)
        return NextResponse.json({ error: 'Failed to add member' }, { status: 500 })
      }

      return NextResponse.json({ message: 'User added to project', member: newMapping, type: 'direct_add' }, { status: 201 })
    } else {
      // Create pending email-based invite
      const { data: mapping, error } = await insertIntoTable({
        table: 'pype_voice_email_project_mapping',
        data: {
          email: email.trim(),
          project_id: projectId,
          role,
          permissions,
          added_by_user_id: userId,
          is_active: true,
        }
      })

      if (error) {
        console.error('Insert error:', error)
        return NextResponse.json({ error: 'Failed to add member' }, { status: 500 })
      }

      return NextResponse.json(
        {
          message: 'Email added to project successfully. User will be added when they sign up.',
          member: mapping,
          type: 'email_mapping'
        },
        { status: 201 }
      )
    }
  } catch (error) {
    console.error('Unexpected error adding member:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function GET(
  request: NextRequest,
  context: any
) {
  try {    const { isAuthenticated, userId } = await verifyUserAuth()
    
    if (!isAuthenticated || !userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { params } = await context;

    const projectId = params.id

    // Check if user is super admin (bypasses project-level restrictions)
    const isSuperAdminUser = await isSuperAdmin(userId)
    let hasAccess = isSuperAdminUser

    if (!hasAccess) {
      // Check project-level access for non-super admin users
      const { data: accessCheck, error: accessError } = await fetchFromTable({
        table: 'pype_voice_email_project_mapping',
        select: 'id',
        filters: [
          { column: 'user_id', operator: '=', value: userId },
          { column: 'project_id', operator: '=', value: projectId },
          { column: 'is_active', operator: '=', value: true }
        ]
      })
      
      const accessData = Array.isArray(accessCheck) && accessCheck.length > 0 ? accessCheck[0] : null

      if(accessError) {
        console.error("Access error:", accessError)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
      }

      hasAccess = !!accessData
    }

    if (!hasAccess) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    // Get members with basic info
    const { data: members, error } = await fetchFromTable({
      table: 'pype_voice_email_project_mapping',
      select: 'id, user_id, email, role, permissions, is_active, added_by_user_id, joined_at',
      filters: [
        { column: 'project_id', operator: '=', value: projectId },
        { column: 'is_active', operator: '=', value: true }
      ]
    })
    
    if (error) {
      console.error('Error fetching members:', error)
      return NextResponse.json({ error: 'Failed to fetch members' }, { status: 500 })
    }
    
    // Get user details for each member
    const membersWithUserData = []
    if (Array.isArray(members)) {
      for (const member of members) {
        const memberData = member as any
        if (memberData.user_id) {
          // Fetch user details
          const { data: userData } = await fetchFromTable({
            table: 'pype_voice_users',
            select: 'email, name, profile_image_url',
            filters: [{ column: 'user_id', operator: '=', value: memberData.user_id }]
          })
          
          const userDetails = Array.isArray(userData) && userData.length > 0 ? userData[0] as any : null
          
          membersWithUserData.push({
            ...memberData,
            user: userDetails || { email: memberData.email, name: null, profile_image_url: null }
          })
        } else {
          // For pending invitations without user_id
          membersWithUserData.push({
            ...memberData,
            user: { email: memberData.email, name: null, profile_image_url: null }
          })
        }
      }
    }
    
    // Separate confirmed members and pending mappings
    const confirmedMembers = membersWithUserData.filter(m => m.user_id)
    const pendingMappings = membersWithUserData.filter(m => !m.user_id)
  
    console.log("members", confirmedMembers)
    console.log("pending_mappings", pendingMappings)

    return NextResponse.json({ 
      members: confirmedMembers || [], 
      pending_mappings: pendingMappings || [] 
    }, { status: 200 })
  } catch (error) {
    console.error('Unexpected error fetching members:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

function getPermissionsByRole(role: string): Record<string, boolean> {
  const rolePermissions: Record<string, Record<string, boolean>> = {
    viewer: { read: true, write: false, delete: false, admin: false },
    member: { read: true, write: true, delete: false, admin: false },
    admin: { read: true, write: true, delete: true, admin: false },
    owner: { read: true, write: true, delete: true, admin: true },
  }

  return rolePermissions[role] || rolePermissions['member']
}
