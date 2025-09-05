-- Fonction de calcul de coût basé sur la configuration de l'agent
-- Prend en compte les overrides et la config spécifique de l'agent

CREATE OR REPLACE FUNCTION calculate_agent_cost(
    p_agent_id UUID,
    p_call_duration_minutes NUMERIC DEFAULT NULL,
    p_stt_duration_minutes NUMERIC DEFAULT NULL,
    p_tokens_used INTEGER DEFAULT NULL,
    p_words_generated INTEGER DEFAULT NULL,
    p_include_dedicated_costs BOOLEAN DEFAULT TRUE
) RETURNS JSONB AS $$
DECLARE
    agent_config RECORD;
    cost_result JSONB := '{}';
    stt_cost NUMERIC := 0;
    tts_cost NUMERIC := 0;
    llm_cost NUMERIC := 0;
    total_cost NUMERIC := 0;
    prorata_ratio NUMERIC := 1.0;
    daily_dedicated_stt NUMERIC := 0;
    daily_dedicated_tts NUMERIC := 0;
    daily_dedicated_llm NUMERIC := 0;
    days_in_month INTEGER;
BEGIN
    -- Récupérer la configuration de l'agent
    SELECT 
        platform_mode,
        billing_cycle,
        cost_overrides,
        provider_config,
        agent_type,
        created_at
    INTO agent_config
    FROM pype_voice_agents 
    WHERE id = p_agent_id;

    -- Calculer prorata et coûts daily dedicated si applicable
    IF p_include_dedicated_costs THEN
        SELECT calculate_monthly_prorata(p_agent_id, EXTRACT(YEAR FROM NOW())::INTEGER, EXTRACT(MONTH FROM NOW())::INTEGER)
        INTO prorata_ratio;
        
        -- Calculer nombre de jours dans le mois courant
        days_in_month := EXTRACT(days FROM DATE_TRUNC('month', NOW()) + INTERVAL '1 month' - INTERVAL '1 day');
        
        -- Coûts daily dedicated (monthly_cost * prorata / jours actifs dans le mois)
        daily_dedicated_stt := COALESCE((agent_config.cost_overrides->>'stt_monthly_cost')::NUMERIC, 
                                       (SELECT stt_monthly_dedicated_cost FROM pype_voice_settings LIMIT 1)) 
                              * prorata_ratio / days_in_month;
        daily_dedicated_tts := COALESCE((agent_config.cost_overrides->>'tts_monthly_cost')::NUMERIC,
                                       (SELECT tts_monthly_dedicated_cost FROM pype_voice_settings LIMIT 1))
                              * prorata_ratio / days_in_month;
        daily_dedicated_llm := COALESCE((agent_config.cost_overrides->>'llm_monthly_cost')::NUMERIC,
                                       (SELECT llm_monthly_dedicated_cost FROM pype_voice_settings LIMIT 1))
                              * prorata_ratio / days_in_month;
    END IF;

    IF NOT FOUND THEN
        RETURN '{"error": "Agent not found"}'::jsonb;
    END IF;

    -- Calcul pour mode PAG (Pay-as-You-Go)
    IF agent_config.platform_mode = 'pag' THEN
        
        -- Vérifier si provider external configuré
        IF agent_config.provider_config IS NOT NULL AND 
           (agent_config.provider_config->>'stt_mode' = 'external' OR
            agent_config.provider_config->>'tts_mode' = 'external' OR  
            agent_config.provider_config->>'llm_mode' = 'external') THEN
            
            -- Mode PAG External: calcul par modèle spécifique
            -- STT Cost (Voice agents only)
            IF agent_config.agent_type = 'voice' AND p_stt_duration_minutes IS NOT NULL THEN
                IF agent_config.cost_overrides IS NOT NULL AND 
                   agent_config.cost_overrides->>'stt_price' IS NOT NULL THEN
                    stt_cost := (agent_config.cost_overrides->>'stt_price')::numeric * p_stt_duration_minutes;
                ELSE
                    SELECT (value->>'stt_external_per_minute')::numeric * p_stt_duration_minutes
                    INTO stt_cost
                    FROM global_settings WHERE key = 'pricing_rates_pag';
                END IF;
            END IF;

            -- TTS Cost (Voice agents only)
            IF agent_config.agent_type = 'voice' AND p_words_generated IS NOT NULL THEN
                IF agent_config.cost_overrides IS NOT NULL AND 
                   agent_config.cost_overrides->>'tts_price' IS NOT NULL THEN
                    tts_cost := (agent_config.cost_overrides->>'tts_price')::numeric * p_words_generated;
                ELSE
                    SELECT (value->>'tts_external_per_word')::numeric * p_words_generated
                    INTO tts_cost
                    FROM global_settings WHERE key = 'pricing_rates_pag';
                END IF;
            END IF;

            -- LLM Cost
            IF p_tokens_used IS NOT NULL THEN
                IF agent_config.cost_overrides IS NOT NULL AND 
                   agent_config.cost_overrides->>'llm_price' IS NOT NULL THEN
                    llm_cost := (agent_config.cost_overrides->>'llm_price')::numeric * p_tokens_used;
                ELSE
                    IF agent_config.agent_type = 'voice' THEN
                        SELECT (value->>'llm_external_per_token')::numeric * p_tokens_used
                        INTO llm_cost
                        FROM global_settings WHERE key = 'pricing_rates_pag';
                    ELSE
                        SELECT (value->>'llm_external_per_token_text')::numeric * p_tokens_used
                        INTO llm_cost
                        FROM global_settings WHERE key = 'pricing_rates_pag';
                    END IF;
                END IF;
            END IF;
            
        ELSE
            -- Mode PAG Builtin: calcul par minute globale pour voice, par token pour text
            IF agent_config.agent_type = 'voice' AND p_call_duration_minutes IS NOT NULL THEN
                -- Voice builtin: STT + TTS + LLM tous calculés par minute
                IF agent_config.cost_overrides IS NOT NULL AND 
                   agent_config.cost_overrides->>'stt_price' IS NOT NULL THEN
                    -- Override STT par minute (représente le coût global voice)
                    stt_cost := (agent_config.cost_overrides->>'stt_price')::numeric * p_call_duration_minutes;
                ELSE
                    -- Tarif STT builtin par minute
                    SELECT (value->>'stt_builtin_per_minute')::numeric * p_call_duration_minutes
                    INTO stt_cost
                    FROM global_settings WHERE key = 'pricing_rates_pag';
                END IF;
                
                IF agent_config.cost_overrides IS NOT NULL AND 
                   agent_config.cost_overrides->>'tts_price' IS NOT NULL THEN
                    -- Override TTS par minute
                    tts_cost := (agent_config.cost_overrides->>'tts_price')::numeric * p_call_duration_minutes;
                ELSE
                    -- Tarif TTS builtin par minute  
                    SELECT (value->>'tts_builtin_per_minute')::numeric * p_call_duration_minutes
                    INTO tts_cost
                    FROM global_settings WHERE key = 'pricing_rates_pag';
                END IF;
                
                IF agent_config.cost_overrides IS NOT NULL AND 
                   agent_config.cost_overrides->>'llm_price' IS NOT NULL THEN
                    -- Override LLM par minute
                    llm_cost := (agent_config.cost_overrides->>'llm_price')::numeric * p_call_duration_minutes;
                ELSE
                    -- Tarif LLM builtin par minute
                    SELECT (value->>'llm_builtin_per_minute')::numeric * p_call_duration_minutes
                    INTO llm_cost
                    FROM global_settings WHERE key = 'pricing_rates_pag';
                END IF;
                
            ELSIF agent_config.agent_type = 'textonly' AND p_tokens_used IS NOT NULL THEN
                -- Text: coût par token
                IF agent_config.cost_overrides IS NOT NULL AND 
                   agent_config.cost_overrides->>'llm_price' IS NOT NULL THEN
                    llm_cost := (agent_config.cost_overrides->>'llm_price')::numeric * p_tokens_used;
                ELSE
                    SELECT (value->>'text_builtin_per_token')::numeric * p_tokens_used
                    INTO llm_cost
                    FROM global_settings WHERE key = 'pricing_rates_pag';
                END IF;
            END IF;
            
        END IF;

    -- Calcul pour mode DEDICATED (coût fixe mensuel proraté daily)
    ELSIF agent_config.platform_mode = 'dedicated' THEN
        -- En mode dedicated: coût par call = 0, mais coût daily proraté pour T0
        IF p_include_dedicated_costs THEN
            stt_cost := daily_dedicated_stt;
            tts_cost := daily_dedicated_tts;
            llm_cost := daily_dedicated_llm;
        ELSE
            -- Pour calcul par call seulement (trigger)
            stt_cost := 0;
            tts_cost := 0;
            llm_cost := 0;
        END IF;

    -- Calcul pour mode Hybrid
    ELSIF agent_config.platform_mode = 'hybrid' THEN
        -- Mode hybrid: calculer selon le provider de chaque modèle individuellement
        
        -- STT Cost (Voice agents only)
        IF agent_config.agent_type = 'voice' AND p_stt_duration_minutes IS NOT NULL THEN
            -- Vérifier le mode STT depuis provider_config
            IF agent_config.provider_config IS NOT NULL AND 
               agent_config.provider_config->>'stt_mode' = 'dedicated' THEN
                -- STT en mode dedicated: coût daily proraté pour T0, 0 pour call uniquement
                IF p_include_dedicated_costs THEN
                    stt_cost := daily_dedicated_stt;
                ELSE
                    stt_cost := 0;
                END IF;
            ELSIF agent_config.provider_config IS NOT NULL AND 
                  agent_config.provider_config->>'stt_mode' = 'external' THEN
                -- STT external: utiliser override ou tarif external global
                IF agent_config.cost_overrides IS NOT NULL AND 
                   agent_config.cost_overrides->>'stt_price' IS NOT NULL THEN
                    stt_cost := (agent_config.cost_overrides->>'stt_price')::numeric * p_stt_duration_minutes;
                ELSE
                    SELECT (value->>'stt_external_per_minute')::numeric * p_stt_duration_minutes
                    INTO stt_cost
                    FROM global_settings WHERE key = 'pricing_rates_pag';
                END IF;
            ELSE
                -- STT builtin (mode par défaut)
                IF agent_config.cost_overrides IS NOT NULL AND 
                   agent_config.cost_overrides->>'stt_price' IS NOT NULL THEN
                    stt_cost := (agent_config.cost_overrides->>'stt_price')::numeric * p_stt_duration_minutes;
                ELSE
                    SELECT (value->>'stt_builtin_per_minute')::numeric * p_stt_duration_minutes
                    INTO stt_cost
                    FROM global_settings WHERE key = 'pricing_rates_pag';
                END IF;
            END IF;
        END IF;

        -- TTS Cost (Voice agents only)  
        IF agent_config.agent_type = 'voice' AND p_words_generated IS NOT NULL THEN
            -- Vérifier le mode TTS depuis provider_config
            IF agent_config.provider_config IS NOT NULL AND 
               agent_config.provider_config->>'tts_mode' = 'dedicated' THEN
                -- TTS en mode dedicated: coût daily proraté pour T0, 0 pour call uniquement
                IF p_include_dedicated_costs THEN
                    tts_cost := daily_dedicated_tts;
                ELSE
                    tts_cost := 0;
                END IF;
            ELSIF agent_config.provider_config IS NOT NULL AND 
                  agent_config.provider_config->>'tts_mode' = 'external' THEN
                -- TTS external
                IF agent_config.cost_overrides IS NOT NULL AND 
                   agent_config.cost_overrides->>'tts_price' IS NOT NULL THEN
                    tts_cost := (agent_config.cost_overrides->>'tts_price')::numeric * p_words_generated;
                ELSE
                    SELECT (value->>'tts_external_per_word')::numeric * p_words_generated
                    INTO tts_cost
                    FROM global_settings WHERE key = 'pricing_rates_pag';
                END IF;
            ELSE
                -- TTS builtin
                IF agent_config.cost_overrides IS NOT NULL AND 
                   agent_config.cost_overrides->>'tts_price' IS NOT NULL THEN
                    tts_cost := (agent_config.cost_overrides->>'tts_price')::numeric * p_words_generated;
                ELSE
                    SELECT (value->>'tts_builtin_per_word')::numeric * p_words_generated
                    INTO tts_cost
                    FROM global_settings WHERE key = 'pricing_rates_pag';
                END IF;
            END IF;
        END IF;

        -- LLM Cost 
        IF p_tokens_used IS NOT NULL THEN
            -- Vérifier le mode LLM depuis provider_config
            IF agent_config.provider_config IS NOT NULL AND 
               agent_config.provider_config->>'llm_mode' = 'dedicated' THEN
                -- LLM en mode dedicated: coût daily proraté pour T0, 0 pour call uniquement
                IF p_include_dedicated_costs THEN
                    llm_cost := daily_dedicated_llm;
                ELSE
                    llm_cost := 0;
                END IF;
            ELSIF agent_config.provider_config IS NOT NULL AND 
                  agent_config.provider_config->>'llm_mode' = 'external' THEN
                -- LLM external
                IF agent_config.cost_overrides IS NOT NULL AND 
                   agent_config.cost_overrides->>'llm_price' IS NOT NULL THEN
                    llm_cost := (agent_config.cost_overrides->>'llm_price')::numeric * p_tokens_used;
                ELSE
                    -- Différencier voice vs text-only pour external
                    IF agent_config.agent_type = 'voice' THEN
                        SELECT (value->>'llm_external_per_token')::numeric * p_tokens_used
                        INTO llm_cost
                        FROM global_settings WHERE key = 'pricing_rates_pag';
                    ELSE
                        SELECT (value->>'llm_external_per_token_text')::numeric * p_tokens_used
                        INTO llm_cost
                        FROM global_settings WHERE key = 'pricing_rates_pag';
                    END IF;
                END IF;
            ELSE
                -- LLM builtin
                IF agent_config.cost_overrides IS NOT NULL AND 
                   agent_config.cost_overrides->>'llm_price' IS NOT NULL THEN
                    llm_cost := (agent_config.cost_overrides->>'llm_price')::numeric * p_tokens_used;
                ELSE
                    -- Différencier voice vs text-only pour builtin
                    IF agent_config.agent_type = 'voice' THEN
                        SELECT (value->>'llm_builtin_per_token')::numeric * p_tokens_used
                        INTO llm_cost
                        FROM global_settings WHERE key = 'pricing_rates_pag';
                    ELSE
                        SELECT (value->>'llm_builtin_per_token_text')::numeric * p_tokens_used
                        INTO llm_cost
                        FROM global_settings WHERE key = 'pricing_rates_pag';
                    END IF;
                END IF;
            END IF;
        END IF;
    END IF;

    -- Calculer total_cost (soit déjà calculé en mode PAG builtin, soit somme des modèles)
    IF total_cost = 0 THEN
        total_cost := stt_cost + tts_cost + llm_cost;
    END IF;

    -- Construire le résultat JSON
    cost_result := jsonb_build_object(
        'agent_id', p_agent_id,
        'platform_mode', agent_config.platform_mode,
        'agent_type', agent_config.agent_type,
        'costs', jsonb_build_object(
            'stt_cost', stt_cost,
            'tts_cost', tts_cost,
            'llm_cost', llm_cost,
            'total_cost', total_cost
        ),
        'usage', jsonb_build_object(
            'call_duration_minutes', p_call_duration_minutes,
            'stt_duration_minutes', p_stt_duration_minutes,
            'tokens_used', p_tokens_used,
            'words_generated', p_words_generated
        ),
        'calculated_at', NOW()
    );

    RETURN cost_result;
END;
$$ LANGUAGE plpgsql;

-- Fonction pour calculer le coût total d'un agent à T0 (temps réel)
CREATE OR REPLACE FUNCTION get_agent_total_cost_t0(
    p_agent_id UUID,
    p_start_date TIMESTAMP DEFAULT NULL,
    p_end_date TIMESTAMP DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
    total_calls_cost NUMERIC := 0;
    dedicated_costs JSONB;
    result JSONB;
    agent_config RECORD;
BEGIN
    -- Dates par défaut = mois courant
    IF p_start_date IS NULL THEN
        p_start_date := DATE_TRUNC('month', NOW());
    END IF;
    IF p_end_date IS NULL THEN
        p_end_date := NOW();
    END IF;

    -- Récupérer config agent
    SELECT platform_mode INTO agent_config FROM pype_voice_agents WHERE id = p_agent_id;

    -- 1. Sommer tous les coûts des calls (PAG + External Hybrid parts)
    SELECT COALESCE(SUM(
        COALESCE(total_stt_cost, 0) + 
        COALESCE(total_tts_cost, 0) + 
        COALESCE(total_llm_cost, 0)
    ), 0)
    INTO total_calls_cost
    FROM pype_voice_call_logs 
    WHERE agent_id = p_agent_id 
    AND created_at BETWEEN p_start_date AND p_end_date;

    -- 2. Ajouter les coûts dedicated proratés PAR MODÈLE (pour dedicated/hybrid dedicated parts)
    IF agent_config.platform_mode = 'dedicated' THEN
        -- Mode dedicated: tous les modèles sont dedicated
        SELECT calculate_agent_cost(p_agent_id, NULL, NULL, NULL, NULL, TRUE)
        INTO dedicated_costs;
        
        total_calls_cost := total_calls_cost + 
            (COALESCE((dedicated_costs->'costs'->>'stt_cost')::NUMERIC, 0) + 
             COALESCE((dedicated_costs->'costs'->>'tts_cost')::NUMERIC, 0) + 
             COALESCE((dedicated_costs->'costs'->>'llm_cost')::NUMERIC, 0)) * 
            EXTRACT(days FROM p_end_date - p_start_date);
            
    ELSIF agent_config.platform_mode = 'hybrid' THEN
        -- Mode hybrid: calculer seulement les parties dedicated de chaque modèle  
        DECLARE
            hybrid_provider_config JSONB;
            dedicated_stt_daily NUMERIC := 0;
            dedicated_tts_daily NUMERIC := 0;
            dedicated_llm_daily NUMERIC := 0;
            hybrid_prorata_ratio NUMERIC;
            hybrid_days_in_month INTEGER;
        BEGIN
            SELECT calculate_monthly_prorata(p_agent_id, EXTRACT(YEAR FROM p_end_date)::INTEGER, EXTRACT(MONTH FROM p_end_date)::INTEGER)
            INTO hybrid_prorata_ratio;
            
            hybrid_days_in_month := EXTRACT(days FROM DATE_TRUNC('month', p_end_date) + INTERVAL '1 month' - INTERVAL '1 day');
            
            SELECT provider_config INTO hybrid_provider_config FROM pype_voice_agents WHERE id = p_agent_id;
            
            -- STT dedicated seulement si stt_mode = 'dedicated'
            IF hybrid_provider_config->>'stt_mode' = 'dedicated' THEN
                SELECT COALESCE((cost_overrides->>'stt_monthly_cost')::NUMERIC, 
                               (SELECT stt_monthly_dedicated_cost FROM pype_voice_settings LIMIT 1)) 
                       * hybrid_prorata_ratio / hybrid_days_in_month
                INTO dedicated_stt_daily
                FROM pype_voice_agents WHERE id = p_agent_id;
            END IF;
            
            -- TTS dedicated seulement si tts_mode = 'dedicated'
            IF hybrid_provider_config->>'tts_mode' = 'dedicated' THEN
                SELECT COALESCE((cost_overrides->>'tts_monthly_cost')::NUMERIC,
                               (SELECT tts_monthly_dedicated_cost FROM pype_voice_settings LIMIT 1))
                       * hybrid_prorata_ratio / hybrid_days_in_month
                INTO dedicated_tts_daily
                FROM pype_voice_agents WHERE id = p_agent_id;
            END IF;
            
            -- LLM dedicated seulement si llm_mode = 'dedicated'
            IF hybrid_provider_config->>'llm_mode' = 'dedicated' THEN
                SELECT COALESCE((cost_overrides->>'llm_monthly_cost')::NUMERIC,
                               (SELECT llm_monthly_dedicated_cost FROM pype_voice_settings LIMIT 1))
                       * hybrid_prorata_ratio / hybrid_days_in_month
                INTO dedicated_llm_daily
                FROM pype_voice_agents WHERE id = p_agent_id;
            END IF;
            
            -- Ajouter seulement les coûts dedicated × jours
            total_calls_cost := total_calls_cost + 
                (dedicated_stt_daily + dedicated_tts_daily + dedicated_llm_daily) * 
                EXTRACT(days FROM p_end_date - p_start_date);
        END;
    END IF;

    -- Calculer breakdown correct selon le mode
    DECLARE
        calls_cost_only NUMERIC;
        dedicated_cost_total NUMERIC := 0;
    BEGIN
        -- Récupérer coût des calls uniquement (sans dedicated)
        calls_cost_only := total_calls_cost;
        
        IF agent_config.platform_mode = 'dedicated' THEN
            dedicated_cost_total := (COALESCE((dedicated_costs->'costs'->>'stt_cost')::NUMERIC, 0) + 
                                   COALESCE((dedicated_costs->'costs'->>'tts_cost')::NUMERIC, 0) + 
                                   COALESCE((dedicated_costs->'costs'->>'llm_cost')::NUMERIC, 0)) * 
                                  EXTRACT(days FROM p_end_date - p_start_date);
            calls_cost_only := calls_cost_only - dedicated_cost_total;
            
        ELSIF agent_config.platform_mode = 'hybrid' THEN
            dedicated_cost_total := (dedicated_stt_daily + dedicated_tts_daily + dedicated_llm_daily) * 
                                  EXTRACT(days FROM p_end_date - p_start_date);
            calls_cost_only := calls_cost_only - dedicated_cost_total;
        END IF;
        
        result := jsonb_build_object(
            'agent_id', p_agent_id,
            'period_start', p_start_date,
            'period_end', p_end_date,
            'total_cost', total_calls_cost,
            'cost_breakdown', jsonb_build_object(
                'calls_cost', calls_cost_only,
                'dedicated_cost', dedicated_cost_total
            )
        );
    END;

    RETURN result;
END;
$$ LANGUAGE plpgsql;

-- Trigger function pour calculer le coût à chaque call log
CREATE OR REPLACE FUNCTION trigger_calculate_call_cost()
RETURNS TRIGGER AS $$
DECLARE
    cost_calculation JSONB;
    call_duration_minutes NUMERIC;
    stt_duration_minutes NUMERIC;
    tokens_used INTEGER;
    words_generated INTEGER;
BEGIN
    -- Utiliser la durée des métriques si disponible, sinon calculer depuis timestamps
    IF NEW.duration_seconds IS NOT NULL THEN
        call_duration_minutes := NEW.duration_seconds / 60.0;
    ELSE
        -- Fallback: calculer depuis start/end timestamps
        call_duration_minutes := EXTRACT(EPOCH FROM (NEW.ended_at - NEW.started_at)) / 60.0;
    END IF;
    
    -- Extraire métriques spécifiques depuis transcript_with_metrics (même logique que send-logs API)
    IF NEW.transcript_with_metrics IS NOT NULL THEN
        -- Parcourir les turns pour sommer les métriques comme dans send-logs
        SELECT 
            -- STT: sommer audio_duration de tous les turns (en minutes)
            COALESCE(SUM((turn->'stt_metrics'->>'audio_duration')::numeric) / 60.0, 0),
            -- LLM: sommer prompt_tokens + completion_tokens de tous les turns
            COALESCE(SUM(
                COALESCE((turn->'llm_metrics'->>'prompt_tokens')::integer, 0) +
                COALESCE((turn->'llm_metrics'->>'completion_tokens')::integer, 0)
            ), 0),
            -- TTS: sommer characters_count et convertir en mots (~5 chars/mot)
            COALESCE(SUM(CEIL((turn->'tts_metrics'->>'characters_count')::numeric / 5.0)), 0)
        INTO stt_duration_minutes, tokens_used, words_generated
        FROM jsonb_array_elements(NEW.transcript_with_metrics::jsonb) AS turn;
    END IF;

    -- Calculer le coût de l'agent pour ce call (sans dedicated costs pour éviter duplication)
    cost_calculation := calculate_agent_cost(
        NEW.agent_id,
        call_duration_minutes,
        stt_duration_minutes,
        tokens_used,
        words_generated,
        FALSE  -- p_include_dedicated_costs = FALSE pour trigger par call
    );

    -- Mettre à jour les coûts directement dans pype_voice_call_logs (utilise colonnes existantes)
    UPDATE pype_voice_call_logs SET
        total_stt_cost = (cost_calculation->'costs'->>'stt_cost')::numeric,
        total_tts_cost = (cost_calculation->'costs'->>'tts_cost')::numeric,
        total_llm_cost = (cost_calculation->'costs'->>'llm_cost')::numeric,
        -- Sauvegarder détail calcul dans metadata si pas déjà présent
        metadata = CASE 
            WHEN metadata IS NULL THEN jsonb_build_object('cost_calculation', cost_calculation)
            ELSE metadata || jsonb_build_object('cost_calculation', cost_calculation)
        END
    WHERE id = NEW.id;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Assurer que les colonnes métriques existent dans pype_voice_call_logs
ALTER TABLE pype_voice_call_logs ADD COLUMN IF NOT EXISTS tokens_used INTEGER DEFAULT 0;
ALTER TABLE pype_voice_call_logs ADD COLUMN IF NOT EXISTS stt_minutes_used NUMERIC DEFAULT 0;
ALTER TABLE pype_voice_call_logs ADD COLUMN IF NOT EXISTS tts_words_used INTEGER DEFAULT 0;
ALTER TABLE pype_voice_call_logs ADD COLUMN IF NOT EXISTS transcript_with_metrics JSONB;

-- Index pour performance des coûts
CREATE INDEX IF NOT EXISTS idx_call_logs_agent_cost ON pype_voice_call_logs(agent_id, total_stt_cost, total_tts_cost, total_llm_cost);
CREATE INDEX IF NOT EXISTS idx_call_logs_cost_date ON pype_voice_call_logs(created_at, agent_id) WHERE total_stt_cost IS NOT NULL;

-- Trigger sur pype_voice_call_logs pour calculer automatiquement les coûts
DROP TRIGGER IF EXISTS trigger_call_cost_calculation ON pype_voice_call_logs;
CREATE TRIGGER trigger_call_cost_calculation
    AFTER INSERT OR UPDATE ON pype_voice_call_logs
    FOR EACH ROW
    EXECUTE FUNCTION trigger_calculate_call_cost();

-- Fonction pour calculer le prorata mensuel d'un agent
CREATE OR REPLACE FUNCTION calculate_monthly_prorata(
    p_agent_id UUID,
    p_year INTEGER,
    p_month INTEGER
) RETURNS JSONB AS $$
DECLARE
    agent_created_at DATE;
    month_days INTEGER;
    agent_active_days INTEGER;
    prorata_ratio NUMERIC;
    result JSONB;
BEGIN
    -- Récupérer la date de création de l'agent
    SELECT created_at::date INTO agent_created_at
    FROM pype_voice_agents
    WHERE id = p_agent_id;

    -- Calculer les jours du mois
    month_days := EXTRACT(DAY FROM DATE_TRUNC('month', make_date(p_year, p_month, 1)) + INTERVAL '1 month' - INTERVAL '1 day');

    -- Calculer les jours actifs de l'agent dans le mois
    IF EXTRACT(YEAR FROM agent_created_at) = p_year AND EXTRACT(MONTH FROM agent_created_at) = p_month THEN
        -- Agent créé dans ce mois
        agent_active_days := month_days - EXTRACT(DAY FROM agent_created_at) + 1;
    ELSE
        -- Agent créé avant ce mois
        agent_active_days := month_days;
    END IF;

    prorata_ratio := agent_active_days::numeric / month_days::numeric;

    result := jsonb_build_object(
        'agent_id', p_agent_id,
        'year', p_year,
        'month', p_month,
        'month_days', month_days,
        'agent_active_days', agent_active_days,
        'prorata_ratio', prorata_ratio,
        'agent_created_at', agent_created_at
    );

    RETURN result;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION calculate_agent_cost IS 'Calcule le coût d''un call basé sur la configuration spécifique de l''agent (avec overrides)';
COMMENT ON FUNCTION calculate_monthly_prorata IS 'Calcule le ratio prorata pour un agent créé en cours de mois';
COMMENT ON TABLE call_costs IS 'Stockage des coûts calculés par call pour facturation mensuelle';
