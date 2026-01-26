/**
 * Feature Context Toggle - Configuration Module
 * 
 * Centralized configuration loader with environment variable validation.
 * All configuration values are loaded from environment variables.
 */

// =============================================================================
// Configuration Interface
// =============================================================================

export interface Config {
    // Server
    port: number;
    nodeEnv: string;
    isProduction: boolean;

    // Database
    db: {
        host: string;
        port: number;
        name: string;
        user: string;
        password: string;
        schema: string;
        ssl: boolean;
        useContainer: boolean;
    };

    // Redis
    redis: {
        url: string;
        cacheTtlSeconds: number;
        cacheKeyPrefix: string;
        allTogglesKey: string;
    };

    // CORS
    corsOrigins: string[];

    // Validation
    validation: {
        minNameLength: number;
        maxNameLength: number;
        minDescriptionLength: number;
        maxDescriptionLength: number;
    };

    // API Limits
    apiLimits: {
        defaultAuditLimit: number;
        maxAuditLimit: number;
        defaultHistoryLimit: number;
        maxHistoryLimit: number;
    };
}

// =============================================================================
// Environment Variable Helpers
// =============================================================================

/**
 * Get required environment variable or throw error
 */
function getRequired(name: string): string {
    const value = process.env[name];
    if (!value) {
        throw new Error(`Missing required environment variable: ${name}`);
    }
    return value;
}

/**
 * Get optional environment variable with default
 */
function getOptional(name: string, defaultValue: string): string {
    return process.env[name] || defaultValue;
}

/**
 * Get integer environment variable
 */
function getInt(name: string, defaultValue: number): number {
    const value = process.env[name];
    if (!value) return defaultValue;
    const parsed = parseInt(value, 10);
    if (isNaN(parsed)) {
        throw new Error(`Invalid integer for ${name}: ${value}`);
    }
    return parsed;
}

// =============================================================================
// Configuration Loader
// =============================================================================

let _config: Config | null = null;

/**
 * Load configuration from environment variables
 */
export function loadConfig(): Config {
    if (_config) return _config;

    const nodeEnv = getOptional('NODE_ENV', 'development');

    _config = {
        // Server
        port: getInt('PORT', 3099),
        nodeEnv,
        isProduction: nodeEnv === 'production',

        // Database - supports both container and NeonDB
        db: (() => {
            const useContainer = getOptional('USE_CONTAINER_DB', 'true') === 'true';
            
            if (useContainer) {
                return {
                    host: getOptional('DB_HOST', 'localhost'),
                    port: getInt('DB_PORT', 5432),
                    name: getOptional('DB_NAME', 'confuse_shared'),
                    user: getOptional('DB_USER', 'confuse'),
                    password: getOptional('DB_PASSWORD', 'confuse_pg_secret'),
                    schema: getOptional('DB_SCHEMA', 'feature_toggles'),
                    ssl: false,
                    useContainer: true,
                };
            } else {
                return {
                    host: getRequired('NEON_DB_HOST'),
                    port: getInt('NEON_DB_PORT', 5432),
                    name: getRequired('NEON_DB_NAME'),
                    user: getRequired('NEON_DB_USER'),
                    password: getRequired('NEON_DB_PASSWORD'),
                    schema: getOptional('DB_SCHEMA', 'feature_toggles'),
                    ssl: true,
                    useContainer: false,
                };
            }
        })(),

        // Redis
        redis: {
            url: getRequired('REDIS_URL'),
            cacheTtlSeconds: getInt('CACHE_TTL_SECONDS', 5),
            cacheKeyPrefix: getOptional('CACHE_KEY_PREFIX', 'toggle:'),
            allTogglesKey: getOptional('ALL_TOGGLES_KEY', 'toggles:all'),
        },

        // CORS
        corsOrigins: getOptional('CORS_ORIGINS', 'http://localhost:5173,http://localhost:3000').split(','),

        // Validation
        validation: {
            minNameLength: getInt('MIN_NAME_LENGTH', 3),
            maxNameLength: getInt('MAX_NAME_LENGTH', 50),
            minDescriptionLength: getInt('MIN_DESCRIPTION_LENGTH', 10),
            maxDescriptionLength: getInt('MAX_DESCRIPTION_LENGTH', 500),
        },

        // API Limits
        apiLimits: {
            defaultAuditLimit: getInt('DEFAULT_AUDIT_LIMIT', 100),
            maxAuditLimit: getInt('MAX_AUDIT_LIMIT', 500),
            defaultHistoryLimit: getInt('DEFAULT_HISTORY_LIMIT', 50),
            maxHistoryLimit: getInt('MAX_HISTORY_LIMIT', 200),
        },
    };

    return _config;
}

/**
 * Get configuration (must be loaded first)
 */
export function getConfig(): Config {
    if (!_config) {
        throw new Error('Configuration not loaded. Call loadConfig() first.');
    }
    return _config;
}

// Export singleton for convenience
export const config = {
    get: getConfig,
    load: loadConfig,
};
