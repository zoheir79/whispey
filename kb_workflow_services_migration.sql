-- ===================================
-- MIGRATION: Services Knowledge Base et Workflow
-- Version: 1.0
-- Date: 2025-01-06
-- ===================================

BEGIN;

-- ========================================
-- 1. TABLE KNOWLEDGE BASES
-- ========================================

CREATE TABLE IF NOT EXISTS pype_voice_knowledge_bases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Association workspace
    workspace_id UUID NOT NULL REFERENCES pype_voice_projects(id) ON DELETE CASCADE,
    
    -- Configuration de base
    name VARCHAR(255) NOT NULL,
    description TEXT,
    
    -- Mode et billing
    platform_mode VARCHAR(20) DEFAULT 'pag' CHECK (platform_mode IN ('dedicated', 'pag')),
    billing_cycle VARCHAR(20) DEFAULT 'monthly' CHECK (billing_cycle IN ('monthly', 'quarterly', 'yearly')),
    
    -- Configuration couts
    cost_overrides JSONB DEFAULT '{}',
    
    -- Stockage S3
    s3_bucket_name VARCHAR(255),
    s3_region VARCHAR(50) DEFAULT 'us-east-1',
    
    -- Metriques usage
    storage_used_mb DECIMAL(15,4) DEFAULT 0,
    total_files INTEGER DEFAULT 0,
    total_vectors INTEGER DEFAULT 0,
    
    -- Configuration embedding
    embedding_model VARCHAR(100) DEFAULT 'text-embedding-ada-002',
    vector_dimensions INTEGER DEFAULT 1536,
    chunk_size INTEGER DEFAULT 1000,
    chunk_overlap INTEGER DEFAULT 200,
    
    -- Indexation
    index_status VARCHAR(20) DEFAULT 'pending' CHECK (index_status IN ('pending', 'indexing', 'completed', 'failed')),
    last_indexed_at TIMESTAMP WITH TIME ZONE,
    
    -- Configuration recherche
    search_similarity_threshold DECIMAL(3,2) DEFAULT 0.80,
    max_search_results INTEGER DEFAULT 10,
    
    -- Statut
    is_active BOOLEAN DEFAULT true,
    
    -- Audit
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID REFERENCES pype_voice_users(user_id),
    
    -- Contraintes
    UNIQUE(workspace_id, name),
    CHECK (storage_used_mb >= 0),
    CHECK (total_files >= 0),
    CHECK (total_vectors >= 0),
    CHECK (vector_dimensions > 0),
    CHECK (chunk_size > 0),
    CHECK (search_similarity_threshold BETWEEN 0 AND 1)
);

-- Index pour performance
CREATE INDEX IF NOT EXISTS idx_kb_workspace ON pype_voice_knowledge_bases(workspace_id);
CREATE INDEX IF NOT EXISTS idx_kb_platform_mode ON pype_voice_knowledge_bases(platform_mode);
CREATE INDEX IF NOT EXISTS idx_kb_status ON pype_voice_knowledge_bases(is_active, index_status);
CREATE INDEX IF NOT EXISTS idx_kb_created ON pype_voice_knowledge_bases(created_at);
CREATE INDEX IF NOT EXISTS idx_kb_storage ON pype_voice_knowledge_bases(storage_used_mb);

-- Commentaires
COMMENT ON TABLE pype_voice_knowledge_bases IS 'Knowledge Bases pour RAG et recherche semantique';
COMMENT ON COLUMN pype_voice_knowledge_bases.platform_mode IS 'Mode: dedicated (fixe) ou pag (usage)';
COMMENT ON COLUMN pype_voice_knowledge_bases.s3_bucket_name IS 'Bucket S3 dedie pour fichiers KB';
COMMENT ON COLUMN pype_voice_knowledge_bases.storage_used_mb IS 'Stockage utilise en MB';
COMMENT ON COLUMN pype_voice_knowledge_bases.total_vectors IS 'Nombre total de vecteurs indexes';

-- ========================================
-- 2. TABLE WORKFLOW AUTOMATIONS
-- ========================================

CREATE TABLE IF NOT EXISTS pype_voice_workflows (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Association workspace
    workspace_id UUID NOT NULL REFERENCES pype_voice_projects(id) ON DELETE CASCADE,
    
    -- Configuration de base
    name VARCHAR(255) NOT NULL,
    description TEXT,
    
    -- Mode et billing
    platform_mode VARCHAR(20) DEFAULT 'pag' CHECK (platform_mode IN ('subscription', 'pag')),
    billing_cycle VARCHAR(20) DEFAULT 'monthly' CHECK (billing_cycle IN ('monthly', 'quarterly', 'yearly')),
    
    -- Configuration couts
    cost_overrides JSONB DEFAULT '{}',
    
    -- Configuration workflow
    workflow_definition JSONB NOT NULL DEFAULT '{}',
    trigger_conditions JSONB DEFAULT '{}',
    
    -- Integration MCP
    mcp_server_url VARCHAR(500),
    mcp_api_key VARCHAR(255),
    mcp_tools_enabled TEXT[] DEFAULT ARRAY['rag', 'automation', 'function_call'],
    
    -- Metriques execution
    total_executions INTEGER DEFAULT 0,
    successful_executions INTEGER DEFAULT 0,
    failed_executions INTEGER DEFAULT 0,
    total_execution_time_minutes DECIMAL(15,4) DEFAULT 0,
    
    -- Configuration avancee
    max_execution_time_minutes INTEGER DEFAULT 30,
    retry_count INTEGER DEFAULT 3,
    timeout_seconds INTEGER DEFAULT 300,
    
    -- Statut
    is_active BOOLEAN DEFAULT true,
    last_executed_at TIMESTAMP WITH TIME ZONE,
    
    -- Audit
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID REFERENCES pype_voice_users(user_id),
    
    -- Contraintes
    UNIQUE(workspace_id, name),
    CHECK (total_executions >= 0),
    CHECK (successful_executions >= 0),
    CHECK (failed_executions >= 0),
    CHECK (total_execution_time_minutes >= 0),
    CHECK (max_execution_time_minutes > 0),
    CHECK (retry_count >= 0),
    CHECK (timeout_seconds > 0)
);

-- Index pour performance
CREATE INDEX IF NOT EXISTS idx_workflow_workspace ON pype_voice_workflows(workspace_id);
CREATE INDEX IF NOT EXISTS idx_workflow_platform_mode ON pype_voice_workflows(platform_mode);
CREATE INDEX IF NOT EXISTS idx_workflow_status ON pype_voice_workflows(is_active);
CREATE INDEX IF NOT EXISTS idx_workflow_executions ON pype_voice_workflows(total_executions, successful_executions);
CREATE INDEX IF NOT EXISTS idx_workflow_created ON pype_voice_workflows(created_at);

-- Commentaires
COMMENT ON TABLE pype_voice_workflows IS 'Workflows automation via MCP';
COMMENT ON COLUMN pype_voice_workflows.platform_mode IS 'Mode: subscription (fixe) ou pag (par operation)';
COMMENT ON COLUMN pype_voice_workflows.workflow_definition IS 'Definition JSON du workflow';
COMMENT ON COLUMN pype_voice_workflows.mcp_tools_enabled IS 'Outils MCP actives: rag, automation, function_call';
COMMENT ON COLUMN pype_voice_workflows.total_execution_time_minutes IS 'Temps total execution en minutes';

-- ========================================
-- 3. TABLE FILES KB (GESTION FICHIERS)
-- ========================================

CREATE TABLE IF NOT EXISTS kb_files (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Association KB
    kb_id UUID NOT NULL REFERENCES pype_voice_knowledge_bases(id) ON DELETE CASCADE,
    
    -- Informations fichier
    filename VARCHAR(500) NOT NULL,
    original_filename VARCHAR(500) NOT NULL,
    file_type VARCHAR(100),
    file_size_bytes BIGINT NOT NULL,
    mime_type VARCHAR(200),
    
    -- Stockage S3
    s3_key VARCHAR(1000) NOT NULL,
    s3_bucket VARCHAR(255) NOT NULL,
    s3_etag VARCHAR(255),
    
    -- Processing
    processing_status VARCHAR(20) DEFAULT 'pending' CHECK (processing_status IN ('pending', 'processing', 'completed', 'failed')),
    chunks_count INTEGER DEFAULT 0,
    vectors_count INTEGER DEFAULT 0,
    processing_error TEXT,
    
    -- Metadonnees
    metadata JSONB DEFAULT '{}',
    
    -- Audit
    uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    processed_at TIMESTAMP WITH TIME ZONE,
    created_by UUID REFERENCES pype_voice_users(user_id),
    
    -- Contraintes
    CHECK (file_size_bytes > 0),
    CHECK (chunks_count >= 0),
    CHECK (vectors_count >= 0)
);

-- Index pour performance
CREATE INDEX IF NOT EXISTS idx_kb_files_kb ON kb_files(kb_id);
CREATE INDEX IF NOT EXISTS idx_kb_files_status ON kb_files(processing_status);
CREATE INDEX IF NOT EXISTS idx_kb_files_s3 ON kb_files(s3_bucket, s3_key);
CREATE INDEX IF NOT EXISTS idx_kb_files_uploaded ON kb_files(uploaded_at);
CREATE INDEX IF NOT EXISTS idx_kb_files_size ON kb_files(file_size_bytes);

-- Commentaires
COMMENT ON TABLE kb_files IS 'Fichiers uploades dans les Knowledge Bases';
COMMENT ON COLUMN kb_files.s3_key IS 'Cle du fichier dans S3';
COMMENT ON COLUMN kb_files.chunks_count IS 'Nombre de chunks crees depuis ce fichier';
COMMENT ON COLUMN kb_files.vectors_count IS 'Nombre de vecteurs generes';

-- ========================================
-- 4. TABLE LOGS WORKFLOW EXECUTIONS
-- ========================================

CREATE TABLE IF NOT EXISTS workflow_execution_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Association workflow
    workflow_id UUID NOT NULL REFERENCES pype_voice_workflows(id) ON DELETE CASCADE,
    
    -- Context execution
    execution_trigger VARCHAR(100),
    triggered_by_agent_id UUID REFERENCES pype_voice_agents(id),
    triggered_by_call_id UUID REFERENCES pype_voice_call_logs(id),
    
    -- Execution details
    started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE,
    execution_time_seconds DECIMAL(10,3),
    
    -- Resultats
    status VARCHAR(20) DEFAULT 'running' CHECK (status IN ('running', 'completed', 'failed', 'timeout')),
    operations_executed INTEGER DEFAULT 0,
    
    -- MCP details
    mcp_calls_made INTEGER DEFAULT 0,
    mcp_tools_used TEXT[] DEFAULT '{}',
    
    -- Donnees
    input_data JSONB DEFAULT '{}',
    output_data JSONB DEFAULT '{}',
    error_details JSONB DEFAULT '{}',
    
    -- Couts
    execution_cost DECIMAL(10,4) DEFAULT 0,
    
    -- Contraintes
    CHECK (execution_time_seconds >= 0),
    CHECK (operations_executed >= 0),
    CHECK (mcp_calls_made >= 0),
    CHECK (execution_cost >= 0)
);

-- Index pour performance
CREATE INDEX IF NOT EXISTS idx_workflow_logs_workflow ON workflow_execution_logs(workflow_id);
CREATE INDEX IF NOT EXISTS idx_workflow_logs_status ON workflow_execution_logs(status);
CREATE INDEX IF NOT EXISTS idx_workflow_logs_started ON workflow_execution_logs(started_at);
CREATE INDEX IF NOT EXISTS idx_workflow_logs_agent ON workflow_execution_logs(triggered_by_agent_id);
CREATE INDEX IF NOT EXISTS idx_workflow_logs_call ON workflow_execution_logs(triggered_by_call_id);
CREATE INDEX IF NOT EXISTS idx_workflow_logs_cost ON workflow_execution_logs(execution_cost);

-- Commentaires
COMMENT ON TABLE workflow_execution_logs IS 'Logs executions workflows avec metriques';
COMMENT ON COLUMN workflow_execution_logs.operations_executed IS 'Nombre operations executees';
COMMENT ON COLUMN workflow_execution_logs.mcp_calls_made IS 'Nombre appels MCP effectues';
COMMENT ON COLUMN workflow_execution_logs.execution_cost IS 'Cout execution en USD';

-- ========================================
-- 5. TABLE METRIQUES KB USAGE
-- ========================================

CREATE TABLE IF NOT EXISTS kb_usage_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Association
    kb_id UUID NOT NULL REFERENCES pype_voice_knowledge_bases(id) ON DELETE CASCADE,
    agent_id UUID REFERENCES pype_voice_agents(id),
    call_id UUID REFERENCES pype_voice_call_logs(id),
    
    -- Date usage
    usage_date DATE NOT NULL DEFAULT CURRENT_DATE,
    
    -- Metriques recherche
    search_queries INTEGER DEFAULT 0,
    search_tokens_used INTEGER DEFAULT 0,
    
    -- Metriques embedding
    embedding_tokens_created INTEGER DEFAULT 0,
    new_vectors_created INTEGER DEFAULT 0,
    
    -- Stockage
    storage_gb_used DECIMAL(10,4) DEFAULT 0,
    
    -- Couts
    search_cost DECIMAL(10,4) DEFAULT 0,
    embedding_cost DECIMAL(10,4) DEFAULT 0,
    storage_cost DECIMAL(10,4) DEFAULT 0,
    
    -- Audit
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Contraintes
    CHECK (search_queries >= 0),
    CHECK (search_tokens_used >= 0),
    CHECK (embedding_tokens_created >= 0),
    CHECK (new_vectors_created >= 0),
    CHECK (storage_gb_used >= 0),
    CHECK (search_cost >= 0),
    CHECK (embedding_cost >= 0),
    CHECK (storage_cost >= 0)
);

-- Index pour performance et aggregation
CREATE INDEX IF NOT EXISTS idx_kb_usage_kb_date ON kb_usage_metrics(kb_id, usage_date);
CREATE INDEX IF NOT EXISTS idx_kb_usage_agent ON kb_usage_metrics(agent_id);
CREATE INDEX IF NOT EXISTS idx_kb_usage_call ON kb_usage_metrics(call_id);
CREATE INDEX IF NOT EXISTS idx_kb_usage_date ON kb_usage_metrics(usage_date);

-- Commentaires
COMMENT ON TABLE kb_usage_metrics IS 'Metriques usage Knowledge Base par jour';
COMMENT ON COLUMN kb_usage_metrics.search_tokens_used IS 'Tokens utilises pour recherches';
COMMENT ON COLUMN kb_usage_metrics.embedding_tokens_created IS 'Tokens pour creation embeddings';
COMMENT ON COLUMN kb_usage_metrics.storage_gb_used IS 'Stockage utilise en GB';

-- ========================================
-- 6. EXTENSIONS TABLE AGENTS EXISTANTE
-- ========================================

-- Ajouter associations KB et Workflow aux agents
ALTER TABLE pype_voice_agents 
ADD COLUMN IF NOT EXISTS associated_kb_id UUID REFERENCES pype_voice_knowledge_bases(id),
ADD COLUMN IF NOT EXISTS associated_workflow_id UUID REFERENCES pype_voice_workflows(id);

-- Index pour associations
CREATE INDEX IF NOT EXISTS idx_agents_kb ON pype_voice_agents(associated_kb_id);
CREATE INDEX IF NOT EXISTS idx_agents_workflow ON pype_voice_agents(associated_workflow_id);

-- Commentaires
COMMENT ON COLUMN pype_voice_agents.associated_kb_id IS 'Knowledge Base associee a cet agent';
COMMENT ON COLUMN pype_voice_agents.associated_workflow_id IS 'Workflow associe a cet agent';

-- ========================================
-- 7. TRIGGERS POUR UPDATED_AT
-- ========================================

-- Triggers pour tables KB/Workflow
CREATE TRIGGER update_kb_updated_at
    BEFORE UPDATE ON pype_voice_knowledge_bases
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_workflow_updated_at
    BEFORE UPDATE ON pype_voice_workflows
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ========================================
-- 8. POLITIQUES RLS
-- ========================================

-- Activer RLS
ALTER TABLE pype_voice_knowledge_bases ENABLE ROW LEVEL SECURITY;
ALTER TABLE pype_voice_workflows ENABLE ROW LEVEL SECURITY;
ALTER TABLE kb_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow_execution_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE kb_usage_metrics ENABLE ROW LEVEL SECURITY;

-- Politiques workspace-based
CREATE POLICY kb_workspace_policy ON pype_voice_knowledge_bases
    FOR ALL
    USING (
        workspace_id IN (
            SELECT DISTINCT epm.project_id 
            FROM pype_voice_email_project_mapping epm
            INNER JOIN pype_voice_users u ON u.email = epm.email
            WHERE u.user_id = current_setting('app.current_user_id')::uuid 
            AND epm.is_active = true
        )
        OR EXISTS (
            SELECT 1 FROM pype_voice_users 
            WHERE user_id = current_setting('app.current_user_id')::uuid 
            AND global_role IN ('admin', 'super_admin')
        )
    );

CREATE POLICY workflow_workspace_policy ON pype_voice_workflows
    FOR ALL
    USING (
        workspace_id IN (
            SELECT DISTINCT epm.project_id 
            FROM pype_voice_email_project_mapping epm
            INNER JOIN pype_voice_users u ON u.email = epm.email
            WHERE u.user_id = current_setting('app.current_user_id')::uuid 
            AND epm.is_active = true
        )
        OR EXISTS (
            SELECT 1 FROM pype_voice_users 
            WHERE user_id = current_setting('app.current_user_id')::uuid 
            AND global_role IN ('admin', 'super_admin')
        )
    );

-- Politiques pour tables dependantes
CREATE POLICY kb_files_policy ON kb_files
    FOR ALL
    USING (
        kb_id IN (SELECT id FROM pype_voice_knowledge_bases)
    );

CREATE POLICY workflow_logs_policy ON workflow_execution_logs
    FOR ALL
    USING (
        workflow_id IN (SELECT id FROM pype_voice_workflows)
    );

CREATE POLICY kb_usage_policy ON kb_usage_metrics
    FOR ALL
    USING (
        kb_id IN (SELECT id FROM pype_voice_knowledge_bases)
    );

COMMIT;

-- ========================================
-- 9. VERIFICATION POST-MIGRATION
-- ========================================

DO $$
BEGIN
    -- Verifier tables principales
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'pype_voice_knowledge_bases') THEN
        RAISE EXCEPTION 'Table pype_voice_knowledge_bases not created';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'pype_voice_workflows') THEN
        RAISE EXCEPTION 'Table pype_voice_workflows not created';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'kb_files') THEN
        RAISE EXCEPTION 'Table kb_files not created';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'workflow_execution_logs') THEN
        RAISE EXCEPTION 'Table workflow_execution_logs not created';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'kb_usage_metrics') THEN
        RAISE EXCEPTION 'Table kb_usage_metrics not created';
    END IF;
    
    -- Verifier extensions agents
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'pype_voice_agents' 
        AND column_name = 'associated_kb_id'
    ) THEN
        RAISE EXCEPTION 'Column associated_kb_id not added to pype_voice_agents';
    END IF;
    
    RAISE NOTICE 'Migration KB et Workflow reussie';
    RAISE NOTICE 'Tables creees: pype_voice_knowledge_bases, pype_voice_workflows';
    RAISE NOTICE 'Tables support: kb_files, workflow_execution_logs, kb_usage_metrics';
    RAISE NOTICE 'Extensions agents: associated_kb_id, associated_workflow_id';
    RAISE NOTICE 'Indexes et politiques RLS configures';
END $$;
