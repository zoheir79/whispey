-- 📊 ANALYSE EXPLICITE DES METRICS TRANSCRIPT_JSON ET TRANSCRIPT_WITH_METRICS
-- Pour l'agent 5109fd4b-a99c-4754-89ee-3f9bfaaa0482

-- 🔍 1. PROBLEMES IDENTIFIES - TRANSCRIPTS "OBJECT" AU LIEU D'ARRAY
SELECT 
    call_id,
    DATE(call_started_at) as call_date,
    duration_seconds,
    '=== TRANSCRIPT_JSON TYPE OBJECT (INVALIDE) ===' as issue,
    LEFT(transcript_json::text, 200) as transcript_json_preview
FROM pype_voice_call_logs 
WHERE agent_id = '5109fd4b-a99c-4754-89ee-3f9bfaaa0482'
  AND call_started_at >= '2025-08-25'
  AND jsonb_typeof(transcript_json) = 'object'
ORDER BY call_started_at;

-- 🔍 2. TRANSCRIPTS VALIDES (ARRAYS) - AVEC CONTENU
SELECT 
    call_id,
    DATE(call_started_at) as call_date,
    duration_seconds,
    jsonb_array_length(transcript_json) as json_turns,
    CASE WHEN transcript_with_metrics IS NOT NULL 
         THEN jsonb_array_length(transcript_with_metrics) 
         ELSE 0 END as metrics_turns,
    '=== PREVIEW FIRST TURN ===' as separator,
    transcript_json->0 as first_turn_json,
    transcript_with_metrics->0 as first_turn_metrics
FROM pype_voice_call_logs 
WHERE agent_id = '5109fd4b-a99c-4754-89ee-3f9bfaaa0482'
  AND call_started_at >= '2025-08-25'
  AND jsonb_typeof(transcript_json) = 'array'
ORDER BY call_started_at;

-- 🔍 2. DETAILS TRANSCRIPT_JSON (avec métriques)
SELECT 
    call_id,
    DATE(call_started_at) as call_date,
    duration_seconds,
    '=== TRANSCRIPT_JSON CONTENT ===' as separator,
    jsonb_pretty(transcript_json) as transcript_json_pretty
FROM pype_voice_call_logs 
WHERE agent_id = '5109fd4b-a99c-4754-89ee-3f9bfaaa0482'
  AND call_started_at >= '2025-08-25'
  AND transcript_json IS NOT NULL
ORDER BY call_started_at;

-- 🔍 3. DETAILS TRANSCRIPT_WITH_METRICS (avec métriques)
SELECT 
    call_id,
    DATE(call_started_at) as call_date,
    duration_seconds,
    '=== TRANSCRIPT_WITH_METRICS CONTENT ===' as separator,
    jsonb_pretty(transcript_with_metrics) as transcript_with_metrics_pretty
FROM pype_voice_call_logs 
WHERE agent_id = '5109fd4b-a99c-4754-89ee-3f9bfaaa0482'
  AND call_started_at >= '2025-08-25'
  AND transcript_with_metrics IS NOT NULL
ORDER BY call_started_at;

-- 🔍 4. EXTRACTION DES METRIQUES INDIVIDUELLES (TRANSCRIPT_JSON)
SELECT 
    call_id,
    DATE(call_started_at) as call_date,
    turn_index,
    turn_data->'stt_metrics'->>'duration' as stt_duration,
    turn_data->'llm_metrics'->>'total_time' as llm_total_time,
    turn_data->'llm_metrics'->>'prompt_tokens' as llm_prompt_tokens,
    turn_data->'llm_metrics'->>'completion_tokens' as llm_completion_tokens,
    turn_data->'tts_metrics'->>'duration' as tts_duration,
    turn_data->'user_transcript' as user_text,
    turn_data->'agent_response' as agent_text
FROM pype_voice_call_logs 
CROSS JOIN LATERAL (
    SELECT 
        ordinality - 1 as turn_index,
        value as turn_data
    FROM jsonb_array_elements(transcript_json) WITH ORDINALITY
) t
WHERE agent_id = '5109fd4b-a99c-4754-89ee-3f9bfaaa0482'
  AND call_started_at >= '2025-08-25'
  AND jsonb_typeof(transcript_json) = 'array'
ORDER BY call_started_at, turn_index;

-- 🔍 5. EXTRACTION DES METRIQUES INDIVIDUELLES (TRANSCRIPT_WITH_METRICS)
SELECT 
    call_id,
    DATE(call_started_at) as call_date,
    turn_index,
    turn_data->'stt_metrics'->>'duration' as stt_duration,
    turn_data->'llm_metrics'->>'ttft' as llm_ttft,
    turn_data->'llm_metrics'->>'prompt_tokens' as llm_prompt_tokens,
    turn_data->'llm_metrics'->>'completion_tokens' as llm_completion_tokens,
    turn_data->'tts_metrics'->>'duration' as tts_duration,
    turn_data->'tts_metrics'->>'ttfb' as tts_ttfb,
    turn_data->'user_transcript' as user_text,
    turn_data->'agent_response' as agent_text
FROM pype_voice_call_logs 
CROSS JOIN LATERAL (
    SELECT 
        ordinality - 1 as turn_index,
        value as turn_data
    FROM jsonb_array_elements(transcript_with_metrics) WITH ORDINALITY
) t
WHERE agent_id = '5109fd4b-a99c-4754-89ee-3f9bfaaa0482'
  AND call_started_at >= '2025-08-25'
  AND jsonb_typeof(transcript_with_metrics) = 'array'
ORDER BY call_started_at, turn_index;

-- 🔍 6. COMPARAISON DES METRIQUES ENTRE LES DEUX FORMATS
WITH transcript_json_metrics AS (
    SELECT 
        call_id,
        SUM((turn_data->'stt_metrics'->>'duration')::numeric) as total_stt,
        SUM((turn_data->'llm_metrics'->>'total_time')::numeric) as total_llm,
        SUM((turn_data->'tts_metrics'->>'duration')::numeric) as total_tts,
        COUNT(*) as turns_count
    FROM pype_voice_call_logs 
    CROSS JOIN LATERAL jsonb_array_elements(transcript_json) as turn_data
    WHERE agent_id = '5109fd4b-a99c-4754-89ee-3f9bfaaa0482'
      AND call_started_at >= '2025-08-25'
      AND jsonb_typeof(transcript_json) = 'array'
    GROUP BY call_id
),
transcript_with_metrics_data AS (
    SELECT 
        call_id,
        SUM((turn_data->'stt_metrics'->>'duration')::numeric) as total_stt,
        SUM((turn_data->'llm_metrics'->>'ttft')::numeric) as total_llm,
        SUM((turn_data->'tts_metrics'->>'duration')::numeric) as total_tts,
        COUNT(*) as turns_count
    FROM pype_voice_call_logs 
    CROSS JOIN LATERAL jsonb_array_elements(transcript_with_metrics) as turn_data
    WHERE agent_id = '5109fd4b-a99c-4754-89ee-3f9bfaaa0482'
      AND call_started_at >= '2025-08-25'
      AND jsonb_typeof(transcript_with_metrics) = 'array'
    GROUP BY call_id
)
SELECT 
    COALESCE(tj.call_id, tw.call_id) as call_id,
    'transcript_json' as source,
    tj.total_stt,
    tj.total_llm,
    tj.total_tts,
    tj.turns_count
FROM transcript_json_metrics tj
UNION ALL
SELECT 
    COALESCE(tj.call_id, tw.call_id) as call_id,
    'transcript_with_metrics' as source,
    tw.total_stt,
    tw.total_llm,
    tw.total_tts,
    tw.turns_count
FROM transcript_with_metrics_data tw
ORDER BY call_id, source;

-- 🔍 7. CONTENU TRANSCRIPTION_METRICS (si existant)
SELECT 
    call_id,
    DATE(call_started_at) as call_date,
    '=== TRANSCRIPTION_METRICS CONTENT ===' as separator,
    jsonb_pretty(transcription_metrics) as transcription_metrics_pretty
FROM pype_voice_call_logs 
WHERE agent_id = '5109fd4b-a99c-4754-89ee-3f9bfaaa0482'
  AND call_started_at >= '2025-08-25'
  AND transcription_metrics IS NOT NULL
ORDER BY call_started_at;
