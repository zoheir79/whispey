-- ===================================
-- FONCTIONS POSTGRESQL: Coûts Avancés
-- Version: 1.0
-- Date: 2025-01-06
-- Modes: injection, fixed, dynamic, hybrid
-- ===================================

BEGIN;

-- ========================================
-- 1. FONCTION CALCUL COÛTS INJECTION
-- ========================================

CREATE OR REPLACE FUNCTION calculate_injection_cost(
    p_source_service_type VARCHAR,
    p_source_service_id UUID,
    p_base_cost DECIMAL(10,4),
    p_target_service_type VARCHAR DEFAULT NULL,
    p_target_service_id UUID DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
    injection_config RECORD;
    injection_amount DECIMAL(10,4) := 0;
    total_injections DECIMAL(10,4) := 0;
    result JSONB;
    injection_record RECORD;
BEGIN
    -- Récupérer configuration injection active
    SELECT ic.injection_config, ic.workspace_id
    INTO injection_config
    FROM cost_configuration_advanced ic
    WHERE ic.service_type = p_source_service_type
    AND ic.service_id = p_source_service_id
    AND ic.cost_mode = 'injection'
    AND ic.is_active = true
    AND (ic.effective_until IS NULL OR ic.effective_until > NOW())
    ORDER BY ic.priority DESC, ic.created_at DESC
    LIMIT 1;
    
    IF NOT FOUND THEN
        RETURN jsonb_build_object(
            'has_injection', false,
            'total_injection_cost', 0,
            'remaining_cost', p_base_cost
        );
    END IF;
    
    -- Calculer montant injection
    injection_amount := p_base_cost * 
        COALESCE((injection_config.injection_config->>'injection_ratio')::DECIMAL, 0.15);
    
    -- Vérifier limite max injection si configurée
    IF injection_config.injection_config ? 'max_injection_amount' THEN
        injection_amount := LEAST(injection_amount, 
            (injection_config.injection_config->>'max_injection_amount')::DECIMAL);
    END IF;
    
    -- Créer enregistrement injection si service cible spécifié
    IF p_target_service_type IS NOT NULL AND p_target_service_id IS NOT NULL THEN
        INSERT INTO cost_injections (
            source_service_type, source_service_id, source_workspace_id,
            target_service_type, target_service_id, target_workspace_id,
            injection_amount, injection_ratio, base_cost_amount,
            injection_reason, status
        ) VALUES (
            p_source_service_type, p_source_service_id, injection_config.workspace_id,
            p_target_service_type, p_target_service_id, injection_config.workspace_id,
            injection_amount, 
            (injection_config.injection_config->>'injection_ratio')::DECIMAL,
            p_base_cost,
            'Automatic cost injection based on usage',
            'pending'
        );
    END IF;
    
    total_injections := injection_amount;
    
    result := jsonb_build_object(
        'has_injection', true,
        'injection_ratio', (injection_config.injection_config->>'injection_ratio')::DECIMAL,
        'injection_amount', injection_amount,
        'total_injection_cost', total_injections,
        'remaining_cost', p_base_cost - total_injections,
        'target_service_type', p_target_service_type,
        'target_service_id', p_target_service_id
    );
    
    RETURN result;
END;
$$ LANGUAGE plpgsql;

-- ========================================
-- 2. FONCTION CALCUL COÛTS FIXES AVEC ALLOWANCES
-- ========================================

CREATE OR REPLACE FUNCTION calculate_fixed_cost_with_allowances(
    p_service_type VARCHAR,
    p_service_id UUID,
    p_usage_metrics JSONB DEFAULT '{}'
) RETURNS JSONB AS $$
DECLARE
    fixed_config RECORD;
    monthly_cost DECIMAL(10,4) := 0;
    overage_cost DECIMAL(10,4) := 0;
    total_cost DECIMAL(10,4) := 0;
    allowance_record RECORD;
    usage_key TEXT;
    usage_value INTEGER;
    result JSONB;
BEGIN
    -- Récupérer configuration fixed cost
    SELECT fc.fixed_cost_config, fc.workspace_id
    INTO fixed_config
    FROM cost_configuration_advanced fc
    WHERE fc.service_type = p_service_type
    AND fc.service_id = p_service_id
    AND fc.cost_mode = 'fixed'
    AND fc.is_active = true
    AND (fc.effective_until IS NULL OR fc.effective_until > NOW())
    ORDER BY fc.priority DESC, fc.created_at DESC
    LIMIT 1;
    
    IF NOT FOUND THEN
        RETURN jsonb_build_object('error', 'No fixed cost configuration found');
    END IF;
    
    -- Récupérer coût mensuel fixe
    monthly_cost := COALESCE((fixed_config.fixed_cost_config->>'monthly_fixed')::DECIMAL, 0);
    
    -- Calculer overages pour chaque type d'usage
    FOR usage_key, usage_value IN SELECT * FROM jsonb_each_text(p_usage_metrics)
    LOOP
        -- Vérifier allowance pour ce type d'usage
        SELECT * INTO allowance_record
        FROM service_allowances
        WHERE service_type = p_service_type
        AND service_id = p_service_id
        AND allowance_type = usage_key
        AND is_active = true
        AND period_start <= CURRENT_DATE
        AND period_end >= CURRENT_DATE;
        
        IF FOUND THEN
            -- Calculer overage si usage dépasse allowance
            IF usage_value::INTEGER > allowance_record.monthly_allowance THEN
                overage_cost := overage_cost + 
                    (usage_value::INTEGER - allowance_record.monthly_allowance) * 
                    allowance_record.overage_rate;
                
                -- Mettre à jour usage dans allowance
                UPDATE service_allowances
                SET current_usage = usage_value::INTEGER,
                    overage_usage = usage_value::INTEGER - monthly_allowance,
                    overage_cost = (usage_value::INTEGER - monthly_allowance) * overage_rate,
                    updated_at = NOW()
                WHERE id = allowance_record.id;
            ELSE
                -- Mise à jour usage sans overage
                UPDATE service_allowances
                SET current_usage = usage_value::INTEGER,
                    overage_usage = 0,
                    overage_cost = 0,
                    updated_at = NOW()
                WHERE id = allowance_record.id;
            END IF;
        END IF;
    END LOOP;
    
    total_cost := monthly_cost + overage_cost;
    
    result := jsonb_build_object(
        'cost_mode', 'fixed',
        'monthly_fixed_cost', monthly_cost,
        'overage_costs', overage_cost,
        'total_cost', total_cost,
        'allowances_applied', p_usage_metrics,
        'calculated_at', NOW()
    );
    
    RETURN result;
END;
$$ LANGUAGE plpgsql;

-- ========================================
-- 3. FONCTION CALCUL COÛTS DYNAMIQUES
-- ========================================

CREATE OR REPLACE FUNCTION calculate_dynamic_cost(
    p_service_type VARCHAR,
    p_service_id UUID,
    p_usage_volume INTEGER,
    p_usage_timestamp TIMESTAMP DEFAULT NOW()
) RETURNS JSONB AS $$
DECLARE
    dynamic_config RECORD;
    base_cost DECIMAL(10,4) := 0;
    tier_multiplier DECIMAL(5,4) := 1.0;
    time_multiplier DECIMAL(5,4) := 1.0;
    final_cost DECIMAL(10,4) := 0;
    tier_record RECORD;
    result JSONB;
    current_hour INTEGER;
BEGIN
    -- Récupérer configuration dynamic cost
    SELECT dc.dynamic_cost_config, dc.workspace_id
    INTO dynamic_config
    FROM cost_configuration_advanced dc
    WHERE dc.service_type = p_service_type
    AND dc.service_id = p_service_id
    AND dc.cost_mode = 'dynamic'
    AND dc.is_active = true
    AND (dc.effective_until IS NULL OR dc.effective_until > NOW())
    ORDER BY dc.priority DESC, dc.created_at DESC
    LIMIT 1;
    
    IF NOT FOUND THEN
        RETURN jsonb_build_object('error', 'No dynamic cost configuration found');
    END IF;
    
    -- Récupérer coût de base
    base_cost := COALESCE((dynamic_config.dynamic_cost_config->>'base_cost')::DECIMAL, 0);
    
    -- Déterminer tier multiplier basé sur volume
    SELECT st.cost_multiplier
    INTO tier_multiplier
    FROM cost_scaling_tiers st
    INNER JOIN cost_configuration_advanced cca ON cca.id = st.cost_config_id
    WHERE cca.service_type = p_service_type
    AND cca.service_id = p_service_id
    AND st.usage_threshold <= p_usage_volume
    ORDER BY st.usage_threshold DESC
    LIMIT 1;
    
    tier_multiplier := COALESCE(tier_multiplier, 1.0);
    
    -- Déterminer time multiplier (peak vs off-peak)
    current_hour := EXTRACT(HOUR FROM p_usage_timestamp);
    
    IF current_hour BETWEEN 9 AND 17 THEN
        -- Peak hours (9AM - 5PM)
        time_multiplier := COALESCE(
            (dynamic_config.dynamic_cost_config->>'peak_hours_multiplier')::DECIMAL, 
            1.0
        );
    ELSE
        -- Off-peak hours
        time_multiplier := 1.0 - COALESCE(
            (dynamic_config.dynamic_cost_config->>'off_peak_discount')::DECIMAL, 
            0.0
        );
    END IF;
    
    -- Calculer coût final
    final_cost := base_cost * tier_multiplier * time_multiplier * p_usage_volume;
    
    result := jsonb_build_object(
        'cost_mode', 'dynamic',
        'base_cost', base_cost,
        'usage_volume', p_usage_volume,
        'tier_multiplier', tier_multiplier,
        'time_multiplier', time_multiplier,
        'usage_hour', current_hour,
        'is_peak_hours', (current_hour BETWEEN 9 AND 17),
        'final_cost', final_cost,
        'calculated_at', NOW()
    );
    
    RETURN result;
END;
$$ LANGUAGE plpgsql;

-- ========================================
-- 4. FONCTION CALCUL COÛTS HYBRIDES
-- ========================================

CREATE OR REPLACE FUNCTION calculate_hybrid_cost(
    p_service_type VARCHAR,
    p_service_id UUID,
    p_usage_metrics JSONB DEFAULT '{}'
) RETURNS JSONB AS $$
DECLARE
    hybrid_config RECORD;
    base_monthly DECIMAL(10,4) := 0;
    overage_cost DECIMAL(10,4) := 0;
    total_cost DECIMAL(10,4) := 0;
    allowance_record RECORD;
    usage_key TEXT;
    usage_value INTEGER;
    included_amount INTEGER;
    overage_amount INTEGER;
    overage_rate DECIMAL(10,6);
    result JSONB;
    overage_details JSONB := '{}';
BEGIN
    -- Récupérer configuration hybrid cost
    SELECT hc.hybrid_config, hc.workspace_id
    INTO hybrid_config
    FROM cost_configuration_advanced hc
    WHERE hc.service_type = p_service_type
    AND hc.service_id = p_service_id
    AND hc.cost_mode = 'hybrid'
    AND hc.is_active = true
    AND (hc.effective_until IS NULL OR hc.effective_until > NOW())
    ORDER BY hc.priority DESC, hc.created_at DESC
    LIMIT 1;
    
    IF NOT FOUND THEN
        RETURN jsonb_build_object('error', 'No hybrid cost configuration found');
    END IF;
    
    -- Récupérer coût mensuel de base
    base_monthly := COALESCE((hybrid_config.hybrid_config->>'base_monthly')::DECIMAL, 0);
    
    -- Calculer overages pour chaque métrique d'usage
    FOR usage_key, usage_value IN SELECT * FROM jsonb_each_text(p_usage_metrics)
    LOOP
        -- Vérifier allowance incluse dans le forfait hybride
        included_amount := COALESCE(
            (hybrid_config.hybrid_config->'included_allowance'->>usage_key)::INTEGER, 
            0
        );
        
        IF usage_value::INTEGER > included_amount THEN
            overage_amount := usage_value::INTEGER - included_amount;
            
            -- Récupérer tarif overage
            overage_rate := COALESCE(
                (hybrid_config.hybrid_config->'overage_rates'->>(
                    CASE usage_key
                        WHEN 'calls' THEN 'per_call'
                        WHEN 'tokens' THEN 'per_token'
                        WHEN 'storage_gb' THEN 'per_gb'
                        WHEN 'executions' THEN 'per_execution'
                        ELSE 'per_unit'
                    END
                ))::DECIMAL,
                0.0
            );
            
            overage_cost := overage_cost + (overage_amount * overage_rate);
            
            -- Ajouter détails overage
            overage_details := overage_details || jsonb_build_object(
                usage_key, jsonb_build_object(
                    'included', included_amount,
                    'used', usage_value::INTEGER,
                    'overage', overage_amount,
                    'rate', overage_rate,
                    'cost', overage_amount * overage_rate
                )
            );
        END IF;
    END LOOP;
    
    -- Vérifier burst protection (limite max overage)
    IF hybrid_config.hybrid_config ? 'burst_protection' THEN
        overage_cost := LEAST(
            overage_cost,
            (hybrid_config.hybrid_config->'burst_protection'->>'max_overage')::DECIMAL
        );
    END IF;
    
    total_cost := base_monthly + overage_cost;
    
    result := jsonb_build_object(
        'cost_mode', 'hybrid',
        'base_monthly_cost', base_monthly,
        'included_allowances', hybrid_config.hybrid_config->'included_allowance',
        'usage_metrics', p_usage_metrics,
        'overage_details', overage_details,
        'total_overage_cost', overage_cost,
        'total_cost', total_cost,
        'calculated_at', NOW()
    );
    
    RETURN result;
END;
$$ LANGUAGE plpgsql;

-- ========================================
-- 5. FONCTION MASTER CALCUL COÛTS AVANCÉS
-- ========================================

CREATE OR REPLACE FUNCTION calculate_advanced_service_cost(
    p_service_type VARCHAR,
    p_service_id UUID,
    p_usage_metrics JSONB DEFAULT '{}',
    p_usage_timestamp TIMESTAMP DEFAULT NOW()
) RETURNS JSONB AS $$
DECLARE
    cost_config RECORD;
    cost_result JSONB;
    injection_result JSONB;
    final_result JSONB;
BEGIN
    -- Récupérer configuration coût active avec priorité
    SELECT cost_mode, workspace_id
    INTO cost_config
    FROM cost_configuration_advanced
    WHERE service_type = p_service_type
    AND service_id = p_service_id
    AND is_active = true
    AND (effective_until IS NULL OR effective_until > NOW())
    ORDER BY priority DESC, created_at DESC
    LIMIT 1;
    
    IF NOT FOUND THEN
        -- Fallback vers système standard
        RETURN jsonb_build_object(
            'cost_mode', 'standard',
            'message', 'Using standard cost calculation',
            'result', calculate_service_total_cost(p_service_type, p_service_id)
        );
    END IF;
    
    -- Calculer selon le mode configuré
    CASE cost_config.cost_mode
        WHEN 'fixed' THEN
            cost_result := calculate_fixed_cost_with_allowances(
                p_service_type, p_service_id, p_usage_metrics
            );
            
        WHEN 'dynamic' THEN
            cost_result := calculate_dynamic_cost(
                p_service_type, p_service_id, 
                COALESCE((p_usage_metrics->>'total_volume')::INTEGER, 1),
                p_usage_timestamp
            );
            
        WHEN 'hybrid' THEN
            cost_result := calculate_hybrid_cost(
                p_service_type, p_service_id, p_usage_metrics
            );
            
        WHEN 'injection' THEN
            -- Pour injection, calculer coût de base puis appliquer injection
            cost_result := calculate_service_total_cost(p_service_type, p_service_id);
            injection_result := calculate_injection_cost(
                p_service_type, p_service_id, 
                (cost_result->>'total_cost')::DECIMAL
            );
            cost_result := cost_result || injection_result;
            
        ELSE
            -- Mode PAG ou dedicated standard
            cost_result := calculate_service_total_cost(p_service_type, p_service_id);
    END CASE;
    
    -- Construire résultat final
    final_result := jsonb_build_object(
        'service_type', p_service_type,
        'service_id', p_service_id,
        'cost_mode', cost_config.cost_mode,
        'workspace_id', cost_config.workspace_id,
        'calculation_timestamp', p_usage_timestamp,
        'usage_metrics', p_usage_metrics
    ) || cost_result;
    
    RETURN final_result;
END;
$$ LANGUAGE plpgsql;

-- ========================================
-- 6. FONCTION TRAITEMENT INJECTIONS EN BATCH
-- ========================================

CREATE OR REPLACE FUNCTION process_pending_cost_injections()
RETURNS JSONB AS $$
DECLARE
    injection_record RECORD;
    processed_count INTEGER := 0;
    failed_count INTEGER := 0;
    result JSONB;
BEGIN
    -- Traiter toutes les injections pending
    FOR injection_record IN 
        SELECT * FROM cost_injections 
        WHERE status = 'pending' 
        AND injection_date >= CURRENT_DATE - INTERVAL '7 days'
        ORDER BY created_at
    LOOP
        BEGIN
            -- Appliquer déduction au service source
            PERFORM deduct_credits_from_workspace(
                injection_record.source_workspace_id,
                injection_record.injection_amount,
                'Cost injection to ' || injection_record.target_service_type,
                injection_record.source_service_type,
                injection_record.source_service_id
            );
            
            -- Créditer au service cible si différent workspace
            IF injection_record.target_workspace_id != injection_record.source_workspace_id THEN
                PERFORM recharge_credits_workspace(
                    injection_record.target_workspace_id,
                    injection_record.injection_amount,
                    'Cost injection from ' || injection_record.source_service_type
                );
            END IF;
            
            -- Marquer comme appliqué
            UPDATE cost_injections
            SET status = 'applied',
                applied_at = NOW()
            WHERE id = injection_record.id;
            
            processed_count := processed_count + 1;
            
        EXCEPTION WHEN OTHERS THEN
            -- Marquer comme failed
            UPDATE cost_injections
            SET status = 'failed'
            WHERE id = injection_record.id;
            
            failed_count := failed_count + 1;
        END;
    END LOOP;
    
    result := jsonb_build_object(
        'processed_successfully', processed_count,
        'failed_processing', failed_count,
        'total_processed', processed_count + failed_count,
        'processed_at', NOW()
    );
    
    RETURN result;
END;
$$ LANGUAGE plpgsql;

COMMIT;

-- ========================================
-- 7. VERIFICATION DES FONCTIONS
-- ========================================

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'calculate_injection_cost') THEN
        RAISE EXCEPTION 'Function calculate_injection_cost not created';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'calculate_fixed_cost_with_allowances') THEN
        RAISE EXCEPTION 'Function calculate_fixed_cost_with_allowances not created';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'calculate_dynamic_cost') THEN
        RAISE EXCEPTION 'Function calculate_dynamic_cost not created';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'calculate_hybrid_cost') THEN
        RAISE EXCEPTION 'Function calculate_hybrid_cost not created';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'calculate_advanced_service_cost') THEN
        RAISE EXCEPTION 'Function calculate_advanced_service_cost not created';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'process_pending_cost_injections') THEN
        RAISE EXCEPTION 'Function process_pending_cost_injections not created';
    END IF;
    
    RAISE NOTICE 'Toutes les fonctions de coûts avancés créées avec succès';
    RAISE NOTICE 'Modes supportés: injection, fixed, dynamic, hybrid';
    RAISE NOTICE 'Fonctions disponibles:';
    RAISE NOTICE '- calculate_injection_cost()';
    RAISE NOTICE '- calculate_fixed_cost_with_allowances()';
    RAISE NOTICE '- calculate_dynamic_cost()';
    RAISE NOTICE '- calculate_hybrid_cost()';
    RAISE NOTICE '- calculate_advanced_service_cost() [MASTER]';
    RAISE NOTICE '- process_pending_cost_injections()';
END $$;
