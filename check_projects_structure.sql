-- Vérifier la structure de la table pype_voice_projects
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'pype_voice_projects'
    AND table_schema = 'public'
ORDER BY ordinal_position;

-- Vérifier la structure de billing_invoices existante
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'billing_invoices'
    AND table_schema = 'public'
ORDER BY ordinal_position;
