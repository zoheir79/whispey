import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { getUserGlobalRole } from '@/services/getGlobalRole'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const globalRole = await getUserGlobalRole(request)
    
    if (globalRole !== 'super_admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    const userCreditId = params.id

    // Fetch transactions for specific user credit
    const result = await query(`
      SELECT 
        ct.*,
        u.email as created_by_email
      FROM credit_transactions ct
      LEFT JOIN pype_voice_users u ON u.user_id = ct.created_by
      WHERE ct.user_credit_id = $1
      ORDER BY ct.created_at DESC
      LIMIT 50
    `, [userCreditId])

    return NextResponse.json(result.rows)
  } catch (error) {
    console.error('Error fetching credit transactions:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
