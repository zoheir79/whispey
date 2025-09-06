-- ===================================
-- MIGRATION: Infrastructure Crédits et Cycles de Facturation
-- Version: 1.0
-- Date: 2025-01-06
-- ===================================

BEGIN;

-- ========================================
-- 1. EXTENSION DES TABLES EXISTANTES
-- ========================================

-- Étendre monthly_consumption pour KB et Workflow
ALTER TABLE monthly_consumption 
ADD COLUMN IF NOT EXISTS kb_storage_gb DECIMAL(10,4) DEFAULT 0,
ADD COLUMN IF NOT EXISTS kb_storage_cost DECIMAL(10,4) DEFAULT 0,
ADD COLUMN IF NOT EXISTS kb_search_tokens INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS kb_search_cost DECIMAL(10,4) DEFAULT 0,
ADD COLUMN IF NOT EXISTS kb_embedding_tokens INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS kb_embedding_cost DECIMAL(10,4) DEFAULT 0,
ADD COLUMN IF NOT EXISTS workflow_operations INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS workflow_cost DECIMAL(10,4) DEFAULT 0,
ADD COLUMN IF NOT EXISTS workflow_execution_minutes DECIMAL(10,4) DEFAULT 0;

-- Commentaires pour documentation
COMMENT ON COLUMN monthly_consumption.kb_storage_gb IS 'Stockage vectoriel KB en GB pour le mois';
COMMENT ON COLUMN monthly_consumption.kb_storage_cost IS 'Cout stockage KB mensuel';
COMMENT ON COLUMN monthly_consumption.kb_search_tokens IS 'Tokens utilises pour recherches KB';
COMMENT ON COLUMN monthly_consumption.kb_search_cost IS 'Cout recherches KB';
COMMENT ON COLUMN monthly_consumption.kb_embedding_tokens IS 'Tokens utilises pour creation embeddings';
COMMENT ON COLUMN monthly_consumption.kb_embedding_cost IS 'Cout creation embeddings (one-shot)';
COMMENT ON COLUMN monthly_consumption.workflow_operations IS 'Nombre operations workflow executees';
COMMENT ON COLUMN monthly_consumption.workflow_cost IS 'Cout total workflow pour le mois';
COMMENT ON COLUMN monthly_consumption.workflow_execution_minutes IS 'Minutes execution workflow';

-- ========================================
-- 2. TABLE GESTION DES CREDITS UTILISATEUR
-- ========================================

CREATE TABLE IF NOT EXISTS user_credits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES pype_voice_projects(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES pype_voice_users(user_id) ON DELETE CASCADE,
    
    -- Balance et configuration
    current_balance DECIMAL(10,4) DEFAULT 0 CHECK (current_balance >= 0),
    currency VARCHAR(3) DEFAULT 'USD' CHECK (currency IN ('USD', 'EUR', 'GBP')),
    credit_limit DECIMAL(10,4) DEFAULT 1000 CHECK (credit_limit > 0),
    low_balance_threshold DECIMAL(10,4) DEFAULT 50 CHECK (low_balance_threshold >= 0),
    
    -- Recharge automatique
    auto_recharge_enabled BOOLEAN DEFAULT false,
    auto_recharge_amount DECIMAL(10,4) DEFAULT 100 CHECK (auto_recharge_amount > 0),
    auto_recharge_threshold DECIMAL(10,4) DEFAULT 20 CHECK (auto_recharge_threshold >= 0),
    
    -- Statut et contrôle
    is_active BOOLEAN DEFAULT true,
    is_suspended BOOLEAN DEFAULT false,
    suspension_reason TEXT,
    
    -- Audit
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID REFERENCES pype_voice_users(user_id),
    
    -- Contraintes
    UNIQUE(workspace_id, user_id),
    CHECK (auto_recharge_threshold < auto_recharge_amount)
);

-- Index pour performance
CREATE INDEX IF NOT EXISTS idx_user_credits_workspace_id ON user_credits(workspace_id);
CREATE INDEX IF NOT EXISTS idx_user_credits_user_id ON user_credits(user_id);
CREATE INDEX IF NOT EXISTS idx_user_credits_balance ON user_credits(current_balance);
CREATE INDEX IF NOT EXISTS idx_user_credits_active ON user_credits(is_active, is_suspended);

-- Commentaires
COMMENT ON TABLE user_credits IS 'Gestion des credits utilisateur par workspace';
COMMENT ON COLUMN user_credits.current_balance IS 'Balance actuelle en credits';
COMMENT ON COLUMN user_credits.credit_limit IS 'Limite maximale de credits autorisee';
COMMENT ON COLUMN user_credits.low_balance_threshold IS 'Seuil alerte balance faible';

-- ========================================
-- 3. TABLE CYCLES DE FACTURATION UNIFIEE
-- ========================================

CREATE TABLE IF NOT EXISTS billing_cycles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Identification du service
    service_type VARCHAR(50) NOT NULL CHECK (service_type IN ('agent', 'knowledge_base', 'workflow', 'workspace')),
    service_id UUID NOT NULL,
    workspace_id UUID NOT NULL REFERENCES pype_voice_projects(id) ON DELETE CASCADE,
    
    -- Configuration du cycle
    cycle_type VARCHAR(20) DEFAULT 'monthly' CHECK (cycle_type IN ('monthly', 'quarterly', 'yearly')),
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    
    -- Période (pour faciliter les requêtes)
    period_year INTEGER NOT NULL,
    period_month INTEGER CHECK (period_month BETWEEN 1 AND 12),
    period_quarter INTEGER CHECK (period_quarter BETWEEN 1 AND 4),
    
    -- Statut du cycle
    status VARCHAR(20) DEFAULT 'current' CHECK (status IN ('current', 'consumed', 'invoiced', 'cancelled')),
    
    -- Coûts
    estimated_cost DECIMAL(10,4) DEFAULT 0 CHECK (estimated_cost >= 0),
    actual_cost DECIMAL(10,4) DEFAULT 0 CHECK (actual_cost >= 0),
    fixed_cost DECIMAL(10,4) DEFAULT 0 CHECK (fixed_cost >= 0),
    pag_cost DECIMAL(10,4) DEFAULT 0 CHECK (pag_cost >= 0),
    prorated_cost DECIMAL(10,4) DEFAULT 0 CHECK (prorated_cost >= 0),
    
    -- Facturation
    invoiced BOOLEAN DEFAULT false,
    invoice_id UUID,
    invoice_date TIMESTAMP WITH TIME ZONE,
    
    -- Métadonnées
    usage_data JSONB DEFAULT '{}',
    notes TEXT,
    
    -- Audit
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID REFERENCES pype_voice_users(user_id),
    
    -- Contraintes
    CHECK (end_date > start_date),
    CHECK (actual_cost >= fixed_cost + pag_cost),
    UNIQUE(service_type, service_id, start_date)
);

-- Index pour performance
CREATE INDEX IF NOT EXISTS idx_billing_cycles_service ON billing_cycles(service_type, service_id);
CREATE INDEX IF NOT EXISTS idx_billing_cycles_workspace ON billing_cycles(workspace_id);
CREATE INDEX IF NOT EXISTS idx_billing_cycles_status ON billing_cycles(status);
CREATE INDEX IF NOT EXISTS idx_billing_cycles_period ON billing_cycles(period_year, period_month);
CREATE INDEX IF NOT EXISTS idx_billing_cycles_dates ON billing_cycles(start_date, end_date);

-- Commentaires
COMMENT ON TABLE billing_cycles IS 'Cycles de facturation pour tous les services (agent, KB, workflow, workspace)';
COMMENT ON COLUMN billing_cycles.service_type IS 'Type de service: agent, knowledge_base, workflow, workspace';
COMMENT ON COLUMN billing_cycles.service_id IS 'ID du service (agent_id, kb_id, workflow_id, workspace_id)';
COMMENT ON COLUMN billing_cycles.fixed_cost IS 'Couts fixes (dedicated, subscription)';
COMMENT ON COLUMN billing_cycles.pag_cost IS 'Couts variables (pay-as-you-go)';
COMMENT ON COLUMN billing_cycles.prorated_cost IS 'Couts prorates pour cycles partiels';

-- ========================================
-- 4. TABLE TRANSACTIONS CREDITS
-- ========================================

CREATE TABLE IF NOT EXISTS credit_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- References
    workspace_id UUID REFERENCES pype_voice_projects(id) ON DELETE CASCADE,
    user_id UUID REFERENCES pype_voice_users(user_id) ON DELETE CASCADE,
    credits_id UUID REFERENCES user_credits(id) ON DELETE CASCADE,
    
    -- Type et montant
    transaction_type VARCHAR(50) NOT NULL CHECK (transaction_type IN ('deduction', 'recharge', 'refund', 'adjustment', 'suspension')),
    amount DECIMAL(10,4) NOT NULL CHECK (amount != 0),
    previous_balance DECIMAL(10,4) NOT NULL CHECK (previous_balance >= 0),
    new_balance DECIMAL(10,4) NOT NULL CHECK (new_balance >= 0),
    
    -- Reference au service/action
    service_type VARCHAR(50) CHECK (service_type IN ('agent', 'knowledge_base', 'workflow', 'workspace', 'call', 'system')),
    service_id UUID,
    billing_cycle_id UUID REFERENCES billing_cycles(id),
    call_log_id UUID REFERENCES pype_voice_call_logs(id),
    
    -- Description et metadonnees
    description TEXT NOT NULL,
    metadata JSONB DEFAULT '{}',
    
    -- Statut
    status VARCHAR(20) DEFAULT 'completed' CHECK (status IN ('pending', 'completed', 'failed', 'cancelled')),
    failure_reason TEXT,
    
    -- Audit
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    processed_at TIMESTAMP WITH TIME ZONE,
    created_by UUID REFERENCES pype_voice_users(user_id),
    
    -- Contraintes logiques
    CHECK (
        (transaction_type = 'deduction' AND amount < 0) OR
        (transaction_type IN ('recharge', 'refund', 'adjustment') AND amount > 0)
    )
);

-- Index pour performance et audit
CREATE INDEX IF NOT EXISTS idx_credit_transactions_credits ON credit_transactions(credits_id);
CREATE INDEX IF NOT EXISTS idx_credit_transactions_workspace ON credit_transactions(workspace_id);
CREATE INDEX IF NOT EXISTS idx_credit_transactions_type ON credit_transactions(transaction_type);
CREATE INDEX IF NOT EXISTS idx_credit_transactions_service ON credit_transactions(service_type, service_id);
CREATE INDEX IF NOT EXISTS idx_credit_transactions_date ON credit_transactions(created_at);
CREATE INDEX IF NOT EXISTS idx_credit_transactions_call ON credit_transactions(call_log_id);

-- Commentaires
COMMENT ON TABLE credit_transactions IS 'Historique des transactions de credits utilisateur';
COMMENT ON COLUMN credit_transactions.transaction_type IS 'Type: deduction (negatif), recharge/refund (positif)';
COMMENT ON COLUMN credit_transactions.amount IS 'Montant: negatif pour deduction, positif pour recharge';
COMMENT ON COLUMN credit_transactions.service_type IS 'Type de service origine de la transaction';

-- ========================================
-- 5. TABLE ALERTES ET NOTIFICATIONS
-- ========================================

CREATE TABLE IF NOT EXISTS credit_alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- References
    workspace_id UUID NOT NULL REFERENCES pype_voice_projects(id) ON DELETE CASCADE,
    user_id UUID REFERENCES pype_voice_users(user_id) ON DELETE CASCADE,
    credits_id UUID REFERENCES user_credits(id) ON DELETE CASCADE,
    
    -- Type alerte
    alert_type VARCHAR(50) NOT NULL CHECK (alert_type IN ('low_balance', 'service_suspended', 'auto_recharge', 'billing_cycle_end', 'payment_failed')),
    severity VARCHAR(20) DEFAULT 'warning' CHECK (severity IN ('info', 'warning', 'critical')),
    
    -- Contenu
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    
    -- Statut
    is_read BOOLEAN DEFAULT false,
    is_dismissed BOOLEAN DEFAULT false,
    
    -- Metadonnees
    alert_data JSONB DEFAULT '{}',
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    read_at TIMESTAMP WITH TIME ZONE,
    dismissed_at TIMESTAMP WITH TIME ZONE
);

-- Index pour performance
CREATE INDEX IF NOT EXISTS idx_credit_alerts_workspace ON credit_alerts(workspace_id);
CREATE INDEX IF NOT EXISTS idx_credit_alerts_user ON credit_alerts(user_id);
CREATE INDEX IF NOT EXISTS idx_credit_alerts_type ON credit_alerts(alert_type, severity);
CREATE INDEX IF NOT EXISTS idx_credit_alerts_unread ON credit_alerts(is_read, is_dismissed);
CREATE INDEX IF NOT EXISTS idx_credit_alerts_date ON credit_alerts(created_at);

-- Commentaires
COMMENT ON TABLE credit_alerts IS 'Systeme alertes pour la gestion des credits';
COMMENT ON COLUMN credit_alerts.alert_type IS 'Type alerte: low_balance, service_suspended, etc.';
COMMENT ON COLUMN credit_alerts.severity IS 'Niveau de severite: info, warning, critical';

-- ========================================
-- 6. TRIGGERS POUR UPDATED_AT
-- ========================================

-- Fonction generique pour updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers pour toutes les tables avec updated_at (idempotent)
DROP TRIGGER IF EXISTS update_user_credits_updated_at ON user_credits;
CREATE TRIGGER update_user_credits_updated_at
    BEFORE UPDATE ON user_credits
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_billing_cycles_updated_at ON billing_cycles;
CREATE TRIGGER update_billing_cycles_updated_at
    BEFORE UPDATE ON billing_cycles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ========================================
-- 7. POLITIQUES RLS (Row Level Security)
-- ========================================

-- Activer RLS sur toutes les nouvelles tables
ALTER TABLE user_credits ENABLE ROW LEVEL SECURITY;
ALTER TABLE billing_cycles ENABLE ROW LEVEL SECURITY;
ALTER TABLE credit_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE credit_alerts ENABLE ROW LEVEL SECURITY;

-- Politique pour user_credits: utilisateurs voient seulement leurs workspaces (idempotent)
DROP POLICY IF EXISTS user_credits_workspace_policy ON user_credits;
CREATE POLICY user_credits_workspace_policy ON user_credits
    FOR ALL
    USING (
        workspace_id IN (
            SELECT DISTINCT epm.project_id 
            FROM pype_voice_email_project_mapping epm
            INNER JOIN pype_voice_users u ON u.email = epm.email
            WHERE u.user_id = current_setting('app.current_user_id')::uuid 
            AND epm.is_active = true
        )
        OR EXISTS (
            SELECT 1 FROM pype_voice_users 
            WHERE user_id = current_setting('app.current_user_id')::uuid 
            AND global_role IN ('admin', 'super_admin')
        )
    );

-- Politique pour billing_cycles: même logique workspace (idempotent)
DROP POLICY IF EXISTS billing_cycles_workspace_policy ON billing_cycles;
CREATE POLICY billing_cycles_workspace_policy ON billing_cycles
    FOR ALL
    USING (
        workspace_id IN (
            SELECT DISTINCT epm.project_id 
            FROM pype_voice_email_project_mapping epm
            INNER JOIN pype_voice_users u ON u.email = epm.email
            WHERE u.user_id = current_setting('app.current_user_id')::uuid 
            AND epm.is_active = true
        )
        OR EXISTS (
            SELECT 1 FROM pype_voice_users 
            WHERE user_id = current_setting('app.current_user_id')::uuid 
            AND global_role IN ('admin', 'super_admin')
        )
    );

-- Politique pour credit_transactions: même logique workspace (idempotent)
DROP POLICY IF EXISTS credit_transactions_workspace_policy ON credit_transactions;
CREATE POLICY credit_transactions_workspace_policy ON credit_transactions
    FOR ALL
    USING (
        workspace_id IN (
            SELECT DISTINCT epm.project_id 
            FROM pype_voice_email_project_mapping epm
            INNER JOIN pype_voice_users u ON u.email = epm.email
            WHERE u.user_id = current_setting('app.current_user_id')::uuid 
            AND epm.is_active = true
        )
        OR EXISTS (
            SELECT 1 FROM pype_voice_users 
            WHERE user_id = current_setting('app.current_user_id')::uuid 
            AND global_role IN ('admin', 'super_admin')
        )
    );

-- Politique pour credit_alerts: même logique workspace (idempotent)
DROP POLICY IF EXISTS credit_alerts_workspace_policy ON credit_alerts;
CREATE POLICY credit_alerts_workspace_policy ON credit_alerts
    FOR ALL
    USING (
        workspace_id IN (
            SELECT DISTINCT epm.project_id 
            FROM pype_voice_email_project_mapping epm
            INNER JOIN pype_voice_users u ON u.email = epm.email
            WHERE u.user_id = current_setting('app.current_user_id')::uuid 
            AND epm.is_active = true
        )
        OR EXISTS (
            SELECT 1 FROM pype_voice_users 
            WHERE user_id = current_setting('app.current_user_id')::uuid 
            AND global_role IN ('admin', 'super_admin')
        )
    );

COMMIT;

-- ========================================
-- 8. VÉRIFICATION POST-MIGRATION
-- ========================================

-- Vérifier que les tables ont été créées
DO $$
BEGIN
    -- Vérifier user_credits
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'user_credits') THEN
        RAISE EXCEPTION 'Table user_credits not created';
    END IF;
    
    -- Vérifier billing_cycles
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'billing_cycles') THEN
        RAISE EXCEPTION 'Table billing_cycles not created';
    END IF;
    
    -- Vérifier credit_transactions
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'credit_transactions') THEN
        RAISE EXCEPTION 'Table credit_transactions not created';
    END IF;
    
    -- Vérifier credit_alerts
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'credit_alerts') THEN
        RAISE EXCEPTION 'Table credit_alerts not created';
    END IF;
    
    -- Vérifier extensions monthly_consumption
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'monthly_consumption' 
        AND column_name = 'kb_storage_gb'
    ) THEN
        RAISE EXCEPTION 'Column kb_storage_gb not added to monthly_consumption';
    END IF;
    
    RAISE NOTICE 'Migration des tables credits et facturation reussie';
    RAISE NOTICE 'Tables creees: user_credits, billing_cycles, credit_transactions, credit_alerts';
    RAISE NOTICE 'Extensions ajoutees a monthly_consumption';
    RAISE NOTICE 'Indexes et contraintes appliques';
    RAISE NOTICE 'Politiques RLS configurees';
END $$;
