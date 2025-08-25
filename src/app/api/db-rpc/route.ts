import { NextRequest, NextResponse } from 'next/server';
import { callRPC, refreshCallSummary, calculateCustomTotal, batchCalculateCustomTotals, getDistinctValues, getAvailableJsonFields } from '@/lib/db-rpc';
import { verifyAuth } from '@/lib/auth-utils';

export async function POST(request: NextRequest) {
  try {
    // Verify authentication
    const authResult = await verifyAuth(request);
    if (!authResult.success || !authResult.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { method, params } = body;

    let result;

    switch (method) {
      case 'refreshCallSummary':
        result = await callRPC('refresh_call_summary', {});
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
        result = await callRPC('get_available_json_fields', params);
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
