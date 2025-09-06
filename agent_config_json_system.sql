-- Système JSON Config pour les agents
-- Gère la configuration flexible des agents avec pricing et overrides

-- Extension de la table agents pour supporter la configuration JSON
ALTER TABLE pype_voice_agents ADD COLUMN IF NOT EXISTS config_json JSONB DEFAULT '{}';
ALTER TABLE pype_voice_agents ADD COLUMN IF NOT EXISTS pricing_overrides JSONB DEFAULT '{}';
ALTER TABLE pype_voice_agents ADD COLUMN IF NOT EXISTS provider_config JSONB DEFAULT '{}';

-- Index pour optimiser les requêtes sur la configuration JSON
CREATE INDEX IF NOT EXISTS idx_agents_config_json ON pype_voice_agents USING GIN (config_json);
CREATE INDEX IF NOT EXISTS idx_agents_pricing_overrides ON pype_voice_agents USING GIN (pricing_overrides);
CREATE INDEX IF NOT EXISTS idx_agents_provider_config ON pype_voice_agents USING GIN (provider_config);

-- Fonction pour valider la configuration JSON d'un agent
CREATE OR REPLACE FUNCTION validate_agent_config_json(
    p_agent_id UUID,
    p_config_json JSONB,
    p_pricing_overrides JSONB DEFAULT NULL,
    p_provider_config JSONB DEFAULT NULL
)
RETURNS RECORD AS $$
DECLARE
    v_result RECORD;
    v_is_valid BOOLEAN := true;
    v_errors TEXT[] := ARRAY[]::TEXT[];
    v_warnings TEXT[] := ARRAY[]::TEXT[];
    v_agent_type TEXT;
    v_platform_mode TEXT;
BEGIN
    -- Récupérer les informations de base de l'agent
    SELECT agent_type, platform_mode INTO v_agent_type, v_platform_mode
    FROM pype_voice_agents WHERE id = p_agent_id;
    
    IF v_agent_type IS NULL THEN
        v_errors := array_append(v_errors, 'Agent not found');
        v_is_valid := false;
    END IF;
    
    -- Validation de la structure config_json
    IF p_config_json IS NOT NULL THEN
        -- Vérifier les champs obligatoires
        IF NOT p_config_json ? 'billing_cycle' THEN
            v_errors := array_append(v_errors, 'billing_cycle is required in config_json');
            v_is_valid := false;
        END IF;
        
        -- Valider billing_cycle
        IF p_config_json->>'billing_cycle' NOT IN ('monthly', 'quarterly', 'annual') THEN
            v_errors := array_append(v_errors, 'billing_cycle must be monthly, quarterly, or annual');
            v_is_valid := false;
        END IF;
        
        -- Valider S3 config pour voice agents
        IF v_agent_type = 'voice' AND p_config_json ? 's3_enabled' THEN
            IF (p_config_json->>'s3_enabled')::BOOLEAN = true THEN
                IF NOT p_config_json ? 's3_storage_gb' THEN
                    v_warnings := array_append(v_warnings, 's3_storage_gb not specified, will use default');
                END IF;
                
                IF p_config_json ? 's3_cost_override' THEN
                    BEGIN
                        PERFORM (p_config_json->>'s3_cost_override')::DECIMAL;
                    EXCEPTION WHEN OTHERS THEN
                        v_errors := array_append(v_errors, 's3_cost_override must be a valid decimal number');
                        v_is_valid := false;
                    END;
                END IF;
            END IF;
        END IF;
    END IF;
    
    -- Validation des pricing_overrides
    IF p_pricing_overrides IS NOT NULL THEN
        -- Valider les overrides de prix pour services
        DECLARE
            service_key TEXT;
            price_fields TEXT[] := ARRAY['stt_price', 'tts_price', 'llm_price'];
        BEGIN
            FOREACH service_key IN ARRAY price_fields LOOP
                IF p_pricing_overrides ? service_key THEN
                    IF p_pricing_overrides->>service_key IS NOT NULL THEN
                        BEGIN
                            PERFORM (p_pricing_overrides->>service_key)::DECIMAL;
                        EXCEPTION WHEN OTHERS THEN
                            v_errors := array_append(v_errors, format('%s must be a valid decimal number', service_key));
                            v_is_valid := false;
                        END;
                    END IF;
                END IF;
            END LOOP;
        END;
        
        -- Valider les URL overrides
        DECLARE
            url_fields TEXT[] := ARRAY['stt_url', 'tts_url', 'llm_url'];
        BEGIN
            FOREACH service_key IN ARRAY url_fields LOOP
                IF p_pricing_overrides ? service_key THEN
                    IF p_pricing_overrides->>service_key IS NOT NULL THEN
                        IF NOT (p_pricing_overrides->>service_key ~ '^https?://') THEN
                            v_warnings := array_append(v_warnings, format('%s should be a valid HTTP(S) URL', service_key));
                        END IF;
                    END IF;
                END IF;
            END LOOP;
        END;
    END IF;
    
    -- Validation du provider_config
    IF p_provider_config IS NOT NULL THEN
        -- Vérifier le mode
        IF NOT p_provider_config ? 'mode' THEN
            v_errors := array_append(v_errors, 'mode is required in provider_config');
            v_is_valid := false;
        ELSE
            IF p_provider_config->>'mode' NOT IN ('builtin', 'external', 'hybrid') THEN
                v_errors := array_append(v_errors, 'mode must be builtin, external, or hybrid');
                v_is_valid := false;
            END IF;
        END IF;
        
        -- Validation pour mode external
        IF p_provider_config->>'mode' = 'external' THEN
            IF v_agent_type = 'voice' THEN
                IF NOT (p_provider_config ? 'stt' AND p_provider_config ? 'tts' AND p_provider_config ? 'llm') THEN
                    v_warnings := array_append(v_warnings, 'External voice agents should have stt, tts, and llm provider configs');
                END IF;
            ELSE
                IF NOT p_provider_config ? 'llm' THEN
                    v_warnings := array_append(v_warnings, 'External text agents should have llm provider config');
                END IF;
            END IF;
        END IF;
    END IF;
    
    SELECT v_is_valid as is_valid, v_errors as errors, v_warnings as warnings INTO v_result;
    RETURN v_result;
END;
$$ LANGUAGE plpgsql;

-- Fonction pour mettre à jour la configuration JSON d'un agent
CREATE OR REPLACE FUNCTION update_agent_config(
    p_agent_id UUID,
    p_config_json JSONB DEFAULT NULL,
    p_pricing_overrides JSONB DEFAULT NULL,
    p_provider_config JSONB DEFAULT NULL,
    p_validate_only BOOLEAN DEFAULT false
)
RETURNS RECORD AS $$
DECLARE
    v_result RECORD;
    v_validation RECORD;
    v_current_config JSONB;
    v_current_pricing JSONB;
    v_current_provider JSONB;
    v_new_config JSONB;
    v_new_pricing JSONB;
    v_new_provider JSONB;
    v_updated BOOLEAN := false;
BEGIN
    -- Récupérer la configuration actuelle
    SELECT config_json, pricing_overrides, provider_config
    INTO v_current_config, v_current_pricing, v_current_provider
    FROM pype_voice_agents WHERE id = p_agent_id;
    
    IF NOT FOUND THEN
        SELECT false as success, 'Agent not found' as error, NULL as warnings INTO v_result;
        RETURN v_result;
    END IF;
    
    -- Fusionner avec la configuration existante
    v_new_config := COALESCE(v_current_config, '{}'::JSONB);
    v_new_pricing := COALESCE(v_current_pricing, '{}'::JSONB);
    v_new_provider := COALESCE(v_current_provider, '{}'::JSONB);
    
    IF p_config_json IS NOT NULL THEN
        v_new_config := v_new_config || p_config_json;
    END IF;
    
    IF p_pricing_overrides IS NOT NULL THEN
        v_new_pricing := v_new_pricing || p_pricing_overrides;
    END IF;
    
    IF p_provider_config IS NOT NULL THEN
        v_new_provider := v_new_provider || p_provider_config;
    END IF;
    
    -- Valider la nouvelle configuration
    SELECT * INTO v_validation 
    FROM validate_agent_config_json(p_agent_id, v_new_config, v_new_pricing, v_new_provider);
    
    IF NOT v_validation.is_valid THEN
        SELECT false as success, array_to_string(v_validation.errors, '; ') as error, v_validation.warnings INTO v_result;
        RETURN v_result;
    END IF;
    
    -- Mise à jour si pas en mode validation seulement
    IF NOT p_validate_only THEN
        UPDATE pype_voice_agents 
        SET config_json = v_new_config,
            pricing_overrides = v_new_pricing,
            provider_config = v_new_provider,
            updated_at = NOW()
        WHERE id = p_agent_id;
        
        v_updated := true;
        
        -- Log de la mise à jour
        INSERT INTO pype_voice_system_logs (level, message, metadata)
        VALUES ('info', format('Agent config updated for agent %s', p_agent_id), jsonb_build_object(
            'agent_id', p_agent_id,
            'config_updated', p_config_json IS NOT NULL,
            'pricing_updated', p_pricing_overrides IS NOT NULL,
            'provider_updated', p_provider_config IS NOT NULL,
            'timestamp', NOW()
        ));
    END IF;
    
    SELECT true as success, 'Configuration updated successfully' as message, v_validation.warnings as warnings, v_updated as updated INTO v_result;
    RETURN v_result;
END;
$$ LANGUAGE plpgsql;

-- Fonction pour récupérer la configuration complète d'un agent
CREATE OR REPLACE FUNCTION get_agent_full_config(p_agent_id UUID)
RETURNS JSONB AS $$
DECLARE
    v_agent RECORD;
    v_config JSONB;
BEGIN
    -- Récupérer toutes les informations de l'agent
    SELECT 
        a.*,
        w.name as workspace_name,
        u.email as owner_email
    INTO v_agent
    FROM pype_voice_agents a
    LEFT JOIN pype_voice_workspaces w ON a.workspace_id = w.id
    LEFT JOIN pype_voice_users u ON a.user_id = u.id
    WHERE a.id = p_agent_id;
    
    IF NOT FOUND THEN
        RETURN NULL;
    END IF;
    
    -- Construire la configuration complète
    v_config := jsonb_build_object(
        'agent_id', v_agent.id,
        'name', v_agent.name,
        'agent_type', v_agent.agent_type,
        'platform_mode', v_agent.platform_mode,
        'workspace_id', v_agent.workspace_id,
        'workspace_name', v_agent.workspace_name,
        'owner_email', v_agent.owner_email,
        'created_at', v_agent.created_at,
        'updated_at', v_agent.updated_at,
        'config', COALESCE(v_agent.config_json, '{}'::JSONB),
        'pricing_overrides', COALESCE(v_agent.pricing_overrides, '{}'::JSONB),
        'provider_config', COALESCE(v_agent.provider_config, '{}'::JSONB)
    );
    
    -- Ajouter les informations de billing cycle si elles existent
    IF EXISTS (SELECT 1 FROM agent_billing_cycles WHERE agent_id = p_agent_id AND is_active = true) THEN
        v_config := v_config || jsonb_build_object(
            'billing_info', (
                SELECT jsonb_build_object(
                    'billing_cycle_id', abc.id,
                    'billing_mode', abc.billing_mode,
                    'billing_cycle', abc.billing_cycle,
                    'fixed_cost', abc.fixed_cost,
                    'usage_cost', abc.usage_cost,
                    'total_cost', abc.total_cost,
                    'next_billing_date', abc.next_billing_date,
                    'is_suspended', abc.is_suspended
                )
                FROM agent_billing_cycles abc 
                WHERE abc.agent_id = p_agent_id AND abc.is_active = true 
                LIMIT 1
            )
        );
    END IF;
    
    RETURN v_config;
END;
$$ LANGUAGE plpgsql;

-- Fonction pour cloner la configuration d'un agent vers un autre
CREATE OR REPLACE FUNCTION clone_agent_config(
    p_source_agent_id UUID,
    p_target_agent_id UUID,
    p_include_pricing BOOLEAN DEFAULT true,
    p_include_provider BOOLEAN DEFAULT true
)
RETURNS RECORD AS $$
DECLARE
    v_result RECORD;
    v_source_config JSONB;
    v_source_pricing JSONB;
    v_source_provider JSONB;
BEGIN
    -- Récupérer la configuration source
    SELECT config_json, pricing_overrides, provider_config
    INTO v_source_config, v_source_pricing, v_source_provider
    FROM pype_voice_agents WHERE id = p_source_agent_id;
    
    IF NOT FOUND THEN
        SELECT false as success, 'Source agent not found' as error INTO v_result;
        RETURN v_result;
    END IF;
    
    -- Vérifier que l'agent cible existe
    IF NOT EXISTS (SELECT 1 FROM pype_voice_agents WHERE id = p_target_agent_id) THEN
        SELECT false as success, 'Target agent not found' as error INTO v_result;
        RETURN v_result;
    END IF;
    
    -- Cloner la configuration
    SELECT * INTO v_result FROM update_agent_config(
        p_target_agent_id,
        v_source_config,
        CASE WHEN p_include_pricing THEN v_source_pricing ELSE NULL END,
        CASE WHEN p_include_provider THEN v_source_provider ELSE NULL END
    );
    
    RETURN v_result;
END;
$$ LANGUAGE plpgsql;

-- Fonction pour obtenir les templates de configuration par défaut
CREATE OR REPLACE FUNCTION get_default_agent_config_templates()
RETURNS TABLE(
    template_name TEXT,
    agent_type TEXT,
    platform_mode TEXT,
    config_json JSONB,
    pricing_overrides JSONB,
    provider_config JSONB,
    description TEXT
) AS $$
BEGIN
    -- Template Voice Agent - Dedicated
    RETURN QUERY VALUES (
        'voice-dedicated'::TEXT,
        'voice'::TEXT,
        'dedicated'::TEXT,
        '{"billing_cycle": "monthly", "s3_enabled": true, "s3_storage_gb": 100, "voice_type": "inbound"}'::JSONB,
        '{}'::JSONB,
        '{"mode": "builtin"}'::JSONB,
        'Voice agent with dedicated pricing and built-in providers'::TEXT
    );
    
    -- Template Voice Agent - PAG
    RETURN QUERY VALUES (
        'voice-pag-builtin'::TEXT,
        'voice'::TEXT,
        'pag'::TEXT,
        '{"billing_cycle": "monthly", "s3_enabled": true, "s3_storage_gb": 50, "voice_type": "inbound"}'::JSONB,
        '{}'::JSONB,
        '{"mode": "builtin"}'::JSONB,
        'Voice agent with pay-as-you-go pricing using built-in providers'::TEXT
    );
    
    -- Template Voice Agent - Hybrid
    RETURN QUERY VALUES (
        'voice-hybrid'::TEXT,
        'voice'::TEXT,
        'hybrid'::TEXT,
        '{"billing_cycle": "monthly", "s3_enabled": true, "s3_storage_gb": 75, "voice_type": "inbound"}'::JSONB,
        '{}'::JSONB,
        '{"mode": "hybrid", "stt": {"mode": "builtin"}, "tts": {"mode": "dedicated"}, "llm": {"mode": "builtin"}}'::JSONB,
        'Voice agent with hybrid pricing (mixed dedicated and PAG)'::TEXT
    );
    
    -- Template Text Agent - Dedicated
    RETURN QUERY VALUES (
        'text-dedicated'::TEXT,
        'text_only'::TEXT,
        'dedicated'::TEXT,
        '{"billing_cycle": "monthly"}'::JSONB,
        '{}'::JSONB,
        '{"mode": "builtin"}'::JSONB,
        'Text-only agent with dedicated pricing'::TEXT
    );
    
    -- Template Text Agent - PAG
    RETURN QUERY VALUES (
        'text-pag'::TEXT,
        'text_only'::TEXT,
        'pag'::TEXT,
        '{"billing_cycle": "monthly"}'::JSONB,
        '{}'::JSONB,
        '{"mode": "builtin"}'::JSONB,
        'Text-only agent with pay-as-you-go pricing'::TEXT
    );
END;
$$ LANGUAGE plpgsql;

-- Fonction pour exporter la configuration d'un agent
CREATE OR REPLACE FUNCTION export_agent_config(p_agent_id UUID)
RETURNS JSONB AS $$
DECLARE
    v_export JSONB;
    v_agent RECORD;
BEGIN
    -- Récupérer la configuration complète
    SELECT * INTO v_export FROM get_agent_full_config(p_agent_id);
    
    IF v_export IS NULL THEN
        RETURN jsonb_build_object('error', 'Agent not found');
    END IF;
    
    -- Ajouter des métadonnées d'export
    v_export := v_export || jsonb_build_object(
        'export_metadata', jsonb_build_object(
            'exported_at', NOW(),
            'export_version', '1.0',
            'whispey_version', 'v2.0'
        )
    );
    
    RETURN v_export;
END;
$$ LANGUAGE plpgsql;

-- Fonction pour importer une configuration d'agent
CREATE OR REPLACE FUNCTION import_agent_config(
    p_agent_id UUID,
    p_exported_config JSONB,
    p_overwrite BOOLEAN DEFAULT false
)
RETURNS RECORD AS $$
DECLARE
    v_result RECORD;
    v_config JSONB;
    v_pricing JSONB;
    v_provider JSONB;
BEGIN
    -- Valider le format d'export
    IF NOT (p_exported_config ? 'config' AND p_exported_config ? 'export_metadata') THEN
        SELECT false as success, 'Invalid export format' as error INTO v_result;
        RETURN v_result;
    END IF;
    
    -- Extraire les configurations
    v_config := p_exported_config->'config';
    v_pricing := COALESCE(p_exported_config->'pricing_overrides', '{}'::JSONB);
    v_provider := COALESCE(p_exported_config->'provider_config', '{}'::JSONB);
    
    -- Si pas d'écrasement, fusionner avec la config existante
    IF NOT p_overwrite THEN
        SELECT * INTO v_result FROM update_agent_config(p_agent_id, v_config, v_pricing, v_provider);
    ELSE
        -- Écraser complètement la configuration
        UPDATE pype_voice_agents 
        SET config_json = v_config,
            pricing_overrides = v_pricing,
            provider_config = v_provider,
            updated_at = NOW()
        WHERE id = p_agent_id;
        
        SELECT true as success, 'Configuration imported successfully' as message INTO v_result;
    END IF;
    
    RETURN v_result;
END;
$$ LANGUAGE plpgsql;

-- Vue pour faciliter les requêtes sur les configurations d'agents
CREATE OR REPLACE VIEW agent_configs_summary AS
SELECT 
    a.id as agent_id,
    a.name,
    a.agent_type,
    a.platform_mode,
    w.name as workspace_name,
    u.email as owner_email,
    
    -- Configuration de base
    a.config_json->>'billing_cycle' as billing_cycle,
    (a.config_json->>'s3_enabled')::BOOLEAN as s3_enabled,
    (a.config_json->>'s3_storage_gb')::INTEGER as s3_storage_gb,
    
    -- Overrides de pricing
    CASE 
        WHEN a.pricing_overrides = '{}'::JSONB THEN false
        ELSE true 
    END as has_pricing_overrides,
    
    -- Configuration des providers
    a.provider_config->>'mode' as provider_mode,
    
    -- Statut de facturation
    COALESCE(abc.is_active, false) as has_billing_cycle,
    abc.billing_mode,
    abc.total_cost,
    abc.is_suspended,
    
    -- Métadonnées
    a.created_at,
    a.updated_at

FROM pype_voice_agents a
LEFT JOIN pype_voice_workspaces w ON a.workspace_id = w.id
LEFT JOIN pype_voice_users u ON a.user_id = u.id  
LEFT JOIN agent_billing_cycles abc ON a.id = abc.agent_id AND abc.is_active = true
WHERE a.deleted_at IS NULL;

-- Fonction pour nettoyer les configurations orphelines
CREATE OR REPLACE FUNCTION cleanup_orphaned_agent_configs()
RETURNS INTEGER AS $$
DECLARE
    v_cleaned_count INTEGER := 0;
BEGIN
    -- Nettoyer les configurations JSON vides ou corrompues
    UPDATE pype_voice_agents 
    SET config_json = '{}'::JSONB
    WHERE config_json IS NULL 
    OR config_json = 'null'::JSONB
    OR NOT jsonb_typeof(config_json) = 'object';
    
    GET DIAGNOSTICS v_cleaned_count = ROW_COUNT;
    
    -- Nettoyer les pricing_overrides vides
    UPDATE pype_voice_agents 
    SET pricing_overrides = '{}'::JSONB
    WHERE pricing_overrides IS NULL 
    OR pricing_overrides = 'null'::JSONB
    OR NOT jsonb_typeof(pricing_overrides) = 'object';
    
    -- Nettoyer les provider_config vides
    UPDATE pype_voice_agents 
    SET provider_config = '{}'::JSONB
    WHERE provider_config IS NULL 
    OR provider_config = 'null'::JSONB
    OR NOT jsonb_typeof(provider_config) = 'object';
    
    RETURN v_cleaned_count;
END;
$$ LANGUAGE plpgsql;

-- Créer des index pour les requêtes fréquentes sur les configurations
CREATE INDEX IF NOT EXISTS idx_agents_config_billing_cycle ON pype_voice_agents ((config_json->>'billing_cycle'));
CREATE INDEX IF NOT EXISTS idx_agents_config_s3_enabled ON pype_voice_agents ((config_json->>'s3_enabled')) WHERE (config_json->>'s3_enabled')::BOOLEAN = true;
CREATE INDEX IF NOT EXISTS idx_agents_provider_mode ON pype_voice_agents ((provider_config->>'mode'));

-- Trigger pour automatiquement nettoyer les configurations à chaque mise à jour
CREATE OR REPLACE FUNCTION agent_config_cleanup_trigger()
RETURNS TRIGGER AS $$
BEGIN
    -- S'assurer que les JSONB ne sont jamais NULL
    NEW.config_json := COALESCE(NEW.config_json, '{}'::JSONB);
    NEW.pricing_overrides := COALESCE(NEW.pricing_overrides, '{}'::JSONB);
    NEW.provider_config := COALESCE(NEW.provider_config, '{}'::JSONB);
    
    -- Valider les configurations basiques
    IF NEW.config_json ? 'billing_cycle' THEN
        IF NEW.config_json->>'billing_cycle' NOT IN ('monthly', 'quarterly', 'annual') THEN
            NEW.config_json := NEW.config_json || '{"billing_cycle": "monthly"}'::JSONB;
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER agent_config_cleanup_before_update
    BEFORE INSERT OR UPDATE ON pype_voice_agents
    FOR EACH ROW EXECUTE FUNCTION agent_config_cleanup_trigger();
