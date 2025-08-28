import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth-utils';
import { query } from '@/lib/db';

export async function GET(
  request: NextRequest,
  { params }: { params: { projectId: string } }
) {
  try {
    // Verify authentication
    const authResult = await verifyAuth(request);
    if (!authResult.success || !authResult.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { projectId } = params;

    // Get user role in this specific project
    const result = await query(
      `SELECT role FROM pype_voice_email_project_mapping 
       WHERE project_id = $1 AND user_id = $2`,
      [projectId, authResult.user.user_id]
    );

    if (result.rows.length === 0) {
      // User is not a member of this project
      return NextResponse.json({ role: null }, { status: 200 });
    }

    const userRole = result.rows[0].role;

    return NextResponse.json({ 
      role: userRole,
      projectId 
    });

  } catch (error) {
    console.error('Error fetching project role:', error);
    return NextResponse.json(
      { error: 'Internal server error' }, 
      { status: 500 }
    );
  }
}
