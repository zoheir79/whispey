-- Add password_hash column to pype_voice_users table
ALTER TABLE public.pype_voice_users ADD COLUMN IF NOT EXISTS password_hash TEXT;

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
