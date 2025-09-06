import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { getUserGlobalRole } from '@/services/getGlobalRole'

export async function GET(request: NextRequest) {
  try {
    const globalRole = await getUserGlobalRole(request)
    
    if (globalRole !== 'super_admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    // Get credit statistics
    const statsResult = await query(`
      SELECT 
        COUNT(*) as total_users,
        SUM(current_balance) as total_credits,
        COUNT(CASE WHEN is_suspended = true THEN 1 END) as suspended_users,
        COUNT(CASE WHEN current_balance < (credit_limit * 0.2) THEN 1 END) as low_balance_users,
        COALESCE(SUM(CASE WHEN DATE_TRUNC('month', created_at) = DATE_TRUNC('month', CURRENT_DATE) THEN current_balance ELSE 0 END), 0) as monthly_consumption,
        COALESCE((
          SELECT SUM(amount) 
          FROM credit_transactions 
          WHERE transaction_type = 'recharge' 
          AND DATE_TRUNC('month', created_at) = DATE_TRUNC('month', CURRENT_DATE)
        ), 0) as monthly_recharges
      FROM user_credits
    `)

    const stats = statsResult.rows[0]
    
    return NextResponse.json({
      total_users: parseInt(stats.total_users),
      total_credits: parseFloat(stats.total_credits || 0),
      suspended_users: parseInt(stats.suspended_users),
      low_balance_users: parseInt(stats.low_balance_users),
      monthly_consumption: parseFloat(stats.monthly_consumption || 0),
      monthly_recharges: parseFloat(stats.monthly_recharges || 0)
    })
  } catch (error) {
    console.error('Error fetching credit stats:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
