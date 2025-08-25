-- Vérification des structures existantes dans la base PostgreSQL

-- 1. Vérifier les fonctions existantes
SELECT schemaname, viewname, definition 
FROM pg_views 
WHERE schemaname = 'public' 
AND viewname LIKE '%call_summary%';

-- 2. Vérifier les vues matérialisées existantes
SELECT schemaname, matviewname, definition 
FROM pg_matviews 
WHERE schemaname = 'public';

-- 3. Vérifier si call_summary_materialized existe et contient des données
SELECT COUNT(*) as row_count 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name = 'call_summary_materialized';

-- 4. Si elle existe, regarder les données
-- SELECT * FROM call_summary_materialized LIMIT 5;

-- 5. Vérifier les données source dans pype_voice_call_logs
SELECT COUNT(*) as source_data_count,
       MIN(call_started_at) as earliest_call,
       MAX(call_started_at) as latest_call
FROM pype_voice_call_logs;
