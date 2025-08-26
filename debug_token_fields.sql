-- 🔍 DEBUG: Vérifier les champs exacts dans llm_metrics pour les tokens
SELECT 
    call_id,
    turn_index,
    '=== LLM_METRICS KEYS ===' as separator,
    jsonb_object_keys(turn->'llm_metrics') as llm_metric_keys
FROM pype_voice_call_logs 
CROSS JOIN LATERAL (
    SELECT ordinality-1 as turn_index, value as turn
    FROM jsonb_array_elements(transcript_with_metrics) WITH ORDINALITY
) t
WHERE agent_id = '5109fd4b-a99c-4754-89ee-3f9bfaaa0482'
  AND call_started_at >= '2025-08-25'
  AND jsonb_typeof(transcript_with_metrics) = 'array'
ORDER BY call_started_at, turn_index;

-- 🔍 CONTENU COMPLET des llm_metrics
SELECT 
    call_id,
    turn_index,
    '=== FULL LLM_METRICS ===' as separator,
    jsonb_pretty(turn->'llm_metrics') as llm_metrics_content
FROM pype_voice_call_logs 
CROSS JOIN LATERAL (
    SELECT ordinality-1 as turn_index, value as turn
    FROM jsonb_array_elements(transcript_with_metrics) WITH ORDINALITY
) t
WHERE agent_id = '5109fd4b-a99c-4754-89ee-3f9bfaaa0482'
  AND call_started_at >= '2025-08-25'
  AND jsonb_typeof(transcript_with_metrics) = 'array'
ORDER BY call_started_at, turn_index
LIMIT 5;
