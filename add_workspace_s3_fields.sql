-- Migration: Add S3 configuration fields to pype_voice_projects table
-- Date: 2025-01-05
-- Description: Add S3 credentials and configuration for per-workspace S3 storage

-- Add S3 configuration columns to pype_voice_projects table
ALTER TABLE pype_voice_projects 
ADD COLUMN IF NOT EXISTS s3_config JSONB DEFAULT NULL,
ADD COLUMN IF NOT EXISTS s3_enabled BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS s3_region VARCHAR(50) DEFAULT NULL,
ADD COLUMN IF NOT EXISTS s3_endpoint VARCHAR(255) DEFAULT NULL,
ADD COLUMN IF NOT EXISTS s3_access_key VARCHAR(255) DEFAULT NULL,
ADD COLUMN IF NOT EXISTS s3_secret_key TEXT DEFAULT NULL, -- Encrypted
ADD COLUMN IF NOT EXISTS s3_bucket_prefix VARCHAR(100) DEFAULT NULL,
ADD COLUMN IF NOT EXISTS s3_cost_per_gb DECIMAL(10,6) DEFAULT 0.023,
ADD COLUMN IF NOT EXISTS s3_default_storage_gb INTEGER DEFAULT 50;

-- Add comment to explain the structure
COMMENT ON COLUMN pype_voice_projects.s3_config IS 'JSON configuration for S3 settings (consolidated config)';
COMMENT ON COLUMN pype_voice_projects.s3_enabled IS 'Whether S3 is enabled for this workspace';
COMMENT ON COLUMN pype_voice_projects.s3_region IS 'S3 region (e.g., us-east-1, eu-west-1)';
COMMENT ON COLUMN pype_voice_projects.s3_endpoint IS 'S3 endpoint URL (for custom S3-compatible services)';
COMMENT ON COLUMN pype_voice_projects.s3_access_key IS 'S3 access key for this workspace';
COMMENT ON COLUMN pype_voice_projects.s3_secret_key IS 'Encrypted S3 secret key for this workspace';
COMMENT ON COLUMN pype_voice_projects.s3_bucket_prefix IS 'Bucket prefix for this workspace (e.g., client-name)';
COMMENT ON COLUMN pype_voice_projects.s3_cost_per_gb IS 'Cost per GB per month for this workspace S3 storage';
COMMENT ON COLUMN pype_voice_projects.s3_default_storage_gb IS 'Default storage allocation for new agents in this workspace';

-- Create index for performance on s3_enabled lookups
CREATE INDEX IF NOT EXISTS idx_pype_voice_projects_s3_enabled 
ON pype_voice_projects(s3_enabled) 
WHERE s3_enabled = true;

-- Add S3 bucket tracking table for agents
CREATE TABLE IF NOT EXISTS pype_voice_agent_s3_buckets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id UUID NOT NULL REFERENCES pype_voice_agents(id) ON DELETE CASCADE,
    workspace_id UUID NOT NULL REFERENCES pype_voice_projects(id) ON DELETE CASCADE,
    bucket_name VARCHAR(255) NOT NULL UNIQUE,
    bucket_created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    bucket_status VARCHAR(20) DEFAULT 'active' CHECK (bucket_status IN ('active', 'inactive', 'deleted')),
    storage_used_gb DECIMAL(10,3) DEFAULT 0,
    last_sync_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_agent_s3_buckets_agent_id ON pype_voice_agent_s3_buckets(agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_s3_buckets_workspace_id ON pype_voice_agent_s3_buckets(workspace_id);
CREATE INDEX IF NOT EXISTS idx_agent_s3_buckets_bucket_name ON pype_voice_agent_s3_buckets(bucket_name);

-- Add comments
COMMENT ON TABLE pype_voice_agent_s3_buckets IS 'Tracks S3 buckets created for each agent';
COMMENT ON COLUMN pype_voice_agent_s3_buckets.bucket_name IS 'Full S3 bucket name (prefix + agent-id)';
COMMENT ON COLUMN pype_voice_agent_s3_buckets.bucket_status IS 'Status of the bucket (active, inactive, deleted)';
COMMENT ON COLUMN pype_voice_agent_s3_buckets.storage_used_gb IS 'Current storage usage in GB';

-- Add S3 configuration to agents table
ALTER TABLE pype_voice_agents 
ADD COLUMN IF NOT EXISTS s3_enabled BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS s3_storage_gb INTEGER DEFAULT 50,
ADD COLUMN IF NOT EXISTS s3_cost_override DECIMAL(10,6) DEFAULT NULL,
ADD COLUMN IF NOT EXISTS s3_bucket_name VARCHAR(255) DEFAULT NULL;

-- Add comments for agent S3 fields
COMMENT ON COLUMN pype_voice_agents.s3_enabled IS 'Whether S3 storage is enabled for this agent (only for voice agents)';
COMMENT ON COLUMN pype_voice_agents.s3_storage_gb IS 'Allocated storage in GB for this agent';
COMMENT ON COLUMN pype_voice_agents.s3_cost_override IS 'Custom cost per GB override for this agent (NULL = use workspace default)';
COMMENT ON COLUMN pype_voice_agents.s3_bucket_name IS 'Associated S3 bucket name for this agent';

-- Create trigger to auto-update updated_at for bucket table
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_agent_s3_buckets_updated_at 
    BEFORE UPDATE ON pype_voice_agent_s3_buckets 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

COMMIT;
