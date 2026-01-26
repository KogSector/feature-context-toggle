/**
 * Feature Context Toggle - Backend Entry Point
 * 
 * Express server for managing feature toggles with PostgreSQL and Redis.
 */

import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import path from 'path';
import { fileURLToPath } from 'url';
import { loadConfig, getConfig } from './config.js';
import { getDb } from './database.js';
import { cache } from './cache.js';
import toggleRoutes from './routes/toggles-db.js';
import type { HealthResponse } from './types/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load configuration first (validates required env vars)
console.log('[STARTUP] Loading configuration...');
const appConfig = loadConfig();
console.log('[STARTUP] Configuration loaded successfully', { port: appConfig.port, nodeEnv: appConfig.nodeEnv });

const app = express();
const PORT = appConfig.port;
const VERSION = process.env.npm_package_version || '1.0.0';

// =============================================================================
// Security Middleware
// =============================================================================
app.use(helmet());

// =============================================================================
// CORS Configuration
// =============================================================================
const corsOrigins = appConfig.corsOrigins;

app.use(cors({
    origin: corsOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
}));

// =============================================================================
// Body Parsing
// =============================================================================
app.use(express.json());

// =============================================================================
// Request Logging
// =============================================================================
app.use((req, res, next) => {
    const start = Date.now();
    const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    console.log(`[REQUEST] [${requestId}] ${req.method} ${req.path} started`, {
        query: req.query,
        headers: { 'content-type': req.headers['content-type'], 'x-service-name': req.headers['x-service-name'] },
        ip: req.ip,
    });
    res.on('finish', () => {
        const duration = Date.now() - start;
        const level = res.statusCode >= 400 ? 'ERROR' : 'SUCCESS';
        console.log(`[RESPONSE] [${requestId}] [${level}] ${req.method} ${req.path} ${res.statusCode} ${duration}ms`);
    });
    next();
});

// =============================================================================
// Health Check
// =============================================================================
app.get('/health', async (_req, res) => {
    console.log('[HEALTH] Health check requested');
    const dbHealth = await getDb().healthCheck();
    const cacheHealth = await cache.healthCheck();
    console.log('[HEALTH] Health check results', { dbHealth, cacheHealth });

    const isHealthy = dbHealth.healthy;
    const status = isHealthy ? 'healthy' : (cacheHealth.healthy ? 'degraded' : 'unhealthy');

    const response: HealthResponse = {
        status,
        service: 'feature-context-toggle',
        version: VERSION,
        timestamp: new Date().toISOString(),
        dependencies: {
            database: dbHealth,
            cache: cacheHealth,
        },
    };

    console.log(`[HEALTH] Responding with status: ${status}`);
    res.status(isHealthy ? 200 : 503).json(response);
});

// =============================================================================
// Toggle Routes
// =============================================================================
app.use('/api/toggles', toggleRoutes);

// =============================================================================
// Static Files - Serve Frontend Dashboard
// =============================================================================
const publicPath = path.join(__dirname, '..', 'public');
app.use(express.static(publicPath));

// SPA fallback - serve index.html for all non-API routes
app.get('*', (req, res, next) => {
    // Skip API routes
    if (req.path.startsWith('/api') || req.path === '/health') {
        return next();
    }
    res.sendFile(path.join(publicPath, 'index.html'), (err) => {
        if (err) {
            // If index.html doesn't exist, return 404
            res.status(404).json({
                success: false,
                error: 'Frontend not available',
                message: 'The dashboard UI is not built. Run: cd frontend && npm run build',
                path: req.path,
                timestamp: new Date().toISOString(),
            });
        }
    });
});

// =============================================================================
// 404 Handler (for API routes only)
// =============================================================================
app.use((req, res) => {
    res.status(404).json({
        success: false,
        error: 'Not found',
        path: req.path,
        timestamp: new Date().toISOString(),
    });
});

// =============================================================================
// Error Handler
// =============================================================================
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error('Unhandled error:', err);
    res.status(500).json({
        success: false,
        error: process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message,
        timestamp: new Date().toISOString(),
    });
});

// =============================================================================
// Startup
// =============================================================================
async function start() {
    console.log('[STARTUP] ==================================================');
    console.log('[STARTUP] Feature Context Toggle Service Starting...');
    console.log('[STARTUP] ==================================================');
    console.log('[STARTUP] Timestamp:', new Date().toISOString());
    console.log('[STARTUP] Node version:', process.version);
    console.log('[STARTUP] Environment:', appConfig.nodeEnv);
    console.log('');
    console.log('╔══════════════════════════════════════════════════════════╗');
    console.log('║     🎛️  Feature Context Toggle - Starting...             ║');
    console.log('╚══════════════════════════════════════════════════════════╝');
    console.log('');

    // Initialize database
    console.log('[STARTUP] Initializing database connection...');
    const dbReady = await getDb().initialize();
    if (!dbReady) {
        console.warn('[STARTUP] ⚠️  Database initialization failed, running in degraded mode');
    } else {
        console.log('[STARTUP] ✅ Database initialized successfully');
    }

    // Initialize cache
    console.log('[STARTUP] Initializing Redis cache connection...');
    const cacheReady = await cache.initialize();
    if (!cacheReady) {
        console.warn('[STARTUP] ⚠️  Cache not available, running without caching');
    } else {
        console.log('[STARTUP] ✅ Redis cache initialized successfully');
    }

    // Start server
    app.listen(PORT, () => {
        console.log('');
        console.log('╔══════════════════════════════════════════════════════════╗');
        console.log('║     🎛️  Feature Context Toggle - Backend Service         ║');
        console.log('╠══════════════════════════════════════════════════════════╣');
        console.log(`║  🚀 Server running on http://localhost:${PORT}            ║`);
        console.log('║  📊 Toggles API: /api/toggles                            ║');
        console.log('║  💚 Health check: /health                                ║');
        console.log('╠══════════════════════════════════════════════════════════╣');
        console.log(`║  📦 Database: ${dbReady ? '✅ Connected' : '❌ Unavailable'}                           ║`);
        console.log(`║  🔴 Cache: ${cacheReady ? '✅ Connected' : '❌ Unavailable'}                              ║`);
        console.log('╚══════════════════════════════════════════════════════════╝');
        console.log('');
    });
}

// Graceful shutdown
process.on('SIGTERM', async () => {
    console.log('[SHUTDOWN] Received SIGTERM, shutting down gracefully...');
    console.log('[SHUTDOWN] Timestamp:', new Date().toISOString());
    await cache.close();
    await getDb().close();
    process.exit(0);
});

process.on('SIGINT', async () => {
    console.log('[SHUTDOWN] Received SIGINT, shutting down gracefully...');
    console.log('[SHUTDOWN] Timestamp:', new Date().toISOString());
    await cache.close();
    await getDb().close();
    process.exit(0);
});

// Start the server
start().catch((error) => {
    console.error('Failed to start server:', error);
    process.exit(1);
});

export default app;
