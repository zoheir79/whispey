import { NextRequest, NextResponse } from 'next/server'
import { verifyUserAuth } from '@/lib/auth'
import { query } from '@/lib/db'
import crypto from 'crypto'

/**
 * API Keys Management Route (Fixed for existing DB schema)
 * GET: List all projects with API tokens
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

    // Get all projects with API tokens (fixed for existing DB schema)
    const result = await query(`
      SELECT 
        id,
        name,
        created_at,
        CASE 
          WHEN token_hash IS NOT NULL THEN true
          ELSE false
        END as has_token,
        updated_at
      FROM pype_voice_projects
      ORDER BY created_at DESC
      LIMIT 10
    `)

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

    // Verify project exists (fixed for existing DB schema)
    const projectCheck = await query(`
      SELECT id, name
      FROM pype_voice_projects
      WHERE id = $1
    `, [projectId])

    if (projectCheck.rows.length === 0) {
      return NextResponse.json(
        { success: false, message: 'Project not found' },
        { status: 404 }
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

    // Verify project exists (fixed for existing DB schema)
    const projectCheck = await query(`
      SELECT id, name
      FROM pype_voice_projects
      WHERE id = $1
    `, [projectId])

    if (projectCheck.rows.length === 0) {
      return NextResponse.json(
        { success: false, message: 'Project not found' },
        { status: 404 }
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
