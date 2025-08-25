import { NextRequest, NextResponse } from 'next/server';
import { fetchFromTable } from '@/lib/db-service';
import { verifyUserAuth } from '@/lib/auth';
import { getUserGlobalRole } from '@/services/getGlobalRole';

export async function POST(request: NextRequest) {
  try {
    // Verify authentication using cookie-based auth (consistent with other endpoints)
    const authResult = await verifyUserAuth(request);
    if (!authResult.isAuthenticated || !authResult.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user's global role and permissions
    const userGlobalRole = await getUserGlobalRole(authResult.userId);
    
    if (!userGlobalRole) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const body = await request.json();
    const { table, select, filters, orderBy, limit, offset } = body;

    // Apply role-based data filtering
    let enhancedFilters = filters || [];
    
    // If user is NOT an admin, restrict data access based on table
    if (!userGlobalRole.permissions.canViewAllProjects) {
      switch (table) {
        case 'pype_voice_projects':
          // Non-admin users: only see projects they have access to via email mapping
          enhancedFilters = [...enhancedFilters, {
            column: 'id',
            operator: 'in',
            value: 'SELECT project_id FROM pype_voice_email_project_mapping WHERE email = (SELECT email FROM pype_voice_users WHERE user_id = $userId)'
          }];
          break;
          
        case 'pype_voice_agents':
          // Non-admin users: only see agents from their projects
          enhancedFilters = [...enhancedFilters, {
            column: 'project_id',
            operator: 'in',
            value: 'SELECT project_id FROM pype_voice_email_project_mapping WHERE email = (SELECT email FROM pype_voice_users WHERE user_id = $userId)'
          }];
          break;
          
        case 'pype_voice_call_logs':
          // Non-admin users: only see call logs from their projects
          enhancedFilters = [...enhancedFilters, {
            column: 'project_id',
            operator: 'in',
            value: 'SELECT project_id FROM pype_voice_email_project_mapping WHERE email = (SELECT email FROM pype_voice_users WHERE user_id = $userId)'
          }];
          break;
          
        case 'pype_voice_email_project_mapping':
          // Non-admin users: only see their own project mappings
          enhancedFilters = [...enhancedFilters, {
            column: 'email',
            operator: 'eq',
            value: '(SELECT email FROM pype_voice_users WHERE user_id = $userId)'
          }];
          break;
          
        case 'pype_voice_users':
          // Non-admin users: only see their own user record
          enhancedFilters = [...enhancedFilters, {
            column: 'user_id',
            operator: 'eq',
            value: authResult.userId
          }];
          break;
          
        default:
          // For other tables, apply general project-based filtering if project_id exists
          // This is a safety measure
          break;
      }
    }
    // Admin users can access all data without additional filters

    // Replace $userId placeholder with actual userId in subqueries
    enhancedFilters = enhancedFilters.map((filter: any) => {
      if (typeof filter.value === 'string' && filter.value.includes('$userId')) {
        return {
          ...filter,
          value: filter.value.replace('$userId', `'${authResult.userId}'`)
        };
      }
      return filter;
    });

    // Fetch data using server-side db-service
    const result = await fetchFromTable({
      table,
      select,
      filters: enhancedFilters,
      orderBy,
      limit,
      offset
    });

    if (result.error) {
      return NextResponse.json(
        { error: 'Database query failed', details: result.error },
        { status: 500 }
      );
    }

    return NextResponse.json({ 
      success: true, 
      data: result.data,
      userRole: userGlobalRole.global_role,
      canViewAll: userGlobalRole.permissions.canViewAllProjects,
      appliedFilters: enhancedFilters.length
    });

  } catch (error) {
    console.error('Overview API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
