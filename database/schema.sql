-- =============================================================================
-- Feature Toggle - Database Schema
-- =============================================================================
-- This schema is part of the shared database (confuse_shared)
-- Run: psql -h localhost -U confuse -d confuse_shared -f schema.sql
-- =============================================================================



-- =============================================================================
-- Feature Toggles Table
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.toggles (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) UNIQUE NOT NULL,
    enabled BOOLEAN DEFAULT false,
    description TEXT NOT NULL,
    category VARCHAR(50) NOT NULL,
    category_type VARCHAR(20) NOT NULL CHECK (category_type IN ('devOnly', 'userFacing', 'ops')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    metadata JSONB DEFAULT '{}'::jsonb,
    
    -- Ensure toggle names are camelCase (start lowercase, alphanumeric)
    CONSTRAINT valid_toggle_name CHECK (name ~ '^[a-z][a-zA-Z0-9]*$'),
    CONSTRAINT valid_description CHECK (length(description) >= 10)
);

-- =============================================================================
-- Audit Log Table
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.audit_log (
    id SERIAL PRIMARY KEY,
    toggle_name VARCHAR(100) NOT NULL,
    action VARCHAR(20) NOT NULL CHECK (action IN ('create', 'update', 'delete')),
    previous_value BOOLEAN,
    new_value BOOLEAN,
    previous_metadata JSONB,
    new_metadata JSONB,
    changed_by VARCHAR(100) NOT NULL DEFAULT 'system',
    changed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    ip_address VARCHAR(45),
    user_agent TEXT,
    notes TEXT
);

-- =============================================================================
-- Demo Users Table (for auth bypass)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.demo_users (
    id SERIAL PRIMARY KEY,
    toggle_name VARCHAR(100) REFERENCES public.toggles(name) ON DELETE CASCADE,
    user_data JSONB NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_demo_user_per_toggle UNIQUE (toggle_name)
);

-- =============================================================================
-- Indexes
-- =============================================================================
CREATE INDEX IF NOT EXISTS idx_toggles_category ON public.toggles(category);
CREATE INDEX IF NOT EXISTS idx_toggles_category_type ON public.toggles(category_type);
CREATE INDEX IF NOT EXISTS idx_toggles_enabled ON public.toggles(enabled);
CREATE INDEX IF NOT EXISTS idx_audit_toggle_name ON public.audit_log(toggle_name);
CREATE INDEX IF NOT EXISTS idx_audit_changed_at ON public.audit_log(changed_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_action ON public.audit_log(action);

-- =============================================================================
-- Functions
-- =============================================================================

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for auto-updating updated_at
DROP TRIGGER IF EXISTS trigger_update_updated_at ON public.toggles;
CREATE TRIGGER trigger_update_updated_at
    BEFORE UPDATE ON public.toggles
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at();

-- =============================================================================
-- Default Toggles - Product Features
-- =============================================================================
INSERT INTO public.toggles (name, enabled, description, category, category_type, metadata) VALUES
('enableRepositories', true, 'Enable repositories pipeline and feature', 'features', 'userFacing', '{}'::jsonb),
('enableDocuments', true, 'Enable documents pipeline and feature', 'features', 'userFacing', '{}'::jsonb),
('enableURLs', false, 'Enable URLs pipeline and feature', 'features', 'userFacing', '{}'::jsonb),
('enableChats', false, 'Enable chats pipeline and feature', 'features', 'userFacing', '{}'::jsonb),
('enableDesign', false, 'Enable design options feature', 'features', 'userFacing', '{}'::jsonb)
ON CONFLICT (name) DO NOTHING;

-- =============================================================================
-- Grant Permissions (for production, adjust as needed)
-- =============================================================================
-- GRANT USAGE ON SCHEMA feature_toggles TO confuse_app;
-- GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA feature_toggles TO confuse_app;
-- GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA feature_toggles TO confuse_app;