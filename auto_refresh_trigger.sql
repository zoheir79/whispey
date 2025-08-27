-- ============================================
-- TRIGGER AUTOMATIQUE POUR RAFRAÎCHIR LA VUE MATÉRIALISÉE
-- Exécuté automatiquement après chaque insertion de call
-- ============================================

-- 1. Créer la fonction trigger
CREATE OR REPLACE FUNCTION refresh_call_summary_trigger()
RETURNS TRIGGER AS $$
BEGIN
    -- Rafraîchir la vue matérialisée après insertion/update/delete
    REFRESH MATERIALIZED VIEW CONCURRENTLY call_summary_materialized;
    
    -- Log pour debugging (optionnel)
    RAISE NOTICE 'Vue matérialisée call_summary_materialized rafraîchie automatiquement pour call_id: %', NEW.call_id;
    
    RETURN CASE 
        WHEN TG_OP = 'DELETE' THEN OLD
        ELSE NEW
    END;
END;
$$ LANGUAGE plpgsql;

-- 2. Créer le trigger sur INSERT
CREATE TRIGGER trigger_refresh_call_summary_on_insert
    AFTER INSERT ON pype_voice_call_logs
    FOR EACH ROW
    EXECUTE FUNCTION refresh_call_summary_trigger();

-- 3. Créer le trigger sur UPDATE
CREATE TRIGGER trigger_refresh_call_summary_on_update
    AFTER UPDATE ON pype_voice_call_logs
    FOR EACH ROW
    EXECUTE FUNCTION refresh_call_summary_trigger();

-- 4. Créer le trigger sur DELETE
CREATE TRIGGER trigger_refresh_call_summary_on_delete
    AFTER DELETE ON pype_voice_call_logs
    FOR EACH ROW
    EXECUTE FUNCTION refresh_call_summary_trigger();

-- 5. Créer un index unique pour le REFRESH CONCURRENTLY
-- (requis pour CONCURRENTLY)
CREATE UNIQUE INDEX IF NOT EXISTS idx_call_summary_unique 
ON call_summary_materialized (agent_id, call_date);

-- 6. Test du trigger
SELECT 'Triggers créés avec succès!' as status;

-- 7. Vérifier les triggers existants
SELECT 
    trigger_name,
    event_manipulation,
    event_object_table,
    trigger_schema
FROM information_schema.triggers 
WHERE event_object_table = 'pype_voice_call_logs'
  AND trigger_name LIKE '%refresh_call_summary%';
