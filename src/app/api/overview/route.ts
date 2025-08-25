import { NextRequest, NextResponse } from 'next/server';
import { fetchFromTable } from '@/lib/db-service';
import { verifyUserAuth } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    // Verify authentication using cookie-based auth (consistent with other endpoints)
    const authResult = await verifyUserAuth(request);
    if (!authResult.isAuthenticated || !authResult.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { table, select, filters, orderBy, limit, offset } = body;

    // Fetch data using server-side db-service
    const result = await fetchFromTable({
      table,
      select,
      filters,
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
      data: result.data 
    });

  } catch (error) {
    console.error('Overview API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
