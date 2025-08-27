-- =====================================================
-- SCRIPT DE NETTOYAGE COMPLET DES DONNÉES DE CALLS
-- ⚠️ ATTENTION: Cette opération est IRRÉVERSIBLE
-- =====================================================

-- 1. Rafraîchir la vue matérialisée pour voir l'état actuel
SELECT 
    COUNT(*) as total_calls_before_cleanup,
    SUM(calls) as aggregated_calls,
    MIN(call_date) as oldest_call,
    MAX(call_date) as newest_call
FROM call_summary_materialized;

-- 2. Supprimer la vue matérialisée (elle sera recréée vide)
DROP MATERIALIZED VIEW IF EXISTS call_summary_materialized;

-- 3. Supprimer toutes les données de calls de la table principale
DELETE FROM pype_voice_call_logs;

-- 4. Vérifier que la table est vide
SELECT COUNT(*) as remaining_calls FROM pype_voice_call_logs;

-- 5. Recréer la vue matérialisée vide
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
    SUM(COALESCE(extract_ai_processing_time(transcript_with_metrics), 0)) as total_ai_processing_minutes,
    SUM(COALESCE(duration_seconds, 0)) / 60.0 as total_minutes,
    AVG(COALESCE(avg_latency, 0)) as avg_latency,
    COUNT(DISTINCT customer_number) as unique_customers,
    SUM(COALESCE(total_llm_cost, 0) + COALESCE(total_tts_cost, 0) + COALESCE(total_stt_cost, 0)) as total_cost,
    SUM(COALESCE(extract_tokens_from_transcript(transcript_with_metrics), 0)) as total_tokens
FROM pype_voice_call_logs 
WHERE call_started_at IS NOT NULL
GROUP BY agent_id, DATE(call_started_at)
ORDER BY agent_id, call_date;

-- 6. Recréer l'index
CREATE INDEX IF NOT EXISTS idx_call_summary_materialized_agent_date 
ON call_summary_materialized (agent_id, call_date);

-- 7. Rafraîchir la vue (sera vide)
REFRESH MATERIALIZED VIEW call_summary_materialized;

-- 8. Vérification finale
SELECT 
    COUNT(*) as calls_in_main_table,
    (SELECT COUNT(*) FROM call_summary_materialized) as calls_in_materialized_view
;

-- 9. Réinitialiser les séquences si nécessaire (optionnel)
-- ALTER SEQUENCE pype_voice_call_logs_id_seq RESTART WITH 1;

SELECT '✅ NETTOYAGE TERMINÉ - Toutes les données de calls ont été supprimées' as status;
