-- 🔍 VERIFIER LE CONTENU DE TRANSCRIPT_WITH_METRICS
-- Puisque transcript_json est vide partout

-- 1. TYPE ET TAILLE DE TRANSCRIPT_WITH_METRICS
SELECT 
    call_id,
    DATE(call_started_at) as call_date,
    duration_seconds,
    jsonb_typeof(transcript_with_metrics) as type,
    CASE 
        WHEN transcript_with_metrics IS NOT NULL AND jsonb_typeof(transcript_with_metrics) = 'array' 
        THEN jsonb_array_length(transcript_with_metrics) 
        ELSE 0 
    END as nb_turns,
    '=== PREVIEW TRANSCRIPT_WITH_METRICS ===' as separator,
    LEFT(transcript_with_metrics::text, 300) as preview
FROM pype_voice_call_logs 
WHERE agent_id = '5109fd4b-a99c-4754-89ee-3f9bfaaa0482'
  AND call_started_at >= '2025-08-25'
ORDER BY call_started_at;

-- 2. CONTENU DETAILLE DES TRANSCRIPT_WITH_METRICS ARRAYS
SELECT 
    call_id,
    DATE(call_started_at) as call_date,
    '=== PREMIER TURN TRANSCRIPT_WITH_METRICS ===' as separator,
    jsonb_pretty(transcript_with_metrics->0) as first_turn_detailed
FROM pype_voice_call_logs 
WHERE agent_id = '5109fd4b-a99c-4754-89ee-3f9bfaaa0482'
  AND call_started_at >= '2025-08-25'
  AND transcript_with_metrics IS NOT NULL 
  AND jsonb_typeof(transcript_with_metrics) = 'array'
  AND jsonb_array_length(transcript_with_metrics) > 0
ORDER BY call_started_at;

-- 3. EXTRACTION DES METRIQUES DE TRANSCRIPT_WITH_METRICS
SELECT 
    call_id,
    turn_index,
    turn->'stt_metrics'->>'duration' as stt_duration,
    turn->'llm_metrics'->>'ttft' as llm_ttft,
    turn->'tts_metrics'->>'duration' as tts_duration,
    turn->'llm_metrics'->>'prompt_tokens' as prompt_tokens,
    turn->'llm_metrics'->>'completion_tokens' as completion_tokens,
    LEFT(turn->>'user_transcript', 80) as user_transcript_preview
FROM pype_voice_call_logs 
CROSS JOIN LATERAL (
    SELECT ordinality-1 as turn_index, value as turn
    FROM jsonb_array_elements(transcript_with_metrics) WITH ORDINALITY
) t
WHERE agent_id = '5109fd4b-a99c-4754-89ee-3f9bfaaa0482'
  AND call_started_at >= '2025-08-25'
  AND jsonb_typeof(transcript_with_metrics) = 'array'
ORDER BY call_started_at, turn_index;
