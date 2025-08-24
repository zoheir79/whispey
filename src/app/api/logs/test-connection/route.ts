import { NextRequest, NextResponse } from 'next/server';
import { fetchFromTable } from '../../../../lib/db-service';

// Handle CORS preflight requests
export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}

export async function GET(request: NextRequest) {
  try {
    // Test PostgreSQL connection
    const { data, error } = await fetchFromTable({
      table: 'pype_voice_projects',
      select: 'COUNT(*) as count',
      limit: 1
    });

    if (error) {
      console.error('PostgreSQL connection error:', error);
      return NextResponse.json(
        { success: false, error: `Failed to connect to PostgreSQL: ${error.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        message: 'Connection successful',
        timestamp: new Date().toISOString(),
        environment: process.env.VERCEL_ENV || 'development'
      }
    }, { status: 200 });

  } catch (error) {
    console.error('Test connection error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}