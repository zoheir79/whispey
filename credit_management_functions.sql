-- ===================================
-- FONCTIONS POSTGRESQL: Gestion Credits et KB/Workflow
-- Version: 1.0 - Extension du systeme existant
-- Date: 2025-01-06
-- ===================================

BEGIN;

-- ========================================
-- 1. FONCTION CALCUL COUTS KB (NOUVELLE)
-- ========================================

CREATE OR REPLACE FUNCTION calculate_kb_cost(
    p_kb_id UUID,
    p_storage_gb DECIMAL DEFAULT NULL,
    p_search_tokens INTEGER DEFAULT NULL,
    p_embedding_tokens INTEGER DEFAULT NULL,
    p_cycle_start DATE DEFAULT NULL,
    p_cycle_end DATE DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
    kb_config RECORD;
    storage_cost DECIMAL(10,4) := 0;
    search_cost DECIMAL(10,4) := 0;
    embedding_cost DECIMAL(10,4) := 0;
    total_cost DECIMAL(10,4) := 0;
    settings_record RECORD;
    prorata_ratio DECIMAL(5,4) := 1;
BEGIN
    -- Recuperer config KB
    SELECT platform_mode, cost_overrides, created_at
    INTO kb_config
    FROM pype_voice_knowledge_bases 
    WHERE id = p_kb_id;
    
    IF NOT FOUND THEN
        RETURN jsonb_build_object('error', 'Knowledge Base not found');
    END IF;
    
    -- Recuperer settings globaux
    SELECT 
        COALESCE((SELECT value FROM settings_global WHERE key = 'pricing_rates_dedicated'), '{}'::jsonb) as dedicated_rates,
        COALESCE((SELECT value FROM settings_global WHERE key = 'pricing_rates_pag'), '{}'::jsonb) as pag_rates
    INTO settings_record;
    
    -- Calcul prorata si cycle partiel
    IF p_cycle_start IS NOT NULL AND p_cycle_end IS NOT NULL THEN
        -- Utiliser fonction existante adaptee pour KB
        BEGIN
            SELECT (calculate_monthly_prorata(p_kb_id, EXTRACT(YEAR FROM p_cycle_start), EXTRACT(MONTH FROM p_cycle_start))->>'prorata_ratio')::DECIMAL
            INTO prorata_ratio;
        EXCEPTION
            WHEN others THEN
                prorata_ratio := 1.0;
        END;
    END IF;
    
    IF kb_config.platform_mode = 'dedicated' THEN
        -- Mode dedicated: cout fixe mensuel prorata
        IF kb_config.cost_overrides IS NOT NULL AND 
           kb_config.cost_overrides ? 'kb_monthly_cost' THEN
            total_cost := (kb_config.cost_overrides->>'kb_monthly_cost')::DECIMAL * prorata_ratio;
        ELSE
            total_cost := COALESCE((settings_record.dedicated_rates->>'kb_monthly')::DECIMAL, 49.99) * prorata_ratio;
        END IF;
        
    ELSE
        -- Mode PAG: calcul par usage
        -- Stockage vectors
        IF p_storage_gb IS NOT NULL THEN
            storage_cost := p_storage_gb * COALESCE((settings_record.pag_rates->>'kb_storage_per_gb_monthly')::DECIMAL, 0.10);
        END IF;
        
        -- Recherche tokens
        IF p_search_tokens IS NOT NULL THEN
            search_cost := p_search_tokens * COALESCE((settings_record.pag_rates->>'kb_search_per_token')::DECIMAL, 0.000015);
        END IF;
        
        -- Embedding creation (one-shot)
        IF p_embedding_tokens IS NOT NULL THEN
            embedding_cost := p_embedding_tokens * COALESCE((settings_record.pag_rates->>'kb_embedding_per_token')::DECIMAL, 0.00002);
        END IF;
        
        total_cost := storage_cost + search_cost + embedding_cost;
    END IF;
    
    RETURN jsonb_build_object(
        'kb_id', p_kb_id,
        'platform_mode', kb_config.platform_mode,
        'costs', jsonb_build_object(
            'storage_cost', storage_cost,
            'search_cost', search_cost,
            'embedding_cost', embedding_cost,
            'total_cost', total_cost
        ),
        'usage', jsonb_build_object(
            'storage_gb', p_storage_gb,
            'search_tokens', p_search_tokens,
            'embedding_tokens', p_embedding_tokens
        ),
        'calculated_at', NOW()
    );
END;
$$ LANGUAGE plpgsql;

-- ========================================
-- 2. FONCTION CALCUL COUTS WORKFLOW (NOUVELLE)
-- ========================================

CREATE OR REPLACE FUNCTION calculate_workflow_cost(
    p_workflow_id UUID,
    p_operations INTEGER DEFAULT NULL,
    p_execution_minutes DECIMAL DEFAULT NULL,
    p_cycle_start DATE DEFAULT NULL,
    p_cycle_end DATE DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
    workflow_config RECORD;
    operation_cost DECIMAL(10,4) := 0;
    execution_cost DECIMAL(10,4) := 0;
    subscription_cost DECIMAL(10,4) := 0;
    total_cost DECIMAL(10,4) := 0;
    settings_record RECORD;
    prorata_ratio DECIMAL(5,4) := 1;
BEGIN
    -- Recuperer config Workflow
    SELECT platform_mode, cost_overrides, created_at
    INTO workflow_config
    FROM pype_voice_workflows 
    WHERE id = p_workflow_id;
    
    IF NOT FOUND THEN
        RETURN jsonb_build_object('error', 'Workflow not found');
    END IF;
    
    -- Recuperer settings globaux
    SELECT 
        COALESCE((SELECT value FROM settings_global WHERE key = 'pricing_rates_dedicated'), '{}'::jsonb) as dedicated_rates,
        COALESCE((SELECT value FROM settings_global WHERE key = 'pricing_rates_pag'), '{}'::jsonb) as pag_rates
    INTO settings_record;
    
    -- Calcul prorata si cycle partiel
    IF p_cycle_start IS NOT NULL AND p_cycle_end IS NOT NULL THEN
        BEGIN
            SELECT (calculate_monthly_prorata(p_workflow_id, EXTRACT(YEAR FROM p_cycle_start), EXTRACT(MONTH FROM p_cycle_start))->>'prorata_ratio')::DECIMAL
            INTO prorata_ratio;
        EXCEPTION
            WHEN others THEN
                prorata_ratio := 1.0;
        END;
    END IF;
    
    IF workflow_config.platform_mode = 'subscription' THEN
        -- Mode subscription: cout fixe mensuel
        IF workflow_config.cost_overrides IS NOT NULL AND 
           workflow_config.cost_overrides ? 'workflow_monthly_cost' THEN
            subscription_cost := (workflow_config.cost_overrides->>'workflow_monthly_cost')::DECIMAL * prorata_ratio;
        ELSE
            subscription_cost := COALESCE((settings_record.dedicated_rates->>'workflow_subscription_monthly')::DECIMAL, 79.99) * prorata_ratio;
        END IF;
        total_cost := subscription_cost;
        
    ELSE
        -- Mode PAG: calcul par usage
        -- Par operation
        IF p_operations IS NOT NULL THEN
            operation_cost := p_operations * COALESCE((settings_record.pag_rates->>'workflow_per_operation')::DECIMAL, 0.005);
        END IF;
        
        -- Par minute execution
        IF p_execution_minutes IS NOT NULL THEN
            execution_cost := p_execution_minutes * COALESCE((settings_record.pag_rates->>'workflow_per_minute')::DECIMAL, 0.02);
        END IF;
        
        total_cost := operation_cost + execution_cost;
    END IF;
    
    RETURN jsonb_build_object(
        'workflow_id', p_workflow_id,
        'platform_mode', workflow_config.platform_mode,
        'costs', jsonb_build_object(
            'operation_cost', operation_cost,
            'execution_cost', execution_cost,
            'subscription_cost', subscription_cost,
            'total_cost', total_cost
        ),
        'usage', jsonb_build_object(
            'operations', p_operations,
            'execution_minutes', p_execution_minutes
        ),
        'calculated_at', NOW()
    );
END;
$$ LANGUAGE plpgsql;

-- ========================================
-- 3. FONCTION DEDUCTION CREDITS (NOUVELLE)
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
        -- Marquer comme insufficient pour suspension
        UPDATE user_credits 
        SET is_suspended = true,
            suspension_reason = 'Insufficient credits',
            updated_at = NOW()
        WHERE id = credits_record.id;
        
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Insufficient credits - services suspended',
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
-- 4. FONCTION RECHARGE CREDITS (NOUVELLE)
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
            is_suspended = false,  -- Reactiver si suspendu
            suspension_reason = NULL
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
    
    -- Reactiver services suspendus
    PERFORM unsuspend_workspace_services(p_workspace_id);
    
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
-- 5. FONCTION SUSPENSION SERVICES (NOUVELLE)
-- ========================================

CREATE OR REPLACE FUNCTION suspend_workspace_services(
    p_workspace_id UUID,
    p_reason TEXT DEFAULT 'Insufficient credits'
) RETURNS JSONB AS $$
DECLARE
    suspended_counts RECORD;
    alert_id UUID;
BEGIN
    -- Suspendre agents
    UPDATE pype_voice_agents 
    SET is_active = false,
        updated_at = NOW()
    WHERE project_id = p_workspace_id AND is_active = true;
    
    -- Suspendre KB si table existe
    BEGIN
        UPDATE pype_voice_knowledge_bases 
        SET is_active = false,
            updated_at = NOW()
        WHERE workspace_id = p_workspace_id AND is_active = true;
    EXCEPTION
        WHEN undefined_table THEN
            NULL; -- Table pas encore creee
    END;
    
    -- Suspendre workflows si table existe
    BEGIN
        UPDATE pype_voice_workflows 
        SET is_active = false,
            updated_at = NOW()
        WHERE workspace_id = p_workspace_id AND is_active = true;
    EXCEPTION
        WHEN undefined_table THEN
            NULL; -- Table pas encore creee
    END;
    
    -- Compter services suspendus
    SELECT 
        (SELECT COUNT(*) FROM pype_voice_agents WHERE project_id = p_workspace_id AND is_active = false) as agents_suspended,
        (SELECT COALESCE((SELECT COUNT(*) FROM pype_voice_knowledge_bases WHERE workspace_id = p_workspace_id AND is_active = false), 0)) as kb_suspended,
        (SELECT COALESCE((SELECT COUNT(*) FROM pype_voice_workflows WHERE workspace_id = p_workspace_id AND is_active = false), 0)) as workflows_suspended
    INTO suspended_counts;
    
    -- Creer alerte de suspension
    INSERT INTO credit_alerts (
        workspace_id, alert_type, severity, title, message,
        alert_data
    ) VALUES (
        p_workspace_id, 'service_suspended', 'critical',
        'Workspace Services Suspended',
        'All services have been suspended due to insufficient credits.',
        jsonb_build_object(
            'reason', p_reason,
            'agents_suspended', suspended_counts.agents_suspended,
            'kb_suspended', suspended_counts.kb_suspended,
            'workflows_suspended', suspended_counts.workflows_suspended
        )
    ) RETURNING id INTO alert_id;
    
    RETURN jsonb_build_object(
        'success', true,
        'workspace_id', p_workspace_id,
        'agents_suspended', suspended_counts.agents_suspended,
        'kb_suspended', suspended_counts.kb_suspended,
        'workflows_suspended', suspended_counts.workflows_suspended,
        'alert_id', alert_id
    );
END;
$$ LANGUAGE plpgsql;

-- ========================================
-- 6. FONCTION REACTIVATION SERVICES (NOUVELLE)
-- ========================================

CREATE OR REPLACE FUNCTION unsuspend_workspace_services(
    p_workspace_id UUID
) RETURNS JSONB AS $$
DECLARE
    reactivated_counts RECORD;
BEGIN
    -- Reactiver agents
    UPDATE pype_voice_agents 
    SET is_active = true,
        updated_at = NOW()
    WHERE project_id = p_workspace_id AND is_active = false;
    
    -- Reactiver KB si table existe
    BEGIN
        UPDATE pype_voice_knowledge_bases 
        SET is_active = true,
            updated_at = NOW()
        WHERE workspace_id = p_workspace_id AND is_active = false;
    EXCEPTION
        WHEN undefined_table THEN
            NULL;
    END;
    
    -- Reactiver workflows si table existe
    BEGIN
        UPDATE pype_voice_workflows 
        SET is_active = true,
            updated_at = NOW()
        WHERE workspace_id = p_workspace_id AND is_active = false;
    EXCEPTION
        WHEN undefined_table THEN
            NULL;
    END;
    
    -- Compter services reactives
    SELECT 
        (SELECT COUNT(*) FROM pype_voice_agents WHERE project_id = p_workspace_id AND is_active = true) as agents_active,
        (SELECT COALESCE((SELECT COUNT(*) FROM pype_voice_knowledge_bases WHERE workspace_id = p_workspace_id AND is_active = true), 0)) as kb_active,
        (SELECT COALESCE((SELECT COUNT(*) FROM pype_voice_workflows WHERE workspace_id = p_workspace_id AND is_active = true), 0)) as workflows_active
    INTO reactivated_counts;
    
    RETURN jsonb_build_object(
        'success', true,
        'workspace_id', p_workspace_id,
        'agents_reactivated', reactivated_counts.agents_active,
        'kb_reactivated', reactivated_counts.kb_active,
        'workflows_reactivated', reactivated_counts.workflows_active
    );
END;
$$ LANGUAGE plpgsql;

-- ========================================
-- 7. FONCTION INTEGRATION CALCULS EXISTANTS
-- ========================================

CREATE OR REPLACE FUNCTION calculate_unified_service_cost(
    p_service_type VARCHAR,
    p_service_id UUID,
    p_usage_params JSONB DEFAULT NULL,
    p_cycle_start DATE DEFAULT NULL,
    p_cycle_end DATE DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
    result JSONB;
BEGIN
    CASE p_service_type
        WHEN 'agent' THEN
            -- Utiliser fonction existante calculate_agent_cost
            result := calculate_agent_cost(
                p_service_id,
                COALESCE((p_usage_params->>'call_duration_minutes')::NUMERIC, NULL),
                COALESCE((p_usage_params->>'stt_duration_minutes')::NUMERIC, NULL),
                COALESCE((p_usage_params->>'tokens_used')::INTEGER, NULL),
                COALESCE((p_usage_params->>'words_generated')::INTEGER, NULL),
                true
            );
            
        WHEN 'knowledge_base' THEN
            -- Utiliser nouvelle fonction KB
            result := calculate_kb_cost(
                p_service_id,
                COALESCE((p_usage_params->>'storage_gb')::DECIMAL, NULL),
                COALESCE((p_usage_params->>'search_tokens')::INTEGER, NULL),
                COALESCE((p_usage_params->>'embedding_tokens')::INTEGER, NULL),
                p_cycle_start,
                p_cycle_end
            );
            
        WHEN 'workflow' THEN
            -- Utiliser nouvelle fonction Workflow
            result := calculate_workflow_cost(
                p_service_id,
                COALESCE((p_usage_params->>'operations')::INTEGER, NULL),
                COALESCE((p_usage_params->>'execution_minutes')::DECIMAL, NULL),
                p_cycle_start,
                p_cycle_end
            );
            
        ELSE
            result := jsonb_build_object('error', 'Unsupported service type: ' || p_service_type);
    END CASE;
    
    RETURN result;
END;
$$ LANGUAGE plpgsql;

COMMIT;

-- ========================================
-- 8. VERIFICATION DES FONCTIONS
-- ========================================

DO $$
BEGIN
    RAISE NOTICE 'Fonctions de gestion credits creees avec succes:';
    RAISE NOTICE '- calculate_kb_cost() - Calculs couts Knowledge Base';
    RAISE NOTICE '- calculate_workflow_cost() - Calculs couts Workflow';
    RAISE NOTICE '- deduct_credits_from_workspace() - Deduction credits avec suspension';
    RAISE NOTICE '- recharge_credits_workspace() - Recharge credits';
    RAISE NOTICE '- suspend_workspace_services() - Suspension services workspace';
    RAISE NOTICE '- unsuspend_workspace_services() - Reactivation services';
    RAISE NOTICE '- calculate_unified_service_cost() - Interface unifiee avec fonctions existantes';
    RAISE NOTICE '';
    RAISE NOTICE 'Ces fonctions etendent le systeme existant sans le remplacer';
    RAISE NOTICE 'Reutilisation des fonctions existantes: calculate_agent_cost(), calculate_monthly_prorata()';
END $$;
