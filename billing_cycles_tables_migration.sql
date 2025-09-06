-- Migration pour créer les tables de cycles de facturation
-- Gère les cycles de facturation pour agents, KB, workflows et workspaces

-- Table des cycles de facturation pour les agents
CREATE TABLE IF NOT EXISTS agent_billing_cycles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id UUID NOT NULL REFERENCES pype_voice_agents(id) ON DELETE CASCADE,
    workspace_id UUID NOT NULL REFERENCES pype_voice_projects(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES pype_voice_users(user_id) ON DELETE CASCADE,
    
    -- Configuration de facturation
    billing_mode TEXT NOT NULL CHECK (billing_mode IN ('dedicated', 'pag', 'hybrid', 'subscription')),
    billing_cycle TEXT NOT NULL CHECK (billing_cycle IN ('monthly', 'quarterly', 'annual')),
    
    -- Prix et coûts
    fixed_cost DECIMAL(10,2) DEFAULT 0,
    usage_cost DECIMAL(10,2) DEFAULT 0,
    total_cost DECIMAL(10,2) GENERATED ALWAYS AS (fixed_cost + usage_cost) STORED,
    
    -- Période de facturation
    billing_period_start TIMESTAMP WITH TIME ZONE NOT NULL,
    billing_period_end TIMESTAMP WITH TIME ZONE NOT NULL,
    next_billing_date TIMESTAMP WITH TIME ZONE NOT NULL,
    
    -- Status et métadonnées
    is_active BOOLEAN DEFAULT true,
    is_paid BOOLEAN DEFAULT false,
    is_suspended BOOLEAN DEFAULT false,
    
    -- Configuration JSON pour overrides et settings spécifiques
    config_json JSONB DEFAULT '{}',
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_billed_at TIMESTAMP WITH TIME ZONE,
    
    -- Index composé pour optimiser les requêtes
    UNIQUE(agent_id, billing_period_start)
);

-- Table des cycles de facturation pour les knowledge bases
CREATE TABLE IF NOT EXISTS kb_billing_cycles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    kb_id UUID NOT NULL REFERENCES pype_voice_knowledge_bases(id) ON DELETE CASCADE,
    workspace_id UUID NOT NULL REFERENCES pype_voice_projects(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES pype_voice_users(user_id) ON DELETE CASCADE,
    
    -- Configuration de facturation
    billing_mode TEXT NOT NULL CHECK (billing_mode IN ('fixed', 'pag')),
    billing_cycle TEXT NOT NULL CHECK (billing_cycle IN ('monthly', 'quarterly', 'annual')),
    
    -- Prix et coûts
    fixed_cost DECIMAL(10,2) DEFAULT 0,
    usage_cost DECIMAL(10,2) DEFAULT 0,
    query_count INTEGER DEFAULT 0,
    upload_mb DECIMAL(10,3) DEFAULT 0,
    total_cost DECIMAL(10,2) GENERATED ALWAYS AS (fixed_cost + usage_cost) STORED,
    
    -- Période de facturation
    billing_period_start TIMESTAMP WITH TIME ZONE NOT NULL,
    billing_period_end TIMESTAMP WITH TIME ZONE NOT NULL,
    next_billing_date TIMESTAMP WITH TIME ZONE NOT NULL,
    
    -- Status et métadonnées
    is_active BOOLEAN DEFAULT true,
    is_paid BOOLEAN DEFAULT false,
    is_suspended BOOLEAN DEFAULT false,
    
    -- Configuration JSON pour overrides de prix PAG
    pricing_overrides JSONB DEFAULT '{}',
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_billed_at TIMESTAMP WITH TIME ZONE,
    
    UNIQUE(kb_id, billing_period_start)
);

-- Table des cycles de facturation pour les workflows
CREATE TABLE IF NOT EXISTS workflow_billing_cycles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workflow_id UUID NOT NULL REFERENCES pype_voice_workflows(id) ON DELETE CASCADE,
    workspace_id UUID NOT NULL REFERENCES pype_voice_projects(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES pype_voice_users(user_id) ON DELETE CASCADE,
    
    -- Configuration de facturation
    billing_mode TEXT NOT NULL CHECK (billing_mode IN ('fixed', 'pag')),
    billing_cycle TEXT NOT NULL CHECK (billing_cycle IN ('monthly', 'quarterly', 'annual')),
    
    -- Prix et coûts
    fixed_cost DECIMAL(10,2) DEFAULT 0,
    usage_cost DECIMAL(10,2) DEFAULT 0,
    execution_count INTEGER DEFAULT 0,
    cpu_minutes DECIMAL(10,3) DEFAULT 0,
    total_cost DECIMAL(10,2) GENERATED ALWAYS AS (fixed_cost + usage_cost) STORED,
    
    -- Période de facturation
    billing_period_start TIMESTAMP WITH TIME ZONE NOT NULL,
    billing_period_end TIMESTAMP WITH TIME ZONE NOT NULL,
    next_billing_date TIMESTAMP WITH TIME ZONE NOT NULL,
    
    -- Status et métadonnées
    is_active BOOLEAN DEFAULT true,
    is_paid BOOLEAN DEFAULT false,
    is_suspended BOOLEAN DEFAULT false,
    
    -- Configuration JSON pour overrides de prix PAG
    pricing_overrides JSONB DEFAULT '{}',
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_billed_at TIMESTAMP WITH TIME ZONE,
    
    UNIQUE(workflow_id, billing_period_start)
);

-- Table des cycles de facturation pour les workspaces (S3, stockage général)
CREATE TABLE IF NOT EXISTS workspace_billing_cycles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES pype_voice_projects(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES pype_voice_users(user_id) ON DELETE CASCADE,
    
    -- Configuration de facturation
    billing_cycle TEXT NOT NULL CHECK (billing_cycle IN ('monthly', 'quarterly', 'annual')),
    
    -- Coûts S3 et stockage
    s3_storage_cost DECIMAL(10,2) DEFAULT 0,
    s3_requests_cost DECIMAL(10,2) DEFAULT 0,
    s3_transfer_cost DECIMAL(10,2) DEFAULT 0,
    s3_total_cost DECIMAL(10,2) GENERATED ALWAYS AS (s3_storage_cost + s3_requests_cost + s3_transfer_cost) STORED,
    
    -- Usage S3
    s3_storage_gb DECIMAL(10,3) DEFAULT 0,
    s3_requests_count INTEGER DEFAULT 0,
    s3_transfer_gb DECIMAL(10,3) DEFAULT 0,
    
    -- Période de facturation
    billing_period_start TIMESTAMP WITH TIME ZONE NOT NULL,
    billing_period_end TIMESTAMP WITH TIME ZONE NOT NULL,
    next_billing_date TIMESTAMP WITH TIME ZONE NOT NULL,
    
    -- Status et métadonnées
    is_active BOOLEAN DEFAULT true,
    is_paid BOOLEAN DEFAULT false,
    is_suspended BOOLEAN DEFAULT false,
    
    -- Configuration JSON pour pricing overrides S3
    s3_pricing_overrides JSONB DEFAULT '{}',
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_billed_at TIMESTAMP WITH TIME ZONE,
    
    UNIQUE(workspace_id, billing_period_start)
);

-- Table consolidée des factures (récapitulatif mensuel/trimestriel/annuel)
CREATE TABLE IF NOT EXISTS billing_invoices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES pype_voice_projects(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES pype_voice_users(user_id) ON DELETE CASCADE,
    
    -- Période de facturation
    billing_period_start TIMESTAMP WITH TIME ZONE NOT NULL,
    billing_period_end TIMESTAMP WITH TIME ZONE NOT NULL,
    billing_cycle TEXT NOT NULL CHECK (billing_cycle IN ('monthly', 'quarterly', 'annual')),
    
    -- Coûts détaillés
    agents_cost DECIMAL(10,2) DEFAULT 0,
    kb_cost DECIMAL(10,2) DEFAULT 0,
    workflows_cost DECIMAL(10,2) DEFAULT 0,
    workspace_cost DECIMAL(10,2) DEFAULT 0,
    total_cost DECIMAL(10,2) GENERATED ALWAYS AS (agents_cost + kb_cost + workflows_cost + workspace_cost) STORED,
    
    -- Status de paiement
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'overdue', 'cancelled')),
    payment_date TIMESTAMP WITH TIME ZONE,
    due_date TIMESTAMP WITH TIME ZONE NOT NULL,
    
    -- Métadonnées
    invoice_number TEXT UNIQUE NOT NULL,
    notes TEXT,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(workspace_id, billing_period_start, billing_cycle)
);

-- Index pour optimiser les performances
CREATE INDEX IF NOT EXISTS idx_agent_billing_cycles_workspace_active 
ON agent_billing_cycles(workspace_id, is_active) 
WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_agent_billing_cycles_next_billing 
ON agent_billing_cycles(next_billing_date) 
WHERE is_active = true AND is_paid = false;

CREATE INDEX IF NOT EXISTS idx_kb_billing_cycles_workspace_active 
ON kb_billing_cycles(workspace_id, is_active) 
WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_kb_billing_cycles_next_billing 
ON kb_billing_cycles(next_billing_date) 
WHERE is_active = true AND is_paid = false;

CREATE INDEX IF NOT EXISTS idx_workflow_billing_cycles_workspace_active 
ON workflow_billing_cycles(workspace_id, is_active) 
WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_workflow_billing_cycles_next_billing 
ON workflow_billing_cycles(next_billing_date) 
WHERE is_active = true AND is_paid = false;

CREATE INDEX IF NOT EXISTS idx_workspace_billing_cycles_next_billing 
ON workspace_billing_cycles(next_billing_date) 
WHERE is_active = true AND is_paid = false;

CREATE INDEX IF NOT EXISTS idx_billing_invoices_workspace_period 
ON billing_invoices(workspace_id, period_start DESC);

CREATE INDEX IF NOT EXISTS idx_billing_invoices_due_date 
ON billing_invoices(due_date) 
WHERE status IN ('pending', 'overdue');

-- Triggers pour mettre à jour les timestamps
CREATE OR REPLACE FUNCTION update_billing_cycle_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER agent_billing_cycles_updated_at
    BEFORE UPDATE ON agent_billing_cycles
    FOR EACH ROW EXECUTE FUNCTION update_billing_cycle_timestamp();

CREATE TRIGGER kb_billing_cycles_updated_at
    BEFORE UPDATE ON kb_billing_cycles
    FOR EACH ROW EXECUTE FUNCTION update_billing_cycle_timestamp();

CREATE TRIGGER workflow_billing_cycles_updated_at
    BEFORE UPDATE ON workflow_billing_cycles
    FOR EACH ROW EXECUTE FUNCTION update_billing_cycle_timestamp();

CREATE TRIGGER workspace_billing_cycles_updated_at
    BEFORE UPDATE ON workspace_billing_cycles
    FOR EACH ROW EXECUTE FUNCTION update_billing_cycle_timestamp();

DROP TRIGGER IF EXISTS billing_invoices_updated_at ON billing_invoices;
CREATE TRIGGER billing_invoices_updated_at BEFORE UPDATE ON billing_invoices
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Fonctions utilitaires pour la gestion des cycles de facturation

-- Fonction pour créer un cycle de facturation d'agent
CREATE OR REPLACE FUNCTION create_agent_billing_cycle(
    p_agent_id UUID,
    p_billing_mode TEXT,
    p_billing_cycle TEXT,
    p_fixed_cost DECIMAL DEFAULT 0,
    p_config_json JSONB DEFAULT '{}'
)
RETURNS UUID AS $$
DECLARE
    v_workspace_id UUID;
    v_user_id UUID;
    v_cycle_id UUID;
    v_start_date TIMESTAMP WITH TIME ZONE;
    v_end_date TIMESTAMP WITH TIME ZONE;
    v_next_billing TIMESTAMP WITH TIME ZONE;
BEGIN
    -- Récupérer les informations de l'agent
    SELECT workspace_id, user_id INTO v_workspace_id, v_user_id
    FROM pype_voice_agents WHERE id = p_agent_id;
    
    IF v_workspace_id IS NULL THEN
        RAISE EXCEPTION 'Agent not found: %', p_agent_id;
    END IF;
    
    -- Calculer les dates de facturation
    v_start_date = DATE_TRUNC('month', NOW());
    
    CASE p_billing_cycle
        WHEN 'monthly' THEN
            v_end_date = v_start_date + INTERVAL '1 month' - INTERVAL '1 day';
            v_next_billing = v_start_date + INTERVAL '1 month';
        WHEN 'quarterly' THEN
            v_end_date = v_start_date + INTERVAL '3 months' - INTERVAL '1 day';
            v_next_billing = v_start_date + INTERVAL '3 months';
        WHEN 'annual' THEN
            v_end_date = v_start_date + INTERVAL '1 year' - INTERVAL '1 day';
            v_next_billing = v_start_date + INTERVAL '1 year';
    END CASE;
    
    -- Créer le cycle de facturation
    INSERT INTO agent_billing_cycles (
        agent_id, workspace_id, user_id,
        billing_mode, billing_cycle,
        fixed_cost, usage_cost,
        billing_period_start, billing_period_end, next_billing_date,
        config_json
    ) VALUES (
        p_agent_id, v_workspace_id, v_user_id,
        p_billing_mode, p_billing_cycle,
        p_fixed_cost, 0,
        v_start_date, v_end_date, v_next_billing,
        p_config_json
    ) RETURNING id INTO v_cycle_id;
    
    RETURN v_cycle_id;
END;
$$ LANGUAGE plpgsql;

-- Fonction pour calculer le prochain cycle de facturation
CREATE OR REPLACE FUNCTION calculate_next_billing_period(
    p_current_start TIMESTAMP WITH TIME ZONE,
    p_billing_cycle TEXT
)
RETURNS RECORD AS $$
DECLARE
    v_result RECORD;
    v_next_start TIMESTAMP WITH TIME ZONE;
    v_next_end TIMESTAMP WITH TIME ZONE;
    v_next_billing TIMESTAMP WITH TIME ZONE;
BEGIN
    CASE p_billing_cycle
        WHEN 'monthly' THEN
            v_next_start = p_current_start + INTERVAL '1 month';
            v_next_end = v_next_start + INTERVAL '1 month' - INTERVAL '1 day';
            v_next_billing = v_next_start + INTERVAL '1 month';
        WHEN 'quarterly' THEN
            v_next_start = p_current_start + INTERVAL '3 months';
            v_next_end = v_next_start + INTERVAL '3 months' - INTERVAL '1 day';
            v_next_billing = v_next_start + INTERVAL '3 months';
        WHEN 'annual' THEN
            v_next_start = p_current_start + INTERVAL '1 year';
            v_next_end = v_next_start + INTERVAL '1 year' - INTERVAL '1 day';
            v_next_billing = v_next_start + INTERVAL '1 year';
    END CASE;
    
    SELECT v_next_start as period_start, v_next_end as period_end, v_next_billing as next_billing
    INTO v_result;
    
    RETURN v_result;
END;
$$ LANGUAGE plpgsql;

-- Fonction pour suspendre les services d'un workspace pour crédits insuffisants
CREATE OR REPLACE FUNCTION suspend_workspace_services(p_workspace_id UUID)
RETURNS VOID AS $$
BEGIN
    -- Suspendre tous les cycles de facturation actifs
    UPDATE agent_billing_cycles 
    SET is_suspended = true, updated_at = NOW()
    WHERE workspace_id = p_workspace_id AND is_active = true;
    
    UPDATE kb_billing_cycles 
    SET is_suspended = true, updated_at = NOW()
    WHERE workspace_id = p_workspace_id AND is_active = true;
    
    UPDATE workflow_billing_cycles 
    SET is_suspended = true, updated_at = NOW()
    WHERE workspace_id = p_workspace_id AND is_active = true;
    
    UPDATE workspace_billing_cycles 
    SET is_suspended = true, updated_at = NOW()
    WHERE workspace_id = p_workspace_id AND is_active = true;
    
    -- Créer une alerte de suspension
    INSERT INTO user_credit_alerts (
        workspace_id, 
        user_id,
        alert_type,
        severity,
        message
    ) 
    SELECT 
        p_workspace_id,
        user_id,
        'service_suspended',
        'critical',
        'Services suspendus pour crédits insuffisants'
    FROM pype_voice_workspaces 
    WHERE id = p_workspace_id;
END;
$$ LANGUAGE plpgsql;

-- Fonction pour réactiver les services d'un workspace
CREATE OR REPLACE FUNCTION reactivate_workspace_services(p_workspace_id UUID)
RETURNS VOID AS $$
BEGIN
    -- Réactiver tous les cycles de facturation
    UPDATE agent_billing_cycles 
    SET is_suspended = false, updated_at = NOW()
    WHERE workspace_id = p_workspace_id AND is_active = true;
    
    UPDATE kb_billing_cycles 
    SET is_suspended = false, updated_at = NOW()
    WHERE workspace_id = p_workspace_id AND is_active = true;
    
    UPDATE workflow_billing_cycles 
    SET is_suspended = false, updated_at = NOW()
    WHERE workspace_id = p_workspace_id AND is_active = true;
    
    UPDATE workspace_billing_cycles 
    SET is_suspended = false, updated_at = NOW()
    WHERE workspace_id = p_workspace_id AND is_active = true;
END;
$$ LANGUAGE plpgsql;

-- RLS Policies pour sécuriser l'accès aux données (désactivé temporairement - à configurer avec le système d'auth)

-- Note: Les politiques RLS seront activées plus tard quand le système d'authentification sera configuré
-- Pour l'instant, on laisse les tables accessibles pour le déploiement

-- Agent billing cycles
-- ALTER TABLE agent_billing_cycles ENABLE ROW LEVEL SECURITY;

-- KB billing cycles  
-- ALTER TABLE kb_billing_cycles ENABLE ROW LEVEL SECURITY;

-- Workflow billing cycles
-- ALTER TABLE workflow_billing_cycles ENABLE ROW LEVEL SECURITY;

-- Workspace billing cycles
-- ALTER TABLE workspace_billing_cycles ENABLE ROW LEVEL SECURITY;

-- Billing invoices
-- ALTER TABLE billing_invoices ENABLE ROW LEVEL SECURITY;

-- Vues pour faciliter les requêtes

-- Vue consolidée des coûts par workspace
CREATE OR REPLACE VIEW workspace_billing_summary AS
SELECT 
    w.id as workspace_id,
    w.name as workspace_name,
    w.owner_user_id as user_id,
    
    -- Coûts agents
    COALESCE(SUM(abc.total_cost), 0) as agents_total_cost,
    COUNT(DISTINCT abc.agent_id) as active_agents_count,
    
    -- Coûts KB
    COALESCE(SUM(kbc.total_cost), 0) as kb_total_cost,
    COUNT(DISTINCT kbc.kb_id) as active_kb_count,
    
    -- Coûts workflows
    COALESCE(SUM(wfc.total_cost), 0) as workflows_total_cost,
    COUNT(DISTINCT wfc.workflow_id) as active_workflows_count,
    
    -- Coûts workspace (S3)
    COALESCE(SUM(wbc.s3_total_cost), 0) as workspace_s3_cost,
    
    -- Total général
    COALESCE(SUM(abc.total_cost), 0) + 
    COALESCE(SUM(kbc.total_cost), 0) + 
    COALESCE(SUM(wfc.total_cost), 0) + 
    COALESCE(SUM(wbc.s3_total_cost), 0) as total_monthly_cost

FROM pype_voice_projects w
LEFT JOIN agent_billing_cycles abc ON w.id = abc.workspace_id AND abc.is_active = true
LEFT JOIN kb_billing_cycles kbc ON w.id = kbc.workspace_id AND kbc.is_active = true
LEFT JOIN workflow_billing_cycles wfc ON w.id = wfc.workspace_id AND wfc.is_active = true
LEFT JOIN workspace_billing_cycles wbc ON w.id = wbc.workspace_id AND wbc.is_active = true
GROUP BY w.id, w.name, w.user_id;

-- Vue des services à facturer prochainement
CREATE OR REPLACE VIEW upcoming_billings AS
SELECT 
    'agent' as service_type,
    abc.agent_id as service_id,
    abc.workspace_id,
    abc.user_id,
    abc.billing_cycle,
    abc.next_billing_date,
    abc.total_cost as estimated_cost,
    abc.is_suspended
FROM agent_billing_cycles abc
WHERE abc.is_active = true 
AND abc.next_billing_date <= NOW() + INTERVAL '7 days'

UNION ALL

SELECT 
    'kb' as service_type,
    kbc.kb_id as service_id,
    kbc.workspace_id,
    kbc.user_id,
    kbc.billing_cycle,
    kbc.next_billing_date,
    kbc.total_cost as estimated_cost,
    kbc.is_suspended
FROM kb_billing_cycles kbc
WHERE kbc.is_active = true 
AND kbc.next_billing_date <= NOW() + INTERVAL '7 days'

UNION ALL

SELECT 
    'workflow' as service_type,
    wfc.workflow_id as service_id,
    wfc.workspace_id,
    wfc.user_id,
    wfc.billing_cycle,
    wfc.next_billing_date,
    wfc.total_cost as estimated_cost,
    wfc.is_suspended
FROM workflow_billing_cycles wfc
WHERE wfc.is_active = true 
AND wfc.next_billing_date <= NOW() + INTERVAL '7 days'

UNION ALL

SELECT 
    'workspace' as service_type,
    wbc.workspace_id as service_id,
    wbc.workspace_id,
    wbc.user_id,
    wbc.billing_cycle,
    wbc.next_billing_date,
    wbc.s3_total_cost as estimated_cost,
    wbc.is_suspended
FROM workspace_billing_cycles wbc
WHERE wbc.is_active = true 
AND wbc.next_billing_date <= NOW() + INTERVAL '7 days'

ORDER BY next_billing_date ASC;
