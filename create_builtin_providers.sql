-- Migration pour créer les 3 providers built-in fixes
-- À exécuter après s'assurer que les providers n'existent pas déjà

-- Ajouter colonne is_builtin si elle n'existe pas
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'ai_providers' 
                   AND column_name = 'is_builtin') THEN
        ALTER TABLE ai_providers ADD COLUMN is_builtin BOOLEAN DEFAULT false;
    END IF;
END $$;

-- Insérer les 3 providers built-in fixes s'ils n'existent pas déjà
INSERT INTO ai_providers (name, type, api_key, api_url, cost_per_unit, unit, is_active, is_builtin)
SELECT 'Built-in STT', 'STT', '', 'http://localhost:8000/stt', 0.0050, 'minute', true, true
WHERE NOT EXISTS (SELECT 1 FROM ai_providers WHERE name = 'Built-in STT' AND is_builtin = true);

INSERT INTO ai_providers (name, type, api_key, api_url, cost_per_unit, unit, is_active, is_builtin)
SELECT 'Built-in TTS', 'TTS', '', 'http://localhost:8000/tts', 0.0020, 'word', true, true  
WHERE NOT EXISTS (SELECT 1 FROM ai_providers WHERE name = 'Built-in TTS' AND is_builtin = true);

INSERT INTO ai_providers (name, type, api_key, api_url, cost_per_unit, unit, is_active, is_builtin)
SELECT 'Built-in LLM', 'LLM', '', 'http://localhost:8000/llm', 0.000015, 'token', true, true
WHERE NOT EXISTS (SELECT 1 FROM ai_providers WHERE name = 'Built-in LLM' AND is_builtin = true);

-- Initialiser les coûts d'abonnement par défaut dans settings_global
INSERT INTO settings_global (key, value, description)
VALUES ('subscription_costs', '{
  "voice_agent_monthly": 29.99,
  "text_agent_monthly": 19.99, 
  "vision_agent_monthly": 39.99
}'::jsonb, 'Monthly subscription costs for dedicated agent types')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;
