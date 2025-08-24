import { NextRequest, NextResponse } from 'next/server';
import { fetchFromTable, insertIntoTable, updateTable } from '../../../../lib/db-service';
import { sendResponse } from '../../../../lib/response';
import { verifyToken } from '../../../../lib/auth';
import { totalCostsINR } from '../../../../lib/calculateCost';
import { processFPOTranscript } from '../../../../lib/transcriptProcessor';
import { CallLogRequest, TranscriptWithMetrics, UsageData } from '../../../../types/logs';

// Handle CORS preflight requests
export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, x-pype-token',
    },
  });
}

export async function POST(request: NextRequest) {
  try {
    const token = request.headers.get('x-pype-token');
    const body: CallLogRequest = await request.json();

    const {
      call_id,
      customer_number,
      agent_id,
      call_ended_reason,
      transcript_type,
      transcript_json,
      metadata,
      dynamic_variables,
      call_started_at,
      call_ended_at,
      duration_seconds,
      transcript_with_metrics,
      recording_url,
      voice_recording_url,
      environment = 'dev'
    } = body;

    console.log("Received call log:", { call_id, agent_id });

    // Validate required fields
    if (!token) {
      return NextResponse.json(
        { success: false, error: 'Token is required' },
        { status: 400 }
      );
    }

    if (!call_id) {
      return NextResponse.json(
        { success: false, error: 'call_id is required' },
        { status: 400 }
      );
    }

    // Verify token
    const tokenVerification = await verifyToken(token, environment);
    if (!tokenVerification.valid) {
      return NextResponse.json(
        { success: false, error: tokenVerification.error || 'Token verification failed' },
        { status: 401 }
      );
    }

    const { project_id } = tokenVerification;

    // Calculate average latency
    let avgLatency: number | null = null;
    if (transcript_with_metrics && Array.isArray(transcript_with_metrics)) {
      let latencySum = 0;
      let latencyCount = 0;

      transcript_with_metrics.forEach((turn: TranscriptWithMetrics) => {
        const stt = turn?.stt_metrics?.duration || 0;
        const llm = turn?.llm_metrics?.ttft || 0;
        const ttsFirstByte = turn?.tts_metrics?.ttfb || 0;
        const ttsDuration = turn?.tts_metrics?.duration || 0;
        const eouDuration = turn?.eou_metrics?.end_of_utterance_delay || 0;
        const ttsTotal = ttsFirstByte + ttsDuration;

        const totalLatency = stt + llm + ttsTotal + eouDuration;

        if (totalLatency > 0) {
          latencySum += totalLatency;
          latencyCount += 1;
        }
      });

      avgLatency = latencyCount > 0 ? latencySum / latencyCount : null;
    }

    // Prepare log data
    const logData = {
      call_id,
      agent_id,
      customer_number,
      call_ended_reason,
      transcript_type,
      transcript_json,
      avg_latency: avgLatency,
      metadata,
      dynamic_variables,
      environment,
      call_started_at,
      call_ended_at,
      recording_url,
      duration_seconds,
      voice_recording_url,
      created_at: new Date().toISOString()
    };

    // Insert log into database
    const { data: insertedLog, error: insertError } = await insertIntoTable({
        table: 'pype_voice_call_logs',
        data: logData
      });

    if (insertError) {
      console.error('Database insert error:', insertError);
      return NextResponse.json(
        { success: false, error: 'Failed to save call log' },
        { status: 500 }
      );
    }

    // Insert conversation turns if metrics exist
    if (transcript_with_metrics && Array.isArray(transcript_with_metrics)) {
      const conversationTurns = transcript_with_metrics.map((turn: TranscriptWithMetrics) => ({
        session_id: insertedLog.id,
        turn_id: turn.turn_id,
        user_transcript: turn.user_transcript || '',
        agent_response: turn.agent_response || '',
        stt_metrics: turn.stt_metrics || {},
        llm_metrics: turn.llm_metrics || {},
        tts_metrics: turn.tts_metrics || {},
        eou_metrics: turn.eou_metrics || {},
        lesson_day: metadata?.lesson_day || 1,
        phone_number: customer_number,
        call_duration: duration_seconds,
        call_success: call_ended_reason !== 'error',
        lesson_completed: metadata?.lesson_completed || false,
        created_at: new Date().toISOString(),
        unix_timestamp: turn.timestamp
      }));

      // Insert conversation turns into metrics logs
      const { error: turnsError } = await Promise.all(
        conversationTurns.map(turn => insertIntoTable({ table: 'pype_voice_metrics_logs', data: turn }))
      ).then(results => {
        const errors = results.filter(result => result.error).map(result => result.error);
        return { error: errors.length > 0 ? errors[0] : null };
      });

      if (turnsError) {
        console.error('Error inserting conversation turns:', turnsError);
      } else {
        console.log(`Inserted ${conversationTurns.length} conversation turns`);
      }
    }

    // Calculate and update costs
    if (metadata?.usage) {
      const rawUsage = metadata.usage;
      const usageArr: UsageData[] = Array.isArray(rawUsage)
        ? rawUsage
        : rawUsage && typeof rawUsage === 'object'
          ? [rawUsage]
          : [];

      const { total_llm_cost_inr, total_tts_cost_inr, total_stt_cost_inr } =
        await totalCostsINR({
          usageArr: usageArr,
          modelName: 'gpt-4.1-mini',
          callStartedAt: call_started_at
        });

      const { error: costError } = await updateTable({
        table: 'pype_voice_call_logs',
        data: {
          total_llm_cost: total_llm_cost_inr,
          total_tts_cost: total_tts_cost_inr,
          total_stt_cost: total_stt_cost_inr
        },
        filters: [{ column: 'id', operator: 'eq', value: insertedLog.id }]
      });

      if (costError) {
        console.log("Total cost insertion error:", costError);
      } else {
        console.log("✅ Costs updated:", {
          total_llm_cost_inr,
          total_tts_cost_inr,
          total_stt_cost_inr
        });
      }
    }

    // Process transcript with field extraction
    const { data: agentConfigData, error: agentError } = await fetchFromTable({
      table: 'pype_voice_agents',
      select: 'field_extractor, field_extractor_prompt',
      filters: [{ column: 'id', operator: '=', value: agent_id }]
    });
    
    const agentConfig = Array.isArray(agentConfigData) && agentConfigData.length > 0 ? agentConfigData[0] as any : null;

    if (agentError) {
      console.error('Failed to fetch agent config:', agentError);
    } else if (agentConfig?.field_extractor && agentConfig?.field_extractor_prompt && Array.isArray(transcript_json) && transcript_json.length > 0) {
      try {
        const fpoResult = await processFPOTranscript({
          log_id: insertedLog.id,
          transcript_json,
          agent_id: agent_id || '',
          field_extractor_prompt: agentConfig.field_extractor_prompt,
        });

        const { error: insertFpoError } = await updateTable({
        table: 'pype_voice_call_logs',
        data: {
          transcription_metrics: fpoResult?.logData
        },
        filters: [{ column: 'id', operator: 'eq', value: insertedLog.id }]
      });

        if (insertFpoError) {
          console.error('Error updating FPO transcript log:', insertFpoError);
        }

        console.log("✅ FPO transcript processed:", fpoResult);
      } catch (fpoError) {
        console.error("❌ FPO processing failed:", fpoError);
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        message: 'Call log saved successfully',
        log_id: insertedLog.id,
        agent_id: agent_id,
        project_id: project_id
      }
    }, { status: 200 });

  } catch (error) {
    console.error('Send call log error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}