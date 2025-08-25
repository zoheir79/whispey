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

    let result;

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
