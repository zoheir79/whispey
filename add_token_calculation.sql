-- 🔧 Add token calculation to existing materialized view
-- Approach: Create a function to calculate tokens, then alter the view

-- Step 1: Create function to extract tokens from transcript_with_metrics
CREATE OR REPLACE FUNCTION extract_tokens_from_transcript(transcript_data JSONB)
RETURNS INTEGER AS $$
BEGIN
    -- Check if transcript_with_metrics is valid array
    IF transcript_data IS NULL OR jsonb_typeof(transcript_data) != 'array' THEN
        RETURN 0;
    END IF;
    
    -- Sum tokens from all turns
    RETURN COALESCE((
        SELECT SUM(
            COALESCE((turn->'llm_metrics'->>'prompt_tokens')::integer, 0) +
            COALESCE((turn->'llm_metrics'->>'completion_tokens')::integer, 0)
        )
        FROM jsonb_array_elements(transcript_data) AS turn
        WHERE turn->'llm_metrics' IS NOT NULL
    ), 0);
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Step 2: Test the function with our known data
SELECT 
    '=== TESTING TOKEN FUNCTION ===' as status,
    call_id,
    extract_tokens_from_transcript(transcript_with_metrics) as calculated_tokens
FROM pype_voice_call_logs 
WHERE agent_id = '5109fd4b-a99c-4754-89ee-3f9bfaaa0482'
  AND DATE(call_started_at) = '2025-08-26'
  AND transcript_with_metrics IS NOT NULL
ORDER BY call_started_at;

-- Step 3: Recreate materialized view with function-based token calculation  
DROP MATERIALIZED VIEW IF EXISTS call_summary_materialized;

CREATE MATERIALIZED VIEW call_summary_materialized AS
SELECT 
    agent_id,
    DATE(call_started_at) as call_date,
    COUNT(*) as calls,
    COUNT(*) FILTER (WHERE call_ended_reason = 'completed') as successful_calls,
    ROUND(
        (COUNT(*) FILTER (WHERE call_ended_reason = 'completed')::decimal / COUNT(*) * 100), 2
    ) as success_rate,
    SUM(COALESCE(duration_seconds, 0)) / 60.0 as total_call_minutes,
    ROUND(0.0, 2) as total_ai_processing_minutes, -- TODO: Add AI processing calculation
    AVG(COALESCE(avg_latency, 0)) as avg_latency,
    COUNT(DISTINCT customer_number) as unique_customers,
    SUM(COALESCE(total_llm_cost, 0) + COALESCE(total_tts_cost, 0) + COALESCE(total_stt_cost, 0)) as total_cost,
    -- Use function to calculate tokens - this avoids GROUP BY issues
    SUM(extract_tokens_from_transcript(transcript_with_metrics)) as total_tokens
FROM pype_voice_call_logs 
WHERE call_started_at IS NOT NULL
GROUP BY agent_id, DATE(call_started_at)
ORDER BY agent_id, call_date;

-- Step 4: Create index
CREATE INDEX IF NOT EXISTS idx_call_summary_materialized_agent_date 
ON call_summary_materialized (agent_id, call_date);

-- Step 5: Refresh and verify tokens
REFRESH MATERIALIZED VIEW call_summary_materialized;

SELECT 
    '=== FINAL VERIFICATION ===' as status,
    call_date, 
    calls, 
    total_tokens,
    CASE WHEN total_tokens > 0 THEN '🎉 TOKENS WORKING!' ELSE '❌ Still 0' END as result
FROM call_summary_materialized 
WHERE agent_id = '5109fd4b-a99c-4754-89ee-3f9bfaaa0482'
ORDER BY call_date;
