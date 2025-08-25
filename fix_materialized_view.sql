-- CORRECTION CRITIQUE: Remplacer la vue matérialisée avec la structure correcte
-- Le problème est que la vue existante utilise created_at au lieu de call_started_at

-- 1. Supprimer la vue existante
DROP MATERIALIZED VIEW IF EXISTS call_summary_materialized;

-- 2. Créer la vue avec la structure EXACTE attendue par le frontend
CREATE MATERIALIZED VIEW call_summary_materialized AS
SELECT 
    agent_id,
    DATE(call_started_at) as call_date,
    COUNT(*) as calls,
    COUNT(*) FILTER (WHERE call_ended_reason = 'completed') as successful_calls,
    ROUND(
        (COUNT(*) FILTER (WHERE call_ended_reason = 'completed')::decimal / NULLIF(COUNT(*), 0) * 100), 2
    ) as success_rate,
    SUM(COALESCE(duration_seconds, 0)) / 60.0 as total_minutes,
    AVG(COALESCE(avg_latency, 0)) as avg_latency,
    COUNT(DISTINCT customer_number) as unique_customers,
    SUM(
        COALESCE(total_llm_cost, 0) + 
        COALESCE(total_tts_cost, 0) + 
        COALESCE(total_stt_cost, 0)
    ) as total_cost
FROM pype_voice_call_logs 
WHERE call_started_at IS NOT NULL
GROUP BY agent_id, DATE(call_started_at)
ORDER BY agent_id, call_date;

-- 3. Créer l'index optimisé
CREATE INDEX idx_call_summary_materialized_agent_date 
ON call_summary_materialized (agent_id, call_date);

-- 4. Rafraîchir avec les données actuelles
REFRESH MATERIALIZED VIEW call_summary_materialized;

-- 5. Vérifier que les données correspondent maintenant
SELECT 
    'CORRECTED VIEW - Should now show data!' as status,
    agent_id,
    call_date,
    calls,
    successful_calls,
    success_rate,
    total_minutes,
    total_cost,
    unique_customers
FROM call_summary_materialized 
WHERE agent_id = '5109fd4b-a99c-4754-89ee-3f9bfaaa0482'
AND call_date >= '2025-08-18'
AND call_date <= '2025-08-25'
ORDER BY call_date;
