-- Database schema for feature-context-toggle service
-- This will be part of the shared database

CREATE SCHEMA IF NOT EXISTS feature_toggles;

-- Feature toggles table
CREATE TABLE IF NOT EXISTS feature_toggles.toggles (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) UNIQUE NOT NULL,
    enabled BOOLEAN DEFAULT false,
    description TEXT,
    category VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    metadata JSONB DEFAULT '{}'::jsonb
);

-- Demo user configuration for auth bypass
CREATE TABLE IF NOT EXISTS feature_toggles.demo_users (
    id SERIAL PRIMARY KEY,
    toggle_name VARCHAR(100) REFERENCES feature_toggles.toggles(name),
    user_data JSONB NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert default toggles
INSERT INTO feature_toggles.toggles (name, enabled, description, category, metadata) VALUES
('authBypass', true, 'Bypass authentication and use a demo user for development/testing', 'authentication', 
 '{"demoUser": {"id": "demo-user-001", "email": "demo@confuse.dev", "name": "Demo Developer", "roles": ["user", "developer", "admin"], "sessionId": "demo-session-001"}}'::jsonb),
('debugLogging', false, 'Enable verbose debug logging across all services', 'debugging', '{}'::jsonb),
('skipRateLimiting', false, 'Disable rate limiting for API endpoints during testing', 'performance', '{}'::jsonb),
('useSharedDatabase', true, 'Use shared database for all services in dev environment', 'database', '{}'::jsonb),
('enableDistributedTracing', true, 'Enable OpenTelemetry distributed tracing', 'observability', '{}'::jsonb)
ON CONFLICT (name) DO NOTHING;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_toggles_category ON feature_toggles.toggles(category);
CREATE INDEX IF NOT EXISTS idx_toggles_enabled ON feature_toggles.toggles(enabled);