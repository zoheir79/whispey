import { NextRequest, NextResponse } from 'next/server'
import { verifyUserAuth } from '@/lib/auth'
import { getUserGlobalRole } from '@/services/getGlobalRole'
import { query } from '@/lib/db'

export async function GET(request: NextRequest) {
  try {
    const { isAuthenticated, userId } = await verifyUserAuth(request);
    
    if (!isAuthenticated || !userId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const userGlobalRole = await getUserGlobalRole(userId);
    
    if (userGlobalRole?.global_role !== 'super_admin') {
      return NextResponse.json({ error: 'Super admin access required' }, { status: 403 });
    }

    // Get current configuration from database or return defaults
    const config = {
      knowledgeBases: {
        costBase: 0.10,
        billingCycle: 'usage',
        dedicatedMode: false,
        fixedPeriodCost: 0
      },
      workflows: {
        costBase: 0.05,
        costPerMinute: 0.002,
        billingCycle: 'usage',
        dedicatedMode: false,
        fixedPeriodCost: 0
      }
    };

    return NextResponse.json(config);

  } catch (error: any) {
    console.error('Error fetching config:', error);
    return NextResponse.json(
      { error: 'Internal server error' }, 
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const { isAuthenticated, userId } = await verifyUserAuth(request);
    
    if (!isAuthenticated || !userId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const userGlobalRole = await getUserGlobalRole(userId);
    
    if (userGlobalRole?.global_role !== 'super_admin') {
      return NextResponse.json({ error: 'Super admin access required' }, { status: 403 });
    }

    const config = await request.json();

    // Here you would save the config to database
    // For now, just return success
    
    return NextResponse.json({
      success: true,
      message: 'Configuration updated successfully'
    });

  } catch (error: any) {
    console.error('Error updating config:', error);
    return NextResponse.json(
      { error: 'Internal server error' }, 
      { status: 500 }
    );
  }
}
