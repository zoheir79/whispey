-- AI Providers Management Migration
-- Date: 2025-09-04
-- Description: Add centralized AI providers management system for STT, TTS, LLM providers

-- ========================================
-- 1. Create settings_global table for built-in models configuration
-- ========================================

CREATE TABLE IF NOT EXISTS public.settings_global (
    id SERIAL PRIMARY KEY,
    key VARCHAR(100) UNIQUE NOT NULL,
    value JSONB NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_settings_global_key ON public.settings_global(key);

-- Insert default built-in models configuration
INSERT INTO public.settings_global (key, value, description) 
VALUES (
    'builtin_models',
    '{
        "url": "http://localhost:8000",
        "api_key": "",
        "cost_per_minute": 0.05
    }'::jsonb,
    'Configuration for built-in AI models including URL, API key and cost per minute'
) ON CONFLICT (key) DO NOTHING;

-- ========================================
-- 2. Create ai_providers table for external providers
-- ========================================

CREATE TABLE IF NOT EXISTS public.ai_providers (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    type VARCHAR(20) NOT NULL CHECK (type IN ('STT', 'TTS', 'LLM')),
    api_url TEXT,
    api_key TEXT,
    unit VARCHAR(20) NOT NULL, -- "minute", "word", "token"
    cost_per_unit NUMERIC(10,4) NOT NULL DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_ai_providers_type ON public.ai_providers(type);
CREATE INDEX IF NOT EXISTS idx_ai_providers_active ON public.ai_providers(is_active);
CREATE INDEX IF NOT EXISTS idx_ai_providers_name ON public.ai_providers(name);

-- Add constraint to ensure unit matches provider type
ALTER TABLE public.ai_providers 
ADD CONSTRAINT chk_provider_unit_type CHECK (
    (type = 'STT' AND unit IN ('minute', 'second')) OR
    (type = 'TTS' AND unit IN ('word', 'character')) OR
    (type = 'LLM' AND unit IN ('token', 'word'))
);

-- ========================================
-- 3. Modify pype_voice_agents table to add provider_config
-- ========================================

-- Add provider_config column to store agent provider configuration
ALTER TABLE public.pype_voice_agents 
ADD COLUMN IF NOT EXISTS provider_config JSONB DEFAULT '{}'::jsonb;

-- Add agent_type column if not exists (for text-only, vision agents)
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'pype_voice_agents' 
                   AND column_name = 'agent_type') THEN
        ALTER TABLE public.pype_voice_agents 
        ADD COLUMN agent_type VARCHAR(50) DEFAULT 'voice';
    END IF;
END $$;

-- Create index for provider_config queries
CREATE INDEX IF NOT EXISTS idx_agents_provider_config ON public.pype_voice_agents USING GIN(provider_config);
CREATE INDEX IF NOT EXISTS idx_agents_type ON public.pype_voice_agents(agent_type);

-- Add constraint for agent_type
ALTER TABLE public.pype_voice_agents 
DROP CONSTRAINT IF EXISTS chk_agent_type;

ALTER TABLE public.pype_voice_agents 
ADD CONSTRAINT chk_agent_type CHECK (agent_type IN ('voice', 'text_only', 'vision'));

-- ========================================
-- 4. Insert sample external providers
-- ========================================

-- STT Providers
INSERT INTO public.ai_providers (name, type, api_url, unit, cost_per_unit) VALUES
('OpenAI Whisper', 'STT', 'https://api.openai.com/v1/audio/transcriptions', 'minute', 0.006),
('Google Speech-to-Text', 'STT', 'https://speech.googleapis.com/v1/speech:recognize', 'minute', 0.016),
('Azure Speech Services', 'STT', 'https://eastus.stt.speech.microsoft.com/speech/recognition/conversation/cognitiveservices/v1', 'minute', 0.012)
ON CONFLICT DO NOTHING;

-- TTS Providers  
INSERT INTO public.ai_providers (name, type, api_url, unit, cost_per_unit) VALUES
('OpenAI TTS', 'TTS', 'https://api.openai.com/v1/audio/speech', 'character', 0.000015),
('ElevenLabs', 'TTS', 'https://api.elevenlabs.io/v1/text-to-speech', 'character', 0.00003),
('Google Text-to-Speech', 'TTS', 'https://texttospeech.googleapis.com/v1/text:synthesize', 'character', 0.000016)
ON CONFLICT DO NOTHING;

-- LLM Providers
INSERT INTO public.ai_providers (name, type, api_url, unit, cost_per_unit) VALUES
('OpenAI GPT-4', 'LLM', 'https://api.openai.com/v1/chat/completions', 'token', 0.00003),
('OpenAI GPT-3.5 Turbo', 'LLM', 'https://api.openai.com/v1/chat/completions', 'token', 0.000002),
('Anthropic Claude', 'LLM', 'https://api.anthropic.com/v1/messages', 'token', 0.000015),
('Google Gemini Pro', 'LLM', 'https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent', 'token', 0.0000005)
ON CONFLICT DO NOTHING;

-- ========================================
-- 5. Add comments for documentation
-- ========================================

COMMENT ON TABLE public.settings_global IS 'Global application settings stored as key-value pairs with JSONB values';
COMMENT ON TABLE public.ai_providers IS 'External AI providers configuration for STT, TTS, and LLM services';
COMMENT ON COLUMN public.pype_voice_agents.provider_config IS 'JSON configuration storing agent AI provider settings (built-in or external)';
COMMENT ON COLUMN public.pype_voice_agents.agent_type IS 'Type of agent: voice (default), text_only, or vision';

-- ========================================
-- 6. Create view for agent costs calculation
-- ========================================

CREATE OR REPLACE VIEW agent_cost_summary AS
SELECT 
    a.id,
    a.name,
    a.agent_type,
    a.provider_config,
    a.currency,
    CASE 
        WHEN (a.provider_config->>'mode') = 'builtin' OR a.provider_config = '{}'::jsonb THEN
            (SELECT (value->>'cost_per_minute')::numeric FROM settings_global WHERE key = 'builtin_models')
        WHEN (a.provider_config->>'mode') = 'external' THEN
            COALESCE((a.provider_config->'stt'->>'cost_per_minute')::numeric, 0) +
            COALESCE((a.provider_config->'tts'->>'cost_per_word')::numeric * 100, 0) + -- Estimated 100 words per minute
            COALESCE((a.provider_config->'llm'->>'cost_per_token')::numeric * 1000, 0) -- Estimated 1000 tokens per minute
        ELSE 0
    END as estimated_cost_per_minute
FROM public.pype_voice_agents a
WHERE a.is_active = true;

COMMENT ON VIEW agent_cost_summary IS 'View providing estimated costs per minute for each agent based on their provider configuration';

-- ========================================
-- 7. Update materialized view to include provider costs
-- ========================================

-- Note: This will be handled separately to avoid breaking existing view
-- The existing call_summary_materialized view should be updated to use provider_config costs
