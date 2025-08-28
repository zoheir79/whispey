-- Créer un utilisateur admin avec email et mot de passe
-- Remplacez les valeurs entre < > par vos propres valeurs

-- ========================================
-- 1. Créer l'utilisateur admin
-- ========================================

INSERT INTO public.pype_voice_users (
    user_id,
    email, 
    name,
    global_role,
    created_at,
    updated_at
) VALUES (
    gen_random_uuid(),                    -- Génère un UUID unique
    'admin@adexgenie.ai',                 -- Remplacez par votre email
    'Administrator',                      -- Nom d'affichage
    'super_admin',                             -- Rôle global admin
    NOW(),
    NOW()
) ON CONFLICT (email) DO UPDATE SET
    global_role = 'super_admin',
    updated_at = NOW();

-- ========================================
-- 2. Alternative : Mettre un utilisateur existant en admin
-- ========================================

-- Si l'utilisateur existe déjà, utilisez cette requête :
UPDATE public.pype_voice_users 
SET global_role = 'super_admin', updated_at = NOW() 
WHERE email = 'djennanezoheir@gmail.com';

-- ========================================
-- 3. Pour créer un SUPER ADMIN (tous les droits)
-- ========================================

-- Créer un super admin
INSERT INTO public.pype_voice_users (
    user_id,
    email, 
    name,
    global_role,
    created_at,
    updated_at
) VALUES (
    gen_random_uuid(),
    'djennanezoheir@gmail.com',           -- Remplacez par votre email
    'Super Administrator',               -- Nom d'affichage
    'super_admin',                      -- Rôle global super admin
    NOW(),
    NOW()
) ON CONFLICT (email) DO UPDATE SET
    global_role = 'super_admin',
    updated_at = NOW();

-- ========================================
-- 4. Vérifier les utilisateurs créés
-- ========================================

-- Voir tous les utilisateurs avec leurs rôles
SELECT 
    user_id,
    email,
    name,
    global_role,
    created_at
FROM public.pype_voice_users 
WHERE global_role IN ('admin', 'super_admin')
ORDER BY created_at DESC;

-- ========================================
-- 5. Voir les permissions d'un utilisateur
-- ========================================

-- Utiliser la vue que nous avons créée
SELECT * FROM user_global_permissions 
WHERE email = 'admin@whispey.com';

-- ========================================
-- NOTES IMPORTANTES :
-- ========================================

-- Les rôles disponibles sont :
-- - 'user' : Utilisateur normal (par défaut)
-- - 'admin' : Admin global (voit tous les workspaces, agents, calls)
-- - 'super_admin' : Super admin (tous les droits + gestion globale)

-- L'authentification par mot de passe se fait via votre système JWT existant
-- Ces utilisateurs pourront se connecter avec leur email via votre système d'auth
