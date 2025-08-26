-- 🔄 REFRESH MATERIALIZED VIEW WITH NEW TOKEN EXTRACTION
REFRESH MATERIALIZED VIEW call_summary_materialized;

-- 🔍 TEST: Vérifier que les tokens sont maintenant extraits
SELECT 
    agent_id,
    call_date,
    calls,
    total_call_minutes as global_call_minutes,
    total_ai_processing_minutes as ai_processing_minutes,
    total_tokens,
    '=== TOKEN STATUS ===' as separator,
    CASE 
        WHEN total_tokens > 0 THEN CONCAT('✅ Tokens found: ', total_tokens)
        ELSE '❌ Still 0 tokens'
    END as token_status
FROM call_summary_materialized
WHERE agent_id = '5109fd4b-a99c-4754-89ee-3f9bfaaa0482'
  AND call_date >= '2025-08-25'
ORDER BY call_date;
