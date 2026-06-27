/**
 * Feature Toggle - Configuration Module
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
        password?: string;
        schema: string;
        ssl: boolean;
        useContainer: boolean;
    };

    // Cache
    cacheTtlSeconds: number;
    cacheKeyPrefix: string;
    allTogglesKey: string;

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
 * Get integer environment variable
 */
function getInt(name: string): number {
    const value = process.env[name];
    if (!value) {
        throw new Error(`Missing required integer environment variable: ${name}`);
    }
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

    const nodeEnv = process.env.NODE_ENV || 'development';

    _config = {
        // Server
        port: getInt('FEATURE_TOGGLE_PORT'),
        nodeEnv,
        isProduction: nodeEnv === 'production',

        // Database - supports both container and NeonDB
        db: (() => {
            let host = getRequired('DB_HOST');
            let port = getInt('DB_PORT');
            let name = getRequired('DB_NAME');
            let user = getRequired('DB_USER');
            let password = process.env.DB_PASSWORD; // optional
            let ssl = process.env.DB_SSL === 'true';

            const dbUrl = process.env.DATABASE_URL;
            if (dbUrl) {
                try {
                    const parsedUrl = new URL(dbUrl);
                    host = parsedUrl.hostname;
                    port = parsedUrl.port ? parseInt(parsedUrl.port, 10) : 5432;
                    name = parsedUrl.pathname.replace(/^\//, '');
                    user = decodeURIComponent(parsedUrl.username);
                    password = decodeURIComponent(parsedUrl.password);
                    if (dbUrl.includes('sslmode=require') || dbUrl.includes('ssl=true')) {
                        ssl = true;
                    }
                } catch (e) {
                    console.error('Failed to parse DATABASE_URL from environment:', e);
                }
            }

            return {
                host,
                port,
                name,
                user,
                password,
                schema: getRequired('DB_SCHEMA'),
                ssl,
                useContainer: false,
            };
        })(),

        // Cache
        cacheTtlSeconds: getInt('CACHE_TTL_SECONDS'),
        cacheKeyPrefix: getRequired('CACHE_KEY_PREFIX'),
        allTogglesKey: getRequired('ALL_TOGGLES_KEY'),

        // CORS
        corsOrigins: getRequired('CORS_ORIGINS').split(','),

        // Validation
        validation: {
            minNameLength: getInt('MIN_NAME_LENGTH'),
            maxNameLength: getInt('MAX_NAME_LENGTH'),
            minDescriptionLength: getInt('MIN_DESCRIPTION_LENGTH'),
            maxDescriptionLength: getInt('MAX_DESCRIPTION_LENGTH'),
        },

        // API Limits
        apiLimits: {
            defaultAuditLimit: getInt('DEFAULT_AUDIT_LIMIT'),
            maxAuditLimit: getInt('MAX_AUDIT_LIMIT'),
            defaultHistoryLimit: getInt('DEFAULT_HISTORY_LIMIT'),
            maxHistoryLimit: getInt('MAX_HISTORY_LIMIT'),
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
