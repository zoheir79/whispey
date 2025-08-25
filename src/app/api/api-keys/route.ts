import { NextRequest, NextResponse } from 'next/server'
import { verifyUserAuth } from '@/lib/auth'
import { query } from '@/lib/db'
import crypto from 'crypto'

/**
 * API Keys Management Route
 * GET: List user's API keys
 * POST: Create new API key
 * DELETE: Revoke API key
 */

export async function GET(request: NextRequest) {
  try {
    // Verify user authentication
    const { isAuthenticated, userId } = await verifyUserAuth()

    if (!isAuthenticated || !userId) {
      return NextResponse.json(
        { success: false, message: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Get user's projects with API tokens
    const result = await query(`
      SELECT 
        p.id,
        p.name,
        p.created_at,
        CASE 
          WHEN p.token_hash IS NOT NULL THEN true
          ELSE false
        END as has_token,
        p.updated_at
      FROM pype_voice_projects p
      JOIN pype_voice_project_members pm ON p.id = pm.project_id
      WHERE pm.user_id = $1
      ORDER BY p.created_at DESC
    `, [userId])

    return NextResponse.json({
      success: true,
      projects: result.rows
    })

  } catch (error) {
    console.error('Error fetching API keys:', error)
    return NextResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    // Verify user authentication
    const { isAuthenticated, userId } = await verifyUserAuth()

    if (!isAuthenticated || !userId) {
      return NextResponse.json(
        { success: false, message: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { projectId, name } = await request.json()

    if (!projectId) {
      return NextResponse.json(
        { success: false, message: 'Project ID is required' },
        { status: 400 }
      )
    }

    // Verify user has access to this project
    const projectCheck = await query(`
      SELECT p.id, p.name
      FROM pype_voice_projects p
      JOIN pype_voice_project_members pm ON p.id = pm.project_id
      WHERE p.id = $1 AND pm.user_id = $2
    `, [projectId, userId])

    if (projectCheck.rows.length === 0) {
      return NextResponse.json(
        { success: false, message: 'Project not found or access denied' },
        { status: 403 }
      )
    }

    // Generate new API key
    const newToken = `wp_${crypto.randomBytes(32).toString('hex')}`
    const tokenHash = crypto.createHash('sha256').update(newToken).digest('hex')

    // Update project with new token
    await query(`
      UPDATE pype_voice_projects 
      SET token_hash = $1, updated_at = NOW()
      WHERE id = $2
    `, [tokenHash, projectId])

    // Log the API key creation
    console.log(`🔑 New API key created for project ${projectId} by user ${userId}`)

    return NextResponse.json({
      success: true,
      message: 'API key created successfully',
      token: newToken,
      projectId: projectId,
      hint: 'Save this token now - it will not be shown again!'
    })

  } catch (error) {
    console.error('Error creating API key:', error)
    return NextResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest) {
  try {
    // Verify user authentication
    const { isAuthenticated, userId } = await verifyUserAuth()

    if (!isAuthenticated || !userId) {
      return NextResponse.json(
        { success: false, message: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { projectId } = await request.json()

    if (!projectId) {
      return NextResponse.json(
        { success: false, message: 'Project ID is required' },
        { status: 400 }
      )
    }

    // Verify user has access to this project
    const projectCheck = await query(`
      SELECT p.id, p.name
      FROM pype_voice_projects p
      JOIN pype_voice_project_members pm ON p.id = pm.project_id
      WHERE p.id = $1 AND pm.user_id = $2
    `, [projectId, userId])

    if (projectCheck.rows.length === 0) {
      return NextResponse.json(
        { success: false, message: 'Project not found or access denied' },
        { status: 403 }
      )
    }

    // Remove token from project
    await query(`
      UPDATE pype_voice_projects 
      SET token_hash = NULL, updated_at = NOW()
      WHERE id = $1
    `, [projectId])

    // Log the API key revocation
    console.log(`🔒 API key revoked for project ${projectId} by user ${userId}`)

    return NextResponse.json({
      success: true,
      message: 'API key revoked successfully'
    })

  } catch (error) {
    console.error('Error revoking API key:', error)
    return NextResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    )
  }
}
