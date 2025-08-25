-- Global Role Migration: Add global roles system
-- This script adds global roles that transcend project-specific permissions

-- ========================================
-- 1. Add global_role column to users table
-- ========================================

ALTER TABLE public.pype_voice_users 
ADD COLUMN IF NOT EXISTS global_role VARCHAR(20) DEFAULT 'user';

-- Set allowed values for global_role
ALTER TABLE public.pype_voice_users 
ADD CONSTRAINT IF NOT EXISTS chk_global_role 
CHECK (global_role IN ('user', 'admin', 'super_admin'));

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_pype_voice_users_global_role 
ON public.pype_voice_users(global_role);

-- ========================================
-- 2. Update existing users with default role
-- ========================================

-- Set all existing users to 'user' role by default
UPDATE public.pype_voice_users 
SET global_role = 'user' 
WHERE global_role IS NULL;

-- ========================================
-- 3. Create global permissions view
-- ========================================

-- Create a view to easily check global permissions
CREATE OR REPLACE VIEW user_global_permissions AS
SELECT 
    u.id,
    u.user_id,
    u.email,
    u.global_role,
    CASE 
        WHEN u.global_role = 'super_admin' THEN TRUE
        WHEN u.global_role = 'admin' THEN TRUE
        ELSE FALSE
    END as can_view_all_projects,
    CASE 
        WHEN u.global_role = 'super_admin' THEN TRUE
        WHEN u.global_role = 'admin' THEN TRUE
        ELSE FALSE
    END as can_view_all_agents,
    CASE 
        WHEN u.global_role = 'super_admin' THEN TRUE
        WHEN u.global_role = 'admin' THEN TRUE
        ELSE FALSE
    END as can_view_all_calls,
    CASE 
        WHEN u.global_role = 'super_admin' THEN TRUE
        ELSE FALSE
    END as can_manage_global_settings
FROM public.pype_voice_users u;

-- ========================================
-- 4. Add comments for documentation
-- ========================================

COMMENT ON COLUMN public.pype_voice_users.global_role IS 'Global role: user (default), admin (can view all resources), super_admin (can manage everything)';
COMMENT ON VIEW user_global_permissions IS 'View providing global permission flags based on user global_role';

-- ========================================
-- 5. Example: Set first user as admin (optional)
-- ========================================

-- Uncomment the following line to set the first user as admin:
-- UPDATE public.pype_voice_users SET global_role = 'admin' WHERE id = (SELECT id FROM public.pype_voice_users ORDER BY created_at LIMIT 1);
