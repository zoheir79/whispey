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
-- SOLUTION IMMÉDIATE : Promouvoir l'utilisateur actuellement connecté
-- ========================================

-- Promote current authenticated user to super_admin
UPDATE pype_voice_users 
SET global_role = 'super_admin',
    email = 'djennanezoheir@gmail.com',
    name = 'Super Administrator',
    first_name = 'Zoheir',
    last_name = 'Djennane'
WHERE user_id = 'b781ff78-76a6-46d1-870a-f73d62924a46';

-- Add mapping to existing project
INSERT INTO pype_voice_email_project_mapping (
    email, 
    project_id, 
    role, 
    is_active, 
    created_at, 
    added_by_user_id
) VALUES (
    'djennanezoheir@gmail.com',
    'ddd115e9-9902-4946-97b2-30c9c4ea325d',
    'owner',
    true,
    NOW(),
    'b781ff78-76a6-46d1-870a-f73d62924a46'
) ON CONFLICT (email, project_id) DO UPDATE 
SET role = 'owner', is_active = true;

-- Verify the changes
SELECT user_id, email, global_role, name FROM pype_voice_users 
WHERE user_id = 'b781ff78-76a6-46d1-870a-f73d62924a46';

SELECT * FROM pype_voice_email_project_mapping 
WHERE email = 'djennanezoheir@gmail.com';

-- ========================================
-- 6. Lister tous les utilisateurs
-- ========================================

-- Liste complète des utilisateurs avec leurs rôles
SELECT 
    user_id,
    email,
    name,
    first_name,
    last_name,
    global_role,
    created_at,
    updated_at
FROM pype_voice_users 
ORDER BY created_at DESC;

-- Uniquement les utilisateurs avec des rôles spéciaux
SELECT 
    user_id,
    email,
    name,
    global_role,
    created_at
FROM pype_voice_users 
WHERE global_role IN ('admin', 'super_admin')
ORDER BY created_at DESC;

-- Compter les utilisateurs par rôle
SELECT 
    global_role,
    COUNT(*) as count
FROM pype_voice_users 
GROUP BY global_role
ORDER BY count DESC;

-- ========================================
-- 7. Nettoyer les utilisateurs dupliqués
-- ========================================

-- GARDER: Utilisateur original (bon utilisateur)
-- b60b1985-87b3-4744-9891-5ab8bb9bf782 | djennanezoheir@gmail.com | créé 2025-08-24

-- SUPPRIMER: Utilisateur dupliqué (mauvais utilisateur) 
-- b781ff78-76a6-46d1-870a-f73d62924a46 | djennanezoheir@gmail.com | créé 2025-08-28

-- 1. Trouver les projets appartenant au mauvais utilisateur
SELECT id, name, owner_user_id FROM pype_voice_projects 
WHERE owner_user_id = 'b781ff78-76a6-46d1-870a-f73d62924a46';

-- 2. Transférer la propriété des projets vers le bon utilisateur
UPDATE pype_voice_projects 
SET owner_user_id = 'b60b1985-87b3-4744-9891-5ab8bb9bf782'
WHERE owner_user_id = 'b781ff78-76a6-46d1-870a-f73d62924a46';

-- 3. Supprimer les mappings du mauvais utilisateur
DELETE FROM pype_voice_email_project_mapping 
WHERE added_by_user_id = 'b781ff78-76a6-46d1-870a-f73d62924a46';

-- 4. Supprimer le mauvais utilisateur
DELETE FROM pype_voice_users 
WHERE user_id = 'b781ff78-76a6-46d1-870a-f73d62924a46';

-- ========================================
-- 8. Ajouter système d'approbation utilisateurs
-- ========================================

-- Ajouter colonne status à la table users
ALTER TABLE pype_voice_users 
ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'active',
ADD COLUMN IF NOT EXISTS approved_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS approved_by VARCHAR(255);

-- Mettre tous les utilisateurs existants comme 'active'
UPDATE pype_voice_users 
SET status = 'active' 
WHERE status IS NULL;

-- Index pour performance
CREATE INDEX IF NOT EXISTS idx_users_status ON pype_voice_users(status);

-- 3. Vérifier qu'il reste seulement le bon utilisateur
SELECT 
    user_id,
    email,
    name,
    global_role,
    created_at
FROM pype_voice_users 
WHERE email = 'djennanezoheir@gmail.com'
ORDER BY created_at;

-- 4. Vérifier les mappings projets
SELECT * FROM pype_voice_email_project_mapping 
WHERE email = 'djennanezoheir@gmail.com';

-- IMPORTANT: Après cette suppression, il faudra se déconnecter/reconnecter
-- car le JWT actuel contient le user_id supprimé

-- ========================================
-- NOTES IMPORTANTES :
-- ========================================

-- Les rôles disponibles sont :
-- - 'user' : Utilisateur normal (par défaut)
-- - 'admin' : Admin global (voit tous les workspaces, agents, calls)
-- - 'super_admin' : Super admin (tous les droits + gestion globale)

-- L'authentification par mot de passe se fait via votre système JWT existant
-- Ces utilisateurs pourront se connecter avec leur email via votre système d'auth

-- ========================================
-- 8. DIAGNOSTIC URGENT - Vérifier l'état actuel
-- ========================================

-- Vérifier les utilisateurs restants
SELECT user_id, email, name, global_role, created_at 
FROM pype_voice_users 
WHERE email = 'djennanezoheir@gmail.com'
ORDER BY created_at;

-- Vérifier tous les projets et leurs propriétaires
SELECT 
    p.id as project_id,
    p.name as project_name,
    p.owner_user_id,
    u.email as owner_email,
    u.name as owner_name
FROM pype_voice_projects p
LEFT JOIN pype_voice_users u ON p.owner_user_id = u.user_id
ORDER BY p.created_at DESC;

-- Vérifier les mappings projet-email
SELECT * FROM pype_voice_email_project_mapping 
WHERE email = 'djennanezoheir@gmail.com'
ORDER BY created_at DESC;

-- ========================================
-- 9. SOLUTION DE RÉCUPÉRATION
-- ========================================

-- Si l'utilisateur original existe encore, créer/réparer les mappings
INSERT INTO pype_voice_email_project_mapping (
    email,
    project_id,
    role,
    is_active,
    created_at,
    added_by_user_id
)
SELECT 
    'djennanezoheir@gmail.com',
    p.id,
    'owner',
    true,
    NOW(),
    'b60b1985-87b3-4744-9891-5ab8bb9bf782'
FROM pype_voice_projects p
WHERE p.owner_user_id = 'b60b1985-87b3-4744-9891-5ab8bb9bf782'
ON CONFLICT (email, project_id) DO UPDATE 
SET role = 'owner', is_active = true;
