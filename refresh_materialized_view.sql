-- 🔄 REFRESH MATERIALIZED VIEW TO EXTRACT METRICS FROM TRANSCRIPT_WITH_METRICS
REFRESH MATERIALIZED VIEW call_summary_materialized;

-- 🔍 TEST: Vérifier les nouvelles valeurs AI processing time
SELECT 
    agent_id,
    call_date,
    calls,
    total_call_minutes as global_call_minutes,
    total_ai_processing_minutes as ai_processing_minutes,
    '=== COMPARISON ===' as separator,
    CASE 
        WHEN total_ai_processing_minutes > 0 THEN 'AI metrics extracted ✅'
        ELSE 'Still 0 - no metrics ❌'
    END as status
FROM call_summary_materialized
WHERE agent_id = '5109fd4b-a99c-4754-89ee-3f9bfaaa0482'
  AND call_date >= '2025-08-25'
ORDER BY call_date;
