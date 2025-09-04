-- Correction pour conflit agent_type
-- L'agent_type existant contient "inbound" (type d'appel)
-- Créons ai_agent_type pour les types d'IA

-- 1. Supprimer la contrainte problématique
ALTER TABLE pype_voice_agents DROP CONSTRAINT IF EXISTS chk_agent_type;

-- 2. Créer nouvelle colonne pour type d'IA
ALTER TABLE pype_voice_agents ADD COLUMN IF NOT EXISTS ai_agent_type VARCHAR(50) DEFAULT 'voice';

-- 3. Ajouter contrainte sur la nouvelle colonne
ALTER TABLE pype_voice_agents 
ADD CONSTRAINT chk_ai_agent_type CHECK (ai_agent_type IN ('voice', 'text_only', 'vision'));

-- 4. Créer index pour performance
CREATE INDEX IF NOT EXISTS idx_agents_ai_type ON pype_voice_agents(ai_agent_type);

-- 5. Commenter pour documentation
COMMENT ON COLUMN pype_voice_agents.ai_agent_type IS 'Type d''agent IA: voice (défaut), text_only, ou vision';

-- 6. Mettre à jour la vue
DROP VIEW IF EXISTS agent_cost_summary;
CREATE OR REPLACE VIEW agent_cost_summary AS
SELECT 
    a.id,
    a.name,
    a.agent_type, -- Type d'appel (inbound, etc.)
    a.ai_agent_type, -- Type d'IA (voice, text_only, vision)
    a.provider_config,
    a.currency,
    CASE 
        WHEN (a.provider_config->>'mode') = 'builtin' OR a.provider_config = '{}'::jsonb THEN
            (SELECT (value->>'cost_per_minute')::numeric FROM settings_global WHERE key = 'builtin_voice')
        WHEN (a.provider_config->>'mode') = 'external' THEN
            COALESCE((a.provider_config->'stt'->>'cost_per_minute')::numeric, 0) +
            COALESCE((a.provider_config->'tts'->>'cost_per_word')::numeric * 100, 0) + 
            COALESCE((a.provider_config->'llm'->>'cost_per_token')::numeric * 1000, 0)
        ELSE 0
    END as estimated_cost_per_minute
FROM pype_voice_agents a
WHERE a.is_active = true;
