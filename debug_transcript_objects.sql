-- 🚨 DEBUG: Pourquoi transcript_json est "object" au lieu d'"array" ?

-- 1. CONTENU EXACT DES TRANSCRIPTS "OBJECT" (PROBLEMATIQUES)
SELECT 
    call_id,
    DATE(call_started_at) as call_date,
    duration_seconds,
    '=== CONTENU TRANSCRIPT_JSON OBJECT ===' as separator,
    jsonb_pretty(transcript_json) as content
FROM pype_voice_call_logs 
WHERE agent_id = '5109fd4b-a99c-4754-89ee-3f9bfaaa0482'
  AND call_started_at >= '2025-08-25'
  AND jsonb_typeof(transcript_json) = 'object'
ORDER BY call_started_at;

-- 2. CONTENU DES TRANSCRIPTS "ARRAY" (VALIDES)
SELECT 
    call_id,
    DATE(call_started_at) as call_date,
    duration_seconds,
    jsonb_array_length(transcript_json) as nb_turns,
    '=== PREMIER TURN TRANSCRIPT_JSON ARRAY ===' as separator,
    jsonb_pretty(transcript_json->0) as first_turn
FROM pype_voice_call_logs 
WHERE agent_id = '5109fd4b-a99c-4754-89ee-3f9bfaaa0482'
  AND call_started_at >= '2025-08-25'
  AND jsonb_typeof(transcript_json) = 'array'
ORDER BY call_started_at;

-- 3. METRIQUES EXTRAITES DES ARRAYS VALIDES
SELECT 
    call_id,
    turn_index,
    turn->'stt_metrics'->>'duration' as stt_seconds,
    turn->'llm_metrics'->>'ttft' as llm_ttft,
    turn->'llm_metrics'->>'total_time' as llm_total_time,
    turn->'tts_metrics'->>'duration' as tts_seconds,
    LEFT(turn->>'user_transcript', 50) as user_text_preview,
    LEFT(turn->>'agent_response', 50) as agent_text_preview
FROM pype_voice_call_logs 
CROSS JOIN LATERAL (
    SELECT ordinality-1 as turn_index, value as turn
    FROM jsonb_array_elements(transcript_json) WITH ORDINALITY
) t
WHERE agent_id = '5109fd4b-a99c-4754-89ee-3f9bfaaa0482'
  AND call_started_at >= '2025-08-25'
  AND jsonb_typeof(transcript_json) = 'array'
ORDER BY call_started_at, turn_index;
