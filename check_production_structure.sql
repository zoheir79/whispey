-- Script pour diagnostiquer la structure de la base de données de production
-- Execute: psql -d whispey -f check_production_structure.sql

\echo '=== DIAGNOSTIC STRUCTURE BASE DE DONNÉES PRODUCTION ==='

-- 1. Vérifier les tables principales
\echo '\n📊 TABLES PRINCIPALES EXISTANTES:'
SELECT 
    schemaname, 
    tablename,
    tableowner
FROM pg_tables 
WHERE schemaname = 'public' 
    AND tablename LIKE '%workspace%' 
    OR tablename LIKE '%agent%' 
    OR tablename LIKE '%knowledge%'
    OR tablename LIKE '%user%'
ORDER BY tablename;

-- 2. Vérifier les schémas disponibles
\echo '\n🏗️ SCHÉMAS DISPONIBLES:'
SELECT schema_name 
FROM information_schema.schemata 
WHERE schema_name NOT LIKE 'pg_%' 
    AND schema_name != 'information_schema'
ORDER BY schema_name;

-- 3. Vérifier les colonnes des tables agents
\echo '\n🤖 STRUCTURE TABLE AGENTS:'
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name LIKE '%agent%' 
    AND table_schema = 'public'
ORDER BY table_name, ordinal_position;

-- 4. Vérifier les tables de références (foreign keys)
\echo '\n🔗 TABLES DE RÉFÉRENCE POUR FOREIGN KEYS:'
SELECT DISTINCT
    tc.table_name,
    tc.constraint_name,
    tc.constraint_type,
    kcu.column_name,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
    AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
    ON ccu.constraint_name = tc.constraint_name
    AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY'
    AND tc.table_schema = 'public'
    AND (tc.table_name LIKE '%agent%' OR tc.table_name LIKE '%knowledge%')
ORDER BY tc.table_name;

-- 5. Chercher des patterns de noms similaires
\echo '\n🔍 RECHERCHE PATTERNS WORKSPACE/USER:'
SELECT tablename
FROM pg_tables 
WHERE schemaname = 'public'
    AND (
        tablename ILIKE '%work%' 
        OR tablename ILIKE '%space%'
        OR tablename ILIKE '%user%'
        OR tablename ILIKE '%project%'
    )
ORDER BY tablename;

-- 6. Vérifier les tables billing existantes
\echo '\n💰 TABLES BILLING EXISTANTES:'
SELECT tablename
FROM pg_tables 
WHERE schemaname = 'public'
    AND tablename ILIKE '%billing%'
ORDER BY tablename;

-- 7. Vérifier les extensions disponibles
\echo '\n🧩 EXTENSIONS POSTGRESQL:'
SELECT extname, extversion
FROM pg_extension
ORDER BY extname;

\echo '\n✅ DIAGNOSTIC TERMINÉ'
