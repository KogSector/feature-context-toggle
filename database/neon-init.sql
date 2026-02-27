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
 '{"demoUser": {"id": "user-rishabh-001", "email": "rishabh.babi@gmail.com", "name": "Rishabh Babi", "roles": ["user", "developer", "admin"], "sessionId": "session-rishabh-001"}}'::jsonb),
('debugLogging', false, 'Enable verbose debug logging across all services', 'debugging', 'devOnly', '{}'::jsonb),
('skipRateLimiting', false, 'Disable rate limiting for API endpoints during testing', 'performance', 'devOnly', '{}'::jsonb),
('useSharedDatabase', true, 'Use shared database for all services in dev environment', 'database', 'ops', '{}'::jsonb),
('enableDistributedTracing', true, 'Enable OpenTelemetry distributed tracing', 'observability', 'ops', '{}'::jsonb),
('advancedSearch', true, 'Enable advanced search features in the application', 'features', 'userFacing', '{}'::jsonb),
-- New toggles for platform transformation
('useUnifiedProcessor', true, 'Route processing through unified-processor (CocoIndex) service', 'processing', 'ops',
 '{"description": "When enabled, uses the new unified-processor for all document and code processing"}'::jsonb),
('useDoclingProcessing', true, 'Enable Docling for advanced document parsing (PDF, DOCX, HTML)', 'processing', 'userFacing',
 '{"description": "When enabled, uses Docling for superior document layout analysis"}'::jsonb),
('useTreeSitterAnalysis', true, 'Enable Tree-sitter for universal code analysis', 'processing', 'userFacing',
 '{"description": "When enabled, uses Tree-sitter for AST-based code understanding"}'::jsonb),
('useGraphitiGraph', true, 'Route graph operations through Graphiti-powered relation-graph', 'graph', 'ops',
 '{"description": "When enabled, uses the Graphiti temporal knowledge graph"}'::jsonb),
-- Enterprise infrastructure toggles
('useHybridSearch', true, 'Enable hybrid vector + graph search for enhanced results', 'search', 'userFacing',
 '{"description": "Combines vector similarity and knowledge graph traversal for better search relevance"}'::jsonb),
('useCircuitBreaker', true, 'Enable circuit breaker pattern for service resilience', 'reliability', 'ops',
 '{"description": "Automatically fails fast when downstream services are unhealthy", "threshold": 5, "timeout": 30000}'::jsonb),
('useKafkaEvents', false, 'Route async operations through Kafka message queue', 'messaging', 'ops',
 '{"description": "When enabled, publishes processing events to Kafka topics for async handling"}'::jsonb),
('enablePrometheusMetrics', true, 'Expose Prometheus metrics endpoints on all services', 'observability', 'ops',
 '{"description": "When enabled, exposes /metrics endpoint for Prometheus scraping"}'::jsonb),
('enableHealthChecks', true, 'Enable detailed health check endpoints', 'observability', 'ops',
 '{"description": "Provides /health and /health/live endpoints for container orchestration"}'::jsonb),
('enableRateLimiting', true, 'Enable API rate limiting in production', 'security', 'ops',
 '{"description": "Rate limits API requests per user/IP to prevent abuse", "requestsPerMinute": 100}'::jsonb),
-- LLM Control Toggle
('enableLLM', false, 'Enable LLM processing for AI-powered features', 'ai', 'devOnly',
 '{"description": "When enabled, allows LLM models to run for semantic analysis, chunking, and entity extraction. Disable to reduce resource usage in development.", "affectedServices": ["unified-processor", "relation-graph", "data-vent"]}'::jsonb)
ON CONFLICT (name) DO NOTHING;

