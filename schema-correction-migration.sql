-- Schema Correction Migration: Fix user_id references
-- This script corrects the mismatch between migrated code and database schema

-- ========================================
-- 1. Add missing user_id columns
-- ========================================

-- Add user_id column to pype_voice_users (maps to id field)
ALTER TABLE public.pype_voice_users 
ADD COLUMN IF NOT EXISTS user_id UUID DEFAULT gen_random_uuid();

-- Make user_id unique and set it equal to id for existing records
UPDATE public.pype_voice_users SET user_id = id WHERE user_id IS NULL;
ALTER TABLE public.pype_voice_users ALTER COLUMN user_id SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_pype_voice_users_user_id ON public.pype_voice_users(user_id);

-- ========================================
-- 2. Fix projects table references
-- ========================================

-- Add owner_user_id column to replace owner_clerk_id
ALTER TABLE public.pype_voice_projects 
ADD COLUMN IF NOT EXISTS owner_user_id UUID;

-- Add foreign key constraint (check if exists first)
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_projects_owner_user_id') THEN
        ALTER TABLE public.pype_voice_projects 
        ADD CONSTRAINT fk_projects_owner_user_id 
        FOREIGN KEY (owner_user_id) REFERENCES public.pype_voice_users(user_id);
    END IF;
END $$;

-- ========================================
-- 3. Fix email project mapping table
-- ========================================

-- Add user_id column to replace clerk_id
ALTER TABLE public.pype_voice_email_project_mapping 
ADD COLUMN IF NOT EXISTS user_id UUID;

-- Add added_by_user_id column to replace added_by_clerk_id  
ALTER TABLE public.pype_voice_email_project_mapping 
ADD COLUMN IF NOT EXISTS added_by_user_id UUID;

-- Add foreign key constraints (check if exists first)
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_mapping_user_id') THEN
        ALTER TABLE public.pype_voice_email_project_mapping 
        ADD CONSTRAINT fk_mapping_user_id 
        FOREIGN KEY (user_id) REFERENCES public.pype_voice_users(user_id);
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_mapping_added_by_user_id') THEN
        ALTER TABLE public.pype_voice_email_project_mapping 
        ADD CONSTRAINT fk_mapping_added_by_user_id 
        FOREIGN KEY (added_by_user_id) REFERENCES public.pype_voice_users(user_id);
    END IF;
END $$;

-- ========================================
-- 4. Add missing columns detected in code
-- ========================================

-- Add vapi_api_key_encrypted and vapi_project_key_encrypted to agents table if missing
ALTER TABLE public.pype_voice_agents 
ADD COLUMN IF NOT EXISTS vapi_api_key_encrypted TEXT;

ALTER TABLE public.pype_voice_agents 
ADD COLUMN IF NOT EXISTS vapi_project_key_encrypted TEXT;

-- ========================================
-- 5. Add missing columns for call logs compatibility
-- ========================================

-- Ensure all required columns exist in call logs table
ALTER TABLE public.pype_voice_call_logs 
ADD COLUMN IF NOT EXISTS transcript_with_metrics JSONB;

-- ========================================
-- 6. Create indexes for performance
-- ========================================

-- Index on user_id for faster lookups
CREATE INDEX IF NOT EXISTS idx_pype_voice_users_user_id_lookup ON public.pype_voice_users(user_id);

-- Index on project mappings
CREATE INDEX IF NOT EXISTS idx_email_mapping_user_id ON public.pype_voice_email_project_mapping(user_id);
CREATE INDEX IF NOT EXISTS idx_email_mapping_project_id ON public.pype_voice_email_project_mapping(project_id);

-- Index on agents user_id
CREATE INDEX IF NOT EXISTS idx_agents_user_id ON public.pype_voice_agents(user_id);

-- ========================================
-- 7. Add constraints for data integrity
-- ========================================

-- Ensure projects have valid foreign key references (check if exists first)
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_projects_owner') THEN
        ALTER TABLE public.pype_voice_projects 
        ADD CONSTRAINT fk_projects_owner 
        FOREIGN KEY (owner_user_id) REFERENCES public.pype_voice_users(user_id);
    END IF;
END $$;

-- Ensure agents have valid foreign key references (check if exists first)
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_agents_user') THEN
        ALTER TABLE public.pype_voice_agents 
        ADD CONSTRAINT fk_agents_user 
        FOREIGN KEY (user_id) REFERENCES public.pype_voice_users(user_id);
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_agents_project') THEN
        ALTER TABLE public.pype_voice_agents 
        ADD CONSTRAINT fk_agents_project 
        FOREIGN KEY (project_id) REFERENCES public.pype_voice_projects(id);
    END IF;
END $$;

-- ========================================
-- 8. Optional: Add name column to users (combined first_name + last_name)
-- ========================================

-- Add name column for JWT compatibility (combines first_name + last_name)
ALTER TABLE public.pype_voice_users 
ADD COLUMN IF NOT EXISTS name TEXT;

-- Update name column from existing first_name and last_name
UPDATE public.pype_voice_users 
SET name = TRIM(COALESCE(first_name, '') || ' ' || COALESCE(last_name, ''))
WHERE name IS NULL AND (first_name IS NOT NULL OR last_name IS NOT NULL);

-- ========================================
-- VERIFICATION QUERIES
-- ========================================

-- Check if all required columns exist
SELECT 
    table_name,
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns 
WHERE table_schema = 'public' 
AND table_name IN ('pype_voice_users', 'pype_voice_projects', 'pype_voice_email_project_mapping', 'pype_voice_agents', 'pype_voice_call_logs')
AND column_name IN ('user_id', 'owner_user_id', 'added_by_user_id', 'vapi_api_key_encrypted', 'vapi_project_key_encrypted', 'transcript_with_metrics', 'name')
ORDER BY table_name, column_name;

-- Verification message
SELECT 'Schema correction migration completed successfully!' AS status;
