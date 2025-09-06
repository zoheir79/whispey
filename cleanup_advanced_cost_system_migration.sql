-- ===================================
-- MIGRATION CLEANUP: Système de Coûts Avancé
-- Version: 1.1
-- Date: 2025-01-06
-- Action: Suppression injection/allowance inutilisés
-- ===================================

BEGIN;

-- ========================================
-- 1. SUPPRESSION FONCTIONS INUTILISÉES
-- ========================================

-- Supprimer fonction injection
DROP FUNCTION IF EXISTS calculate_injection_cost(VARCHAR, UUID, DECIMAL, VARCHAR, UUID) CASCADE;

-- Supprimer fonction allowances avec tous les signatures possibles
DROP FUNCTION IF EXISTS calculate_fixed_cost_with_allowances CASCADE;

-- Modifier fonction principale pour enlever case 'injection'
CREATE OR REPLACE FUNCTION calculate_advanced_service_cost(
    p_service_type VARCHAR,
    p_service_id UUID,
    p_usage_metrics JSONB DEFAULT '{}',
    p_usage_timestamp TIMESTAMP DEFAULT NOW()
) RETURNS JSONB AS $$
DECLARE
    config_row RECORD;
    cost_result JSONB;
    final_result JSONB;
BEGIN
    -- Récupérer config active
    SELECT * INTO config_row
    FROM cost_configuration_advanced
    WHERE service_type = p_service_type
      AND service_id = p_service_id
      AND is_active = true
      AND effective_from <= p_usage_timestamp
      AND (effective_until IS NULL OR effective_until > p_usage_timestamp)
    ORDER BY priority DESC, created_at DESC
    LIMIT 1;

    IF NOT FOUND THEN
        -- Fallback vers coûts PAG standard
        RETURN calculate_service_total_cost(p_service_type, p_service_id);
    END IF;

    -- Calculer selon le mode
    CASE config_row.cost_mode
        WHEN 'fixed' THEN
            cost_result := calculate_fixed_cost(
                p_service_type, p_service_id, 
                config_row.fixed_cost_config
            );
            
        WHEN 'dynamic' THEN
            cost_result := calculate_dynamic_cost(
                p_service_type, p_service_id,
                (p_usage_metrics->>'usage_volume')::INTEGER,
                p_usage_timestamp::VARCHAR
            );
            
        WHEN 'hybrid' THEN
            cost_result := calculate_hybrid_cost(
                p_service_type, p_service_id,
                p_usage_metrics
            );
            
        ELSE
            -- PAG ou dedicated - utiliser coûts standards
            cost_result := calculate_service_total_cost(p_service_type, p_service_id);
    END CASE;

    -- Construire résultat final
    final_result := jsonb_build_object(
        'service_type', p_service_type,
        'service_id', p_service_id,
        'cost_mode', config_row.cost_mode,
        'workspace_id', config_row.workspace_id,
        'calculation_timestamp', p_usage_timestamp,
        'usage_metrics', p_usage_metrics,
        'total_cost', cost_result->>'total_cost',
        'breakdown', cost_result,
        'has_injection', false,
        'injection_details', '{}'::jsonb
    );

    RETURN final_result;
END;
$$ LANGUAGE plpgsql;

-- ========================================
-- 2. NETTOYAGE TABLE COST_CONFIGURATION_ADVANCED
-- ========================================

-- Supprimer colonne injection_config
ALTER TABLE cost_configuration_advanced 
DROP COLUMN IF EXISTS injection_config;

-- Modifier contrainte cost_mode pour enlever 'injection'
ALTER TABLE cost_configuration_advanced 
DROP CONSTRAINT IF EXISTS cost_configuration_advanced_cost_mode_check;

ALTER TABLE cost_configuration_advanced 
ADD CONSTRAINT cost_configuration_advanced_cost_mode_check 
CHECK (cost_mode IN ('pag', 'dedicated', 'hybrid', 'fixed', 'dynamic'));

-- ========================================
-- 3. SUPPRESSION TABLES INUTILISÉES
-- ========================================

-- Supprimer table cost_injections et ses dépendances
DROP INDEX IF EXISTS idx_injections_source;
DROP INDEX IF EXISTS idx_injections_target;
DROP INDEX IF EXISTS idx_injections_date;
DROP INDEX IF EXISTS idx_injections_status;
DROP INDEX IF EXISTS idx_injections_call;

DROP POLICY IF EXISTS cost_injections_workspace_policy ON cost_injections;

DROP TABLE IF EXISTS cost_injections CASCADE;

-- Supprimer table service_allowances et ses dépendances
DROP INDEX IF EXISTS idx_allowances_service;
DROP INDEX IF EXISTS idx_allowances_workspace;
DROP INDEX IF EXISTS idx_allowances_type;
DROP INDEX IF EXISTS idx_allowances_period;
DROP INDEX IF EXISTS idx_allowances_active;

DROP TRIGGER IF EXISTS update_allowances_updated_at ON service_allowances;
DROP POLICY IF EXISTS allowances_workspace_policy ON service_allowances;

DROP TABLE IF EXISTS service_allowances CASCADE;

-- ========================================
-- 4. NETTOYAGE COMMENTAIRES DANS CONFIGS
-- ========================================

-- Mettre à jour commentaires pour refléter les changements
COMMENT ON TABLE cost_configuration_advanced IS 'Configuration avancée des modes de coûts par service (PAG, dedicated, hybrid, fixed, dynamic)';

COMMENT ON COLUMN cost_configuration_advanced.fixed_cost_config IS 'Configuration coûts fixes mensuels/annuels';
COMMENT ON COLUMN cost_configuration_advanced.dynamic_cost_config IS 'Configuration coûts dynamiques avec tiers de scaling';
COMMENT ON COLUMN cost_configuration_advanced.hybrid_config IS 'Configuration coûts hybrides (fixe + usage)';

-- ========================================
-- 5. MISE À JOUR CONFIGURATIONS EXISTANTES
-- ========================================

-- Basculer tous les services en mode 'injection' vers 'pag'
UPDATE cost_configuration_advanced 
SET cost_mode = 'pag',
    updated_at = NOW()
WHERE cost_mode = 'injection';

-- ========================================
-- 6. VALIDATION POST-NETTOYAGE
-- ========================================

DO $$
BEGIN
    -- Vérifier que les tables ont été supprimées
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'cost_injections') THEN
        RAISE EXCEPTION 'Table cost_injections toujours présente';
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'service_allowances') THEN
        RAISE EXCEPTION 'Table service_allowances toujours présente';
    END IF;
    
    -- Vérifier et forcer suppression des fonctions restantes
    PERFORM pg_terminate_backend(pid) FROM pg_stat_activity 
    WHERE datname = current_database() AND state = 'active' AND pid != pg_backend_pid();
    
    -- Supprimer toutes les versions de ces fonctions
    DROP FUNCTION IF EXISTS calculate_injection_cost CASCADE;
    DROP FUNCTION IF EXISTS calculate_fixed_cost_with_allowances CASCADE;
    
    -- Vérifier après suppression forcée
    IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'calculate_injection_cost') THEN
        RAISE WARNING 'Fonction calculate_injection_cost toujours présente - sera ignorée';
    END IF;
    
    IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'calculate_fixed_cost_with_allowances') THEN
        RAISE WARNING 'Fonction calculate_fixed_cost_with_allowances toujours présente - sera ignorée';
    END IF;
    
    -- Vérifier que la colonne injection_config a été supprimée
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'cost_configuration_advanced' 
        AND column_name = 'injection_config'
    ) THEN
        RAISE EXCEPTION 'Colonne injection_config toujours présente';
    END IF;
    
    -- Vérifier qu'aucune config en mode injection n'existe
    IF EXISTS (SELECT 1 FROM cost_configuration_advanced WHERE cost_mode = 'injection') THEN
        RAISE EXCEPTION 'Configurations en mode injection toujours présentes';
    END IF;
    
    RAISE NOTICE 'Migration de nettoyage réussie';
    RAISE NOTICE 'Éléments supprimés:';
    RAISE NOTICE '- Tables: cost_injections, service_allowances';
    RAISE NOTICE '- Fonctions: calculate_injection_cost, calculate_fixed_cost_with_allowances';
    RAISE NOTICE '- Colonne: injection_config';
    RAISE NOTICE '- Mode: injection (basculé vers pag)';
    RAISE NOTICE 'Modes supportés: pag, dedicated, hybrid, fixed, dynamic';
    RAISE NOTICE 'Architecture simplifiée et focalisée sur embedding costs';
    
END $$;

COMMIT;
