/**
 * Feature Context Toggle - Toggle Routes (Database Version)
 * 
 * REST API for managing feature toggles using PostgreSQL with Redis caching.
 */

import { Router, Request, Response } from 'express';
import { getDb, Toggle } from '../database.js';
import { cache } from '../cache.js';
import { getConfig } from '../config.js';
import {
    validateCreateToggle,
    validateUpdateToggle,
    validateMetadataUpdate,
    validateBulkUpdate
} from '../validation.js';
import type {
    ToggleState,
    FeatureToggle,
    ApiResponse,
    DemoUser,
    HealthResponse,
    AuditEntry
} from '../types/index.js';

const router = Router();

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Get client identifier for audit logging
 */
function getClientIdentifier(req: Request): string {
    return req.headers['x-service-name'] as string ||
        req.headers['x-user-id'] as string ||
        req.ip ||
        'unknown';
}

/**
 * Convert database toggle to API format
 */
function toApiFormat(toggle: Toggle): FeatureToggle & { name: string } {
    return {
        name: toggle.name,
        enabled: toggle.enabled,
        description: toggle.description,
        category: toggle.category,
        categoryType: toggle.category_type,
        ...toggle.metadata
    };
}

/**
 * Convert array of database toggles to ToggleState format
 */
function toToggleState(toggles: Toggle[]): ToggleState {
    return toggles.reduce((acc, toggle) => {
        acc[toggle.name] = {
            enabled: toggle.enabled,
            description: toggle.description,
            category: toggle.category,
            categoryType: toggle.category_type,
            ...toggle.metadata
        };
        return acc;
    }, {} as ToggleState);
}

// =============================================================================
// GET /api/toggles - Get all toggles
// =============================================================================
router.get('/', async (req: Request, res: Response) => {
    console.log('[ROUTE] GET /api/toggles - Fetching all toggles', { category: req.query.category, categoryType: req.query.categoryType, format: req.query.format });
    try {
        const { category, categoryType, format } = req.query;

        // Try cache first (only for unfiltered requests)
        if (!category && !categoryType) {
            console.log('[ROUTE] GET /api/toggles - Checking cache for unfiltered request');
            const cached = await cache.getAllToggles();
            if (cached) {
                console.log(`[ROUTE] GET /api/toggles - Cache hit, returning ${cached.length} toggles`);
                const togglesObj = toToggleState(cached);
                return res.json({
                    success: true,
                    data: format === 'array' ? cached.map(toApiFormat) : togglesObj,
                    cached: true,
                    timestamp: new Date().toISOString(),
                } as ApiResponse);
            }
        }

        // Fetch from database
        console.log('[ROUTE] GET /api/toggles - Fetching from database');
        const toggles = await getDb().getAllToggles(
            category as string | undefined,
            categoryType as string | undefined
        );
        console.log(`[ROUTE] GET /api/toggles - Database returned ${toggles.length} toggles`);

        // Cache if unfiltered
        if (!category && !categoryType) {
            await cache.setAllToggles(toggles);
        }

        const responseData = format === 'array'
            ? toggles.map(toApiFormat)
            : toToggleState(toggles);

        res.json({
            success: true,
            data: responseData,
            cached: false,
            timestamp: new Date().toISOString(),
        } as ApiResponse);
    } catch (error) {
        console.error('[ROUTE] [ERROR] GET /api/toggles - Error fetching toggles:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch toggles',
            timestamp: new Date().toISOString(),
        } as ApiResponse);
    }
});

// =============================================================================
// GET /api/toggles/categories - Get unique categories
// =============================================================================
router.get('/categories', async (_req: Request, res: Response) => {
    console.log('[ROUTE] GET /api/toggles/categories - Fetching categories');
    try {
        const toggles = await getDb().getAllToggles();
        const categories = [...new Set(toggles.map(t => t.category))];
        const categoryTypes = [...new Set(toggles.map(t => t.category_type))];

        console.log('[ROUTE] GET /api/toggles/categories - Returning categories', { categories, categoryTypes });
        res.json({
            success: true,
            data: { categories, categoryTypes },
            timestamp: new Date().toISOString(),
        } as ApiResponse);
    } catch (error) {
        console.error('[ROUTE] [ERROR] GET /api/toggles/categories - Error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch categories',
            timestamp: new Date().toISOString(),
        } as ApiResponse);
    }
});

// =============================================================================
// GET /api/toggles/audit - Get recent audit log
// =============================================================================
router.get('/audit', async (req: Request, res: Response) => {
    console.log('[ROUTE] GET /api/toggles/audit - Fetching audit log', { limit: req.query.limit });
    try {
        const config = getConfig();
        const limit = parseInt(req.query.limit as string) || config.apiLimits.defaultAuditLimit;
        const auditLog = await getDb().getRecentAuditLog(Math.min(limit, config.apiLimits.maxAuditLimit));
        console.log(`[ROUTE] GET /api/toggles/audit - Returning ${auditLog.length} audit entries`);

        res.json({
            success: true,
            data: auditLog,
            timestamp: new Date().toISOString(),
        } as ApiResponse<AuditEntry[]>);
    } catch (error) {
        console.error('[ROUTE] [ERROR] GET /api/toggles/audit - Error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch audit log',
            timestamp: new Date().toISOString(),
        } as ApiResponse);
    }
});

// =============================================================================
// GET /api/toggles/auth-bypass/user - Get demo user for auth bypass
// =============================================================================
router.get('/auth-bypass/user', async (_req: Request, res: Response) => {
    console.log('[ROUTE] GET /api/toggles/auth-bypass/user - Fetching demo user');
    try {
        const demoUser = await getDb().getDemoUser('authBypass');

        if (!demoUser) {
            console.log('[ROUTE] GET /api/toggles/auth-bypass/user - No demo user found or auth bypass disabled');
            return res.status(404).json({
                success: false,
                error: 'Auth bypass is disabled or demo user not configured',
                timestamp: new Date().toISOString(),
            } as ApiResponse);
        }

        console.log('[ROUTE] GET /api/toggles/auth-bypass/user - Demo user found and returned');
        res.json({
            success: true,
            data: demoUser,
            timestamp: new Date().toISOString(),
        } as ApiResponse);
    } catch (error) {
        console.error('[ROUTE] [ERROR] GET /api/toggles/auth-bypass/user - Error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get demo user',
            timestamp: new Date().toISOString(),
        } as ApiResponse);
    }
});

// =============================================================================
// GET /api/toggles/:name - Get a specific toggle
// =============================================================================
router.get('/:name', async (req: Request, res: Response) => {
    const { name } = req.params;
    console.log(`[ROUTE] GET /api/toggles/${name} - Fetching single toggle`);
    try {

        // Try cache first
        console.log(`[ROUTE] GET /api/toggles/${name} - Checking cache`);
        const cached = await cache.getToggle(name);
        if (cached) {
            console.log(`[ROUTE] GET /api/toggles/${name} - Cache hit`);
            return res.json({
                success: true,
                data: toApiFormat(cached),
                cached: true,
                timestamp: new Date().toISOString(),
            } as ApiResponse);
        }

        // Fetch from database
        console.log(`[ROUTE] GET /api/toggles/${name} - Fetching from database`);
        const toggle = await getDb().getToggle(name);

        if (!toggle) {
            return res.status(404).json({
                success: false,
                error: `Toggle '${name}' not found`,
                timestamp: new Date().toISOString(),
            } as ApiResponse);
        }

        // Cache the result
        await cache.setToggle(name, toggle);

        console.log(`[ROUTE] GET /api/toggles/${name} - Toggle found and returned`);
        res.json({
            success: true,
            data: toApiFormat(toggle),
            cached: false,
            timestamp: new Date().toISOString(),
        } as ApiResponse);
    } catch (error) {
        console.error(`[ROUTE] [ERROR] GET /api/toggles/${name} - Error:`, error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch toggle',
            timestamp: new Date().toISOString(),
        } as ApiResponse);
    }
});

// =============================================================================
// POST /api/logs - Accept frontend logs
// =============================================================================
router.post('/logs', async (req: Request, res: Response) => {
    console.log('[ROUTE] POST /api/logs - Received frontend log', { 
        logCount: Array.isArray(req.body) ? req.body.length : 1 
    });
    
    try {
        // Just acknowledge receipt - we could store logs if needed
        res.json({
            success: true,
            message: 'Logs received',
            timestamp: new Date().toISOString(),
        });
    } catch (error) {
        console.error('[ROUTE] [ERROR] POST /api/logs - Error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to process logs',
            timestamp: new Date().toISOString(),
        });
    }
});

// =============================================================================
// GET /api/toggles/:name/history - Get toggle audit history
// =============================================================================
router.get('/:name/history', async (req: Request, res: Response) => {
    try {
        const { name } = req.params;
        const config = getConfig();
        const limit = parseInt(req.query.limit as string) || config.apiLimits.defaultHistoryLimit;

        // Verify toggle exists
        const toggle = await getDb().getToggle(name);
        if (!toggle) {
            return res.status(404).json({
                success: false,
                error: `Toggle '${name}' not found`,
                timestamp: new Date().toISOString(),
            } as ApiResponse);
        }

        const history = await getDb().getToggleHistory(name, Math.min(limit, config.apiLimits.maxHistoryLimit));

        res.json({
            success: true,
            data: history,
            timestamp: new Date().toISOString(),
        } as ApiResponse<AuditEntry[]>);
    } catch (error) {
        console.error('Error fetching toggle history:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch toggle history',
            timestamp: new Date().toISOString(),
        } as ApiResponse);
    }
});

// =============================================================================
// POST /api/toggles - Create a new toggle
// =============================================================================
router.post('/', async (req: Request, res: Response) => {
    console.log('[ROUTE] POST /api/toggles - Creating new toggle', { name: req.body.name, category: req.body.category });
    try {
        // Validate input
        const validation = validateCreateToggle(req.body);
        if (!validation.valid) {
            return res.status(400).json({
                success: false,
                error: 'Validation failed',
                errors: validation.errors,
                timestamp: new Date().toISOString(),
            } as ApiResponse);
        }

        const { name, enabled, description, category, categoryType, metadata } = req.body;

        // Check if toggle already exists
        const existing = await getDb().getToggle(name);
        if (existing) {
            console.log(`[ROUTE] POST /api/toggles - Toggle '${name}' already exists`);
            return res.status(409).json({
                success: false,
                error: `Toggle '${name}' already exists`,
                timestamp: new Date().toISOString(),
            } as ApiResponse);
        }

        // Create toggle
        const toggle = await getDb().createToggle(
            { name, enabled, description, category, categoryType, metadata },
            getClientIdentifier(req)
        );

        // Invalidate cache
        await cache.invalidateAll();

        console.log(`[ROUTE] POST /api/toggles - 🎛️ Toggle '${name}' created by ${getClientIdentifier(req)}`);

        res.status(201).json({
            success: true,
            data: toApiFormat(toggle),
            timestamp: new Date().toISOString(),
        } as ApiResponse);
    } catch (error) {
        console.error('[ROUTE] [ERROR] POST /api/toggles - Error creating toggle:', error);
        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Failed to create toggle',
            timestamp: new Date().toISOString(),
        } as ApiResponse);
    }
});

// =============================================================================
// POST /api/toggles/bulk - Bulk update toggles
// =============================================================================
router.post('/bulk', async (req: Request, res: Response) => {
    console.log('[ROUTE] POST /api/toggles/bulk - Bulk update request', { count: req.body.toggles?.length });
    try {
        // Validate input
        const validation = validateBulkUpdate(req.body);
        if (!validation.valid) {
            return res.status(400).json({
                success: false,
                error: 'Validation failed',
                errors: validation.errors,
                timestamp: new Date().toISOString(),
            } as ApiResponse);
        }

        const { toggles } = req.body;
        const clientId = getClientIdentifier(req);

        const results = await getDb().bulkUpdateToggles(toggles, clientId);

        // Invalidate cache
        await cache.invalidateAll();

        console.log(`[ROUTE] POST /api/toggles/bulk - 🎛️ Bulk update: ${results.length} toggles updated by ${clientId}`);

        res.json({
            success: true,
            data: {
                updated: results.length,
                toggles: results.map(toApiFormat),
            },
            timestamp: new Date().toISOString(),
        } as ApiResponse);
    } catch (error) {
        console.error('[ROUTE] [ERROR] POST /api/toggles/bulk - Error:', error);
        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Failed to bulk update toggles',
            timestamp: new Date().toISOString(),
        } as ApiResponse);
    }
});

// =============================================================================
// PATCH /api/toggles/:name - Update toggle enabled state
// =============================================================================
router.patch('/:name', async (req: Request, res: Response) => {
    const { name } = req.params;
    console.log(`[ROUTE] PATCH /api/toggles/${name} - Updating toggle`, { enabled: req.body.enabled });
    try {

        // Validate input
        const validation = validateUpdateToggle(req.body);
        if (!validation.valid) {
            return res.status(400).json({
                success: false,
                error: 'Validation failed',
                errors: validation.errors,
                timestamp: new Date().toISOString(),
            } as ApiResponse);
        }

        const { enabled } = req.body;
        const clientId = getClientIdentifier(req);

        const toggle = await getDb().updateToggle(name, enabled, clientId);

        if (!toggle) {
            return res.status(404).json({
                success: false,
                error: `Toggle '${name}' not found`,
                timestamp: new Date().toISOString(),
            } as ApiResponse);
        }

        // Invalidate cache
        await cache.invalidateToggle(name);

        console.log(`[ROUTE] PATCH /api/toggles/${name} - 🎛️ Toggle set to ${enabled ? 'ENABLED' : 'DISABLED'} by ${clientId}`);

        res.json({
            success: true,
            data: toApiFormat(toggle),
            timestamp: new Date().toISOString(),
        } as ApiResponse);
    } catch (error) {
        console.error(`[ROUTE] [ERROR] PATCH /api/toggles/${name} - Error:`, error);
        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Failed to update toggle',
            timestamp: new Date().toISOString(),
        } as ApiResponse);
    }
});

// =============================================================================
// PATCH /api/toggles/:name/metadata - Update toggle metadata
// =============================================================================
router.patch('/:name/metadata', async (req: Request, res: Response) => {
    const { name } = req.params;
    console.log(`[ROUTE] PATCH /api/toggles/${name}/metadata - Updating metadata`);
    try {

        // Validate input
        const validation = validateMetadataUpdate(req.body);
        if (!validation.valid) {
            return res.status(400).json({
                success: false,
                error: 'Validation failed',
                errors: validation.errors,
                timestamp: new Date().toISOString(),
            } as ApiResponse);
        }

        const { metadata } = req.body;
        const clientId = getClientIdentifier(req);

        const toggle = await getDb().updateToggleMetadata(name, metadata, clientId);

        if (!toggle) {
            return res.status(404).json({
                success: false,
                error: `Toggle '${name}' not found`,
                timestamp: new Date().toISOString(),
            } as ApiResponse);
        }

        // Invalidate cache
        await cache.invalidateToggle(name);

        console.log(`[ROUTE] PATCH /api/toggles/${name}/metadata - 🎛️ Metadata updated by ${clientId}`);

        res.json({
            success: true,
            data: toApiFormat(toggle),
            timestamp: new Date().toISOString(),
        } as ApiResponse);
    } catch (error) {
        console.error(`[ROUTE] [ERROR] PATCH /api/toggles/${name}/metadata - Error:`, error);
        res.status(500).json({
            success: false,
            error: 'Failed to update toggle metadata',
            timestamp: new Date().toISOString(),
        } as ApiResponse);
    }
});

// =============================================================================
// DELETE /api/toggles/:name - Delete a toggle
// =============================================================================
router.delete('/:name', async (req: Request, res: Response) => {
    const { name } = req.params;
    console.log(`[ROUTE] DELETE /api/toggles/${name} - Deleting toggle`);
    try {
        const clientId = getClientIdentifier(req);

        const deleted = await getDb().deleteToggle(name, clientId);

        if (!deleted) {
            return res.status(404).json({
                success: false,
                error: `Toggle '${name}' not found`,
                timestamp: new Date().toISOString(),
            } as ApiResponse);
        }

        // Invalidate cache
        await cache.invalidateToggle(name);

        console.log(`[ROUTE] DELETE /api/toggles/${name} - 🎛️ Toggle deleted by ${clientId}`);

        res.json({
            success: true,
            data: { deleted: name },
            timestamp: new Date().toISOString(),
        } as ApiResponse);
    } catch (error) {
        console.error(`[ROUTE] [ERROR] DELETE /api/toggles/${name} - Error:`, error);
        res.status(500).json({
            success: false,
            error: 'Failed to delete toggle',
            timestamp: new Date().toISOString(),
        } as ApiResponse);
    }
});

export default router;