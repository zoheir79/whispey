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
    -- AI processing time - sum across all calls for this agent/date
    SUM(COALESCE(extract_ai_processing_time(transcript_with_metrics), 0)) as total_ai_processing_minutes,
    -- Combined minutes for chart display (now using global call time)
    SUM(COALESCE(duration_seconds, 0)) / 60.0 as total_minutes,
    AVG(COALESCE(avg_latency, 0)) as avg_latency,
    COUNT(DISTINCT customer_number) as unique_customers,
    -- Coûts per-call (usage costs)
    SUM(COALESCE(l.total_llm_cost, 0) + COALESCE(l.total_tts_cost, 0) + COALESCE(l.total_stt_cost, 0)) as total_usage_cost,
    -- Platform mode pour différencier le calcul
    MAX(a.platform_mode) as platform_mode,
    -- Extract and sum tokens across all calls for this agent/date
    SUM(COALESCE(extract_tokens_from_transcript(transcript_with_metrics), 0)) as total_tokens
FROM pype_voice_call_logs l
LEFT JOIN pype_voice_agents a ON l.agent_id = a.id
WHERE call_started_at IS NOT NULL
GROUP BY agent_id, DATE(call_started_at)
ORDER BY agent_id, call_date;

-- Créer un index pour optimiser les requêtes
CREATE INDEX IF NOT EXISTS idx_call_summary_materialized_agent_date 
ON call_summary_materialized (agent_id, call_date);

CREATE INDEX IF NOT EXISTS idx_call_summary_materialized_platform_mode
ON call_summary_materialized (platform_mode);

-- Rafraîchir la vue avec les données actuelles
REFRESH MATERIALIZED VIEW call_summary_materialized;

-- Créer une fonction helper pour calculer les coûts complets avec dedicated T0
CREATE OR REPLACE FUNCTION get_complete_daily_cost(p_agent_id UUID, p_date DATE)
RETURNS JSONB AS $$
DECLARE
    usage_cost NUMERIC := 0;
    dedicated_cost NUMERIC := 0;
    platform_mode TEXT;
    total_cost NUMERIC := 0;
BEGIN
    -- Récupérer usage cost depuis materialized view
    SELECT total_usage_cost, platform_mode 
    INTO usage_cost, platform_mode
    FROM call_summary_materialized 
    WHERE agent_id = p_agent_id AND call_date = p_date;
    
    usage_cost := COALESCE(usage_cost, 0);
    
    -- Calculer dedicated cost seulement pour dedicated/hybrid
    IF platform_mode IN ('dedicated', 'hybrid') THEN
        SELECT COALESCE(
            (get_agent_total_cost_t0(p_agent_id, p_date, p_date + INTERVAL '1 day'))->>'total_cost', '0'
        )::NUMERIC - usage_cost
        INTO dedicated_cost;
    END IF;
    
    total_cost := usage_cost + COALESCE(dedicated_cost, 0);
    
    RETURN jsonb_build_object(
        'usage_cost', usage_cost,
        'dedicated_cost', COALESCE(dedicated_cost, 0),
        'total_cost', total_cost,
        'platform_mode', COALESCE(platform_mode, 'pag')
    );
END;
$$ LANGUAGE plpgsql;

-- Vérification des données avec coûts complets
SELECT 
    agent_id,
    call_date,
    calls,
    successful_calls,
    success_rate,
    total_call_minutes as global_call_duration,
    total_ai_processing_minutes as stt_llm_tts_duration,
    total_usage_cost,
    platform_mode,
    get_complete_daily_cost(agent_id, call_date) as complete_cost,
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
