-- ===================================
-- MIGRATION: Système de Coûts Avancé
-- Version: 1.0
-- Date: 2025-01-06
-- Modes: injection, fixed, dynamic, hybrid
-- ===================================

BEGIN;

-- ========================================
-- 1. TABLE CONFIGURATION COÛTS AVANCÉS
-- ========================================

CREATE TABLE IF NOT EXISTS cost_configuration_advanced (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Association service
    service_type VARCHAR(20) NOT NULL CHECK (service_type IN ('agent', 'knowledge_base', 'workflow', 'workspace')),
    service_id UUID NOT NULL,
    workspace_id UUID NOT NULL REFERENCES pype_voice_projects(id) ON DELETE CASCADE,
    
    -- Mode de coût
    cost_mode VARCHAR(20) DEFAULT 'pag' CHECK (cost_mode IN ('pag', 'dedicated', 'injection', 'hybrid', 'fixed', 'dynamic')),
    
    -- Configuration injection de coûts
    injection_config JSONB DEFAULT '{}',
    -- Format: {
    --   "target_service": "agent|kb|workflow",
    --   "target_id": "uuid",
    --   "injection_ratio": 0.15,
    --   "max_injection_amount": 100.00,
    --   "injection_frequency": "per_call|daily|monthly"
    -- }
    
    -- Configuration coûts fixes
    fixed_cost_config JSONB DEFAULT '{}',
    -- Format: {
    --   "monthly_fixed": 49.99,
    --   "quarterly_fixed": 149.99,
    --   "yearly_fixed": 599.99,
    --   "activation_fee": 25.00,
    --   "includes_allowance": {"calls": 1000, "storage_gb": 10}
    -- }
    
    -- Configuration coûts dynamiques
    dynamic_cost_config JSONB DEFAULT '{}',
    -- Format: {
    --   "base_cost": 19.99,
    --   "scaling_tiers": [
    --     {"threshold": 1000, "multiplier": 1.0},
    --     {"threshold": 5000, "multiplier": 0.8},
    --     {"threshold": 10000, "multiplier": 0.6}
    --   ],
    --   "peak_hours_multiplier": 1.5,
    --   "off_peak_discount": 0.2
    -- }
    
    -- Configuration hybride
    hybrid_config JSONB DEFAULT '{}',
    -- Format: {
    --   "base_monthly": 29.99,
    --   "included_allowance": {"calls": 500, "tokens": 50000},
    --   "overage_rates": {"per_call": 0.05, "per_token": 0.0001},
    --   "burst_protection": {"max_overage": 200.00}
    -- }
    
    -- Limites et seuils
    usage_limits JSONB DEFAULT '{}',
    cost_caps JSONB DEFAULT '{}',
    
    -- Période d'application
    effective_from TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    effective_until TIMESTAMP WITH TIME ZONE,
    
    -- Statut
    is_active BOOLEAN DEFAULT true,
    priority INTEGER DEFAULT 0,
    
    -- Audit
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID REFERENCES pype_voice_users(user_id),
    
    -- Contraintes
    UNIQUE(service_type, service_id, workspace_id, effective_from),
    CHECK (priority >= 0)
);

-- Index pour performance
CREATE INDEX IF NOT EXISTS idx_cost_config_service ON cost_configuration_advanced(service_type, service_id);
CREATE INDEX IF NOT EXISTS idx_cost_config_workspace ON cost_configuration_advanced(workspace_id);
CREATE INDEX IF NOT EXISTS idx_cost_config_mode ON cost_configuration_advanced(cost_mode);
CREATE INDEX IF NOT EXISTS idx_cost_config_effective ON cost_configuration_advanced(effective_from, effective_until);
CREATE INDEX IF NOT EXISTS idx_cost_config_active ON cost_configuration_advanced(is_active, priority);

-- Commentaires
COMMENT ON TABLE cost_configuration_advanced IS 'Configuration avancée des modes de coûts par service';
COMMENT ON COLUMN cost_configuration_advanced.injection_config IS 'Config injection coûts vers autres services';
COMMENT ON COLUMN cost_configuration_advanced.fixed_cost_config IS 'Config coûts fixes avec allowances';
COMMENT ON COLUMN cost_configuration_advanced.dynamic_cost_config IS 'Config coûts dynamiques avec tiers';

-- ========================================
-- 2. TABLE INJECTION COÛTS
-- ========================================

CREATE TABLE IF NOT EXISTS cost_injections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Service source (qui injecte)
    source_service_type VARCHAR(20) NOT NULL,
    source_service_id UUID NOT NULL,
    source_workspace_id UUID NOT NULL,
    
    -- Service cible (qui reçoit l'injection)
    target_service_type VARCHAR(20) NOT NULL,
    target_service_id UUID NOT NULL,
    target_workspace_id UUID NOT NULL,
    
    -- Montant injection
    injection_amount DECIMAL(10,4) NOT NULL,
    injection_ratio DECIMAL(5,4) NOT NULL, -- 0.15 = 15%
    base_cost_amount DECIMAL(10,4) NOT NULL,
    
    -- Context
    triggered_by_call_id UUID REFERENCES pype_voice_call_logs(id),
    triggered_by_usage_event UUID,
    injection_reason TEXT,
    
    -- Période
    injection_date DATE DEFAULT CURRENT_DATE,
    billing_period VARCHAR(20),
    
    -- Statut
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'applied', 'failed', 'cancelled')),
    applied_at TIMESTAMP WITH TIME ZONE,
    
    -- Audit
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Contraintes
    CHECK (injection_amount > 0),
    CHECK (injection_ratio > 0 AND injection_ratio <= 1),
    CHECK (base_cost_amount >= 0)
);

-- Index pour performance
CREATE INDEX IF NOT EXISTS idx_injections_source ON cost_injections(source_service_type, source_service_id);
CREATE INDEX IF NOT EXISTS idx_injections_target ON cost_injections(target_service_type, target_service_id);
CREATE INDEX IF NOT EXISTS idx_injections_date ON cost_injections(injection_date);
CREATE INDEX IF NOT EXISTS idx_injections_status ON cost_injections(status);
CREATE INDEX IF NOT EXISTS idx_injections_call ON cost_injections(triggered_by_call_id);

-- Commentaires
COMMENT ON TABLE cost_injections IS 'Injections de coûts entre services';
COMMENT ON COLUMN cost_injections.injection_ratio IS 'Ratio injection (0.15 = 15% du coût source)';

-- ========================================
-- 3. TABLE ALLOWANCES ET QUOTAS
-- ========================================

CREATE TABLE IF NOT EXISTS service_allowances (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Association service
    service_type VARCHAR(20) NOT NULL,
    service_id UUID NOT NULL,
    workspace_id UUID NOT NULL,
    
    -- Type allowance
    allowance_type VARCHAR(50) NOT NULL, -- calls, tokens, storage_gb, executions, searches
    
    -- Limites
    monthly_allowance INTEGER DEFAULT 0,
    current_usage INTEGER DEFAULT 0,
    overage_usage INTEGER DEFAULT 0,
    
    -- Période
    period_start DATE DEFAULT CURRENT_DATE,
    period_end DATE DEFAULT (CURRENT_DATE + INTERVAL '1 month'),
    
    -- Coûts overage
    overage_rate DECIMAL(10,6) DEFAULT 0,
    overage_cost DECIMAL(10,4) DEFAULT 0,
    
    -- Statut
    is_active BOOLEAN DEFAULT true,
    reset_on_billing_cycle BOOLEAN DEFAULT true,
    
    -- Audit
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Contraintes
    CHECK (monthly_allowance >= 0),
    CHECK (current_usage >= 0),
    CHECK (overage_usage >= 0),
    CHECK (overage_rate >= 0),
    CHECK (overage_cost >= 0),
    
    UNIQUE(service_type, service_id, allowance_type, period_start)
);

-- Index pour performance
CREATE INDEX IF NOT EXISTS idx_allowances_service ON service_allowances(service_type, service_id);
CREATE INDEX IF NOT EXISTS idx_allowances_workspace ON service_allowances(workspace_id);
CREATE INDEX IF NOT EXISTS idx_allowances_type ON service_allowances(allowance_type);
CREATE INDEX IF NOT EXISTS idx_allowances_period ON service_allowances(period_start, period_end);
CREATE INDEX IF NOT EXISTS idx_allowances_active ON service_allowances(is_active);

-- Commentaires
COMMENT ON TABLE service_allowances IS 'Allowances et quotas par service avec gestion overage';
COMMENT ON COLUMN service_allowances.overage_rate IS 'Tarif par unité dépassement';

-- ========================================
-- 4. TABLE SCALING TIERS
-- ========================================

CREATE TABLE IF NOT EXISTS cost_scaling_tiers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Association configuration
    cost_config_id UUID NOT NULL REFERENCES cost_configuration_advanced(id) ON DELETE CASCADE,
    
    -- Tier configuration
    tier_level INTEGER NOT NULL,
    usage_threshold INTEGER NOT NULL,
    cost_multiplier DECIMAL(5,4) DEFAULT 1.0,
    flat_rate DECIMAL(10,4),
    
    -- Conditions spéciales
    time_based_conditions JSONB DEFAULT '{}',
    volume_conditions JSONB DEFAULT '{}',
    
    -- Audit
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Contraintes
    CHECK (tier_level > 0),
    CHECK (usage_threshold >= 0),
    CHECK (cost_multiplier > 0),
    
    UNIQUE(cost_config_id, tier_level)
);

-- Index pour performance
CREATE INDEX IF NOT EXISTS idx_scaling_tiers_config ON cost_scaling_tiers(cost_config_id);
CREATE INDEX IF NOT EXISTS idx_scaling_tiers_level ON cost_scaling_tiers(tier_level);
CREATE INDEX IF NOT EXISTS idx_scaling_tiers_threshold ON cost_scaling_tiers(usage_threshold);

-- Commentaires
COMMENT ON TABLE cost_scaling_tiers IS 'Tiers de scaling pour coûts dynamiques';
COMMENT ON COLUMN cost_scaling_tiers.cost_multiplier IS 'Multiplicateur coût (0.8 = -20%)';

-- ========================================
-- 5. TRIGGERS POUR UPDATED_AT
-- ========================================

CREATE TRIGGER update_cost_config_updated_at
    BEFORE UPDATE ON cost_configuration_advanced
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_allowances_updated_at
    BEFORE UPDATE ON service_allowances
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ========================================
-- 6. POLITIQUES RLS
-- ========================================

-- Activer RLS
ALTER TABLE cost_configuration_advanced ENABLE ROW LEVEL SECURITY;
ALTER TABLE cost_injections ENABLE ROW LEVEL SECURITY;
ALTER TABLE service_allowances ENABLE ROW LEVEL SECURITY;
ALTER TABLE cost_scaling_tiers ENABLE ROW LEVEL SECURITY;

-- Politiques workspace-based
CREATE POLICY cost_config_workspace_policy ON cost_configuration_advanced
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

CREATE POLICY cost_injections_workspace_policy ON cost_injections
    FOR ALL
    USING (
        source_workspace_id IN (
            SELECT DISTINCT epm.project_id 
            FROM pype_voice_email_project_mapping epm
            INNER JOIN pype_voice_users u ON u.email = epm.email
            WHERE u.user_id = current_setting('app.current_user_id')::uuid 
            AND epm.is_active = true
        )
        OR target_workspace_id IN (
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

CREATE POLICY allowances_workspace_policy ON service_allowances
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

CREATE POLICY scaling_tiers_policy ON cost_scaling_tiers
    FOR ALL
    USING (
        cost_config_id IN (SELECT id FROM cost_configuration_advanced)
    );

COMMIT;

-- ========================================
-- 7. VERIFICATION POST-MIGRATION
-- ========================================

DO $$
BEGIN
    -- Vérifier tables principales
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'cost_configuration_advanced') THEN
        RAISE EXCEPTION 'Table cost_configuration_advanced not created';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'cost_injections') THEN
        RAISE EXCEPTION 'Table cost_injections not created';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'service_allowances') THEN
        RAISE EXCEPTION 'Table service_allowances not created';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'cost_scaling_tiers') THEN
        RAISE EXCEPTION 'Table cost_scaling_tiers not created';
    END IF;
    
    RAISE NOTICE 'Migration système coûts avancé réussie';
    RAISE NOTICE 'Tables créées: cost_configuration_advanced, cost_injections';
    RAISE NOTICE 'Tables support: service_allowances, cost_scaling_tiers';
    RAISE NOTICE 'Modes supportés: pag, dedicated, injection, hybrid, fixed, dynamic';
    RAISE NOTICE 'Indexes et politiques RLS configurés';
END $$;
