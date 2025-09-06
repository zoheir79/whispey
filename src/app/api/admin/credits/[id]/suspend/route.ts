import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { verifyUserAuth } from '@/lib/auth'

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const params = await context.params
    
    // Verify user authentication
    const { isAuthenticated, userId } = await verifyUserAuth(request)
    if (!isAuthenticated || !userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if user is super admin
    const authResult = await query(`
      SELECT global_role FROM pype_voice_users WHERE email = $1
    `, [userId])

    if (authResult.rows.length === 0 || authResult.rows[0].global_role !== 'super_admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    const { suspend } = await request.json()
    const userCreditId = params.id

    if (typeof suspend !== 'boolean') {
      return NextResponse.json({ error: 'Invalid suspend value' }, { status: 400 })
    }

    // Update suspension status
    await query(`
      UPDATE user_credits 
      SET is_suspended = $1, updated_at = NOW()
      WHERE id = $2
    `, [suspend, userCreditId])

    // Get user info for alert
    const userResult = await query(`
      SELECT uc.workspace_id, uc.user_id, u.email as user_email
      FROM user_credits uc
      LEFT JOIN pype_voice_users u ON u.user_id = uc.user_id
      WHERE uc.id = $1
    `, [userCreditId])

    if (userResult.rows.length > 0) {
      const { workspace_id, user_id, user_email } = userResult.rows[0]
      
      // Create alert
      await query(`
        INSERT INTO credit_alerts (
          workspace_id, user_id, alert_type, severity, message
        ) VALUES ($1, $2, $3, $4, $5)
      `, [
        workspace_id,
        user_id,
        suspend ? 'service_suspended' : 'service_resumed',
        suspend ? 'critical' : 'info',
        suspend 
          ? `Services suspendus pour ${user_email} par un administrateur`
          : `Services réactivés pour ${user_email} par un administrateur`
      ])
    }

    return NextResponse.json({ 
      success: true, 
      suspended: suspend 
    })

  } catch (error) {
    console.error('Error updating suspension status:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
