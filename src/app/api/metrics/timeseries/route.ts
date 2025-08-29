import { NextRequest, NextResponse } from 'next/server';
import { verifyUserAuth } from '@/lib/auth';
import { query } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    // Verify authentication
    const { isAuthenticated, userId } = await verifyUserAuth(request);
    if (!isAuthenticated || !userId) {
      return NextResponse.json(
        { success: false, message: 'Authentication required' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get('projectId');
    const period = searchParams.get('period') || '7d'; // 7d, 30d, 90d, 1y
    const metric = searchParams.get('metric') || 'all'; // calls, cost, llm, tts, stt, duration, completion

    // Calculate date range based on period
    const now = new Date();
    const startDate = new Date();
    
    switch (period) {
      case '7d':
        startDate.setDate(now.getDate() - 7);
        break;
      case '30d':
        startDate.setDate(now.getDate() - 30);
        break;
      case '90d':
        startDate.setDate(now.getDate() - 90);
        break;
      case '1y':
        startDate.setFullYear(now.getFullYear() - 1);
        break;
      default:
        startDate.setDate(now.getDate() - 7);
    }

    // Mock time series data - replace with real database queries
    const timeSeriesData = generateTimeSeriesData(startDate, now, projectId, metric);

    return NextResponse.json({
      success: true,
      data: timeSeriesData,
      period,
      projectId,
      metric
    });

  } catch (error) {
    console.error('Time series metrics error:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to fetch time series metrics' },
      { status: 500 }
    );
  }
}

function generateTimeSeriesData(startDate: Date, endDate: Date, projectId: string | null, metric: string) {
  const data: any[] = [];
  const currentDate = new Date(startDate);
  
  while (currentDate <= endDate) {
    const dateStr = currentDate.toISOString().split('T')[0];
    
    // Generate realistic data points
    const baseValue = Math.random() * 0.5 + 0.5; // 0.5 to 1.0 multiplier
    
    const dataPoint: any = {
      date: dateStr,
      timestamp: currentDate.getTime(),
    };

    if (metric === 'all' || metric === 'calls') {
      dataPoint.calls = Math.floor((Math.random() * 20 + 5) * baseValue);
      dataPoint.successful_calls = Math.floor(dataPoint.calls * (0.92 + Math.random() * 0.08));
      dataPoint.failed_calls = dataPoint.calls - dataPoint.successful_calls;
    }

    if (metric === 'all' || metric === 'cost') {
      dataPoint.total_cost = Math.round((Math.random() * 15 + 2) * baseValue * 100) / 100;
      dataPoint.llm_cost = Math.round(dataPoint.total_cost * 0.6 * 100) / 100;
      dataPoint.tts_cost = Math.round(dataPoint.total_cost * 0.25 * 100) / 100;
      dataPoint.stt_cost = Math.round(dataPoint.total_cost * 0.15 * 100) / 100;
    }

    if (metric === 'all' || metric === 'llm') {
      dataPoint.llm_tokens_input = Math.floor((Math.random() * 5000 + 1000) * baseValue);
      dataPoint.llm_tokens_output = Math.floor((Math.random() * 3000 + 500) * baseValue);
      dataPoint.llm_requests = Math.floor((Math.random() * 50 + 10) * baseValue);
    }

    if (metric === 'all' || metric === 'tts') {
      dataPoint.tts_characters = Math.floor((Math.random() * 10000 + 2000) * baseValue);
      dataPoint.tts_requests = Math.floor((Math.random() * 30 + 5) * baseValue);
      dataPoint.tts_duration = Math.round((Math.random() * 300 + 60) * baseValue);
    }

    if (metric === 'all' || metric === 'stt') {
      dataPoint.stt_duration = Math.round((Math.random() * 600 + 120) * baseValue);
      dataPoint.stt_requests = Math.floor((Math.random() * 25 + 8) * baseValue);
      dataPoint.stt_accuracy = Math.round((0.85 + Math.random() * 0.15) * 100) / 100;
    }

    if (metric === 'all' || metric === 'duration') {
      dataPoint.avg_call_duration = Math.round((Math.random() * 180 + 30) * baseValue);
      dataPoint.total_call_duration = dataPoint.calls ? dataPoint.calls * dataPoint.avg_call_duration : 0;
      dataPoint.avg_response_time = Math.round((Math.random() * 3 + 1) * baseValue * 100) / 100;
    }

    if (metric === 'all' || metric === 'completion') {
      dataPoint.completion_rate = Math.round((0.88 + Math.random() * 0.12) * 100) / 100;
      dataPoint.user_satisfaction = Math.round((4.2 + Math.random() * 0.8) * 10) / 10;
      dataPoint.task_success_rate = Math.round((0.85 + Math.random() * 0.15) * 100) / 100;
    }

    data.push(dataPoint);
    currentDate.setDate(currentDate.getDate() + 1);
  }

  return data;
}
