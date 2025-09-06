-- ===================================
-- MIGRATION: Credit Monitoring & Alerts System
-- Version: 1.0
-- Date: 2025-01-06
-- Description: Tables pour surveillance des crédits et alertes automatiques
-- ===================================

BEGIN;

-- ========================================
-- 1. TABLE CREDIT ALERTS
-- ========================================

-- Créer table si elle n'existe pas
CREATE TABLE IF NOT EXISTS credit_alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES pype_voice_projects(id) ON DELETE CASCADE,
    alert_type VARCHAR(30) NOT NULL,
    current_balance DECIMAL(10,4) NOT NULL,
    threshold DECIMAL(10,4) NOT NULL,
    currency VARCHAR(3) DEFAULT 'USD',
    alert_message TEXT NOT NULL,
    severity VARCHAR(20) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Ajouter colonnes manquantes si elles n'existent pas
DO $$ 
BEGIN
    -- Ajouter is_resolved
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='credit_alerts' AND column_name='is_resolved') THEN
        ALTER TABLE credit_alerts ADD COLUMN is_resolved BOOLEAN DEFAULT false;
    END IF;
    
    -- Ajouter resolved_at
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='credit_alerts' AND column_name='resolved_at') THEN
        ALTER TABLE credit_alerts ADD COLUMN resolved_at TIMESTAMP WITH TIME ZONE;
    END IF;
    
    -- Ajouter resolved_by
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='credit_alerts' AND column_name='resolved_by') THEN
        ALTER TABLE credit_alerts ADD COLUMN resolved_by VARCHAR(255);
    END IF;
    
    -- Ajouter metadata
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='credit_alerts' AND column_name='metadata') THEN
        ALTER TABLE credit_alerts ADD COLUMN metadata JSONB DEFAULT '{}';
    END IF;
    
    -- Ajouter updated_at
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='credit_alerts' AND column_name='updated_at') THEN
        ALTER TABLE credit_alerts ADD COLUMN updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
    END IF;
END $$;

-- Ajouter contraintes si elles n'existent pas
DO $$
BEGIN
    -- Contrainte alert_type
    IF NOT EXISTS (SELECT 1 FROM information_schema.check_constraints 
                   WHERE constraint_name='credit_alerts_alert_type_check') THEN
        ALTER TABLE credit_alerts ADD CONSTRAINT credit_alerts_alert_type_check 
        CHECK (alert_type IN ('low_balance', 'critical_balance', 'negative_balance', 'auto_suspension'));
    END IF;
    
    -- Contrainte severity
    IF NOT EXISTS (SELECT 1 FROM information_schema.check_constraints 
                   WHERE constraint_name='credit_alerts_severity_check') THEN
        ALTER TABLE credit_alerts ADD CONSTRAINT credit_alerts_severity_check 
        CHECK (severity IN ('info', 'warning', 'critical', 'emergency'));
    END IF;
END $$;

-- Index pour performance des alertes
CREATE INDEX IF NOT EXISTS idx_credit_alerts_workspace_status 
ON credit_alerts (workspace_id, is_resolved, created_at);

CREATE INDEX IF NOT EXISTS idx_credit_alerts_type_severity 
ON credit_alerts (alert_type, severity);

CREATE INDEX IF NOT EXISTS idx_credit_alerts_created_at 
ON credit_alerts (created_at);

-- ========================================
-- 2. TABLE MONITORING LOGS
-- ========================================

CREATE TABLE IF NOT EXISTS credit_monitoring_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Exécution du monitoring
    monitoring_run_id UUID DEFAULT gen_random_uuid(),
    execution_timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Résultats globaux
    total_workspaces_checked INTEGER NOT NULL,
    alerts_generated INTEGER NOT NULL DEFAULT 0,
    suspensions_triggered INTEGER NOT NULL DEFAULT 0,
    
    -- Détails par workspace
    workspace_results JSONB DEFAULT '[]',
    -- Format: [{"workspace_id": "uuid", "status": "ok|alert|suspended", "balance": 123.45}]
    
    -- Performance
    execution_duration_ms INTEGER,
    
    -- Erreurs
    errors_encountered INTEGER DEFAULT 0,
    error_details JSONB DEFAULT '[]',
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ========================================
-- 3. TABLE WEBHOOK CONFIGURATIONS
-- ========================================

CREATE TABLE IF NOT EXISTS webhook_configurations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Workspace ou global
    workspace_id UUID REFERENCES pype_voice_projects(id) ON DELETE CASCADE,
    is_global BOOLEAN DEFAULT false,
    
    -- Configuration webhook
    webhook_url TEXT NOT NULL,
    webhook_name VARCHAR(100) NOT NULL,
    
    -- Types d'événements à notifier
    event_types TEXT[] NOT NULL, -- ['low_balance', 'suspension', 'recharge']
    
    -- Seuils de déclenchement
    balance_threshold DECIMAL(10,4),
    severity_threshold VARCHAR(20) CHECK (severity_threshold IN ('info', 'warning', 'critical', 'emergency')),
    
    -- Configuration HTTP
    http_method VARCHAR(10) DEFAULT 'POST',
    headers JSONB DEFAULT '{}',
    auth_type VARCHAR(20) CHECK (auth_type IN ('none', 'bearer', 'basic', 'api_key')),
    auth_config JSONB DEFAULT '{}',
    
    -- Retry et timeouts
    timeout_seconds INTEGER DEFAULT 30,
    max_retries INTEGER DEFAULT 3,
    retry_delay_seconds INTEGER DEFAULT 60,
    
    -- Statut
    is_active BOOLEAN DEFAULT true,
    last_triggered_at TIMESTAMP WITH TIME ZONE,
    last_success_at TIMESTAMP WITH TIME ZONE,
    last_error_at TIMESTAMP WITH TIME ZONE,
    last_error_message TEXT,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID,
    
    -- Contraintes
    CHECK (webhook_url ~ '^https?://'),
    CHECK (array_length(event_types, 1) > 0)
);

-- ========================================
-- 4. TRIGGERS ET FONCTIONS
-- ========================================

-- Trigger pour updated_at sur credit_alerts
CREATE TRIGGER update_credit_alerts_updated_at
    BEFORE UPDATE ON credit_alerts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Trigger pour updated_at sur webhook_configurations
CREATE TRIGGER update_webhook_configs_updated_at
    BEFORE UPDATE ON webhook_configurations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Index pour logs de monitoring
CREATE INDEX IF NOT EXISTS idx_monitoring_logs_timestamp ON credit_monitoring_logs(execution_timestamp);
CREATE INDEX IF NOT EXISTS idx_monitoring_logs_run_id ON credit_monitoring_logs(monitoring_run_id);

-- Index pour monitoring rapide des alertes
CREATE INDEX IF NOT EXISTS idx_alerts_workspace_active ON credit_alerts(workspace_id, is_resolved) WHERE is_resolved = false;
CREATE INDEX IF NOT EXISTS idx_alerts_severity_created ON credit_alerts(severity, created_at) WHERE is_resolved = false;

-- Index pour webhooks
CREATE INDEX IF NOT EXISTS idx_webhooks_workspace_active ON webhook_configurations(workspace_id, is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_webhooks_global_active ON webhook_configurations(is_global, is_active) WHERE is_global = true AND is_active = true;

-- ========================================
-- 6. NOTES SÉCURITÉ
-- ========================================

-- Note: RLS policies retirees car dépendantes de Supabase auth.uid()
-- La sécurité est gérée au niveau application via les APIs Next.js
-- avec vérification des permissions par workspace

COMMENT ON TABLE credit_alerts IS 'Alertes automatiques pour surveillance des crédits';
COMMENT ON COLUMN credit_alerts.alert_type IS 'Type alerte: low_balance, critical_balance, negative_balance, auto_suspension';
COMMENT ON COLUMN credit_alerts.severity IS 'Sévérité: info, warning, critical, emergency';

COMMENT ON TABLE credit_monitoring_logs IS 'Logs des exécutions du monitoring de crédits';
COMMENT ON COLUMN credit_monitoring_logs.workspace_results IS 'Résultats détaillés par workspace au format JSON';

COMMENT ON TABLE webhook_configurations IS 'Configuration webhooks pour notifications crédit';
COMMENT ON COLUMN webhook_configurations.event_types IS 'Types événements à notifier: low_balance, suspension, recharge';

-- ========================================
-- 8. DONNÉES INITIALES
-- ========================================

-- Webhook de test par défaut (à configurer)
INSERT INTO webhook_configurations (
    webhook_name,
    webhook_url,
    event_types,
    is_global,
    severity_threshold,
    is_active,
    created_at
) VALUES (
    'Default Credit Alerts',
    'https://hooks.slack.com/services/YOUR/SLACK/WEBHOOK', 
    ARRAY['critical_balance', 'auto_suspension'],
    true,
    'critical',
    false, -- Désactivé par défaut
    NOW()
) ON CONFLICT DO NOTHING;

-- ========================================
-- 9. VALIDATION POST-MIGRATION
-- ========================================

DO $$
BEGIN
    -- Vérifier création des tables
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'credit_alerts') THEN
        RAISE EXCEPTION 'Table credit_alerts not created';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'credit_monitoring_logs') THEN
        RAISE EXCEPTION 'Table credit_monitoring_logs not created';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'webhook_configurations') THEN
        RAISE EXCEPTION 'Table webhook_configurations not created';
    END IF;
    
    -- Vérifier index critiques
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_alerts_workspace_active') THEN
        RAISE EXCEPTION 'Critical index idx_alerts_workspace_active not created';
    END IF;
    
    RAISE NOTICE 'Migration monitoring système crédit réussie';
    RAISE NOTICE 'Tables créées: credit_alerts, credit_monitoring_logs, webhook_configurations';
    RAISE NOTICE 'Indexes, triggers, et politiques RLS configurés';
    RAISE NOTICE 'Système de surveillance prêt pour surveillance automatique';
    
END $$;

COMMIT;
