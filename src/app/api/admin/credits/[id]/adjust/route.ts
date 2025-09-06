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
    const userResult = await query(`
      SELECT global_role FROM pype_voice_users WHERE email = $1
    `, [userId])

    if (userResult.rows.length === 0 || userResult.rows[0].global_role !== 'super_admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    const { amount, description } = await request.json()
    const userCreditId = params.id

    if (!amount || typeof amount !== 'number') {
      return NextResponse.json({ error: 'Invalid amount' }, { status: 400 })
    }

    // Get current balance
    const currentResult = await query(`
      SELECT current_balance, workspace_id, user_id 
      FROM user_credits 
      WHERE id = $1
    `, [userCreditId])

    if (currentResult.rows.length === 0) {
      return NextResponse.json({ error: 'User credit not found' }, { status: 404 })
    }

    const { current_balance, workspace_id, user_id } = currentResult.rows[0]
    const balanceBefore = parseFloat(current_balance)
    const balanceAfter = balanceBefore + amount

    // Prevent negative balance unless it's a super admin adjustment
    if (balanceAfter < 0 && amount < 0) {
      return NextResponse.json({ error: 'Insufficient balance' }, { status: 400 })
    }

    // Update user credits
    await query(`
      UPDATE user_credits 
      SET current_balance = $1, updated_at = NOW()
      WHERE id = $2
    `, [balanceAfter, userCreditId])

    // Create transaction record
    await query(`
      INSERT INTO credit_transactions (
        user_credit_id, workspace_id, user_id, transaction_type, amount, 
        balance_before, balance_after, description, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    `, [
      userCreditId,
      workspace_id,
      user_id,
      amount > 0 ? 'recharge' : 'adjustment',
      amount,
      balanceBefore,
      balanceAfter,
      description || 'Manual credit adjustment',
      user_id // In a real app, this would be the admin's user_id
    ])

    return NextResponse.json({ 
      success: true, 
      new_balance: balanceAfter 
    })

  } catch (error) {
    console.error('Error adjusting credits:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
