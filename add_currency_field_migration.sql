-- Migration: Add currency field to pype_voice_agents table
-- Date: 2025-08-30
-- Description: Add currency field to support agent-specific currency settings

-- Add currency field to agents table
ALTER TABLE public.pype_voice_agents 
ADD COLUMN IF NOT EXISTS currency VARCHAR(3) DEFAULT 'USD';

-- Create index for better performance on currency queries
CREATE INDEX IF NOT EXISTS idx_agents_currency ON public.pype_voice_agents(currency);

-- Add comment to document the field
COMMENT ON COLUMN public.pype_voice_agents.currency IS 'ISO 4217 currency code (e.g., USD, EUR, GBP) for cost calculations';

-- Update existing records to have USD as default currency
UPDATE public.pype_voice_agents 
SET currency = 'USD' 
WHERE currency IS NULL;
