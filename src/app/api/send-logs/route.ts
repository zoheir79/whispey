// app/api/call-logs/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { fetchFromTable, insertIntoTable } from '../../../lib/db-service'
import { query } from '@/lib/db'
import crypto from 'crypto'

// Helper function to verify token
const verifyToken = async (token: string, environment = 'dev') => {
  try {
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex')

    const { data, error } = await fetchFromTable({
      table: 'pype_voice_projects',
      select: '*',
      filters: [{ column: 'token_hash', operator: '=', value: tokenHash }]
    })

    if (error || !data || !Array.isArray(data) || data.length === 0) {
      return { valid: false, error: 'Invalid or expired token' }
    }

    const authToken = (data as any[])[0]

    return { 
      valid: true, 
      token: authToken,
      project_id: authToken.id
    }
  } catch (error) {
    console.error('Token verification error:', error)
    return { valid: false, error: 'Token verification failed' }
  }
}

export async function POST(request: NextRequest) {
  try {
    // Parse request body
    const body = await request.json()
    const token = request.headers.get('x-pype-token')

    const { 
      // Agent call fields (existing)
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
      
      // New service fields
      service_type = 'agent', // 'agent' | 'knowledge_base' | 'workflow'
      service_id,
      
      // KB specific fields
      kb_operation_type, // 'search' | 'embedding' | 'storage'
      search_queries_count,
      search_tokens_used,
      embedding_tokens_created,
      new_vectors_created,
      storage_gb_used,
      
      // Workflow specific fields
      workflow_execution_id,
      workflow_operations_executed,
      workflow_mcp_calls_made,
      workflow_mcp_tools_used,
      workflow_execution_time_seconds,
      workflow_input_data,
      workflow_output_data,
      workflow_error_details,
      
      environment = 'dev'
    } = body

    console.log("body", body)

    // Validate required fields
    if (!token) {
      return NextResponse.json(
        { error: 'Token is required' },
        { status: 400 }
      )
    }

    if (!service_id) {
      return NextResponse.json(
        { error: 'service_id is required' },
        { status: 400 }
      )
    }

    // Validate service-specific requirements
    if (service_type === 'agent' && !call_id) {
      return NextResponse.json(
        { error: 'call_id is required for agent service' },
        { status: 400 }
      )
    }

    if (service_type === 'knowledge_base' && !kb_operation_type) {
      return NextResponse.json(
        { error: 'kb_operation_type is required for knowledge_base service' },
        { status: 400 }
      )
    }

    if (service_type === 'workflow' && !workflow_execution_id) {
      return NextResponse.json(
        { error: 'workflow_execution_id is required for workflow service' },
        { status: 400 }
      )
    }

    // Verify token
    const tokenVerification = await verifyToken(token, environment)
    console.log("tokenVerification", tokenVerification)

    if (!tokenVerification.valid) {
      return NextResponse.json(
        { error: tokenVerification.error },
        { status: 401 }
      )
    }

    const { project_id } = tokenVerification

    // Process according to service type
    if (service_type === 'agent') {
      return await processAgentCall()
    } else if (service_type === 'knowledge_base') {
      return await processKnowledgeBaseUsage()
    } else if (service_type === 'workflow') {
      return await processWorkflowExecution()
    } else {
      return NextResponse.json(
        { error: 'Invalid service_type' },
        { status: 400 }
      )
    }

    // === AGENT CALL PROCESSING ===
    async function processAgentCall() {
      // Calculate average latency
      let avgLatency = null

    if (transcript_with_metrics && Array.isArray(transcript_with_metrics)) {
      let latencySum = 0
      let latencyCount = 0
    
      transcript_with_metrics.forEach(turn => {
        const stt = turn?.stt_metrics?.duration || 0
        const llm = turn?.llm_metrics?.ttft || 0
        
        // CORRECTED: Include full TTS duration, not just TTFB
        const ttsFirstByte = turn?.tts_metrics?.ttfb || 0
        const ttsDuration = turn?.tts_metrics?.duration || 0
        const eouDuration = turn?.eou_metrics?.end_of_utterance_delay || 0
        const ttsTotal = ttsFirstByte + ttsDuration
    
        const totalLatency = stt + llm + ttsTotal + eouDuration
    
        // Only include turns with valid metrics
        if (totalLatency > 0) {
          latencySum += totalLatency
          latencyCount += 1
        }
      })
    
        avgLatency = latencyCount > 0 ? latencySum / latencyCount : null
      }

      console.log("calculated avgLatency", avgLatency)

      // Extract real metrics from transcript_with_metrics
      let transcriptLength = 0
      let responseLength = 0
      let tokensUsed = 0
      let sttMinutesUsed = 0
      let ttsWordsUsed = 0

      if (transcript_with_metrics && Array.isArray(transcript_with_metrics)) {
        transcript_with_metrics.forEach(turn => {
          const userText = turn.user_transcript || ''
          const agentText = turn.agent_response || ''
          
          transcriptLength += userText.length
          responseLength += agentText.length
          
          // Extract real metrics from Whispey SDK transcript_with_metrics
          const llmMetrics = turn.llm_metrics || {}
          const sttMetrics = turn.stt_metrics || {}
          const ttsMetrics = turn.tts_metrics || {}
          
          // LLM tokens from SDK metrics (prompt_tokens + completion_tokens)
          const promptTokens = llmMetrics.prompt_tokens || 0
          const completionTokens = llmMetrics.completion_tokens || 0
          const totalTokens = promptTokens + completionTokens
          tokensUsed += totalTokens
          
          // STT audio duration from SDK metrics (in seconds)
          const sttAudioDuration = sttMetrics.audio_duration || 0
          sttMinutesUsed += (sttAudioDuration / 60) // Convert to minutes
          
          // TTS characters from SDK metrics (convert to word estimate: ~5 chars per word)
          const ttsCharacters = ttsMetrics.characters_count || 0
          const estimatedWords = Math.ceil(ttsCharacters / 5)
          ttsWordsUsed += estimatedWords
        })
      }

      // Prepare log data for Supabase (serialize JSON fields) using system timezone
      const now = new Date()
      const nowLocal = new Date(now.getTime() - (now.getTimezoneOffset() * 60000))
      const logData = {
        call_id,
        agent_id,
        customer_number,
        call_ended_reason,
        transcript_type,
        transcript_json: transcript_json ? JSON.stringify(transcript_json) : null,
        transcript_with_metrics: transcript_with_metrics ? JSON.stringify(transcript_with_metrics) : null,
        avg_latency: avgLatency,
        metadata: metadata ? JSON.stringify(metadata) : null,
        dynamic_variables,
        environment,
        call_started_at,
        call_ended_at,
        recording_url,
        duration_seconds,
        transcript: transcript_with_metrics ? transcript_with_metrics.map((t: any) => t.user_transcript).join(' ') : '',
        response: transcript_with_metrics ? transcript_with_metrics.map((t: any) => t.agent_response).join(' ') : '',
        tokens_used: tokensUsed,
        stt_minutes_used: sttMinutesUsed,
        tts_words_used: ttsWordsUsed,
        start_time: call_started_at ? new Date(call_started_at) : nowLocal,
        end_time: call_ended_at ? new Date(call_ended_at) : nowLocal,
        created_at: nowLocal.toISOString()
      }

      // Insert log into database
      const { data: insertedLog, error: insertError } = await insertIntoTable({
          table: 'pype_voice_call_logs',
          data: logData
        })

      if (insertError) {
        console.error('Database insert error:', insertError)
        return NextResponse.json(
          { error: 'Failed to save call log' },
          { status: 500 }
        )
      }

      // Process metrics and insert into ClickHouse
      if (transcript_with_metrics && Array.isArray(transcript_with_metrics)) {

        // Also insert into Supabase for backup/compatibility
        const conversationTurns = transcript_with_metrics.map(turn => ({
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
          created_at: nowLocal.toISOString(),
          unix_timestamp: turn.timestamp
        }))
   
        // Insert all conversation turns to database
        const { error: turnsError } = await insertIntoTable({
          table: 'pype_voice_metrics_logs',
          data: conversationTurns[0]
        })
        
        // For bulk insert, we need to insert each turn individually with current db-service
        for (const turn of conversationTurns) {
          const { error } = await insertIntoTable({
          table: 'pype_voice_metrics_logs',
          data: turn
        })
          if (error) {
            console.error('Error inserting conversation turn:', error)
          }
        }

        if (turnsError) {
          console.error('Error inserting conversation turns:', turnsError)
        } else {
          console.log(`Inserted ${conversationTurns.length} conversation turns`)
        }
      }

      return NextResponse.json({
        message: 'Agent call log saved successfully',
        log_id: insertedLog.id,
        agent_id: agent_id,
        project_id: project_id
      }, { status: 200 })
    }

    // === KNOWLEDGE BASE USAGE PROCESSING ===
    async function processKnowledgeBaseUsage() {
      const now = new Date()
      const usageDate = now.toISOString().split('T')[0] // YYYY-MM-DD format

      const kbMetrics = {
        kb_id: service_id,
        agent_id: agent_id || null,
        call_id: call_id || null,
        usage_date: usageDate,
        search_queries: search_queries_count || 0,
        search_tokens_used: search_tokens_used || 0,
        embedding_tokens_created: embedding_tokens_created || 0,
        new_vectors_created: new_vectors_created || 0,
        storage_gb_used: storage_gb_used || 0,
        search_cost: 0, // Will be calculated by cost functions
        embedding_cost: 0,
        storage_cost: 0,
        created_at: now.toISOString()
      }

      // Insert KB usage metrics
      const { data: insertedMetrics, error: insertError } = await insertIntoTable({
        table: 'kb_usage_metrics',
        data: kbMetrics
      })

      if (insertError) {
        console.error('KB metrics insert error:', insertError)
        return NextResponse.json(
          { error: 'Failed to save KB usage metrics' },
          { status: 500 }
        )
      }

      // Calculate costs and deduct credits
      const { creditManager } = await import('@/services/creditManager')
      const costResult = await creditManager.calculateServiceCost('knowledge_base', service_id, {
        search_tokens: search_tokens_used || 0,
        embedding_tokens: embedding_tokens_created || 0,
        storage_gb: storage_gb_used || 0
      })

      if (costResult.costs.total_cost > 0) {
        await creditManager.deductCredits({
          workspace_id: project_id,
          amount: costResult.costs.total_cost,
          description: `KB usage - ${kb_operation_type}`,
          service_type: 'knowledge_base',
          service_id
        })
      }

      return NextResponse.json({
        message: 'KB usage metrics saved successfully',
        metrics_id: insertedMetrics.id,
        service_id,
        project_id,
        operation_type: kb_operation_type,
        cost: costResult.costs.total_cost
      }, { status: 200 })
    }

    // === WORKFLOW EXECUTION PROCESSING ===
    async function processWorkflowExecution() {
      const now = new Date()
      
      const executionLog = {
        workflow_id: service_id,
        execution_trigger: 'sdk',
        triggered_by_agent_id: agent_id || null,
        triggered_by_call_id: call_id || null,
        started_at: call_started_at ? new Date(call_started_at) : now,
        completed_at: call_ended_at ? new Date(call_ended_at) : now,
        execution_time_seconds: workflow_execution_time_seconds || 0,
        status: 'completed',
        operations_executed: workflow_operations_executed || 0,
        mcp_calls_made: workflow_mcp_calls_made || 0,
        mcp_tools_used: workflow_mcp_tools_used || [],
        input_data: workflow_input_data ? JSON.stringify(workflow_input_data) : '{}',
        output_data: workflow_output_data ? JSON.stringify(workflow_output_data) : '{}',
        error_details: workflow_error_details ? JSON.stringify(workflow_error_details) : '{}',
        execution_cost: 0 // Will be calculated
      }

      // Insert workflow execution log
      const { data: insertedLog, error: insertError } = await insertIntoTable({
        table: 'workflow_execution_logs',
        data: executionLog
      })

      if (insertError) {
        console.error('Workflow log insert error:', insertError)
        return NextResponse.json(
          { error: 'Failed to save workflow execution log' },
          { status: 500 }
        )
      }

      // Calculate costs and deduct credits
      const { creditManager } = await import('@/services/creditManager')
      const costResult = await creditManager.calculateServiceCost('workflow', service_id, {
        operations: workflow_operations_executed || 0,
        execution_minutes: (workflow_execution_time_seconds || 0) / 60
      })

      if (costResult.costs.total_cost > 0) {
        await creditManager.deductCredits({
          workspace_id: project_id,
          amount: costResult.costs.total_cost,
          description: `Workflow execution`,
          service_type: 'workflow',
          service_id
        })

        // Update execution log with cost using raw query
        await query(`
          UPDATE workflow_execution_logs 
          SET execution_cost = $1 
          WHERE id = $2
        `, [costResult.costs.total_cost, insertedLog.id])
      }

      return NextResponse.json({
        message: 'Workflow execution log saved successfully',
        execution_id: insertedLog.id,
        workflow_id: service_id,
        project_id,
        cost: costResult.costs.total_cost
      }, { status: 200 })
    }

  } catch (error: any) {
    console.error('Send log error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}