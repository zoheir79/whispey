import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'

export async function GET(request: NextRequest) {
  try {
    const workspaces = await query(`
      SELECT id, name, created_at 
      FROM pype_voice_workspaces 
      ORDER BY created_at DESC
    `)

    return NextResponse.json({ workspaces: workspaces.rows || [] })
  } catch (error) {
    console.error('Error in workspaces API:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
