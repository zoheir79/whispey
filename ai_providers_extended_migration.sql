-- Migration pour système AI Providers étendu
-- Ajoute support pour modes pricing, overrides coûts, configuration S3, et modèles builtin séparés

-- Extension table agents pour nouveaux champs
ALTER TABLE pype_voice_agents ADD COLUMN IF NOT EXISTS pricing_mode VARCHAR(20) DEFAULT 'pag';
ALTER TABLE pype_voice_agents ADD COLUMN IF NOT EXISTS cost_overrides JSONB DEFAULT '{}';
ALTER TABLE pype_voice_agents ADD COLUMN IF NOT EXISTS s3_bucket_name VARCHAR(255);

-- Index pour optimiser les requêtes
CREATE INDEX IF NOT EXISTS idx_agents_pricing_mode ON pype_voice_agents(pricing_mode);
CREATE INDEX IF NOT EXISTS idx_agents_cost_overrides ON pype_voice_agents USING GIN(cost_overrides);
CREATE INDEX IF NOT EXISTS idx_agents_s3_bucket ON pype_voice_agents(s3_bucket_name);

-- Commentaires pour documentation
COMMENT ON COLUMN pype_voice_agents.pricing_mode IS 'Mode de facturation: pag (pay-as-go) ou dedicated (mensuel)';
COMMENT ON COLUMN pype_voice_agents.cost_overrides IS 'Surcharges de coûts personnalisées par agent (JSON)';
COMMENT ON COLUMN pype_voice_agents.s3_bucket_name IS 'Nom du bucket S3 dédié pour cet agent';

-- Configuration globale étendue - Modèles builtin séparés
INSERT INTO settings_global (key, value, description, created_at, updated_at)
VALUES (
  'builtin_stt',
  '{
    "url": "http://localhost:8000/stt",
    "api_key": "",
    "cost_per_minute": 0.02,
    "cost_dedicated_monthly": 50.00
  }',
  'Configuration du modèle STT builtin avec coûts PAG et dédié',
  NOW(),
  NOW()
) ON CONFLICT (key) DO UPDATE SET
  value = EXCLUDED.value,
  description = EXCLUDED.description,
  updated_at = NOW();

INSERT INTO settings_global (key, value, description, created_at, updated_at)
VALUES (
  'builtin_tts',
  '{
    "url": "http://localhost:8000/tts",
    "api_key": "",
    "cost_per_word": 0.0001,
    "cost_dedicated_monthly": 30.00
  }',
  'Configuration du modèle TTS builtin avec coûts PAG et dédié',
  NOW(),
  NOW()
) ON CONFLICT (key) DO UPDATE SET
  value = EXCLUDED.value,
  description = EXCLUDED.description,
  updated_at = NOW();

INSERT INTO settings_global (key, value, description, created_at, updated_at)
VALUES (
  'builtin_llm',
  '{
    "url": "http://localhost:8000/llm",
    "api_key": "",
    "cost_per_token": 0.00005,
    "cost_dedicated_monthly": 100.00
  }',
  'Configuration du modèle LLM builtin avec coûts PAG et dédié',
  NOW(),
  NOW()
) ON CONFLICT (key) DO UPDATE SET
  value = EXCLUDED.value,
  description = EXCLUDED.description,
  updated_at = NOW();

-- Configuration S3 avec coût de stockage
INSERT INTO settings_global (key, value, description, created_at, updated_at)
VALUES (
  's3_config',
  '{
    "endpoint": "https://s3.example.com",
    "access_key": "",
    "secret_key": "",
    "region": "us-east-1",
    "bucket_prefix": "whispey-agent-",
    "cost_per_gb": 0.023
  }',
  'Configuration stockage S3 compatible (Ceph RGW) avec coût par Go',
  NOW(),
  NOW()
) ON CONFLICT (key) DO UPDATE SET
  value = EXCLUDED.value,
  description = EXCLUDED.description,
  updated_at = NOW();

-- Coûts de subscription agents
INSERT INTO settings_global (key, value, description, created_at, updated_at)
VALUES (
  'agent_subscription_costs',
  '{
    "voice_per_minute": 0.10,
    "textonly_per_month": 25.00
  }',
  'Coûts de subscription pour agents voice (par minute) et text-only (par mois)',
  NOW(),
  NOW()
) ON CONFLICT (key) DO UPDATE SET
  value = EXCLUDED.value,
  description = EXCLUDED.description,
  updated_at = NOW();

-- Fonction pour génération automatique des noms de buckets S3
CREATE OR REPLACE FUNCTION generate_s3_bucket_name(agent_id INTEGER, project_id INTEGER)
RETURNS VARCHAR(255) AS $$
DECLARE
  bucket_prefix VARCHAR(100);
BEGIN
  -- Récupérer le préfixe depuis la config S3
  SELECT (value->>'bucket_prefix') INTO bucket_prefix 
  FROM settings_global 
  WHERE key = 's3_config';
  
  -- Si pas de préfixe, utiliser un par défaut
  IF bucket_prefix IS NULL THEN
    bucket_prefix := 'whispey-agent-';
  END IF;
  
  -- Retourner le nom du bucket: prefix + agent_id + project_id
  RETURN CONCAT(bucket_prefix, agent_id, '-', project_id);
END;
$$ LANGUAGE plpgsql;

-- Trigger pour créer automatiquement le nom du bucket S3 lors de la création d'un agent
CREATE OR REPLACE FUNCTION set_agent_s3_bucket()
RETURNS TRIGGER AS $$
BEGIN
  -- Générer le nom du bucket S3 si pas déjà défini
  IF NEW.s3_bucket_name IS NULL THEN
    NEW.s3_bucket_name := generate_s3_bucket_name(NEW.id, NEW.project_id);
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Appliquer le trigger sur les insertions
DROP TRIGGER IF EXISTS trigger_set_agent_s3_bucket ON pype_voice_agents;
CREATE TRIGGER trigger_set_agent_s3_bucket
  BEFORE INSERT ON pype_voice_agents
  FOR EACH ROW
  EXECUTE FUNCTION set_agent_s3_bucket();

-- Vue pour calculer les coûts effectifs avec overrides
CREATE OR REPLACE VIEW agent_effective_costs AS
SELECT 
  a.id,
  a.name,
  a.agent_type,
  a.pricing_mode,
  a.cost_overrides,
  a.s3_bucket_name,
  
  -- Coûts STT effectifs
  COALESCE(
    (a.cost_overrides->>'builtin_stt_cost')::DECIMAL, 
    (s_stt.value->>'cost_per_minute')::DECIMAL
  ) AS effective_stt_cost,
  
  -- Coûts TTS effectifs
  COALESCE(
    (a.cost_overrides->>'builtin_tts_cost')::DECIMAL,
    (s_tts.value->>'cost_per_word')::DECIMAL
  ) AS effective_tts_cost,
  
  -- Coûts LLM effectifs
  COALESCE(
    (a.cost_overrides->>'builtin_llm_cost')::DECIMAL,
    (s_llm.value->>'cost_per_token')::DECIMAL
  ) AS effective_llm_cost,
  
  -- Coût S3 effectif
  COALESCE(
    (a.cost_overrides->>'s3_storage_cost_per_gb')::DECIMAL,
    (s_s3.value->>'cost_per_gb')::DECIMAL
  ) AS effective_s3_cost

FROM pype_voice_agents a
LEFT JOIN settings_global s_stt ON s_stt.key = 'builtin_stt'
LEFT JOIN settings_global s_tts ON s_tts.key = 'builtin_tts' 
LEFT JOIN settings_global s_llm ON s_llm.key = 'builtin_llm'
LEFT JOIN settings_global s_s3 ON s_s3.key = 's3_config';

-- Exemples de données pour test
INSERT INTO ai_providers (name, type, api_url, api_key, unit, cost_per_unit, is_active, created_at, updated_at)
VALUES 
  ('OpenAI Whisper', 'STT', 'https://api.openai.com/v1/audio/transcriptions', 'sk-example', 'minute', 0.006, true, NOW(), NOW()),
  ('ElevenLabs TTS', 'TTS', 'https://api.elevenlabs.io/v1/text-to-speech', 'api-key', 'word', 0.00025, true, NOW(), NOW()),
  ('OpenAI GPT-4', 'LLM', 'https://api.openai.com/v1/chat/completions', 'sk-example', 'token', 0.00003, true, NOW(), NOW()),
  ('Google Speech-to-Text', 'STT', 'https://speech.googleapis.com/v1/speech:recognize', 'google-key', 'minute', 0.004, true, NOW(), NOW()),
  ('Azure TTS', 'TTS', 'https://eastus.tts.speech.microsoft.com/cognitiveservices/v1', 'azure-key', 'word', 0.0002, true, NOW(), NOW()),
  ('Claude-3', 'LLM', 'https://api.anthropic.com/v1/messages', 'anthropic-key', 'token', 0.000015, true, NOW(), NOW())
ON CONFLICT (name, type) DO NOTHING;

PRINT 'Migration AI Providers étendue terminée avec succès !';
