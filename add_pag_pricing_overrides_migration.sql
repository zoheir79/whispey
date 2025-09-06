-- Migration: Ajouter les champs PAG pricing overrides pour KB et Workflow
-- Date: $(date)
-- Description: Ajoute les colonnes pour les overrides de prix PAG des Knowledge Bases et Workflows

-- 1. Ajouter les champs PAG pricing dans la table des settings globaux
DO $$
BEGIN
    -- Vérifier si la colonne pricing_rates_pag existe et ajouter les nouveaux champs PAG
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'global_settings' AND column_name = 'pricing_rates_pag') THEN
        -- Mettre à jour la structure JSON pour inclure les nouveaux champs PAG
        UPDATE global_settings 
        SET pricing_rates_pag = pricing_rates_pag || jsonb_build_object(
            'kb_per_query', 0.001,
            'kb_per_upload_mb', 0.01, 
            'workflow_per_execution', 0.05,
            'workflow_per_cpu_minute', 0.02
        )
        WHERE pricing_rates_pag IS NOT NULL;
        
        RAISE NOTICE 'Mis à jour pricing_rates_pag avec les nouveaux champs PAG KB/Workflow';
    END IF;
END $$;

-- 2. Ajouter les colonnes d'override PAG dans la table pype_voice_knowledge_bases
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'pype_voice_knowledge_bases' AND column_name = 'kb_per_query_override') THEN
        ALTER TABLE pype_voice_knowledge_bases 
        ADD COLUMN kb_per_query_override DECIMAL(10,6) DEFAULT NULL,
        ADD COLUMN kb_per_upload_mb_override DECIMAL(10,6) DEFAULT NULL;
        
        RAISE NOTICE 'Ajouté colonnes kb_per_query_override et kb_per_upload_mb_override dans pype_voice_knowledge_bases';
    END IF;
END $$;

-- 3. Ajouter les colonnes d'override PAG dans la table pype_voice_workflows  
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'pype_voice_workflows' AND column_name = 'workflow_per_execution_override') THEN
        ALTER TABLE pype_voice_workflows 
        ADD COLUMN workflow_per_execution_override DECIMAL(10,6) DEFAULT NULL,
        ADD COLUMN workflow_per_cpu_minute_override DECIMAL(10,6) DEFAULT NULL;
        
        RAISE NOTICE 'Ajouté colonnes workflow_per_execution_override et workflow_per_cpu_minute_override dans pype_voice_workflows';
    END IF;
END $$;

-- 4. Ajouter des commentaires pour documentation
COMMENT ON COLUMN pype_voice_knowledge_bases.kb_per_query_override IS 'Override du prix PAG par requête pour cette KB (optionnel)';
COMMENT ON COLUMN pype_voice_knowledge_bases.kb_per_upload_mb_override IS 'Override du prix PAG par MB uploadé pour cette KB (optionnel)';
COMMENT ON COLUMN pype_voice_workflows.workflow_per_execution_override IS 'Override du prix PAG par exécution pour ce workflow (optionnel)';
COMMENT ON COLUMN pype_voice_workflows.workflow_per_cpu_minute_override IS 'Override du prix PAG par minute CPU pour ce workflow (optionnel)';

-- 5. Vérification finale
DO $$
BEGIN
    RAISE NOTICE 'Migration PAG pricing overrides terminée avec succès!';
    RAISE NOTICE 'Nouvelles colonnes ajoutées:';
    RAISE NOTICE '- pype_voice_knowledge_bases: kb_per_query_override, kb_per_upload_mb_override';  
    RAISE NOTICE '- pype_voice_workflows: workflow_per_execution_override, workflow_per_cpu_minute_override';
    RAISE NOTICE 'Prix PAG par défaut configurés dans global_settings.pricing_rates_pag';
END $$;
