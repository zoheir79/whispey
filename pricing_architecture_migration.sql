-- ===================================
-- NOUVELLE ARCHITECTURE PRICING COMPLÈTE
-- 3 modes: Dedicated, PAG, Hybrid
-- ===================================

BEGIN;

-- 1. Modifier table agents pour nouvelle architecture pricing
ALTER TABLE agents ADD COLUMN IF NOT EXISTS platform_mode VARCHAR(20) DEFAULT 'pag' CHECK (platform_mode IN ('dedicated', 'pag', 'hybrid'));
ALTER TABLE agents ADD COLUMN IF NOT EXISTS pricing_config JSONB DEFAULT '{}';
ALTER TABLE agents ADD COLUMN IF NOT EXISTS s3_storage_gb INTEGER DEFAULT 50;
ALTER TABLE agents ADD COLUMN IF NOT EXISTS billing_cycle VARCHAR(20) DEFAULT 'monthly' CHECK (billing_cycle IN ('monthly', 'yearly'));

-- 2. Créer table monthly_consumption pour tracking détaillé
CREATE TABLE IF NOT EXISTS monthly_consumption (
    id SERIAL PRIMARY KEY,
    agent_id INTEGER REFERENCES agents(id) ON DELETE CASCADE,
    year INTEGER NOT NULL,
    month INTEGER NOT NULL,
    
    -- Consommation par type de modèle
    stt_usage_minutes DECIMAL(10,4) DEFAULT 0,
    stt_cost DECIMAL(10,4) DEFAULT 0,
    stt_provider_type VARCHAR(20), -- 'builtin_dedicated', 'builtin_pag', 'external_pag'
    
    tts_usage_words INTEGER DEFAULT 0,
    tts_cost DECIMAL(10,4) DEFAULT 0,
    tts_provider_type VARCHAR(20),
    
    llm_usage_tokens INTEGER DEFAULT 0,
    llm_cost DECIMAL(10,4) DEFAULT 0,
    llm_provider_type VARCHAR(20),
    
    -- Frais d'abonnement agent
    agent_subscription_cost DECIMAL(10,4) DEFAULT 0,
    agent_subscription_type VARCHAR(20), -- 'voice_dedicated', 'text_dedicated', 'voice_pag', 'text_pag'
    
    -- Frais S3 storage
    s3_storage_gb INTEGER DEFAULT 50,
    s3_storage_cost DECIMAL(10,4) DEFAULT 0,
    
    -- Totaux
    total_usage_cost DECIMAL(10,4) DEFAULT 0, -- PAG usage (minutes/tokens)
    total_subscription_cost DECIMAL(10,4) DEFAULT 0, -- Dedicated + Agent + S3
    total_monthly_cost DECIMAL(10,4) DEFAULT 0, -- Grand total
    
    -- Metadata
    call_count INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(agent_id, year, month)
);

-- 3. Créer table billing_items pour détail facturation
CREATE TABLE IF NOT EXISTS billing_items (
    id SERIAL PRIMARY KEY,
    agent_id INTEGER REFERENCES agents(id) ON DELETE CASCADE,
    consumption_id INTEGER REFERENCES monthly_consumption(id) ON DELETE CASCADE,
    year INTEGER NOT NULL,
    month INTEGER NOT NULL,
    
    item_type VARCHAR(30) NOT NULL, -- 'stt_builtin_dedicated', 'tts_builtin_pag', 'llm_external_pag', 'agent_subscription', 's3_storage'
    item_name VARCHAR(100) NOT NULL,
    item_description TEXT,
    
    -- Quantités
    quantity DECIMAL(12,4) NOT NULL, -- minutes, words, tokens, agents, GB
    unit VARCHAR(20) NOT NULL, -- 'minute', 'word', 'token', 'agent', 'gb'
    unit_price DECIMAL(10,6) NOT NULL,
    
    -- Coûts
    line_total DECIMAL(10,4) NOT NULL,
    
    -- Metadata
    provider_id INTEGER, -- Reference ai_providers si applicable
    is_subscription BOOLEAN DEFAULT false, -- true pour dedicated, false pour PAG
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    INDEX(agent_id, year, month),
    INDEX(item_type)
);

-- 4. Modifier table calls pour tracking coûts détaillés
ALTER TABLE calls ADD COLUMN IF NOT EXISTS usage_cost DECIMAL(10,4) DEFAULT 0; -- Coût PAG calculé
ALTER TABLE calls ADD COLUMN IF NOT EXISTS usage_breakdown JSONB DEFAULT '{}'; -- Détail coûts par modèle
ALTER TABLE calls ADD COLUMN IF NOT EXISTS estimated_dedicated_cost DECIMAL(10,4) DEFAULT 0; -- Estimation dedicated

-- 5. Ajouter nouveaux settings pour tarifs
INSERT INTO settings_global (key, value, description) VALUES 
('pricing_rates_dedicated', '{
    "stt_monthly": 15.00,
    "tts_monthly": 12.00,
    "llm_monthly": 25.00,
    "voice_agent_monthly": 29.99,
    "text_agent_monthly": 19.99,
    "vision_agent_monthly": 39.99,
    "s3_storage_per_gb_monthly": 0.10
}'::jsonb, 'Monthly rates for dedicated models and subscriptions')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

INSERT INTO settings_global (key, value, description) VALUES 
('pricing_rates_pag', '{
    "stt_builtin_per_minute": 0.0050,
    "tts_builtin_per_word": 0.0020,
    "llm_builtin_per_token": 0.000015,
    "s3_storage_per_gb_monthly": 0.10
}'::jsonb, 'Pay-as-you-go rates for built-in models')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

-- 6. Créer fonction de calcul coût automatique
CREATE OR REPLACE FUNCTION calculate_call_cost(
    p_agent_id INTEGER,
    p_duration_seconds INTEGER,
    p_transcript_length INTEGER,
    p_response_length INTEGER,
    p_tokens_used INTEGER
) RETURNS JSONB AS $$
DECLARE
    agent_config RECORD;
    cost_breakdown JSONB := '{}';
    total_cost DECIMAL(10,4) := 0;
    stt_cost DECIMAL(10,4) := 0;
    tts_cost DECIMAL(10,4) := 0;
    llm_cost DECIMAL(10,4) := 0;
    pag_rates JSONB;
BEGIN
    -- Récupérer config agent
    SELECT platform_mode, pricing_config, agent_type INTO agent_config
    FROM agents WHERE id = p_agent_id;
    
    -- Récupérer tarifs PAG
    SELECT value INTO pag_rates 
    FROM settings_global WHERE key = 'pricing_rates_pag';
    
    -- Calculer coûts selon mode
    IF agent_config.platform_mode = 'pag' THEN
        -- Mode PAG: calculer selon usage réel
        IF agent_config.agent_type = 'voice' THEN
            stt_cost := (p_duration_seconds / 60.0) * (pag_rates->>'stt_builtin_per_minute')::DECIMAL;
            tts_cost := p_response_length * (pag_rates->>'tts_builtin_per_word')::DECIMAL;
        END IF;
        llm_cost := p_tokens_used * (pag_rates->>'llm_builtin_per_token')::DECIMAL;
        
        total_cost := stt_cost + tts_cost + llm_cost;
        
    ELSIF agent_config.platform_mode = 'dedicated' THEN
        -- Mode Dedicated: coût = 0 (facturé mensuellement)
        total_cost := 0;
        stt_cost := 0;
        tts_cost := 0;
        llm_cost := 0;
        
    -- Mode Hybrid: mix selon config
    ELSIF agent_config.platform_mode = 'hybrid' THEN
        -- TODO: Implémenter logique hybride selon pricing_config
        total_cost := 0;
    END IF;
    
    -- Construire breakdown
    cost_breakdown := jsonb_build_object(
        'stt_cost', stt_cost,
        'tts_cost', tts_cost,
        'llm_cost', llm_cost,
        'total_cost', total_cost,
        'mode', agent_config.platform_mode
    );
    
    RETURN cost_breakdown;
END;
$$ LANGUAGE plpgsql;

-- 7. Créer trigger pour calcul automatique coût call
CREATE OR REPLACE FUNCTION trigger_calculate_call_cost()
RETURNS TRIGGER AS $$
DECLARE
    cost_data JSONB;
BEGIN
    -- Calculer coût automatiquement à l'insertion/update
    cost_data := calculate_call_cost(
        NEW.agent_id,
        EXTRACT(EPOCH FROM (NEW.end_time - NEW.start_time))::INTEGER,
        COALESCE(length(NEW.transcript), 0),
        COALESCE(length(NEW.response), 0),
        COALESCE(NEW.tokens_used, 0)
    );
    
    NEW.usage_cost := (cost_data->>'total_cost')::DECIMAL;
    NEW.usage_breakdown := cost_data;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Attacher trigger sur table calls
DROP TRIGGER IF EXISTS calculate_cost_trigger ON calls;
CREATE TRIGGER calculate_cost_trigger
    BEFORE INSERT OR UPDATE ON calls
    FOR EACH ROW EXECUTE FUNCTION trigger_calculate_call_cost();

COMMIT;
