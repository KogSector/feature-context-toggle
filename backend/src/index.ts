/**
 * Feature Context Toggle - Backend Entry Point
 * 
 * Express server for managing feature toggles with PostgreSQL and Redis.
 */

import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { loadConfig, getConfig } from './config.js';
import { db } from './database.js';
import { cache } from './cache.js';
import toggleRoutes from './routes/toggles-db.js';
import type { HealthResponse } from './types/index.js';

// Load configuration first (validates required env vars)
const appConfig = loadConfig();

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
    res.on('finish', () => {
        const duration = Date.now() - start;
        const level = res.statusCode >= 400 ? '⚠️' : '✓';
        console.log(`${level} ${req.method} ${req.path} ${res.statusCode} ${duration}ms`);
    });
    next();
});

// =============================================================================
// Health Check
// =============================================================================
app.get('/health', async (_req, res) => {
    const dbHealth = await db.healthCheck();
    const cacheHealth = await cache.healthCheck();

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

    res.status(isHealthy ? 200 : 503).json(response);
});

// =============================================================================
// Toggle Routes
// =============================================================================
app.use('/api/toggles', toggleRoutes);

// =============================================================================
// 404 Handler
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
    console.log('');
    console.log('╔══════════════════════════════════════════════════════════╗');
    console.log('║     🎛️  Feature Context Toggle - Starting...             ║');
    console.log('╚══════════════════════════════════════════════════════════╝');
    console.log('');

    // Initialize database
    const dbReady = await db.initialize();
    if (!dbReady) {
        console.warn('⚠️  Database initialization failed, running in degraded mode');
    }

    // Initialize cache
    const cacheReady = await cache.initialize();
    if (!cacheReady) {
        console.warn('⚠️  Cache not available, running without caching');
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
    console.log('Received SIGTERM, shutting down gracefully...');
    await cache.close();
    await db.close();
    process.exit(0);
});

process.on('SIGINT', async () => {
    console.log('Received SIGINT, shutting down gracefully...');
    await cache.close();
    await db.close();
    process.exit(0);
});

// Start the server
start().catch((error) => {
    console.error('Failed to start server:', error);
    process.exit(1);
});

export default app;
