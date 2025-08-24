-- ========================================
-- JWT Authentication Migration - CRITICAL FIXES
-- ========================================

-- Add password_hash column to pype_voice_users table
ALTER TABLE public.pype_voice_users ADD COLUMN IF NOT EXISTS password_hash TEXT;

-- ========================================
-- CRITICAL: Add missing user_id column mapping
-- ========================================

-- Add user_id column that our migrated code expects
ALTER TABLE public.pype_voice_users 
ADD COLUMN IF NOT EXISTS user_id UUID DEFAULT gen_random_uuid();

-- Make user_id unique and set it equal to id for existing records
UPDATE public.pype_voice_users SET user_id = id WHERE user_id IS NULL;
ALTER TABLE public.pype_voice_users ALTER COLUMN user_id SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_pype_voice_users_user_id ON public.pype_voice_users(user_id);

-- ========================================
-- Fix projects table references
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
-- Fix email project mapping table
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
-- Add missing VAPI columns for agents
-- ========================================

-- Add VAPI encryption columns that our code expects
ALTER TABLE public.pype_voice_agents 
ADD COLUMN IF NOT EXISTS vapi_api_key_encrypted TEXT;

ALTER TABLE public.pype_voice_agents 
ADD COLUMN IF NOT EXISTS vapi_project_key_encrypted TEXT;

-- ========================================
-- Add missing call logs columns
-- ========================================

-- Ensure transcript_with_metrics column exists
ALTER TABLE public.pype_voice_call_logs 
ADD COLUMN IF NOT EXISTS transcript_with_metrics JSONB;

-- ========================================
-- Add combined name column for JWT compatibility
-- ========================================

-- Add name column (combines first_name + last_name)
ALTER TABLE public.pype_voice_users 
ADD COLUMN IF NOT EXISTS name TEXT;

-- Update name column from existing first_name and last_name
UPDATE public.pype_voice_users 
SET name = TRIM(COALESCE(first_name, '') || ' ' || COALESCE(last_name, ''))
WHERE name IS NULL AND (first_name IS NOT NULL OR last_name IS NOT NULL);

-- ========================================
-- Add performance indexes
-- ========================================

-- Index on user_id for faster lookups
CREATE INDEX IF NOT EXISTS idx_pype_voice_users_user_id_lookup ON public.pype_voice_users(user_id);
CREATE INDEX IF NOT EXISTS idx_email_mapping_user_id ON public.pype_voice_email_project_mapping(user_id);
CREATE INDEX IF NOT EXISTS idx_email_mapping_project_id ON public.pype_voice_email_project_mapping(project_id);
CREATE INDEX IF NOT EXISTS idx_agents_user_id ON public.pype_voice_agents(user_id);

-- ========================================
-- Add foreign key constraints for data integrity
-- ========================================

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
-- OPTIONAL: Clean up old Clerk columns (after migration testing)
-- ========================================

-- Remove clerk_id column from pype_voice_users table (optional, you can keep it if needed for migration)
-- ALTER TABLE public.pype_voice_users DROP COLUMN IF EXISTS clerk_id;

-- Remove owner_clerk_id column from pype_voice_projects table (optional, you can keep it if needed for migration)  
-- ALTER TABLE public.pype_voice_projects DROP COLUMN IF EXISTS owner_clerk_id;

-- Remove clerk_id column from pype_voice_email_project_mapping table (optional, you can keep it if needed for migration)
-- ALTER TABLE public.pype_voice_email_project_mapping DROP COLUMN IF EXISTS clerk_id;
-- ALTER TABLE public.pype_voice_email_project_mapping DROP COLUMN IF EXISTS added_by_clerk_id;

-- Note: The commented out DROP COLUMN statements are optional.
-- You may want to keep these columns during the transition period
-- and remove them later once the migration is complete.

-- ========================================
-- VERIFICATION
-- ========================================

SELECT 'JWT Authentication migration with schema fixes completed successfully!' AS status;
