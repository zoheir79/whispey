-- Fix Usage Minutes Chart by properly recreating materialized view
-- This addresses the GROUP BY constraint with transcript_with_metrics

-- Drop and recreate the materialized view with proper structure
DROP MATERIALIZED VIEW IF EXISTS call_summary_materialized;

-- Create base view first
CREATE MATERIALIZED VIEW call_summary_materialized AS
SELECT 
    agent_id,
    DATE(call_started_at) as call_date,
    COUNT(*) as calls,
    COUNT(*) FILTER (WHERE call_ended_reason = 'completed') as successful_calls,
    ROUND(
        (COUNT(*) FILTER (WHERE call_ended_reason = 'completed')::decimal / COUNT(*) * 100), 2
    ) as success_rate,
    -- Global call time (traditional duration_seconds)
    SUM(COALESCE(duration_seconds, 0)) / 60.0 as total_call_minutes,
    -- AI processing time using individual extraction per call
    SUM(extract_ai_processing_time(transcript_with_metrics)) as total_ai_processing_minutes,
    -- Combined minutes for chart display (same as AI processing time)
    SUM(extract_ai_processing_time(transcript_with_metrics)) as total_minutes,
    AVG(COALESCE(avg_latency, 0)) as avg_latency,
    COUNT(DISTINCT customer_number) as unique_customers,
    SUM(COALESCE(total_llm_cost, 0) + COALESCE(total_tts_cost, 0) + COALESCE(total_stt_cost, 0)) as total_cost,
    -- Extract tokens using individual extraction per call
    SUM(extract_tokens_from_transcript(transcript_with_metrics)) as total_tokens
FROM pype_voice_call_logs 
WHERE call_started_at IS NOT NULL
GROUP BY agent_id, DATE(call_started_at)
ORDER BY agent_id, call_date;

-- Create index
CREATE INDEX IF NOT EXISTS idx_call_summary_materialized_agent_date 
ON call_summary_materialized (agent_id, call_date);

-- Refresh the view
REFRESH MATERIALIZED VIEW call_summary_materialized;

-- Verification query
SELECT 
    '=== FINAL VERIFICATION ===' as status,
    call_date,
    calls,
    ROUND(total_ai_processing_minutes::numeric, 2) as total_ai_processing_minutes,
    ROUND(total_minutes::numeric, 2) as total_minutes,
    total_tokens,
    CASE 
        WHEN total_ai_processing_minutes > 0 AND total_tokens > 0 THEN '🎉 ALL WORKING!'
        WHEN total_ai_processing_minutes > 0 THEN '⚠️ TOKENS MISSING'
        WHEN total_tokens > 0 THEN '⚠️ AI TIME MISSING' 
        ELSE '❌ BOTH MISSING'
    END as result
FROM call_summary_materialized 
WHERE agent_id = '5109fd4b-a99c-4754-89ee-3f9bfaaa0482'
ORDER BY call_date;
