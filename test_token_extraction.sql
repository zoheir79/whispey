-- 🧪 TEST MANUAL: Extraction directe des tokens
SELECT 
    call_id,
    DATE(call_started_at) as call_date,
    '=== MANUAL TOKEN EXTRACTION ===' as separator,
    (SELECT SUM(
        COALESCE((turn->'llm_metrics'->>'prompt_tokens')::integer, 0) +
        COALESCE((turn->'llm_metrics'->>'completion_tokens')::integer, 0)
    ) FROM jsonb_array_elements(transcript_with_metrics) AS turn) as manual_total_tokens,
    '=== DETAIL PAR TURN ===' as separator2,
    jsonb_array_length(transcript_with_metrics) as nb_turns
FROM pype_voice_call_logs 
WHERE agent_id = '5109fd4b-a99c-4754-89ee-3f9bfaaa0482'
  AND call_started_at >= '2025-08-25'
  AND transcript_with_metrics IS NOT NULL 
  AND jsonb_typeof(transcript_with_metrics) = 'array'
ORDER BY call_started_at;

-- 🔍 DETAIL EXACT DES TOKENS PAR TURN
SELECT 
    call_id,
    turn_index,
    (turn->'llm_metrics'->>'prompt_tokens')::integer as prompt_tokens,
    (turn->'llm_metrics'->>'completion_tokens')::integer as completion_tokens,
    COALESCE((turn->'llm_metrics'->>'prompt_tokens')::integer, 0) + 
    COALESCE((turn->'llm_metrics'->>'completion_tokens')::integer, 0) as turn_total
FROM pype_voice_call_logs 
CROSS JOIN LATERAL (
    SELECT ordinality-1 as turn_index, value as turn
    FROM jsonb_array_elements(transcript_with_metrics) WITH ORDINALITY
) t
WHERE agent_id = '5109fd4b-a99c-4754-89ee-3f9bfaaa0482'
  AND call_started_at >= '2025-08-25'
  AND jsonb_typeof(transcript_with_metrics) = 'array'
ORDER BY call_started_at, turn_index;
