import { NextRequest, NextResponse } from 'next/server';
import { callRPC, refreshCallSummary, calculateCustomTotal, batchCalculateCustomTotals, getDistinctValues, getAvailableJsonFields } from '@/lib/db-rpc';
import { verifyUserAuth } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    // Verify authentication using cookie-based auth (consistent with other endpoints)
    const authResult = await verifyUserAuth(request);
    if (!authResult.isAuthenticated || !authResult.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { method, params } = body;

    // Debug logging to see what method is being called
    console.log('DB-RPC API called with method:', method);
    console.log('DB-RPC API called with params:', params);

    let result;

    // Handle cases where method is undefined - this looks like a table query that should go to /api/overview
    if (!method && params && params.table) {
      console.log('Redirecting undefined method with table query to overview logic');
      // Import the overview API logic
      const { fetchFromTable } = await import('@/lib/db-service');
      
      // Convert the params to the format expected by fetchFromTable
      const queryParams = {
        table: params.table,
        select: params.select,
        filters: params.filters || [],
        orderBy: params.orderBy,
        limit: params.limit,
        offset: params.offset
      };
      
      result = await fetchFromTable(queryParams);
      
      if (result.error) {
        return NextResponse.json(
          { error: 'Table query failed', details: result.error },
          { status: 500 }
        );
      }

      return NextResponse.json({ 
        success: true, 
        data: result.data 
      });
    }

    switch (method) {
      case 'refreshCallSummary':
        result = await refreshCallSummary();
        break;
      
      case 'calculateCustomTotal':
        result = await calculateCustomTotal(params);
        break;
      
      case 'batchCalculateCustomTotals':
        result = await batchCalculateCustomTotals(params);
        break;
      
      case 'getDistinctValues':
        result = await getDistinctValues(params);
        break;
      
      case 'getAvailableJsonFields':
        result = await getAvailableJsonFields(params);
        break;
      
      case 'callRPC':
        result = await callRPC(params.functionName, params.args);
        break;
      
      default:
        return NextResponse.json({ error: 'Unknown RPC method' }, { status: 400 });
    }

    if (result.error) {
      return NextResponse.json(
        { error: 'RPC call failed', details: result.error },
        { status: 500 }
      );
    }

    return NextResponse.json({ 
      success: true, 
      data: result.data 
    });

  } catch (error) {
    console.error('DB RPC API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
