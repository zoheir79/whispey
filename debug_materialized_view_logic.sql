-- 🔍 DEBUG: Simuler exactement la logique de la vue matérialisée
-- Comparer avec notre test manuel qui fonctionne

SELECT 
    '=== TOUS LES APPELS 2025-08-26 ===' as separator,
    call_id,
    transcript_with_metrics IS NOT NULL as has_transcript,
    CASE WHEN transcript_with_metrics IS NOT NULL THEN jsonb_typeof(transcript_with_metrics) ELSE 'NULL' END as transcript_type,
    CASE WHEN transcript_with_metrics IS NOT NULL AND jsonb_typeof(transcript_with_metrics) = 'array' 
         THEN jsonb_array_length(transcript_with_metrics) ELSE 0 END as nb_turns
FROM pype_voice_call_logs 
WHERE agent_id = '5109fd4b-a99c-4754-89ee-3f9bfaaa0482'
  AND DATE(call_started_at) = '2025-08-26'
ORDER BY call_started_at;

SELECT 
    '=== LOGIQUE VUE MATÉRIALISÉE (GROUPED) ===' as separator,
    agent_id,
    DATE(call_started_at) as call_date,
    COUNT(*) as total_calls,
    SUM(
        CASE 
            WHEN transcript_with_metrics IS NOT NULL AND jsonb_typeof(transcript_with_metrics) = 'array' THEN
                COALESCE(
                    (SELECT SUM(
                        COALESCE((turn->'llm_metrics'->>'prompt_tokens')::integer, 0) +
                        COALESCE((turn->'llm_metrics'->>'completion_tokens')::integer, 0)
                    ) FROM jsonb_array_elements(transcript_with_metrics) AS turn), 0
                )
            ELSE 0
        END
    ) as grouped_total_tokens
FROM pype_voice_call_logs 
WHERE agent_id = '5109fd4b-a99c-4754-89ee-3f9bfaaa0482'
  AND DATE(call_started_at) = '2025-08-26'
GROUP BY agent_id, DATE(call_started_at);

SELECT 
    '=== LOGIQUE TEST MANUEL (FILTERED) ===' as separator,
    COUNT(*) as filtered_calls,
    SUM(
        (SELECT SUM(
            COALESCE((turn->'llm_metrics'->>'prompt_tokens')::integer, 0) +
            COALESCE((turn->'llm_metrics'->>'completion_tokens')::integer, 0)
        ) FROM jsonb_array_elements(transcript_with_metrics) AS turn)
    ) as manual_total_tokens
FROM pype_voice_call_logs 
WHERE agent_id = '5109fd4b-a99c-4754-89ee-3f9bfaaa0482'
  AND DATE(call_started_at) = '2025-08-26'
  AND transcript_with_metrics IS NOT NULL 
  AND jsonb_typeof(transcript_with_metrics) = 'array';
