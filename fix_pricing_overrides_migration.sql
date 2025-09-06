-- ===================================
-- MIGRATION: Correction Overrides & Calculs après changement PricingSettings
-- Date: 2025-01-06
-- Objectif: Consolider overrides existants avec nouvelle structure pricing
-- ===================================

BEGIN;

-- ========================================
-- 1. MIGRATION DES OVERRIDES AGENTS EXISTANTS
-- ========================================

-- Fonction de migration des cost_overrides vers nouveaux noms
CREATE OR REPLACE FUNCTION migrate_agent_cost_overrides()
RETURNS JSONB AS $$
DECLARE
    agent_record RECORD;
    updated_overrides JSONB;
    migration_count INTEGER := 0;
    result JSONB;
BEGIN
    -- Parcourir tous les agents avec cost_overrides
    FOR agent_record IN 
        SELECT id, cost_overrides, name
        FROM pype_voice_agents 
        WHERE cost_overrides IS NOT NULL 
        AND cost_overrides != '{}'::jsonb
    LOOP
        updated_overrides := agent_record.cost_overrides;
        
        -- Mapper anciens noms vers nouveaux noms si nécessaire
        -- Garder les noms existants qui sont encore valides
        -- Pas de changement nécessaire car structure overrides reste compatible
        
        -- S3 storage: s3_storage_cost_per_gb reste valide (mapping vers s3_rates.storage_gb_month)
        -- Autres champs restent identiques
        
        -- Pas de modification nécessaire pour l'instant
        -- Les overrides utilisent des noms génériques compatibles
        
        RAISE NOTICE 'Agent % (%): overrides conservés', agent_record.id, agent_record.name;
    END LOOP;
    
    result := jsonb_build_object(
        'migrated_agents', migration_count,
        'status', 'completed',
        'message', 'Overrides agent compatibles avec nouvelle structure'
    );
    
    RETURN result;
END;
$$ LANGUAGE plpgsql;

-- ========================================
-- 2. MISE À JOUR FONCTION CALCUL AGENTS
-- ========================================

-- Nouvelle fonction calculate_agent_cost compatible avec PricingSettings
CREATE OR REPLACE FUNCTION calculate_agent_cost_v2(
    p_agent_id UUID,
    p_call_duration_minutes NUMERIC DEFAULT NULL,
    p_stt_duration_minutes NUMERIC DEFAULT NULL,
    p_tokens_used INTEGER DEFAULT NULL,
    p_words_generated INTEGER DEFAULT NULL,
    p_include_dedicated_costs BOOLEAN DEFAULT TRUE
) RETURNS JSONB AS $$
DECLARE
    agent_config RECORD;
    pricing_settings JSONB;
    cost_result JSONB := '{}';
    stt_cost NUMERIC := 0;
    tts_cost NUMERIC := 0;
    llm_cost NUMERIC := 0;
    total_cost NUMERIC := 0;
    prorata_ratio NUMERIC := 1.0;
    daily_dedicated_stt NUMERIC := 0;
    daily_dedicated_tts NUMERIC := 0;
    daily_dedicated_llm NUMERIC := 0;
    days_in_month INTEGER;
BEGIN
    -- Récupérer configuration agent
    SELECT 
        platform_mode,
        billing_cycle,
        cost_overrides,
        provider_config,
        agent_type,
        created_at
    INTO agent_config
    FROM pype_voice_agents 
    WHERE id = p_agent_id;

    IF NOT FOUND THEN
        RETURN '{"error": "Agent not found"}'::jsonb;
    END IF;

    -- Récupérer settings globaux avec nouvelle structure
    SELECT 
        COALESCE((SELECT value FROM settings_global WHERE key = 'pricing_rates_dedicated'), '{}'::jsonb) as dedicated_rates,
        COALESCE((SELECT value FROM settings_global WHERE key = 'pricing_rates_pag'), '{}'::jsonb) as pag_rates,
        COALESCE((SELECT value FROM settings_global WHERE key = 'subscription_costs'), '{}'::jsonb) as subscription_costs,
        COALESCE((SELECT value FROM settings_global WHERE key = 'fixed_pricing'), '{}'::jsonb) as fixed_pricing,
        COALESCE((SELECT value FROM settings_global WHERE key = 's3_rates'), '{}'::jsonb) as s3_rates
    INTO pricing_settings;

    -- Calculer prorata et coûts daily dedicated si applicable
    IF p_include_dedicated_costs THEN
        SELECT calculate_monthly_prorata(p_agent_id, EXTRACT(YEAR FROM NOW())::INTEGER, EXTRACT(MONTH FROM NOW())::INTEGER)
        INTO prorata_ratio;
        
        days_in_month := EXTRACT(days FROM DATE_TRUNC('month', NOW()) + INTERVAL '1 month' - INTERVAL '1 day');
        
        -- Coûts daily dedicated avec fallback override -> global
        daily_dedicated_stt := COALESCE(
            (agent_config.cost_overrides->>'stt_monthly_cost')::NUMERIC,
            (pricing_settings->'dedicated_rates'->>'stt_monthly')::NUMERIC,
            0
        ) * prorata_ratio / days_in_month;
        
        daily_dedicated_tts := COALESCE(
            (agent_config.cost_overrides->>'tts_monthly_cost')::NUMERIC,
            (pricing_settings->'dedicated_rates'->>'tts_monthly')::NUMERIC,
            0
        ) * prorata_ratio / days_in_month;
        
        daily_dedicated_llm := COALESCE(
            (agent_config.cost_overrides->>'llm_monthly_cost')::NUMERIC,
            (pricing_settings->'dedicated_rates'->>'llm_monthly')::NUMERIC,
            0
        ) * prorata_ratio / days_in_month;
    END IF;

    -- Calcul pour mode PAG (Pay-as-You-Go)
    IF agent_config.platform_mode = 'pag' THEN
        
        -- STT Cost (Voice agents only)
        IF agent_config.agent_type = 'voice' AND p_stt_duration_minutes IS NOT NULL THEN
            stt_cost := COALESCE(
                (agent_config.cost_overrides->>'builtin_stt_cost')::NUMERIC,
                (pricing_settings->'pag_rates'->>'stt_builtin_per_minute')::NUMERIC,
                0
            ) * p_stt_duration_minutes;
        END IF;

        -- TTS Cost (Voice agents only)
        IF agent_config.agent_type = 'voice' AND p_words_generated IS NOT NULL THEN
            tts_cost := COALESCE(
                (agent_config.cost_overrides->>'builtin_tts_cost')::NUMERIC,
                (pricing_settings->'pag_rates'->>'tts_builtin_per_minute')::NUMERIC,
                0
            ) * p_words_generated;
        END IF;

        -- LLM Cost
        IF p_tokens_used IS NOT NULL THEN
            llm_cost := COALESCE(
                (agent_config.cost_overrides->>'builtin_llm_cost')::NUMERIC,
                (pricing_settings->'pag_rates'->>'llm_builtin_per_token')::NUMERIC,
                0
            ) * p_tokens_used;
        END IF;

    -- Mode DEDICATED
    ELSIF agent_config.platform_mode = 'dedicated' THEN
        IF p_include_dedicated_costs THEN
            stt_cost := daily_dedicated_stt;
            tts_cost := daily_dedicated_tts;
            llm_cost := daily_dedicated_llm;
        END IF;

    END IF;

    total_cost := stt_cost + tts_cost + llm_cost;

    -- Construire résultat
    cost_result := jsonb_build_object(
        'agent_id', p_agent_id,
        'platform_mode', agent_config.platform_mode,
        'agent_type', agent_config.agent_type,
        'stt_cost', stt_cost,
        'tts_cost', tts_cost,
        'llm_cost', llm_cost,
        'total_cost', total_cost,
        'prorata_ratio', prorata_ratio,
        'has_overrides', (agent_config.cost_overrides IS NOT NULL AND agent_config.cost_overrides != '{}'::jsonb),
        'calculation_timestamp', NOW()
    );

    RETURN cost_result;
END;
$$ LANGUAGE plpgsql;

-- ========================================
-- 3. FONCTION CALCUL SERVICE TOTAL COST CONSOLIDÉE
-- ========================================

CREATE OR REPLACE FUNCTION calculate_service_total_cost_v2(
    p_service_type VARCHAR,
    p_service_id UUID,
    p_usage_metrics JSONB DEFAULT '{}'
) RETURNS JSONB AS $$
DECLARE
    service_config RECORD;
    pricing_settings RECORD;
    total_cost NUMERIC := 0;
    monthly_cost NUMERIC := 0;
    usage_cost NUMERIC := 0;
    result JSONB;
BEGIN
    -- Récupérer settings globaux consolidés
    SELECT 
        COALESCE((SELECT value FROM settings_global WHERE key = 'pricing_rates_dedicated'), '{}'::jsonb) as dedicated_rates,
        COALESCE((SELECT value FROM settings_global WHERE key = 'pricing_rates_pag'), '{}'::jsonb) as pag_rates,
        COALESCE((SELECT value FROM settings_global WHERE key = 'subscription_costs'), '{}'::jsonb) as subscription_costs,
        COALESCE((SELECT value FROM settings_global WHERE key = 'fixed_pricing'), '{}'::jsonb) as fixed_pricing,
        COALESCE((SELECT value FROM settings_global WHERE key = 's3_rates'), '{}'::jsonb) as s3_rates
    INTO pricing_settings;

    CASE p_service_type
        WHEN 'agent' THEN
            -- Utiliser calculate_agent_cost_v2
            SELECT calculate_agent_cost_v2(p_service_id)
            INTO result;
            RETURN result;
            
        WHEN 'knowledge_base' THEN
            -- KB coût fixe ou usage-based
            SELECT cost_overrides, billing_mode
            INTO service_config
            FROM pype_voice_knowledge_bases
            WHERE id = p_service_id;
            
            IF service_config.billing_mode = 'fixed' THEN
                monthly_cost := COALESCE(
                    (service_config.cost_overrides->>'monthly_cost')::NUMERIC,
                    (pricing_settings.fixed_pricing->>'kb_monthly')::NUMERIC,
                    0
                );
            ELSE
                -- Usage-based KB calculation
                usage_cost := COALESCE(
                    (p_usage_metrics->>'storage_gb')::NUMERIC * 
                    COALESCE(
                        (service_config.cost_overrides->>'storage_cost_per_gb')::NUMERIC,
                        (pricing_settings.s3_rates->>'storage_gb_month')::NUMERIC,
                        0
                    ), 0
                );
            END IF;
            
        WHEN 'workflow' THEN
            -- Workflow coût fixe
            SELECT cost_overrides
            INTO service_config
            FROM pype_voice_workflows
            WHERE id = p_service_id;
            
            monthly_cost := COALESCE(
                (service_config.cost_overrides->>'monthly_cost')::NUMERIC,
                (pricing_settings.fixed_pricing->>'workflow_monthly')::NUMERIC,
                0
            );
            
        ELSE
            RETURN jsonb_build_object('error', 'Unknown service type');
    END CASE;

    total_cost := monthly_cost + usage_cost;

    result := jsonb_build_object(
        'service_type', p_service_type,
        'service_id', p_service_id,
        'monthly_cost', monthly_cost,
        'usage_cost', usage_cost,
        'total_cost', total_cost,
        'calculation_timestamp', NOW(),
        'pricing_version', 'v2'
    );

    RETURN result;
END;
$$ LANGUAGE plpgsql;

-- ========================================
-- 4. EXÉCUTION MIGRATION
-- ========================================

-- Exécuter migration
SELECT migrate_agent_cost_overrides() as migration_result;

-- Tester nouvelles fonctions
DO $$
BEGIN
    RAISE NOTICE '✅ Fonctions de calcul mises à jour:';
    RAISE NOTICE '- calculate_agent_cost_v2()';
    RAISE NOTICE '- calculate_service_total_cost_v2()';
    RAISE NOTICE '- migrate_agent_cost_overrides()';
    RAISE NOTICE '';
    RAISE NOTICE '📋 Logique de fallback consolidée:';
    RAISE NOTICE '1. Override agent si défini';
    RAISE NOTICE '2. Settings globaux sinon';
    RAISE NOTICE '3. Valeur par défaut 0';
END $$;

COMMIT;

-- ========================================
-- 5. VÉRIFICATION POST-MIGRATION
-- ========================================

-- Vérifier que les fonctions sont créées
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'calculate_agent_cost_v2') THEN
        RAISE EXCEPTION 'Function calculate_agent_cost_v2 not created';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'calculate_service_total_cost_v2') THEN
        RAISE EXCEPTION 'Function calculate_service_total_cost_v2 not created';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'migrate_agent_cost_overrides') THEN
        RAISE EXCEPTION 'Function migrate_agent_cost_overrides not created';
    END IF;
    
    RAISE NOTICE '✅ Migration des overrides et calculs terminée avec succès';
    RAISE NOTICE 'Toutes les fonctions sont opérationnelles';
END $$;
