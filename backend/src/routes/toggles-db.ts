/**
 * Feature Context Toggle - Toggle Routes (Database Version)
 * 
 * REST API for managing feature toggles using PostgreSQL with Redis caching.
 */

import { Router, Request, Response } from 'express';
import { db, Toggle } from '../database.js';
import { cache } from '../cache.js';
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
    try {
        const { category, categoryType, format } = req.query;

        // Try cache first (only for unfiltered requests)
        if (!category && !categoryType) {
            const cached = await cache.getAllToggles();
            if (cached) {
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
        const toggles = await db.getAllToggles(
            category as string | undefined,
            categoryType as string | undefined
        );

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
        console.error('Error fetching toggles:', error);
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
    try {
        const toggles = await db.getAllToggles();
        const categories = [...new Set(toggles.map(t => t.category))];
        const categoryTypes = [...new Set(toggles.map(t => t.category_type))];

        res.json({
            success: true,
            data: { categories, categoryTypes },
            timestamp: new Date().toISOString(),
        } as ApiResponse);
    } catch (error) {
        console.error('Error fetching categories:', error);
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
    try {
        const limit = parseInt(req.query.limit as string) || 100;
        const auditLog = await db.getRecentAuditLog(Math.min(limit, 500));

        res.json({
            success: true,
            data: auditLog,
            timestamp: new Date().toISOString(),
        } as ApiResponse<AuditEntry[]>);
    } catch (error) {
        console.error('Error fetching audit log:', error);
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
    try {
        const demoUser = await db.getDemoUser('authBypass');

        if (!demoUser) {
            return res.status(404).json({
                success: false,
                error: 'Auth bypass is disabled or demo user not configured',
                timestamp: new Date().toISOString(),
            } as ApiResponse);
        }

        res.json({
            success: true,
            data: demoUser,
            timestamp: new Date().toISOString(),
        } as ApiResponse);
    } catch (error) {
        console.error('Error fetching demo user:', error);
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
    try {
        const { name } = req.params;

        // Try cache first
        const cached = await cache.getToggle(name);
        if (cached) {
            return res.json({
                success: true,
                data: toApiFormat(cached),
                cached: true,
                timestamp: new Date().toISOString(),
            } as ApiResponse);
        }

        // Fetch from database
        const toggle = await db.getToggle(name);

        if (!toggle) {
            return res.status(404).json({
                success: false,
                error: `Toggle '${name}' not found`,
                timestamp: new Date().toISOString(),
            } as ApiResponse);
        }

        // Cache the result
        await cache.setToggle(name, toggle);

        res.json({
            success: true,
            data: toApiFormat(toggle),
            cached: false,
            timestamp: new Date().toISOString(),
        } as ApiResponse);
    } catch (error) {
        console.error('Error fetching toggle:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch toggle',
            timestamp: new Date().toISOString(),
        } as ApiResponse);
    }
});

// =============================================================================
// GET /api/toggles/:name/history - Get toggle audit history
// =============================================================================
router.get('/:name/history', async (req: Request, res: Response) => {
    try {
        const { name } = req.params;
        const limit = parseInt(req.query.limit as string) || 50;

        // Verify toggle exists
        const toggle = await db.getToggle(name);
        if (!toggle) {
            return res.status(404).json({
                success: false,
                error: `Toggle '${name}' not found`,
                timestamp: new Date().toISOString(),
            } as ApiResponse);
        }

        const history = await db.getToggleHistory(name, Math.min(limit, 200));

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
        const existing = await db.getToggle(name);
        if (existing) {
            return res.status(409).json({
                success: false,
                error: `Toggle '${name}' already exists`,
                timestamp: new Date().toISOString(),
            } as ApiResponse);
        }

        // Create toggle
        const toggle = await db.createToggle(
            { name, enabled, description, category, categoryType, metadata },
            getClientIdentifier(req)
        );

        // Invalidate cache
        await cache.invalidateAll();

        console.log(`🎛️  Toggle '${name}' created by ${getClientIdentifier(req)}`);

        res.status(201).json({
            success: true,
            data: toApiFormat(toggle),
            timestamp: new Date().toISOString(),
        } as ApiResponse);
    } catch (error) {
        console.error('Error creating toggle:', error);
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

        const results = await db.bulkUpdateToggles(toggles, clientId);

        // Invalidate cache
        await cache.invalidateAll();

        console.log(`🎛️  Bulk update: ${results.length} toggles updated by ${clientId}`);

        res.json({
            success: true,
            data: {
                updated: results.length,
                toggles: results.map(toApiFormat),
            },
            timestamp: new Date().toISOString(),
        } as ApiResponse);
    } catch (error) {
        console.error('Error bulk updating toggles:', error);
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
    try {
        const { name } = req.params;

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

        const toggle = await db.updateToggle(name, enabled, clientId);

        if (!toggle) {
            return res.status(404).json({
                success: false,
                error: `Toggle '${name}' not found`,
                timestamp: new Date().toISOString(),
            } as ApiResponse);
        }

        // Invalidate cache
        await cache.invalidateToggle(name);

        console.log(`🎛️  Toggle '${name}' set to ${enabled ? 'ENABLED' : 'DISABLED'} by ${clientId}`);

        res.json({
            success: true,
            data: toApiFormat(toggle),
            timestamp: new Date().toISOString(),
        } as ApiResponse);
    } catch (error) {
        console.error('Error updating toggle:', error);
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
    try {
        const { name } = req.params;

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

        const toggle = await db.updateToggleMetadata(name, metadata, clientId);

        if (!toggle) {
            return res.status(404).json({
                success: false,
                error: `Toggle '${name}' not found`,
                timestamp: new Date().toISOString(),
            } as ApiResponse);
        }

        // Invalidate cache
        await cache.invalidateToggle(name);

        console.log(`🎛️  Toggle '${name}' metadata updated by ${clientId}`);

        res.json({
            success: true,
            data: toApiFormat(toggle),
            timestamp: new Date().toISOString(),
        } as ApiResponse);
    } catch (error) {
        console.error('Error updating toggle metadata:', error);
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
    try {
        const { name } = req.params;
        const clientId = getClientIdentifier(req);

        const deleted = await db.deleteToggle(name, clientId);

        if (!deleted) {
            return res.status(404).json({
                success: false,
                error: `Toggle '${name}' not found`,
                timestamp: new Date().toISOString(),
            } as ApiResponse);
        }

        // Invalidate cache
        await cache.invalidateToggle(name);

        console.log(`🎛️  Toggle '${name}' deleted by ${clientId}`);

        res.json({
            success: true,
            data: { deleted: name },
            timestamp: new Date().toISOString(),
        } as ApiResponse);
    } catch (error) {
        console.error('Error deleting toggle:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to delete toggle',
            timestamp: new Date().toISOString(),
        } as ApiResponse);
    }
});

export default router;