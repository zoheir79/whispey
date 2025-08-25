-- Création des 3 fonctions PostgreSQL manquantes pour Whispey
-- Basé sur l'analyse du code et les appels RPC attendus

-- 1. FONCTION: get_available_json_fields
-- Récupère les champs disponibles dans une colonne JSON
CREATE OR REPLACE FUNCTION get_available_json_fields(
    p_agent_id UUID,
    p_column_name TEXT,
    p_limit INTEGER DEFAULT 100
)
RETURNS TABLE(field_name TEXT, field_type TEXT, sample_value TEXT)
LANGUAGE plpgsql
AS $$
BEGIN
    -- Pour les colonnes metadata et transcription_metrics (JSONB)
    IF p_column_name = 'metadata' THEN
        RETURN QUERY
        SELECT DISTINCT
            jsonb_object_keys(metadata) as field_name,
            'text'::text as field_type,
            (metadata ->> jsonb_object_keys(metadata))::text as sample_value
        FROM pype_voice_call_logs 
        WHERE agent_id = p_agent_id 
        AND metadata IS NOT NULL
        LIMIT p_limit;
    ELSIF p_column_name = 'transcription_metrics' THEN
        RETURN QUERY
        SELECT DISTINCT
            jsonb_object_keys(transcription_metrics) as field_name,
            'text'::text as field_type,
            (transcription_metrics ->> jsonb_object_keys(transcription_metrics))::text as sample_value
        FROM pype_voice_call_logs 
        WHERE agent_id = p_agent_id 
        AND transcription_metrics IS NOT NULL
        LIMIT p_limit;
    END IF;
    
    RETURN;
END;
$$;

-- 2. FONCTION: get_distinct_values
-- Récupère les valeurs distinctes pour une colonne ou un champ JSON
CREATE OR REPLACE FUNCTION get_distinct_values(
    p_agent_id UUID,
    p_column_name TEXT,
    p_json_field TEXT DEFAULT NULL,
    p_limit INTEGER DEFAULT 100
)
RETURNS TABLE(value TEXT, count BIGINT)
LANGUAGE plpgsql
AS $$
BEGIN
    -- Si c'est un champ JSON
    IF p_json_field IS NOT NULL THEN
        IF p_column_name = 'metadata' THEN
            RETURN QUERY
            EXECUTE format('
                SELECT DISTINCT
                    (metadata ->> %L)::text as value,
                    COUNT(*)::bigint as count
                FROM pype_voice_call_logs 
                WHERE agent_id = %L
                AND metadata ? %L
                GROUP BY (metadata ->> %L)
                ORDER BY count DESC
                LIMIT %s
            ', p_json_field, p_agent_id, p_json_field, p_json_field, p_limit);
        ELSIF p_column_name = 'transcription_metrics' THEN
            RETURN QUERY
            EXECUTE format('
                SELECT DISTINCT
                    (transcription_metrics ->> %L)::text as value,
                    COUNT(*)::bigint as count
                FROM pype_voice_call_logs 
                WHERE agent_id = %L
                AND transcription_metrics ? %L
                GROUP BY (transcription_metrics ->> %L)
                ORDER BY count DESC
                LIMIT %s
            ', p_json_field, p_agent_id, p_json_field, p_json_field, p_limit);
        END IF;
    ELSE
        -- Pour les colonnes normales
        RETURN QUERY
        EXECUTE format('
            SELECT DISTINCT
                %I::text as value,
                COUNT(*)::bigint as count
            FROM pype_voice_call_logs 
            WHERE agent_id = %L
            AND %I IS NOT NULL
            GROUP BY %I
            ORDER BY count DESC
            LIMIT %s
        ', p_column_name, p_agent_id, p_column_name, p_column_name, p_limit);
    END IF;
    
    RETURN;
END;
$$;

-- 3. FONCTION: batch_calculate_custom_totals
-- Calcule plusieurs totaux personnalisés en une seule fois
CREATE OR REPLACE FUNCTION batch_calculate_custom_totals(
    p_configs JSONB,
    p_project_id UUID,
    p_agent_id UUID,
    p_date_from DATE DEFAULT NULL,
    p_date_to DATE DEFAULT NULL
)
RETURNS TABLE(config_id TEXT, result NUMERIC, error_message TEXT)
LANGUAGE plpgsql
AS $$
DECLARE
    config_item JSONB;
    calc_result RECORD;
    v_config_id TEXT;
    v_result NUMERIC;
    v_error_message TEXT;
BEGIN
    -- Itérer sur chaque configuration dans le tableau
    FOR config_item IN SELECT jsonb_array_elements(p_configs)
    LOOP
        -- Appeler calculate_custom_total pour chaque configuration
        SELECT INTO calc_result *
        FROM calculate_custom_total(
            p_agent_id,
            config_item->>'aggregation',
            config_item->>'column_name',
            config_item->>'json_field',
            COALESCE(config_item->'filters', '[]'::jsonb),
            COALESCE(config_item->>'filter_logic', 'AND'),
            p_date_from,
            p_date_to
        );
        
        -- Assigner les valeurs aux variables
        v_config_id := config_item->>'id';
        v_result := calc_result.result;
        v_error_message := calc_result.error_message;
        
        -- Retourner le résultat pour cette configuration
        config_id := v_config_id;
        result := v_result;
        error_message := v_error_message;
        RETURN NEXT;
    END LOOP;
    
    RETURN;
END;
$$;

-- 4. CRÉER LA VUE MATÉRIALISÉE SI ELLE N'EXISTE PAS
CREATE MATERIALIZED VIEW IF NOT EXISTS call_summary_materialized AS
SELECT 
    agent_id,
    DATE(call_started_at) as call_date,
    COUNT(*) as calls,
    COUNT(*) FILTER (WHERE call_ended_reason = 'completed') as successful_calls,
    ROUND(
        (COUNT(*) FILTER (WHERE call_ended_reason = 'completed')::decimal / COUNT(*) * 100), 2
    ) as success_rate,
    SUM(COALESCE(duration_seconds, 0)) / 60.0 as total_minutes,
    AVG(COALESCE(avg_latency, 0)) as avg_latency,
    COUNT(DISTINCT customer_number) as unique_customers,
    SUM(COALESCE(total_llm_cost, 0) + COALESCE(total_tts_cost, 0) + COALESCE(total_stt_cost, 0)) as total_cost
FROM pype_voice_call_logs 
WHERE call_started_at IS NOT NULL
GROUP BY agent_id, DATE(call_started_at)
ORDER BY agent_id, call_date;

-- Créer un index pour optimiser les requêtes
CREATE INDEX IF NOT EXISTS idx_call_summary_materialized_agent_date 
ON call_summary_materialized (agent_id, call_date);

-- Rafraîchir la vue avec les données actuelles
REFRESH MATERIALIZED VIEW call_summary_materialized;

-- Test: Vérifier que tout fonctionne
SELECT 'Functions created successfully!' as status;

-- Afficher un aperçu des données
SELECT 
    agent_id,
    call_date,
    calls,
    successful_calls,
    success_rate,
    total_minutes,
    total_cost,
    unique_customers
FROM call_summary_materialized 
ORDER BY agent_id, call_date
LIMIT 5;
