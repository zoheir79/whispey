-- Système de déduction automatique des coûts fixes et PAG usage
-- Gère la facturation automatique et la déduction des crédits

-- Fonction principale pour traiter les facturations dues
CREATE OR REPLACE FUNCTION process_due_billings()
RETURNS TABLE(
    workspace_id UUID,
    service_type TEXT,
    service_id UUID,
    amount_deducted DECIMAL(10,2),
    success BOOLEAN,
    error_message TEXT
) AS $$
DECLARE
    billing_record RECORD;
    user_credit_record RECORD;
    deduction_success BOOLEAN;
    deduction_error TEXT;
BEGIN
    -- Traiter tous les services ayant une facturation due
    FOR billing_record IN
        SELECT 
            'agent' as service_type,
            abc.id as billing_cycle_id,
            abc.agent_id as service_id,
            abc.workspace_id,
            abc.user_id,
            abc.total_cost,
            abc.billing_mode,
            abc.billing_cycle,
            abc.next_billing_date
        FROM agent_billing_cycles abc
        WHERE abc.is_active = true 
        AND abc.is_paid = false 
        AND abc.is_suspended = false
        AND abc.next_billing_date <= NOW()
        
        UNION ALL
        
        SELECT 
            'kb' as service_type,
            kbc.id as billing_cycle_id,
            kbc.kb_id as service_id,
            kbc.workspace_id,
            kbc.user_id,
            kbc.total_cost,
            kbc.billing_mode,
            kbc.billing_cycle,
            kbc.next_billing_date
        FROM kb_billing_cycles kbc
        WHERE kbc.is_active = true 
        AND kbc.is_paid = false 
        AND kbc.is_suspended = false
        AND kbc.next_billing_date <= NOW()
        
        UNION ALL
        
        SELECT 
            'workflow' as service_type,
            wfc.id as billing_cycle_id,
            wfc.workflow_id as service_id,
            wfc.workspace_id,
            wfc.user_id,
            wfc.total_cost,
            wfc.billing_mode,
            wfc.billing_cycle,
            wfc.next_billing_date
        FROM workflow_billing_cycles wfc
        WHERE wfc.is_active = true 
        AND wfc.is_paid = false 
        AND wfc.is_suspended = false
        AND wfc.next_billing_date <= NOW()
        
        UNION ALL
        
        SELECT 
            'workspace' as service_type,
            wbc.id as billing_cycle_id,
            wbc.workspace_id as service_id,
            wbc.workspace_id,
            wbc.user_id,
            wbc.s3_total_cost as total_cost,
            'pag' as billing_mode,
            wbc.billing_cycle,
            wbc.next_billing_date
        FROM workspace_billing_cycles wbc
        WHERE wbc.is_active = true 
        AND wbc.is_paid = false 
        AND wbc.is_suspended = false
        AND wbc.next_billing_date <= NOW()
    LOOP
        -- Vérifier et déduire les crédits
        SELECT process_service_billing(
            billing_record.service_type,
            billing_record.billing_cycle_id,
            billing_record.workspace_id,
            billing_record.user_id,
            billing_record.total_cost
        ) INTO deduction_success, deduction_error;
        
        -- Retourner le résultat
        workspace_id := billing_record.workspace_id;
        service_type := billing_record.service_type;
        service_id := billing_record.service_id;
        amount_deducted := billing_record.total_cost;
        success := deduction_success;
        error_message := deduction_error;
        
        RETURN NEXT;
    END LOOP;
    
    RETURN;
END;
$$ LANGUAGE plpgsql;

-- Fonction pour traiter la facturation d'un service spécifique
CREATE OR REPLACE FUNCTION process_service_billing(
    p_service_type TEXT,
    p_billing_cycle_id UUID,
    p_workspace_id UUID,
    p_user_id UUID,
    p_amount DECIMAL(10,2)
)
RETURNS RECORD AS $$
DECLARE
    v_user_credit_id UUID;
    v_current_balance DECIMAL(10,2);
    v_credit_limit DECIMAL(10,2);
    v_auto_recharge_enabled BOOLEAN;
    v_auto_recharge_amount DECIMAL(10,2);
    v_auto_recharge_threshold DECIMAL(10,2);
    v_result RECORD;
    v_success BOOLEAN := false;
    v_error TEXT := null;
    v_next_period RECORD;
BEGIN
    -- Récupérer les informations de crédit utilisateur
    SELECT id, current_balance, credit_limit, auto_recharge_enabled, 
           auto_recharge_amount, auto_recharge_threshold
    INTO v_user_credit_id, v_current_balance, v_credit_limit, 
         v_auto_recharge_enabled, v_auto_recharge_amount, v_auto_recharge_threshold
    FROM user_credits 
    WHERE workspace_id = p_workspace_id;
    
    IF v_user_credit_id IS NULL THEN
        -- Créer un compte de crédit si inexistant
        INSERT INTO user_credits (workspace_id, user_id, current_balance, credit_limit)
        VALUES (p_workspace_id, p_user_id, 0, 1000)
        RETURNING id, current_balance INTO v_user_credit_id, v_current_balance;
    END IF;
    
    -- Vérifier la balance et tenter la recharge automatique si nécessaire
    IF v_current_balance < p_amount THEN
        IF v_auto_recharge_enabled AND v_current_balance <= v_auto_recharge_threshold THEN
            -- Tenter la recharge automatique
            UPDATE user_credits 
            SET current_balance = current_balance + v_auto_recharge_amount,
                updated_at = NOW()
            WHERE id = v_user_credit_id;
            
            -- Enregistrer la transaction de recharge
            INSERT INTO user_credit_transactions (
                user_credit_id, transaction_type, amount, 
                balance_before, balance_after, description
            ) VALUES (
                v_user_credit_id, 'recharge', v_auto_recharge_amount,
                v_current_balance, v_current_balance + v_auto_recharge_amount,
                'Recharge automatique'
            );
            
            v_current_balance := v_current_balance + v_auto_recharge_amount;
        END IF;
        
        -- Vérifier à nouveau après recharge potentielle
        IF v_current_balance < p_amount THEN
            -- Balance insuffisante - suspendre le service
            PERFORM suspend_service_billing(p_service_type, p_billing_cycle_id, p_workspace_id);
            
            v_success := false;
            v_error := 'Balance insuffisante pour la facturation';
            
            -- Créer une alerte
            INSERT INTO user_credit_alerts (
                workspace_id, user_id, alert_type, severity, message
            ) VALUES (
                p_workspace_id, p_user_id, 'service_suspended', 'critical',
                format('Service %s suspendu: balance insuffisante (%s requis, %s disponible)', 
                       p_service_type, p_amount, v_current_balance)
            );
        ELSE
            -- Balance suffisante - procéder à la déduction
            PERFORM deduct_credits_and_advance_billing(
                p_service_type, p_billing_cycle_id, v_user_credit_id, p_amount
            );
            v_success := true;
        END IF;
    ELSE
        -- Balance suffisante - procéder à la déduction
        PERFORM deduct_credits_and_advance_billing(
            p_service_type, p_billing_cycle_id, v_user_credit_id, p_amount
        );
        v_success := true;
    END IF;
    
    SELECT v_success as success, v_error as error INTO v_result;
    RETURN v_result;
END;
$$ LANGUAGE plpgsql;

-- Fonction pour déduire les crédits et avancer le cycle de facturation
CREATE OR REPLACE FUNCTION deduct_credits_and_advance_billing(
    p_service_type TEXT,
    p_billing_cycle_id UUID,
    p_user_credit_id UUID,
    p_amount DECIMAL(10,2)
)
RETURNS VOID AS $$
DECLARE
    v_current_balance DECIMAL(10,2);
    v_new_balance DECIMAL(10,2);
    v_next_period RECORD;
    v_current_start TIMESTAMP WITH TIME ZONE;
    v_billing_cycle TEXT;
BEGIN
    -- Récupérer la balance actuelle
    SELECT current_balance INTO v_current_balance 
    FROM user_credits WHERE id = p_user_credit_id;
    
    v_new_balance := v_current_balance - p_amount;
    
    -- Déduire les crédits
    UPDATE user_credits 
    SET current_balance = v_new_balance,
        last_transaction_date = NOW(),
        updated_at = NOW()
    WHERE id = p_user_credit_id;
    
    -- Enregistrer la transaction
    INSERT INTO user_credit_transactions (
        user_credit_id, transaction_type, amount,
        balance_before, balance_after, description,
        service_type, service_id
    ) VALUES (
        p_user_credit_id, 'deduction', -p_amount,
        v_current_balance, v_new_balance,
        format('Facturation %s', p_service_type),
        p_service_type, p_billing_cycle_id
    );
    
    -- Marquer comme payé et avancer au prochain cycle selon le type de service
    CASE p_service_type
        WHEN 'agent' THEN
            SELECT billing_period_start, billing_cycle 
            INTO v_current_start, v_billing_cycle
            FROM agent_billing_cycles WHERE id = p_billing_cycle_id;
            
            SELECT * INTO v_next_period 
            FROM calculate_next_billing_period(v_current_start, v_billing_cycle);
            
            UPDATE agent_billing_cycles 
            SET is_paid = true,
                last_billed_at = NOW(),
                billing_period_start = v_next_period.period_start,
                billing_period_end = v_next_period.period_end,
                next_billing_date = v_next_period.next_billing,
                usage_cost = 0,  -- Reset usage cost for next period
                updated_at = NOW()
            WHERE id = p_billing_cycle_id;
            
        WHEN 'kb' THEN
            SELECT billing_period_start, billing_cycle 
            INTO v_current_start, v_billing_cycle
            FROM kb_billing_cycles WHERE id = p_billing_cycle_id;
            
            SELECT * INTO v_next_period 
            FROM calculate_next_billing_period(v_current_start, v_billing_cycle);
            
            UPDATE kb_billing_cycles 
            SET is_paid = true,
                last_billed_at = NOW(),
                billing_period_start = v_next_period.period_start,
                billing_period_end = v_next_period.period_end,
                next_billing_date = v_next_period.next_billing,
                usage_cost = 0,
                query_count = 0,
                upload_mb = 0,
                updated_at = NOW()
            WHERE id = p_billing_cycle_id;
            
        WHEN 'workflow' THEN
            SELECT billing_period_start, billing_cycle 
            INTO v_current_start, v_billing_cycle
            FROM workflow_billing_cycles WHERE id = p_billing_cycle_id;
            
            SELECT * INTO v_next_period 
            FROM calculate_next_billing_period(v_current_start, v_billing_cycle);
            
            UPDATE workflow_billing_cycles 
            SET is_paid = true,
                last_billed_at = NOW(),
                billing_period_start = v_next_period.period_start,
                billing_period_end = v_next_period.period_end,
                next_billing_date = v_next_period.next_billing,
                usage_cost = 0,
                execution_count = 0,
                cpu_minutes = 0,
                updated_at = NOW()
            WHERE id = p_billing_cycle_id;
            
        WHEN 'workspace' THEN
            SELECT billing_period_start, billing_cycle 
            INTO v_current_start, v_billing_cycle
            FROM workspace_billing_cycles WHERE id = p_billing_cycle_id;
            
            SELECT * INTO v_next_period 
            FROM calculate_next_billing_period(v_current_start, v_billing_cycle);
            
            UPDATE workspace_billing_cycles 
            SET is_paid = true,
                last_billed_at = NOW(),
                billing_period_start = v_next_period.period_start,
                billing_period_end = v_next_period.period_end,
                next_billing_date = v_next_period.next_billing,
                s3_storage_cost = 0,
                s3_requests_cost = 0,
                s3_transfer_cost = 0,
                s3_storage_gb = 0,
                s3_requests_count = 0,
                s3_transfer_gb = 0,
                updated_at = NOW()
            WHERE id = p_billing_cycle_id;
    END CASE;
END;
$$ LANGUAGE plpgsql;

-- Fonction pour suspendre un service spécifique
CREATE OR REPLACE FUNCTION suspend_service_billing(
    p_service_type TEXT,
    p_billing_cycle_id UUID,
    p_workspace_id UUID
)
RETURNS VOID AS $$
BEGIN
    CASE p_service_type
        WHEN 'agent' THEN
            UPDATE agent_billing_cycles 
            SET is_suspended = true, updated_at = NOW()
            WHERE id = p_billing_cycle_id;
            
        WHEN 'kb' THEN
            UPDATE kb_billing_cycles 
            SET is_suspended = true, updated_at = NOW()
            WHERE id = p_billing_cycle_id;
            
        WHEN 'workflow' THEN
            UPDATE workflow_billing_cycles 
            SET is_suspended = true, updated_at = NOW()
            WHERE id = p_billing_cycle_id;
            
        WHEN 'workspace' THEN
            UPDATE workspace_billing_cycles 
            SET is_suspended = true, updated_at = NOW()
            WHERE id = p_billing_cycle_id;
    END CASE;
END;
$$ LANGUAGE plpgsql;

-- Fonction pour calculer les coûts PAG basés sur l'usage
CREATE OR REPLACE FUNCTION calculate_pag_usage_cost(
    p_service_type TEXT,
    p_service_id UUID,
    p_usage_metrics JSONB
)
RETURNS DECIMAL(10,2) AS $$
DECLARE
    v_cost DECIMAL(10,2) := 0;
    v_settings RECORD;
    v_overrides JSONB;
    v_agent_type TEXT;
    v_minutes_used DECIMAL(10,3);
    v_tokens_used INTEGER;
    v_queries_count INTEGER;
    v_upload_mb DECIMAL(10,3);
    v_executions INTEGER;
    v_cpu_minutes DECIMAL(10,3);
BEGIN
    -- Récupérer les paramètres de pricing globaux
    SELECT value::jsonb INTO v_settings 
    FROM pype_voice_global_settings 
    WHERE key = 'pricing_rates_pag';
    
    CASE p_service_type
        WHEN 'agent' THEN
            -- Récupérer le type d'agent et les overrides
            SELECT agent_type, config_json INTO v_agent_type, v_overrides
            FROM agent_billing_cycles abc
            JOIN pype_voice_agents a ON abc.agent_id = a.id
            WHERE abc.agent_id = p_service_id AND abc.is_active = true;
            
            -- Calculer selon le type d'agent et mode (support HYBRID)
            IF v_agent_type = 'voice' THEN
                v_minutes_used := (p_usage_metrics->>'minutes_used')::DECIMAL(10,3);
                v_tokens_used := (p_usage_metrics->>'tokens_used')::INTEGER;
                
                -- STT cost - Check individual mode in HYBRID
                IF (v_overrides->>'stt_mode') = 'dedicated' THEN
                    -- STT Dedicated: pas de coût par usage, déjà facturé en fixe
                    NULL;
                ELSE
                    -- STT PAG (builtin ou external)
                    IF (v_overrides->>'stt_mode') = 'external' THEN
                        -- External STT par minute STT réelle
                        v_cost := v_cost + ((p_usage_metrics->>'stt_duration_minutes')::DECIMAL(10,3) * COALESCE(
                            (v_overrides->>'stt_price')::DECIMAL(10,3),
                            (v_settings->>'external_stt_per_minute')::DECIMAL(10,3),
                            0.12
                        ));
                    ELSE
                        -- Builtin STT par minute d'appel
                        v_cost := v_cost + (v_minutes_used * COALESCE(
                            (v_overrides->>'stt_price')::DECIMAL(10,3),
                            (v_settings->>'voice_stt_builtin_per_minute')::DECIMAL(10,3),
                            0.10
                        ));
                    END IF;
                END IF;
                
                -- TTS cost - Check individual mode in HYBRID
                IF (v_overrides->>'tts_mode') = 'dedicated' THEN
                    -- TTS Dedicated: pas de coût par usage
                    NULL;
                ELSE
                    -- TTS PAG (builtin ou external)
                    IF (v_overrides->>'tts_mode') = 'external' THEN
                        -- External TTS par mot
                        v_cost := v_cost + ((p_usage_metrics->>'tts_words_generated')::INTEGER * COALESCE(
                            (v_overrides->>'tts_price')::DECIMAL(10,6),
                            (v_settings->>'external_tts_per_word')::DECIMAL(10,6),
                            0.005
                        ));
                    ELSE
                        -- Builtin TTS par minute d'appel
                        v_cost := v_cost + (v_minutes_used * COALESCE(
                            (v_overrides->>'tts_price')::DECIMAL(10,3),
                            (v_settings->>'voice_tts_builtin_per_minute')::DECIMAL(10,3),
                            0.15
                        ));
                    END IF;
                END IF;
                
                -- LLM cost - Check individual mode in HYBRID
                IF (v_overrides->>'llm_mode') = 'dedicated' THEN
                    -- LLM Dedicated: pas de coût par usage
                    NULL;
                ELSIF (v_overrides->>'llm_mode') = 'external' THEN
                    -- External LLM par token
                    v_cost := v_cost + (v_tokens_used * COALESCE(
                        (v_overrides->>'llm_price')::DECIMAL(10,6),
                        (v_settings->>'external_llm_per_token')::DECIMAL(10,6),
                        0.0003
                    ));
                ELSE
                    -- Builtin LLM par minute pour voice
                    v_cost := v_cost + (v_minutes_used * COALESCE(
                        (v_overrides->>'llm_price')::DECIMAL(10,3),
                        (v_settings->>'voice_llm_builtin_per_minute')::DECIMAL(10,3),
                        0.05
                    ));
                END IF;
                
            ELSE -- text_only agent
                v_tokens_used := (p_usage_metrics->>'tokens_used')::INTEGER;
                v_cost := v_cost + (v_tokens_used * COALESCE(
                    (v_overrides->>'llm_price')::DECIMAL(10,6),
                    (v_settings->>'text_llm_builtin_per_token')::DECIMAL(10,6),
                    0.0002
                ));
            END IF;
            
        WHEN 'kb' THEN
            -- Récupérer les overrides KB
            SELECT pricing_overrides INTO v_overrides
            FROM kb_billing_cycles 
            WHERE kb_id = p_service_id AND is_active = true;
            
            v_queries_count := (p_usage_metrics->>'queries_count')::INTEGER;
            v_upload_mb := (p_usage_metrics->>'upload_mb')::DECIMAL(10,3);
            
            -- Query cost
            v_cost := v_cost + (v_queries_count * COALESCE(
                (v_overrides->>'query_price')::DECIMAL(10,3),
                (v_settings->>'kb_per_query')::DECIMAL(10,3),
                0.01
            ));
            
            -- Upload cost
            v_cost := v_cost + (v_upload_mb * COALESCE(
                (v_overrides->>'upload_price')::DECIMAL(10,3),
                (v_settings->>'kb_per_upload_mb')::DECIMAL(10,3),
                0.02
            ));
            
        WHEN 'workflow' THEN
            -- Récupérer les overrides Workflow
            SELECT pricing_overrides INTO v_overrides
            FROM workflow_billing_cycles 
            WHERE workflow_id = p_service_id AND is_active = true;
            
            v_executions := (p_usage_metrics->>'executions')::INTEGER;
            v_cpu_minutes := (p_usage_metrics->>'cpu_minutes')::DECIMAL(10,3);
            
            -- Execution cost
            v_cost := v_cost + (v_executions * COALESCE(
                (v_overrides->>'execution_price')::DECIMAL(10,3),
                (v_settings->>'workflow_per_execution')::DECIMAL(10,3),
                0.10
            ));
            
            -- CPU time cost
            v_cost := v_cost + (v_cpu_minutes * COALESCE(
                (v_overrides->>'cpu_price')::DECIMAL(10,3),
                (v_settings->>'workflow_per_cpu_minute')::DECIMAL(10,3),
                0.50
            ));
    END CASE;
    
    RETURN v_cost;
END;
$$ LANGUAGE plpgsql;

-- Fonction pour ajouter des coûts d'usage PAG
CREATE OR REPLACE FUNCTION add_pag_usage_cost(
    p_service_type TEXT,
    p_service_id UUID,
    p_usage_metrics JSONB
)
RETURNS DECIMAL(10,2) AS $$
DECLARE
    v_additional_cost DECIMAL(10,2);
    v_billing_cycle_id UUID;
BEGIN
    -- Calculer le coût additionnel
    SELECT calculate_pag_usage_cost(p_service_type, p_service_id, p_usage_metrics)
    INTO v_additional_cost;
    
    -- Mettre à jour le cycle de facturation approprié
    CASE p_service_type
        WHEN 'agent' THEN
            UPDATE agent_billing_cycles 
            SET usage_cost = usage_cost + v_additional_cost,
                updated_at = NOW()
            WHERE agent_id = p_service_id AND is_active = true
            RETURNING id INTO v_billing_cycle_id;
            
        WHEN 'kb' THEN
            UPDATE kb_billing_cycles 
            SET usage_cost = usage_cost + v_additional_cost,
                query_count = query_count + COALESCE((p_usage_metrics->>'queries_count')::INTEGER, 0),
                upload_mb = upload_mb + COALESCE((p_usage_metrics->>'upload_mb')::DECIMAL(10,3), 0),
                updated_at = NOW()
            WHERE kb_id = p_service_id AND is_active = true
            RETURNING id INTO v_billing_cycle_id;
            
        WHEN 'workflow' THEN
            UPDATE workflow_billing_cycles 
            SET usage_cost = usage_cost + v_additional_cost,
                execution_count = execution_count + COALESCE((p_usage_metrics->>'executions')::INTEGER, 0),
                cpu_minutes = cpu_minutes + COALESCE((p_usage_metrics->>'cpu_minutes')::DECIMAL(10,3), 0),
                updated_at = NOW()
            WHERE workflow_id = p_service_id AND is_active = true
            RETURNING id INTO v_billing_cycle_id;
            
        WHEN 'workspace' THEN
            UPDATE workspace_billing_cycles 
            SET s3_storage_cost = s3_storage_cost + COALESCE((p_usage_metrics->>'storage_cost')::DECIMAL(10,2), 0),
                s3_requests_cost = s3_requests_cost + COALESCE((p_usage_metrics->>'requests_cost')::DECIMAL(10,2), 0),
                s3_transfer_cost = s3_transfer_cost + COALESCE((p_usage_metrics->>'transfer_cost')::DECIMAL(10,2), 0),
                s3_storage_gb = s3_storage_gb + COALESCE((p_usage_metrics->>'storage_gb')::DECIMAL(10,3), 0),
                s3_requests_count = s3_requests_count + COALESCE((p_usage_metrics->>'requests_count')::INTEGER, 0),
                s3_transfer_gb = s3_transfer_gb + COALESCE((p_usage_metrics->>'transfer_gb')::DECIMAL(10,3), 0),
                updated_at = NOW()
            WHERE workspace_id = p_service_id AND is_active = true
            RETURNING id INTO v_billing_cycle_id;
    END CASE;
    
    RETURN v_additional_cost;
END;
$$ LANGUAGE plpgsql;

-- Fonction pour vérifier et traiter les alertes de crédits faibles
CREATE OR REPLACE FUNCTION check_low_credit_alerts()
RETURNS VOID AS $$
DECLARE
    credit_record RECORD;
    alert_threshold DECIMAL(10,2);
BEGIN
    FOR credit_record IN
        SELECT uc.*, w.name as workspace_name, u.email as user_email
        FROM user_credits uc
        JOIN pype_voice_workspaces w ON uc.workspace_id = w.id
        JOIN pype_voice_users u ON uc.user_id = u.id
        WHERE uc.current_balance > 0  -- Éviter les alertes pour les comptes à zéro
    LOOP
        alert_threshold := credit_record.credit_limit * 0.2;  -- 20% du limit
        
        IF credit_record.current_balance <= alert_threshold THEN
            -- Créer une alerte si pas déjà existante récente
            IF NOT EXISTS (
                SELECT 1 FROM user_credit_alerts 
                WHERE workspace_id = credit_record.workspace_id 
                AND alert_type = 'low_balance'
                AND created_at > NOW() - INTERVAL '24 hours'
            ) THEN
                INSERT INTO user_credit_alerts (
                    workspace_id, user_id, alert_type, severity, message
                ) VALUES (
                    credit_record.workspace_id,
                    credit_record.user_id,
                    'low_balance',
                    CASE 
                        WHEN credit_record.current_balance <= (credit_record.credit_limit * 0.1) THEN 'critical'
                        ELSE 'warning'
                    END,
                    format('Balance faible: %s restant sur %s (%s%%)', 
                           credit_record.current_balance, 
                           credit_record.credit_limit,
                           ROUND((credit_record.current_balance / credit_record.credit_limit * 100)::NUMERIC, 1))
                );
            END IF;
        END IF;
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Tâche programmée pour traiter les facturations (à exécuter via cron)
CREATE OR REPLACE FUNCTION scheduled_billing_processor()
RETURNS TEXT AS $$
DECLARE
    v_processed_count INTEGER := 0;
    v_failed_count INTEGER := 0;
    v_suspended_count INTEGER := 0;
    billing_result RECORD;
    result_summary TEXT;
BEGIN
    -- Traiter toutes les facturations dues
    FOR billing_result IN
        SELECT * FROM process_due_billings()
    LOOP
        v_processed_count := v_processed_count + 1;
        
        IF billing_result.success THEN
            -- Facturation réussie
            NULL;
        ELSE
            v_failed_count := v_failed_count + 1;
            IF billing_result.error_message LIKE '%suspendu%' THEN
                v_suspended_count := v_suspended_count + 1;
            END IF;
        END IF;
    END LOOP;
    
    -- Vérifier les alertes de crédits faibles
    PERFORM check_low_credit_alerts();
    
    result_summary := format('Facturation automatique - Traité: %s, Échecs: %s, Suspensions: %s', 
                           v_processed_count, v_failed_count, v_suspended_count);
    
    -- Log du résultat
    INSERT INTO pype_voice_system_logs (level, message, metadata)
    VALUES ('info', result_summary, jsonb_build_object(
        'processed', v_processed_count,
        'failed', v_failed_count,
        'suspended', v_suspended_count,
        'timestamp', NOW()
    ));
    
    RETURN result_summary;
END;
$$ LANGUAGE plpgsql;

-- Vue pour monitorer les métriques de facturation
CREATE OR REPLACE VIEW billing_metrics AS
SELECT 
    DATE_TRUNC('day', created_at) as billing_date,
    
    -- Comptes par statut
    COUNT(*) FILTER (WHERE is_active = true) as active_billings,
    COUNT(*) FILTER (WHERE is_suspended = true) as suspended_billings,
    COUNT(*) FILTER (WHERE is_paid = false AND next_billing_date <= NOW()) as overdue_billings,
    
    -- Revenus
    SUM(total_cost) FILTER (WHERE is_paid = true) as paid_revenue,
    SUM(total_cost) FILTER (WHERE is_paid = false) as pending_revenue,
    
    -- Par type de service
    COUNT(*) FILTER (WHERE billing_mode = 'dedicated') as dedicated_services,
    COUNT(*) FILTER (WHERE billing_mode = 'pag') as pag_services,
    COUNT(*) FILTER (WHERE billing_mode = 'hybrid') as hybrid_services

FROM (
    SELECT created_at, is_active, is_suspended, is_paid, next_billing_date, 
           total_cost, billing_mode, 'agent' as service_type
    FROM agent_billing_cycles
    
    UNION ALL
    
    SELECT created_at, is_active, is_suspended, is_paid, next_billing_date, 
           total_cost, billing_mode, 'kb' as service_type
    FROM kb_billing_cycles
    
    UNION ALL
    
    SELECT created_at, is_active, is_suspended, is_paid, next_billing_date, 
           total_cost, billing_mode, 'workflow' as service_type
    FROM workflow_billing_cycles
) combined_billings
GROUP BY DATE_TRUNC('day', created_at)
ORDER BY billing_date DESC;
