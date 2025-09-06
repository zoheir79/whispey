-- Système de métriques usage pour déduction PAG
-- Gère le logging et l'agrégation des métriques d'usage des agents, KB, workflows

-- Table principale des événements d'usage (logs en temps réel)
CREATE TABLE IF NOT EXISTS usage_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Identifiants du service
    service_type TEXT NOT NULL CHECK (service_type IN ('agent', 'kb', 'workflow', 'workspace')),
    service_id UUID NOT NULL,
    workspace_id UUID NOT NULL REFERENCES pype_voice_projects(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES pype_voice_users(user_id) ON DELETE CASCADE,
    
    -- Type d'événement
    event_type TEXT NOT NULL CHECK (event_type IN (
        'agent_call_start', 'agent_call_end', 'agent_message', 
        'kb_query', 'kb_upload', 'kb_index',
        'workflow_start', 'workflow_end', 'workflow_step',
        'api_request', 's3_operation'
    )),
    
    -- Métriques d'usage
    usage_metrics JSONB NOT NULL DEFAULT '{}',
    
    -- Coûts calculés
    cost_breakdown JSONB DEFAULT '{}',
    total_cost DECIMAL(10,6) DEFAULT 0,
    
    -- Métadonnées de l'événement
    session_id TEXT,
    call_id TEXT,
    request_id TEXT,
    
    -- Timestamps
    event_timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    processed_at TIMESTAMP WITH TIME ZONE,
    
    -- Status de traitement
    is_processed BOOLEAN DEFAULT false,
    processing_error TEXT,
    
    -- Index pour optimiser les requêtes
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index pour optimiser les performances
CREATE INDEX IF NOT EXISTS idx_usage_events_service ON usage_events(service_type, service_id);
CREATE INDEX IF NOT EXISTS idx_usage_events_workspace ON usage_events(workspace_id, event_timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_usage_events_timestamp ON usage_events(event_timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_usage_events_unprocessed ON usage_events(is_processed, event_timestamp) WHERE is_processed = false;
CREATE INDEX IF NOT EXISTS idx_usage_events_session ON usage_events(session_id) WHERE session_id IS NOT NULL;

-- Table d'agrégation des métriques par période (pour optimiser les requêtes)
CREATE TABLE IF NOT EXISTS usage_metrics_aggregated (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Identifiants
    service_type TEXT NOT NULL,
    service_id UUID NOT NULL,
    workspace_id UUID NOT NULL,
    user_id UUID NOT NULL,
    
    -- Période d'agrégation
    period_type TEXT NOT NULL CHECK (period_type IN ('hour', 'day', 'week', 'month')),
    period_start TIMESTAMP WITH TIME ZONE NOT NULL,
    period_end TIMESTAMP WITH TIME ZONE NOT NULL,
    
    -- Métriques agrégées
    total_events INTEGER DEFAULT 0,
    
    -- Métriques spécifiques par type de service
    agent_minutes_used DECIMAL(10,3) DEFAULT 0,
    agent_messages_count INTEGER DEFAULT 0,
    agent_stt_minutes DECIMAL(10,3) DEFAULT 0,
    agent_tts_minutes DECIMAL(10,3) DEFAULT 0,
    agent_llm_tokens INTEGER DEFAULT 0,
    
    kb_queries_count INTEGER DEFAULT 0,
    kb_upload_mb DECIMAL(10,3) DEFAULT 0,
    kb_processed_documents INTEGER DEFAULT 0,
    
    workflow_executions INTEGER DEFAULT 0,
    workflow_cpu_minutes DECIMAL(10,3) DEFAULT 0,
    workflow_steps_executed INTEGER DEFAULT 0,
    
    s3_storage_gb DECIMAL(10,3) DEFAULT 0,
    s3_requests_count INTEGER DEFAULT 0,
    s3_transfer_gb DECIMAL(10,3) DEFAULT 0,
    
    -- Coûts calculés
    total_cost DECIMAL(10,4) DEFAULT 0,
    cost_breakdown JSONB DEFAULT '{}',
    
    -- Métadonnées
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(service_type, service_id, period_type, period_start)
);

CREATE INDEX IF NOT EXISTS idx_usage_aggregated_service_period ON usage_metrics_aggregated(service_type, service_id, period_type, period_start DESC);
CREATE INDEX IF NOT EXISTS idx_usage_aggregated_workspace ON usage_metrics_aggregated(workspace_id, period_start DESC);

-- Fonction pour enregistrer un événement d'usage
CREATE OR REPLACE FUNCTION log_usage_event(
    p_service_type TEXT,
    p_service_id UUID,
    p_event_type TEXT,
    p_usage_metrics JSONB,
    p_session_id TEXT DEFAULT NULL,
    p_call_id TEXT DEFAULT NULL,
    p_request_id TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    v_event_id UUID;
    v_workspace_id UUID;
    v_user_id UUID;
    v_total_cost DECIMAL(10,6) := 0;
    v_cost_breakdown JSONB := '{}';
BEGIN
    -- Récupérer workspace_id et user_id selon le type de service
    CASE p_service_type
        WHEN 'agent' THEN
            SELECT workspace_id, user_id INTO v_workspace_id, v_user_id
            FROM pype_voice_agents WHERE id = p_service_id;
            
        WHEN 'kb' THEN
            SELECT workspace_id, user_id INTO v_workspace_id, v_user_id
            FROM pype_voice_knowledge_bases WHERE id = p_service_id;
            
        WHEN 'workflow' THEN
            SELECT workspace_id, user_id INTO v_workspace_id, v_user_id
            FROM pype_voice_workflows WHERE id = p_service_id;
            
        WHEN 'workspace' THEN
            SELECT id, user_id INTO v_workspace_id, v_user_id
            FROM pype_voice_workspaces WHERE id = p_service_id;
    END CASE;
    
    IF v_workspace_id IS NULL THEN
        RAISE EXCEPTION 'Service not found: % %', p_service_type, p_service_id;
    END IF;
    
    -- Calculer les coûts en temps réel
    SELECT calculate_pag_usage_cost(p_service_type, p_service_id, p_usage_metrics) INTO v_total_cost;
    
    -- Créer le breakdown des coûts
    v_cost_breakdown := jsonb_build_object(
        'calculated_at', NOW(),
        'service_type', p_service_type,
        'event_type', p_event_type,
        'total_cost', v_total_cost
    );
    
    -- Insérer l'événement
    INSERT INTO usage_events (
        service_type, service_id, workspace_id, user_id,
        event_type, usage_metrics, cost_breakdown, total_cost,
        session_id, call_id, request_id
    ) VALUES (
        p_service_type, p_service_id, v_workspace_id, v_user_id,
        p_event_type, p_usage_metrics, v_cost_breakdown, v_total_cost,
        p_session_id, p_call_id, p_request_id
    ) RETURNING id INTO v_event_id;
    
    -- Déclencher l'agrégation asynchrone
    PERFORM pg_notify('usage_event_logged', json_build_object(
        'event_id', v_event_id,
        'service_type', p_service_type,
        'service_id', p_service_id,
        'workspace_id', v_workspace_id
    )::text);
    
    RETURN v_event_id;
END;
$$ LANGUAGE plpgsql;

-- Fonction pour traiter et agréger les événements
CREATE OR REPLACE FUNCTION process_usage_events_batch(p_batch_size INTEGER DEFAULT 1000)
RETURNS INTEGER AS $$
DECLARE
    v_processed_count INTEGER := 0;
    event_record RECORD;
    v_aggregation_result RECORD;
BEGIN
    -- Traiter les événements non traités par batch
    FOR event_record IN
        SELECT * FROM usage_events 
        WHERE is_processed = false 
        ORDER BY event_timestamp ASC 
        LIMIT p_batch_size
    LOOP
        BEGIN
            -- Agréger l'événement
            SELECT * INTO v_aggregation_result FROM aggregate_usage_event(event_record.id);
            
            -- Marquer comme traité
            UPDATE usage_events 
            SET is_processed = true,
                processed_at = NOW(),
                processing_error = NULL
            WHERE id = event_record.id;
            
            v_processed_count := v_processed_count + 1;
            
        EXCEPTION WHEN OTHERS THEN
            -- Enregistrer l'erreur mais continuer
            UPDATE usage_events 
            SET processing_error = SQLERRM,
                processed_at = NOW()
            WHERE id = event_record.id;
        END;
    END LOOP;
    
    -- Mettre à jour les cycles de facturation avec les nouveaux coûts
    IF v_processed_count > 0 THEN
        PERFORM update_billing_cycles_from_usage();
    END IF;
    
    RETURN v_processed_count;
END;
$$ LANGUAGE plpgsql;

-- Fonction pour agréger un événement spécifique
CREATE OR REPLACE FUNCTION aggregate_usage_event(p_event_id UUID)
RETURNS RECORD AS $$
DECLARE
    v_event RECORD;
    v_result RECORD;
    v_periods TEXT[] := ARRAY['hour', 'day', 'month'];
    period_type TEXT;
    v_period_start TIMESTAMP WITH TIME ZONE;
    v_period_end TIMESTAMP WITH TIME ZONE;
BEGIN
    -- Récupérer l'événement
    SELECT * INTO v_event FROM usage_events WHERE id = p_event_id;
    
    IF NOT FOUND THEN
        SELECT false as success, 'Event not found' as error INTO v_result;
        RETURN v_result;
    END IF;
    
    -- Agréger pour chaque période (heure, jour, mois)
    FOREACH period_type IN ARRAY v_periods LOOP
        -- Calculer les bornes de la période
        CASE period_type
            WHEN 'hour' THEN
                v_period_start := DATE_TRUNC('hour', v_event.event_timestamp);
                v_period_end := v_period_start + INTERVAL '1 hour';
            WHEN 'day' THEN
                v_period_start := DATE_TRUNC('day', v_event.event_timestamp);
                v_period_end := v_period_start + INTERVAL '1 day';
            WHEN 'month' THEN
                v_period_start := DATE_TRUNC('month', v_event.event_timestamp);
                v_period_end := v_period_start + INTERVAL '1 month';
        END CASE;
        
        -- Insérer ou mettre à jour l'agrégation
        INSERT INTO usage_metrics_aggregated (
            service_type, service_id, workspace_id, user_id,
            period_type, period_start, period_end,
            total_events, total_cost
        ) VALUES (
            v_event.service_type, v_event.service_id, v_event.workspace_id, v_event.user_id,
            period_type, v_period_start, v_period_end,
            1, v_event.total_cost
        )
        ON CONFLICT (service_type, service_id, period_type, period_start)
        DO UPDATE SET
            total_events = usage_metrics_aggregated.total_events + 1,
            total_cost = usage_metrics_aggregated.total_cost + v_event.total_cost,
            updated_at = NOW();
        
        -- Mettre à jour les métriques spécifiques selon le type d'événement
        PERFORM update_specific_metrics(
            v_event.service_type, v_event.service_id, period_type, v_period_start,
            v_event.event_type, v_event.usage_metrics
        );
    END LOOP;
    
    SELECT true as success, 'Event aggregated successfully' as message INTO v_result;
    RETURN v_result;
END;
$$ LANGUAGE plpgsql;

-- Fonction pour mettre à jour les métriques spécifiques
CREATE OR REPLACE FUNCTION update_specific_metrics(
    p_service_type TEXT,
    p_service_id UUID,
    p_period_type TEXT,
    p_period_start TIMESTAMP WITH TIME ZONE,
    p_event_type TEXT,
    p_usage_metrics JSONB
)
RETURNS VOID AS $$
DECLARE
    v_update_fields JSONB := '{}';
BEGIN
    -- Construire les champs à mettre à jour selon le type d'événement
    CASE p_event_type
        WHEN 'agent_call_end' THEN
            v_update_fields := jsonb_build_object(
                'agent_minutes_used', COALESCE((p_usage_metrics->>'minutes_used')::DECIMAL(10,3), 0),
                'agent_stt_minutes', COALESCE((p_usage_metrics->>'stt_minutes')::DECIMAL(10,3), 0),
                'agent_tts_minutes', COALESCE((p_usage_metrics->>'tts_minutes')::DECIMAL(10,3), 0),
                'agent_llm_tokens', COALESCE((p_usage_metrics->>'llm_tokens')::INTEGER, 0)
            );
        WHEN 'agent_message' THEN
            v_update_fields := jsonb_build_object(
                'agent_messages_count', 1,
                'agent_llm_tokens', COALESCE((p_usage_metrics->>'tokens_used')::INTEGER, 0)
            );
        WHEN 'kb_query' THEN
            v_update_fields := jsonb_build_object(
                'kb_queries_count', 1
            );
        WHEN 'kb_upload' THEN
            v_update_fields := jsonb_build_object(
                'kb_upload_mb', COALESCE((p_usage_metrics->>'upload_mb')::DECIMAL(10,3), 0),
                'kb_processed_documents', COALESCE((p_usage_metrics->>'documents_count')::INTEGER, 0)
            );
        WHEN 'workflow_end' THEN
            v_update_fields := jsonb_build_object(
                'workflow_executions', 1,
                'workflow_cpu_minutes', COALESCE((p_usage_metrics->>'cpu_minutes')::DECIMAL(10,3), 0),
                'workflow_steps_executed', COALESCE((p_usage_metrics->>'steps_count')::INTEGER, 0)
            );
        WHEN 's3_operation' THEN
            v_update_fields := jsonb_build_object(
                's3_requests_count', COALESCE((p_usage_metrics->>'requests_count')::INTEGER, 0),
                's3_transfer_gb', COALESCE((p_usage_metrics->>'transfer_gb')::DECIMAL(10,3), 0)
            );
    END CASE;
    
    -- Appliquer les mises à jour si on a des champs à mettre à jour
    IF v_update_fields != '{}'::JSONB THEN
        UPDATE usage_metrics_aggregated 
        SET 
            agent_minutes_used = agent_minutes_used + COALESCE((v_update_fields->>'agent_minutes_used')::DECIMAL(10,3), 0),
            agent_messages_count = agent_messages_count + COALESCE((v_update_fields->>'agent_messages_count')::INTEGER, 0),
            agent_stt_minutes = agent_stt_minutes + COALESCE((v_update_fields->>'agent_stt_minutes')::DECIMAL(10,3), 0),
            agent_tts_minutes = agent_tts_minutes + COALESCE((v_update_fields->>'agent_tts_minutes')::DECIMAL(10,3), 0),
            agent_llm_tokens = agent_llm_tokens + COALESCE((v_update_fields->>'agent_llm_tokens')::INTEGER, 0),
            kb_queries_count = kb_queries_count + COALESCE((v_update_fields->>'kb_queries_count')::INTEGER, 0),
            kb_upload_mb = kb_upload_mb + COALESCE((v_update_fields->>'kb_upload_mb')::DECIMAL(10,3), 0),
            kb_processed_documents = kb_processed_documents + COALESCE((v_update_fields->>'kb_processed_documents')::INTEGER, 0),
            workflow_executions = workflow_executions + COALESCE((v_update_fields->>'workflow_executions')::INTEGER, 0),
            workflow_cpu_minutes = workflow_cpu_minutes + COALESCE((v_update_fields->>'workflow_cpu_minutes')::DECIMAL(10,3), 0),
            workflow_steps_executed = workflow_steps_executed + COALESCE((v_update_fields->>'workflow_steps_executed')::INTEGER, 0),
            s3_requests_count = s3_requests_count + COALESCE((v_update_fields->>'s3_requests_count')::INTEGER, 0),
            s3_transfer_gb = s3_transfer_gb + COALESCE((v_update_fields->>'s3_transfer_gb')::DECIMAL(10,3), 0),
            updated_at = NOW()
        WHERE service_type = p_service_type 
        AND service_id = p_service_id 
        AND period_type = p_period_type 
        AND period_start = p_period_start;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Fonction pour mettre à jour les cycles de facturation avec les métriques d'usage
CREATE OR REPLACE FUNCTION update_billing_cycles_from_usage()
RETURNS INTEGER AS $$
DECLARE
    v_updated_count INTEGER := 0;
    billing_record RECORD;
    v_current_month_start TIMESTAMP WITH TIME ZONE;
    v_usage_metrics RECORD;
BEGIN
    v_current_month_start := DATE_TRUNC('month', NOW());
    
    -- Mettre à jour les cycles de facturation actifs avec les métriques du mois en cours
    FOR billing_record IN
        SELECT abc.*, a.agent_type
        FROM agent_billing_cycles abc
        JOIN pype_voice_agents a ON abc.agent_id = a.id
        WHERE abc.is_active = true 
        AND abc.billing_mode IN ('pag', 'hybrid')
        AND abc.billing_period_start <= v_current_month_start
        AND abc.billing_period_end >= NOW()
    LOOP
        -- Récupérer les métriques agrégées pour ce mois
        SELECT 
            COALESCE(SUM(agent_minutes_used), 0) as total_minutes,
            COALESCE(SUM(agent_llm_tokens), 0) as total_tokens,
            COALESCE(SUM(total_cost), 0) as calculated_cost
        INTO v_usage_metrics
        FROM usage_metrics_aggregated
        WHERE service_type = 'agent'
        AND service_id = billing_record.agent_id
        AND period_type = 'month'
        AND period_start = v_current_month_start;
        
        -- Mettre à jour le cycle de facturation avec les nouveaux coûts
        UPDATE agent_billing_cycles 
        SET usage_cost = v_usage_metrics.calculated_cost,
            updated_at = NOW()
        WHERE id = billing_record.id;
        
        v_updated_count := v_updated_count + 1;
    END LOOP;
    
    -- Faire de même pour KB et workflows
    FOR billing_record IN
        SELECT * FROM kb_billing_cycles 
        WHERE is_active = true 
        AND billing_mode = 'pag'
        AND billing_period_start <= v_current_month_start
        AND billing_period_end >= NOW()
    LOOP
        SELECT COALESCE(SUM(total_cost), 0) INTO v_usage_metrics
        FROM usage_metrics_aggregated
        WHERE service_type = 'kb'
        AND service_id = billing_record.kb_id
        AND period_type = 'month'
        AND period_start = v_current_month_start;
        
        UPDATE kb_billing_cycles 
        SET usage_cost = v_usage_metrics.calculated_cost,
            updated_at = NOW()
        WHERE id = billing_record.id;
    END LOOP;
    
    FOR billing_record IN
        SELECT * FROM workflow_billing_cycles 
        WHERE is_active = true 
        AND billing_mode = 'pag'
        AND billing_period_start <= v_current_month_start
        AND billing_period_end >= NOW()
    LOOP
        SELECT COALESCE(SUM(total_cost), 0) INTO v_usage_metrics
        FROM usage_metrics_aggregated
        WHERE service_type = 'workflow'
        AND service_id = billing_record.workflow_id
        AND period_type = 'month'
        AND period_start = v_current_month_start;
        
        UPDATE workflow_billing_cycles 
        SET usage_cost = v_usage_metrics.calculated_cost,
            updated_at = NOW()
        WHERE id = billing_record.id;
    END LOOP;
    
    RETURN v_updated_count;
END;
$$ LANGUAGE plpgsql;

-- Fonction utilitaire pour obtenir les métriques d'un service
CREATE OR REPLACE FUNCTION get_service_usage_metrics(
    p_service_type TEXT,
    p_service_id UUID,
    p_period_start TIMESTAMP WITH TIME ZONE DEFAULT NULL,
    p_period_end TIMESTAMP WITH TIME ZONE DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
    v_metrics JSONB;
    v_start_date TIMESTAMP WITH TIME ZONE;
    v_end_date TIMESTAMP WITH TIME ZONE;
BEGIN
    -- Utiliser le mois courant par défaut
    v_start_date := COALESCE(p_period_start, DATE_TRUNC('month', NOW()));
    v_end_date := COALESCE(p_period_end, NOW());
    
    -- Agrégation des métriques depuis les événements bruts
    SELECT jsonb_build_object(
        'service_type', p_service_type,
        'service_id', p_service_id,
        'period_start', v_start_date,
        'period_end', v_end_date,
        'total_events', COUNT(*),
        'total_cost', COALESCE(SUM(total_cost), 0),
        'metrics_by_event_type', jsonb_agg(
            jsonb_build_object(
                'event_type', event_type,
                'count', count,
                'total_cost', event_cost
            )
        )
    ) INTO v_metrics
    FROM (
        SELECT 
            event_type,
            COUNT(*) as count,
            SUM(total_cost) as event_cost
        FROM usage_events
        WHERE service_type = p_service_type
        AND service_id = p_service_id
        AND event_timestamp BETWEEN v_start_date AND v_end_date
        GROUP BY event_type
    ) grouped_events;
    
    -- Ajouter les métriques spécifiques depuis les agrégations
    SELECT v_metrics || jsonb_build_object(
        'aggregated_metrics', jsonb_build_object(
            'agent_minutes_used', COALESCE(SUM(agent_minutes_used), 0),
            'agent_messages_count', COALESCE(SUM(agent_messages_count), 0),
            'agent_llm_tokens', COALESCE(SUM(agent_llm_tokens), 0),
            'kb_queries_count', COALESCE(SUM(kb_queries_count), 0),
            'kb_upload_mb', COALESCE(SUM(kb_upload_mb), 0),
            'workflow_executions', COALESCE(SUM(workflow_executions), 0),
            'workflow_cpu_minutes', COALESCE(SUM(workflow_cpu_minutes), 0),
            's3_requests_count', COALESCE(SUM(s3_requests_count), 0),
            's3_transfer_gb', COALESCE(SUM(s3_transfer_gb), 0)
        )
    ) INTO v_metrics
    FROM usage_metrics_aggregated
    WHERE service_type = p_service_type
    AND service_id = p_service_id
    AND period_start >= v_start_date
    AND period_start < v_end_date;
    
    RETURN COALESCE(v_metrics, '{}'::JSONB);
END;
$$ LANGUAGE plpgsql;

-- Tâche programmée pour traiter les événements d'usage
CREATE OR REPLACE FUNCTION scheduled_usage_processing()
RETURNS TEXT AS $$
DECLARE
    v_processed_count INTEGER;
    v_billing_updated INTEGER;
    result_summary TEXT;
BEGIN
    -- Traiter les événements en attente
    SELECT process_usage_events_batch(5000) INTO v_processed_count;
    
    -- Mettre à jour les cycles de facturation
    SELECT update_billing_cycles_from_usage() INTO v_billing_updated;
    
    -- Nettoyer les anciens événements (> 6 mois)
    DELETE FROM usage_events 
    WHERE is_processed = true 
    AND processed_at < NOW() - INTERVAL '6 months';
    
    result_summary := format('Usage processing - Events processed: %s, Billing cycles updated: %s', 
                           v_processed_count, v_billing_updated);
    
    -- Log du résultat
    INSERT INTO pype_voice_system_logs (level, message, metadata)
    VALUES ('info', result_summary, jsonb_build_object(
        'processed_events', v_processed_count,
        'updated_billing_cycles', v_billing_updated,
        'timestamp', NOW()
    ));
    
    RETURN result_summary;
END;
$$ LANGUAGE plpgsql;

-- Vue pour faciliter les requêtes de métriques
CREATE OR REPLACE VIEW usage_metrics_summary AS
SELECT 
    ue.service_type,
    ue.service_id,
    ue.workspace_id,
    DATE_TRUNC('day', ue.event_timestamp) as usage_date,
    COUNT(*) as total_events,
    SUM(ue.total_cost) as daily_cost,
    
    -- Métriques par type d'événement
    COUNT(*) FILTER (WHERE ue.event_type LIKE 'agent_%') as agent_events,
    COUNT(*) FILTER (WHERE ue.event_type LIKE 'kb_%') as kb_events,
    COUNT(*) FILTER (WHERE ue.event_type LIKE 'workflow_%') as workflow_events,
    
    -- Coûts par type
    SUM(ue.total_cost) FILTER (WHERE ue.event_type LIKE 'agent_%') as agent_cost,
    SUM(ue.total_cost) FILTER (WHERE ue.event_type LIKE 'kb_%') as kb_cost,
    SUM(ue.total_cost) FILTER (WHERE ue.event_type LIKE 'workflow_%') as workflow_cost

FROM usage_events ue
WHERE ue.is_processed = true
GROUP BY ue.service_type, ue.service_id, ue.workspace_id, DATE_TRUNC('day', ue.event_timestamp)
ORDER BY usage_date DESC;

-- RLS pour sécuriser l'accès aux métriques
ALTER TABLE usage_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE usage_metrics_aggregated ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usage events workspace access" ON usage_events
    FOR ALL USING (
        workspace_id IN (
            SELECT workspace_id FROM pype_voice_email_project_mapping 
            WHERE email = auth.jwt()->>'email'
        )
        OR EXISTS (
            SELECT 1 FROM pype_voice_users u 
            WHERE u.email = auth.jwt()->>'email' 
            AND u.global_role = 'super_admin'
        )
    );

CREATE POLICY "Usage metrics aggregated workspace access" ON usage_metrics_aggregated
    FOR ALL USING (
        workspace_id IN (
            SELECT workspace_id FROM pype_voice_email_project_mapping 
            WHERE email = auth.jwt()->>'email'
        )
        OR EXISTS (
            SELECT 1 FROM pype_voice_users u 
            WHERE u.email = auth.jwt()->>'email' 
            AND u.global_role = 'super_admin'
        )
    );

-- Fonction pour simuler des événements d'usage (pour testing)
CREATE OR REPLACE FUNCTION simulate_usage_events(
    p_agent_id UUID,
    p_minutes_used DECIMAL(10,3) DEFAULT 1.5,
    p_tokens_used INTEGER DEFAULT 1000
)
RETURNS UUID AS $$
DECLARE
    v_event_id UUID;
    v_metrics JSONB;
BEGIN
    -- Créer des métriques simulées pour un appel d'agent voice
    v_metrics := jsonb_build_object(
        'minutes_used', p_minutes_used,
        'stt_minutes', p_minutes_used,
        'tts_minutes', p_minutes_used * 0.8, -- Un peu moins de TTS que STT
        'llm_tokens', p_tokens_used,
        'call_quality', 'good',
        'session_duration', p_minutes_used * 60
    );
    
    -- Logger l'événement
    SELECT log_usage_event(
        'agent',
        p_agent_id,
        'agent_call_end',
        v_metrics,
        gen_random_uuid()::TEXT, -- session_id
        gen_random_uuid()::TEXT  -- call_id
    ) INTO v_event_id;
    
    RETURN v_event_id;
END;
$$ LANGUAGE plpgsql;
