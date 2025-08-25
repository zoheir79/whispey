import { NextRequest, NextResponse } from 'next/server';
import { fetchFromTable } from '@/lib/db-service';
import { verifyUserAuth } from '@/lib/auth';

interface TranscriptRecord {
  transcript_json: any;
  transcript_with_metrics: any;
  call_id: string;
  duration_seconds: number;
}

export async function GET(request: NextRequest) {
  try {
    // Verify authentication using cookie-based auth (consistent with other endpoints)
    const authResult = await verifyUserAuth(request);
    if (!authResult.isAuthenticated || !authResult.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const session_id = searchParams.get('session_id');

    console.log('🔍 TRANSCRIPT API: Received session_id:', session_id);

    if (!session_id) {
      console.log('❌ TRANSCRIPT API: No session_id provided');
      return NextResponse.json({ error: 'session_id is required' }, { status: 400 });
    }

    // Fetch transcript data from the database using call_id (session_id)
    // Try exact match first, then try UUID pattern match if not found
    console.log('🔍 TRANSCRIPT API: Trying exact match for call_id:', session_id);
    let { data: transcriptData, error: queryError } = await fetchFromTable({
      table: 'pype_voice_call_logs',
      select: 'transcript_json, transcript_with_metrics, call_id, duration_seconds',
      filters: [
        { column: 'call_id', operator: '=', value: session_id }
      ],
      limit: 1
    });

    console.log('🔍 TRANSCRIPT API: Exact match result:', {
      found: transcriptData?.length || 0,
      error: queryError,
      data: transcriptData
    });

    // If no exact match found, try searching by UUID pattern (for cases where frontend passes UUID only)
    if (!queryError && (!transcriptData || transcriptData.length === 0)) {
      console.log('🔍 TRANSCRIPT API: Trying pattern match for call_id LIKE:', `${session_id}%`);
      ({ data: transcriptData, error: queryError } = await fetchFromTable({
        table: 'pype_voice_call_logs',
        select: 'transcript_json, transcript_with_metrics, call_id, duration_seconds',
        filters: [
          { column: 'call_id', operator: 'like', value: `${session_id}%` }
        ],
        limit: 1
      }));
      
      console.log('🔍 TRANSCRIPT API: Pattern match result:', {
        found: transcriptData?.length || 0,
        error: queryError,
        data: transcriptData
      });
    }

    if (queryError) {
      console.error('Transcript query error:', queryError);
      return NextResponse.json(
        { error: 'Failed to fetch transcript data', details: queryError },
        { status: 500 }
      );
    }

    if (!transcriptData || transcriptData.length === 0) {
      return NextResponse.json({ error: 'Transcript not found' }, { status: 404 });
    }

    const record = transcriptData[0] as unknown as TranscriptRecord;
    
    // Try to parse transcript_json properly
    let transcript = null;
    try {
      // Check if transcript_json is already an object or needs parsing
      if (typeof record.transcript_json === 'string') {
        transcript = JSON.parse(record.transcript_json);
      } else if (record.transcript_json && typeof record.transcript_json === 'object') {
        transcript = record.transcript_json;
      }
    } catch (parseError) {
      console.warn('Failed to parse transcript_json:', parseError);
      // Try transcript_with_metrics as fallback
      try {
        if (typeof record.transcript_with_metrics === 'string') {
          transcript = JSON.parse(record.transcript_with_metrics);
        } else if (record.transcript_with_metrics && typeof record.transcript_with_metrics === 'object') {
          transcript = record.transcript_with_metrics;
        }
      } catch (fallbackError) {
        console.warn('Failed to parse transcript_with_metrics:', fallbackError);
        return NextResponse.json({ error: 'Invalid transcript format' }, { status: 422 });
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        transcript: transcript || {},
        call_id: record.call_id,
        duration_seconds: record.duration_seconds
      }
    });

  } catch (error) {
    console.error('Transcript API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
