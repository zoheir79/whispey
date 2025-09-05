BEGIN;

-- Drop existing billing tables with incorrect structure
DROP TABLE IF EXISTS billing_items CASCADE;
DROP TABLE IF EXISTS billing_invoices CASCADE;

-- Create billing_invoices table for invoice management
CREATE TABLE billing_invoices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL,
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    billing_cycle VARCHAR(10) DEFAULT 'monthly', -- 'monthly' or 'annual'
    total_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
    status VARCHAR(20) DEFAULT 'draft', -- 'draft', 'sent', 'paid', 'cancelled'
    currency VARCHAR(3) DEFAULT 'USD',
    invoice_data JSONB, -- Full invoice data
    due_date DATE,
    paid_date DATE,
    payment_method VARCHAR(50),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create billing_items table for detailed billing records per agent
CREATE TABLE billing_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_id UUID REFERENCES billing_invoices(id) ON DELETE CASCADE,
    agent_id UUID NOT NULL REFERENCES pype_voice_agents(id) ON DELETE CASCADE,
    agent_name VARCHAR(255) NOT NULL,
    platform_mode VARCHAR(20) NOT NULL, -- 'dedicated', 'pag', 'hybrid'
    
    -- Cost breakdown per service
    stt_cost DECIMAL(10,4) DEFAULT 0,
    tts_cost DECIMAL(10,4) DEFAULT 0,
    llm_cost DECIMAL(10,4) DEFAULT 0,
    agent_cost DECIMAL(10,4) DEFAULT 0,
    s3_cost DECIMAL(10,4) DEFAULT 0,
    total_cost DECIMAL(10,4) DEFAULT 0,
    
    -- Detailed usage and configuration data
    usage_details JSONB, -- Contains usage metrics and consumption details
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for billing tables
CREATE INDEX idx_billing_invoices_workspace_id ON billing_invoices(workspace_id);
CREATE INDEX idx_billing_invoices_period ON billing_invoices(period_start, period_end);
CREATE INDEX idx_billing_invoices_status ON billing_invoices(status);
CREATE INDEX idx_billing_invoices_created_at ON billing_invoices(created_at);

CREATE INDEX idx_billing_items_invoice_id ON billing_items(invoice_id);
CREATE INDEX idx_billing_items_agent_id ON billing_items(agent_id);
CREATE INDEX idx_billing_items_platform_mode ON billing_items(platform_mode);

COMMIT;
