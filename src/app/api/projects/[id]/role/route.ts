import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth-utils';
import { query } from '@/lib/db';

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    console.log('🔍 PROJECT ROLE API: Starting authentication check');
    
    // Verify authentication
    const authResult = await verifyAuth(request);
    console.log('🔍 PROJECT ROLE API: Auth result:', { success: authResult.success, hasUser: !!authResult.user, message: authResult.message });
    
    if (!authResult.success || !authResult.user) {
      console.log('🔍 PROJECT ROLE API: Authentication failed, returning 401');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    console.log('🔍 PROJECT ROLE API: User authenticated:', { user_id: authResult.user.user_id, email: authResult.user.email });

    const { id: projectId } = await context.params;

    // Get user role in this specific project
    const result = await query(
      `SELECT epm.role FROM pype_voice_email_project_mapping epm
       INNER JOIN pype_voice_users u ON u.email = epm.email
       WHERE epm.project_id = $1 AND u.user_id = $2 AND epm.is_active = true`,
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
