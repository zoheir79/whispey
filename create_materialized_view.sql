-- Création de la vue matérialisée call_summary_materialized pour l'Overview
-- Cette vue agrège les données de pype_voice_call_logs par agent et par date

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
    -- Global call time (traditional duration_seconds)
    SUM(COALESCE(duration_seconds, 0)) / 60.0 as total_call_minutes,
    -- AI processing time - Use transcript_with_metrics (has ttft) or transcript_json (has total_time)
    SUM(
        CASE 
            -- Try transcript_with_metrics first (uses llm_metrics.ttft)
            WHEN transcript_with_metrics IS NOT NULL AND jsonb_typeof(transcript_with_metrics) = 'array' THEN (
                SELECT COALESCE(SUM(
                    COALESCE((turn->'stt_metrics'->>'duration')::numeric, 0) +
                    COALESCE((turn->'llm_metrics'->>'ttft')::numeric, 0) +
                    COALESCE((turn->'tts_metrics'->>'duration')::numeric, 0)
                ), 0)
                FROM jsonb_array_elements(transcript_with_metrics) as turn
            )
            -- Fallback to transcript_json (uses llm_metrics.total_time)
            WHEN transcript_json IS NOT NULL AND jsonb_typeof(transcript_json) = 'array' THEN (
                SELECT COALESCE(SUM(
                    COALESCE((turn->'stt_metrics'->>'duration')::numeric, 0) +
                    COALESCE((turn->'llm_metrics'->>'total_time')::numeric, 0) +
                    COALESCE((turn->'tts_metrics'->>'duration')::numeric, 0)
                ), 0)
                FROM jsonb_array_elements(transcript_json) as turn
            )
            ELSE 0
        END
    ) / 60.0 as total_ai_processing_minutes,
    AVG(COALESCE(avg_latency, 0)) as avg_latency,
    COUNT(DISTINCT customer_number) as unique_customers,
    SUM(COALESCE(total_llm_cost, 0) + COALESCE(total_tts_cost, 0) + COALESCE(total_stt_cost, 0)) as total_cost,
    -- Extract and sum tokens from transcription_metrics JSONB (use llm_prompt_tokens/llm_completion_tokens)
    SUM(
        COALESCE((transcription_metrics->>'llm_prompt_tokens')::integer, 0) + 
        COALESCE((transcription_metrics->>'llm_completion_tokens')::integer, 0)
    ) as total_tokens
FROM pype_voice_call_logs 
WHERE call_started_at IS NOT NULL
GROUP BY agent_id, DATE(call_started_at)
ORDER BY agent_id, call_date;

-- Créer un index pour optimiser les requêtes
CREATE INDEX IF NOT EXISTS idx_call_summary_materialized_agent_date 
ON call_summary_materialized (agent_id, call_date);

-- Rafraîchir la vue avec les données actuelles
REFRESH MATERIALIZED VIEW call_summary_materialized;

-- Vérification des données créées avec les deux métriques de temps
SELECT 
    agent_id,
    call_date,
    calls,
    successful_calls,
    success_rate,
    total_call_minutes as global_call_duration,
    total_ai_processing_minutes as stt_llm_tts_duration,
    total_cost,
    total_tokens,
    unique_customers
FROM call_summary_materialized 
ORDER BY agent_id, call_date
LIMIT 10;

-- Debug: Comparer temps global vs temps traitement IA
SELECT 
    agent_id,
    call_date,
    total_call_minutes as global_minutes,
    total_ai_processing_minutes as ai_processing_minutes,
    (total_call_minutes - total_ai_processing_minutes) as difference_minutes,
    ROUND((total_ai_processing_minutes / NULLIF(total_call_minutes, 0) * 100), 2) as ai_efficiency_percent
FROM call_summary_materialized
WHERE total_call_minutes > 0
LIMIT 10;

-- DIAGNOSTIC: Analyser les données manquantes par date
SELECT 
    DATE(call_started_at) as call_date,
    COUNT(*) as total_calls,
    COUNT(duration_seconds) as has_duration_seconds,
    COUNT(CASE WHEN duration_seconds > 0 THEN 1 END) as has_nonzero_duration,
    COUNT(transcript_json) as has_transcript_json,
    COUNT(transcript_with_metrics) as has_transcript_with_metrics,
    COUNT(transcription_metrics) as has_transcription_metrics,
    COUNT(CASE WHEN jsonb_typeof(transcript_json) = 'array' THEN 1 END) as valid_transcript_json,
    COUNT(CASE WHEN jsonb_typeof(transcript_with_metrics) = 'array' THEN 1 END) as valid_transcript_with_metrics
FROM pype_voice_call_logs 
WHERE agent_id = '5109fd4b-a99c-4754-89ee-3f9bfaaa0482'
  AND call_started_at >= '2025-08-25'
  AND call_started_at < '2025-08-27'
GROUP BY DATE(call_started_at)
ORDER BY call_date;
