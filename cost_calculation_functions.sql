-- ===================================
-- FONCTIONS POSTGRESQL: Calculs de Couts
-- Version: 1.0
-- Date: 2025-01-06
-- ===================================

BEGIN;

-- ========================================
-- 1. FONCTION CALCUL COUTS FIXES PAR CYCLE
-- ========================================

CREATE OR REPLACE FUNCTION calculate_fixed_costs_current_cycle(
    p_service_type VARCHAR,
    p_service_id UUID,
    p_cycle_start DATE,
    p_cycle_end DATE
) RETURNS DECIMAL(10,4) AS $$
DECLARE
    fixed_cost DECIMAL(10,4) := 0;
    service_record RECORD;
    prorata_ratio DECIMAL(5,4) := 1;
    settings_record RECORD;
BEGIN
    -- Calcul prorata si fonction existante disponible
    BEGIN
        SELECT calculate_monthly_prorata(p_service_id, EXTRACT(YEAR FROM p_cycle_start), EXTRACT(MONTH FROM p_cycle_start))
        INTO prorata_ratio;
    EXCEPTION
        WHEN others THEN
            prorata_ratio := 1.0; -- Fallback si fonction non disponible
    END;
    
    -- Recuperer settings globaux
    SELECT 
        COALESCE((SELECT value FROM settings_global WHERE key = 'pricing_rates_dedicated'), '{}'::jsonb) as dedicated_rates,
        COALESCE((SELECT value FROM settings_global WHERE key = 'pricing_rates_pag'), '{}'::jsonb) as pag_rates
    INTO settings_record;
    
    CASE p_service_type
        WHEN 'agent' THEN
            -- Recuperer config agent
            SELECT platform_mode, billing_cycle, agent_type, cost_overrides
            INTO service_record
            FROM pype_voice_agents WHERE id = p_service_id;
            
            IF service_record.platform_mode = 'dedicated' THEN
                -- Utiliser overrides agent ou tarifs globaux
                IF service_record.cost_overrides IS NOT NULL AND 
                   service_record.cost_overrides ? 'agent_monthly_cost' THEN
                    fixed_cost := (service_record.cost_overrides->>'agent_monthly_cost')::DECIMAL;
                ELSE
                    -- Tarifs par defaut selon type agent
                    fixed_cost := CASE 
                        WHEN service_record.agent_type = 'voice' THEN 
                            COALESCE((settings_record.dedicated_rates->>'voice_agent_monthly')::DECIMAL, 29.99)
                        ELSE 
                            COALESCE((settings_record.dedicated_rates->>'text_agent_monthly')::DECIMAL, 19.99)
                    END;
                END IF;
            END IF;
            
        WHEN 'knowledge_base' THEN
            -- Recuperer config KB
            SELECT platform_mode, cost_overrides
            INTO service_record
            FROM pype_voice_knowledge_bases WHERE id = p_service_id;
            
            IF service_record.platform_mode = 'dedicated' THEN
                IF service_record.cost_overrides IS NOT NULL AND 
                   service_record.cost_overrides ? 'kb_monthly_cost' THEN
                    fixed_cost := (service_record.cost_overrides->>'kb_monthly_cost')::DECIMAL;
                ELSE
                    fixed_cost := COALESCE((settings_record.dedicated_rates->>'kb_monthly')::DECIMAL, 49.99);
                END IF;
            END IF;
            
        WHEN 'workflow' THEN
            -- Recuperer config Workflow
            SELECT platform_mode, cost_overrides
            INTO service_record
            FROM pype_voice_workflows WHERE id = p_service_id;
            
            IF service_record.platform_mode = 'subscription' THEN
                IF service_record.cost_overrides IS NOT NULL AND 
                   service_record.cost_overrides ? 'workflow_monthly_cost' THEN
                    fixed_cost := (service_record.cost_overrides->>'workflow_monthly_cost')::DECIMAL;
                ELSE
                    fixed_cost := COALESCE((settings_record.dedicated_rates->>'workflow_subscription_monthly')::DECIMAL, 79.99);
                END IF;
            END IF;
            
        WHEN 'workspace' THEN
            -- Couts S3 workspace
            SELECT s3_storage_gb INTO service_record
            FROM pype_voice_projects WHERE id = p_service_id;
            
            fixed_cost := COALESCE(service_record.s3_storage_gb, 50) * 
                         COALESCE((settings_record.dedicated_rates->>'s3_storage_per_gb_monthly')::DECIMAL, 0.10);
    END CASE;
    
    -- Appliquer prorata
    RETURN fixed_cost * prorata_ratio;
END;
$$ LANGUAGE plpgsql;

-- ========================================
-- 2. FONCTION CALCUL COUTS PAG PAR CYCLE
-- ========================================

CREATE OR REPLACE FUNCTION calculate_pag_costs_current_cycle(
    p_service_type VARCHAR,
    p_service_id UUID,
    p_cycle_start TIMESTAMP,
    p_cycle_end TIMESTAMP
) RETURNS DECIMAL(10,4) AS $$
DECLARE
    pag_cost DECIMAL(10,4) := 0;
    settings_record RECORD;
BEGIN
    -- Recuperer settings PAG
    SELECT 
        COALESCE((SELECT value FROM settings_global WHERE key = 'pricing_rates_pag'), '{}'::jsonb) as pag_rates
    INTO settings_record;
    
    CASE p_service_type
        WHEN 'agent' THEN
            -- STT, TTS, LLM depuis call_logs
            SELECT COALESCE(SUM(
                COALESCE(total_stt_cost, 0) + 
                COALESCE(total_tts_cost, 0) + 
                COALESCE(total_llm_cost, 0)
            ), 0)
            INTO pag_cost
            FROM pype_voice_call_logs
            WHERE agent_id = p_service_id
              AND call_started_at >= p_cycle_start
              AND call_started_at <= p_cycle_end;
              
        WHEN 'knowledge_base' THEN
            -- Couts depuis monthly_consumption
            SELECT 
                COALESCE(SUM(
                    kb_storage_cost + 
                    kb_search_cost + 
                    kb_embedding_cost
                ), 0)
            INTO pag_cost
            FROM monthly_consumption
            WHERE agent_id IN (
                SELECT DISTINCT agent_id 
                FROM pype_voice_agents a
                WHERE a.associated_kb_id = p_service_id
            )
            AND year = EXTRACT(YEAR FROM p_cycle_start)
            AND month = EXTRACT(MONTH FROM p_cycle_start);
              
        WHEN 'workflow' THEN
            -- Couts depuis monthly_consumption
            SELECT COALESCE(SUM(workflow_cost), 0)
            INTO pag_cost
            FROM monthly_consumption
            WHERE agent_id IN (
                SELECT DISTINCT agent_id 
                FROM pype_voice_agents a
                WHERE a.associated_workflow_id = p_service_id
            )
            AND year = EXTRACT(YEAR FROM p_cycle_start)
            AND month = EXTRACT(MONTH FROM p_cycle_start);
            
        WHEN 'workspace' THEN
            -- Couts S3 variables (uploads, transferts)
            pag_cost := 0; -- Pour l'instant, S3 en fixed cost seulement
    END CASE;
    
    RETURN pag_cost;
END;
$$ LANGUAGE plpgsql;

-- ========================================
-- 3. FONCTION CALCUL COUT TOTAL SERVICE
-- ========================================

CREATE OR REPLACE FUNCTION calculate_service_total_cost(
    p_service_type VARCHAR,
    p_service_id UUID,
    p_cycle_start TIMESTAMP DEFAULT NULL,
    p_cycle_end TIMESTAMP DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
    result JSONB;
    fixed_cost DECIMAL(10,4) := 0;
    pag_cost DECIMAL(10,4) := 0;
    total_cost DECIMAL(10,4) := 0;
    cycle_dates RECORD;
BEGIN
    -- Si pas de dates specifiques, utiliser cycle actuel
    IF p_cycle_start IS NULL OR p_cycle_end IS NULL THEN
        SELECT start_date::TIMESTAMP, end_date::TIMESTAMP + INTERVAL '23:59:59'
        INTO cycle_dates
        FROM billing_cycles
        WHERE service_type = p_service_type 
        AND service_id = p_service_id 
        AND status = 'current'
        ORDER BY created_at DESC
        LIMIT 1;
        
        p_cycle_start := COALESCE(p_cycle_start, cycle_dates.start_date);
        p_cycle_end := COALESCE(p_cycle_end, cycle_dates.end_date);
    END IF;
    
    -- Calcul couts fixes
    fixed_cost := calculate_fixed_costs_current_cycle(
        p_service_type, 
        p_service_id, 
        p_cycle_start::DATE, 
        p_cycle_end::DATE
    );
    
    -- Calcul couts PAG
    pag_cost := calculate_pag_costs_current_cycle(
        p_service_type, 
        p_service_id, 
        p_cycle_start, 
        p_cycle_end
    );
    
    total_cost := fixed_cost + pag_cost;
    
    -- Construction resultat JSON
    result := jsonb_build_object(
        'service_type', p_service_type,
        'service_id', p_service_id,
        'cycle_start', p_cycle_start,
        'cycle_end', p_cycle_end,
        'fixed_cost', fixed_cost,
        'pag_cost', pag_cost,
        'total_cost', total_cost,
        'calculated_at', NOW()
    );
    
    RETURN result;
END;
$$ LANGUAGE plpgsql;

-- ========================================
-- 4. FONCTION DEDUCTION CREDITS
-- ========================================

CREATE OR REPLACE FUNCTION deduct_credits_from_workspace(
    p_workspace_id UUID,
    p_amount DECIMAL(10,4),
    p_description TEXT,
    p_service_type VARCHAR DEFAULT NULL,
    p_service_id UUID DEFAULT NULL,
    p_call_log_id UUID DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
    credits_record RECORD;
    transaction_id UUID;
    new_balance DECIMAL(10,4);
    result JSONB;
BEGIN
    -- Recuperer credits workspace (premier utilisateur actif)
    SELECT * INTO credits_record
    FROM user_credits 
    WHERE workspace_id = p_workspace_id 
    AND is_active = true 
    AND is_suspended = false
    ORDER BY created_at
    LIMIT 1;
    
    IF NOT FOUND THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'No active credits found for workspace',
            'workspace_id', p_workspace_id
        );
    END IF;
    
    -- Verifier balance suffisante
    IF credits_record.current_balance < ABS(p_amount) THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Insufficient credits',
            'current_balance', credits_record.current_balance,
            'required_amount', ABS(p_amount),
            'workspace_id', p_workspace_id
        );
    END IF;
    
    -- Calculer nouvelle balance
    new_balance := credits_record.current_balance - ABS(p_amount);
    
    -- Mettre a jour credits
    UPDATE user_credits 
    SET current_balance = new_balance,
        updated_at = NOW()
    WHERE id = credits_record.id;
    
    -- Creer transaction
    INSERT INTO credit_transactions (
        workspace_id, user_id, credits_id,
        transaction_type, amount, previous_balance, new_balance,
        service_type, service_id, call_log_id,
        description, status
    ) VALUES (
        p_workspace_id, credits_record.user_id, credits_record.id,
        'deduction', -ABS(p_amount), credits_record.current_balance, new_balance,
        p_service_type, p_service_id, p_call_log_id,
        p_description, 'completed'
    ) RETURNING id INTO transaction_id;
    
    -- Verifier seuil alerte
    IF new_balance <= credits_record.low_balance_threshold THEN
        INSERT INTO credit_alerts (
            workspace_id, user_id, credits_id,
            alert_type, severity, title, message,
            alert_data
        ) VALUES (
            p_workspace_id, credits_record.user_id, credits_record.id,
            'low_balance', 'warning', 'Low Credit Balance',
            'Your credit balance is below the threshold. Current balance: $' || new_balance::TEXT,
            jsonb_build_object('current_balance', new_balance, 'threshold', credits_record.low_balance_threshold)
        );
    END IF;
    
    RETURN jsonb_build_object(
        'success', true,
        'transaction_id', transaction_id,
        'previous_balance', credits_record.current_balance,
        'new_balance', new_balance,
        'amount_deducted', ABS(p_amount)
    );
END;
$$ LANGUAGE plpgsql;

-- ========================================
-- 5. FONCTION RECHARGE CREDITS
-- ========================================

CREATE OR REPLACE FUNCTION recharge_credits_workspace(
    p_workspace_id UUID,
    p_amount DECIMAL(10,4),
    p_description TEXT DEFAULT 'Credit recharge'
) RETURNS JSONB AS $$
DECLARE
    credits_record RECORD;
    transaction_id UUID;
    new_balance DECIMAL(10,4);
BEGIN
    -- Recuperer ou creer credits workspace
    SELECT * INTO credits_record
    FROM user_credits 
    WHERE workspace_id = p_workspace_id 
    ORDER BY created_at
    LIMIT 1;
    
    IF NOT FOUND THEN
        -- Creer nouveau compte credits (utilise premier user du workspace)
        INSERT INTO user_credits (workspace_id, user_id, current_balance)
        SELECT p_workspace_id, u.user_id, p_amount
        FROM pype_voice_users u
        INNER JOIN pype_voice_email_project_mapping epm ON u.email = epm.email
        WHERE epm.project_id = p_workspace_id AND epm.is_active = true
        ORDER BY epm.created_at
        LIMIT 1
        RETURNING * INTO credits_record;
        
        new_balance := p_amount;
    ELSE
        -- Mettre a jour balance existante
        new_balance := credits_record.current_balance + p_amount;
        
        UPDATE user_credits 
        SET current_balance = new_balance,
            updated_at = NOW(),
            is_suspended = false  -- Reactiver si suspendu
        WHERE id = credits_record.id;
    END IF;
    
    -- Creer transaction
    INSERT INTO credit_transactions (
        workspace_id, user_id, credits_id,
        transaction_type, amount, previous_balance, new_balance,
        description, status
    ) VALUES (
        p_workspace_id, credits_record.user_id, credits_record.id,
        'recharge', p_amount, COALESCE(credits_record.current_balance, 0), new_balance,
        p_description, 'completed'
    ) RETURNING id INTO transaction_id;
    
    RETURN jsonb_build_object(
        'success', true,
        'transaction_id', transaction_id,
        'previous_balance', COALESCE(credits_record.current_balance, 0),
        'new_balance', new_balance,
        'amount_added', p_amount
    );
END;
$$ LANGUAGE plpgsql;

-- ========================================
-- 6. FONCTION SUSPENSION SERVICE
-- ========================================

CREATE OR REPLACE FUNCTION suspend_service_for_insufficient_credits(
    p_service_type VARCHAR,
    p_service_id UUID,
    p_workspace_id UUID,
    p_reason TEXT DEFAULT 'Insufficient credits'
) RETURNS JSONB AS $$
DECLARE
    affected_count INTEGER := 0;
    alert_id UUID;
BEGIN
    CASE p_service_type
        WHEN 'agent' THEN
            UPDATE pype_voice_agents 
            SET is_active = false,
                updated_at = NOW()
            WHERE id = p_service_id AND project_id = p_workspace_id;
            GET DIAGNOSTICS affected_count = ROW_COUNT;
            
        WHEN 'knowledge_base' THEN
            UPDATE pype_voice_knowledge_bases 
            SET is_active = false,
                updated_at = NOW()
            WHERE id = p_service_id AND workspace_id = p_workspace_id;
            GET DIAGNOSTICS affected_count = ROW_COUNT;
            
        WHEN 'workflow' THEN
            UPDATE pype_voice_workflows 
            SET is_active = false,
                updated_at = NOW()
            WHERE id = p_service_id AND workspace_id = p_workspace_id;
            GET DIAGNOSTICS affected_count = ROW_COUNT;
    END CASE;
    
    -- Creer alerte de suspension
    INSERT INTO credit_alerts (
        workspace_id, alert_type, severity, title, message,
        alert_data
    ) VALUES (
        p_workspace_id, 'service_suspended', 'critical',
        'Service Suspended - Insufficient Credits',
        'Service ' || p_service_type || ' has been suspended due to insufficient credits.',
        jsonb_build_object(
            'service_type', p_service_type,
            'service_id', p_service_id,
            'reason', p_reason
        )
    ) RETURNING id INTO alert_id;
    
    RETURN jsonb_build_object(
        'success', true,
        'service_type', p_service_type,
        'service_id', p_service_id,
        'suspended', affected_count > 0,
        'alert_id', alert_id
    );
END;
$$ LANGUAGE plpgsql;

COMMIT;

-- ========================================
-- 7. VERIFICATION DES FONCTIONS
-- ========================================

-- Verifier que toutes les fonctions ont ete creees
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'calculate_fixed_costs_current_cycle') THEN
        RAISE EXCEPTION 'Function calculate_fixed_costs_current_cycle not created';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'calculate_pag_costs_current_cycle') THEN
        RAISE EXCEPTION 'Function calculate_pag_costs_current_cycle not created';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'calculate_service_total_cost') THEN
        RAISE EXCEPTION 'Function calculate_service_total_cost not created';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'deduct_credits_from_workspace') THEN
        RAISE EXCEPTION 'Function deduct_credits_from_workspace not created';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'recharge_credits_workspace') THEN
        RAISE EXCEPTION 'Function recharge_credits_workspace not created';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'suspend_service_for_insufficient_credits') THEN
        RAISE EXCEPTION 'Function suspend_service_for_insufficient_credits not created';
    END IF;
    
    RAISE NOTICE 'Toutes les fonctions de calcul de couts ont ete creees avec succes';
    RAISE NOTICE 'Fonctions disponibles:';
    RAISE NOTICE '- calculate_fixed_costs_current_cycle()';
    RAISE NOTICE '- calculate_pag_costs_current_cycle()';
    RAISE NOTICE '- calculate_service_total_cost()';
    RAISE NOTICE '- deduct_credits_from_workspace()';
    RAISE NOTICE '- recharge_credits_workspace()';
    RAISE NOTICE '- suspend_service_for_insufficient_credits()';
END $$;
