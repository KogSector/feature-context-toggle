-- NeonDB Schema Initialization for Feature Context Toggle
-- Run this script to set up the feature_toggles schema in NeonDB

-- Create feature_toggles schema
CREATE SCHEMA IF NOT EXISTS feature_toggles;

-- Feature toggles table
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
    CONSTRAINT valid_toggle_name CHECK (name ~ '^[a-z][a-zA-Z0-9]*$'),
    CONSTRAINT valid_description CHECK (length(description) >= 10)
);

-- Audit log table
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

-- Demo users table (for auth bypass)
CREATE TABLE IF NOT EXISTS feature_toggles.demo_users (
    id SERIAL PRIMARY KEY,
    toggle_name VARCHAR(100) REFERENCES feature_toggles.toggles(name) ON DELETE CASCADE,
    user_data JSONB NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_demo_user_per_toggle UNIQUE (toggle_name)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_toggles_category ON feature_toggles.toggles(category);
CREATE INDEX IF NOT EXISTS idx_toggles_category_type ON feature_toggles.toggles(category_type);
CREATE INDEX IF NOT EXISTS idx_toggles_enabled ON feature_toggles.toggles(enabled);
CREATE INDEX IF NOT EXISTS idx_audit_toggle_name ON feature_toggles.audit_log(toggle_name);
CREATE INDEX IF NOT EXISTS idx_audit_changed_at ON feature_toggles.audit_log(changed_at DESC);

-- Insert default feature toggles
INSERT INTO feature_toggles.toggles (name, enabled, description, category, category_type, metadata) VALUES
('authBypass', true, 'Bypass authentication and use a demo user for development/testing', 'authentication', 'devOnly',
 '{"demoUser": {"id": "demo-user-001", "email": "demo@confuse.dev", "name": "Demo Developer", "roles": ["user", "developer", "admin"], "sessionId": "demo-session-001"}}'::jsonb),
('debugLogging', false, 'Enable verbose debug logging across all services', 'debugging', 'devOnly', '{}'::jsonb),
('skipRateLimiting', false, 'Disable rate limiting for API endpoints during testing', 'performance', 'devOnly', '{}'::jsonb),
('useSharedDatabase', true, 'Use shared database for all services in dev environment', 'database', 'ops', '{}'::jsonb),
('enableDistributedTracing', true, 'Enable OpenTelemetry distributed tracing', 'observability', 'ops', '{}'::jsonb),
('advancedSearch', true, 'Enable advanced search features in the application', 'features', 'userFacing', '{}'::jsonb)
ON CONFLICT (name) DO NOTHING;
