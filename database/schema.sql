-- =============================================================================
-- Feature Context Toggle - Database Schema
-- =============================================================================
-- This schema is part of the shared database (confuse_shared)
-- Run: psql -h localhost -U confuse -d confuse_shared -f schema.sql
-- =============================================================================

CREATE SCHEMA IF NOT EXISTS feature_toggles;

-- =============================================================================
-- Feature Toggles Table
-- =============================================================================
CREATE TABLE IF NOT EXISTS feature_toggles.toggles (
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
CREATE TABLE IF NOT EXISTS feature_toggles.audit_log (
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
CREATE TABLE IF NOT EXISTS feature_toggles.demo_users (
    id SERIAL PRIMARY KEY,
    toggle_name VARCHAR(100) REFERENCES feature_toggles.toggles(name) ON DELETE CASCADE,
    user_data JSONB NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_demo_user_per_toggle UNIQUE (toggle_name)
);

-- =============================================================================
-- Indexes
-- =============================================================================
CREATE INDEX IF NOT EXISTS idx_toggles_category ON feature_toggles.toggles(category);
CREATE INDEX IF NOT EXISTS idx_toggles_category_type ON feature_toggles.toggles(category_type);
CREATE INDEX IF NOT EXISTS idx_toggles_enabled ON feature_toggles.toggles(enabled);
CREATE INDEX IF NOT EXISTS idx_audit_toggle_name ON feature_toggles.audit_log(toggle_name);
CREATE INDEX IF NOT EXISTS idx_audit_changed_at ON feature_toggles.audit_log(changed_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_action ON feature_toggles.audit_log(action);

-- =============================================================================
-- Functions
-- =============================================================================

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION feature_toggles.update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for auto-updating updated_at
DROP TRIGGER IF EXISTS trigger_update_updated_at ON feature_toggles.toggles;
CREATE TRIGGER trigger_update_updated_at
    BEFORE UPDATE ON feature_toggles.toggles
    FOR EACH ROW
    EXECUTE FUNCTION feature_toggles.update_updated_at();

-- =============================================================================
-- Default Toggles - Authentication & Security
-- =============================================================================
INSERT INTO feature_toggles.toggles (name, enabled, description, category, category_type, metadata) VALUES
('authBypass', false, 'Bypass authentication and use a demo user for development/testing', 'authentication', 'devOnly', 
 '{"demoUser": {"id": "demo-user-001", "email": "demo@confuse.dev", "name": "Demo Developer", "roles": ["user", "developer", "admin"], "sessionId": "demo-session-001"}}'::jsonb),
('oauthProviders', true, 'Enable OAuth login options (Google, GitHub, etc.)', 'authentication', 'userFacing', '{}'::jsonb),
('mfaRequired', false, 'Force multi-factor authentication for all users', 'authentication', 'ops', '{}'::jsonb),
('sessionTimeout', true, 'Enable automatic session expiry after inactivity', 'authentication', 'ops', '{"timeoutMinutes": 60}'::jsonb),
('apiRateLimiting', true, 'Rate limit API requests per user/IP', 'authentication', 'ops', '{"requestsPerMinute": 100}'::jsonb)
ON CONFLICT (name) DO NOTHING;

-- =============================================================================
-- Default Toggles - Data Processing
-- =============================================================================
INSERT INTO feature_toggles.toggles (name, enabled, description, category, category_type, metadata) VALUES
('chunkingEnabled', true, 'Enable document chunking for processing', 'data', 'ops', '{"maxChunkSize": 1000}'::jsonb),
('embeddingCache', true, 'Cache vector embeddings for faster retrieval', 'data', 'ops', '{"ttlHours": 24}'::jsonb),
('dataRetention', true, 'Auto-purge old data based on retention policy', 'data', 'ops', '{"retentionDays": 90}'::jsonb),
('asyncProcessing', true, 'Enable background job processing for heavy tasks', 'data', 'ops', '{}'::jsonb)
ON CONFLICT (name) DO NOTHING;

-- =============================================================================
-- Default Toggles - Infrastructure
-- =============================================================================
INSERT INTO feature_toggles.toggles (name, enabled, description, category, category_type, metadata) VALUES
('useSharedDatabase', true, 'Use shared PostgreSQL database for all services', 'infrastructure', 'ops', '{}'::jsonb),
('distributedTracing', true, 'Enable OpenTelemetry distributed tracing', 'infrastructure', 'ops', '{}'::jsonb),
('loadBalancing', false, 'Enable load balancer for horizontal scaling', 'infrastructure', 'ops', '{}'::jsonb),
('cachingEnabled', true, 'Enable Redis caching layer for performance', 'infrastructure', 'ops', '{}'::jsonb),
('cdnEnabled', false, 'Enable CDN for static asset delivery', 'infrastructure', 'ops', '{}'::jsonb)
ON CONFLICT (name) DO NOTHING;

-- =============================================================================
-- Default Toggles - Development & Debugging
-- =============================================================================
INSERT INTO feature_toggles.toggles (name, enabled, description, category, category_type, metadata) VALUES
('debugLogging', false, 'Enable verbose debug logging across all services', 'debugging', 'devOnly', '{}'::jsonb),
('skipRateLimiting', false, 'Disable rate limiting for API endpoints during testing', 'debugging', 'devOnly', '{}'::jsonb),
('mockExternalServices', false, 'Mock external API calls for isolated testing', 'debugging', 'devOnly', '{}'::jsonb),
('profilingEnabled', false, 'Enable performance profiling and metrics collection', 'debugging', 'devOnly', '{}'::jsonb),
('featureFlags', true, 'Enable A/B testing framework for experiments', 'debugging', 'userFacing', '{}'::jsonb)
ON CONFLICT (name) DO NOTHING;

-- =============================================================================
-- Grant Permissions (for production, adjust as needed)
-- =============================================================================
-- GRANT USAGE ON SCHEMA feature_toggles TO confuse_app;
-- GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA feature_toggles TO confuse_app;
-- GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA feature_toggles TO confuse_app;