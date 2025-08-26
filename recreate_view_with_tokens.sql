-- 🔥 RECREATE materialized view with token extraction logic

-- Drop existing view
DROP MATERIALIZED VIEW IF EXISTS call_summary_materialized;

-- Execute the create script with new token logic
\i create_materialized_view.sql

-- Verify token extraction works
SELECT 
    '=== VERIFICATION AFTER RECREATION ===' as status,
    agent_id, 
    call_date, 
    calls, 
    total_tokens,
    CASE WHEN total_tokens > 0 THEN '✅ TOKENS FIXED' ELSE '❌ Still 0' END as token_status
FROM call_summary_materialized 
WHERE agent_id = '5109fd4b-a99c-4754-89ee-3f9bfaaa0482'
ORDER BY call_date;
