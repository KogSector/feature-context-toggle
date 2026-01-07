/**
 * Feature Context Toggle - Toggle Routes (Database Version)
 * 
 * REST API for managing feature toggles using shared database
 */

import { Router, Request, Response } from 'express';
import { db } from '../database.js';
import type { ToggleState, FeatureToggle, ToggleUpdateRequest, ApiResponse, DemoUser } from '../types/index.js';

const router = Router();

/**
 * GET /api/toggles
 * Get all feature toggles
 */
router.get('/', async (_req: Request, res: Response) => {
    try {
        const toggles = await db.getAllToggles();
        
        // Convert to original format for compatibility
        const togglesObj = toggles.reduce((acc, toggle) => {
            acc[toggle.name] = {
                enabled: toggle.enabled,
                description: toggle.description,
                category: toggle.category,
                ...toggle.metadata
            };
            return acc;
        }, {} as ToggleState);

        const response: ApiResponse<ToggleState> = {
            success: true,
            data: togglesObj,
            timestamp: new Date().toISOString(),
        };

        res.json(response);
    } catch (error) {
        console.error('Database error:', error);
        const response: ApiResponse = {
            success: false,
            error: 'Failed to read toggles from database',
            timestamp: new Date().toISOString(),
        };
        res.status(500).json(response);
    }
});

/**
 * GET /api/toggles/:name
 * Get a specific toggle by name
 */
router.get('/:name', async (req: Request, res: Response) => {
    try {
        const { name } = req.params;
        const toggle = await db.getToggle(name);

        if (!toggle) {
            const response: ApiResponse = {
                success: false,
                error: `Toggle '${name}' not found`,
                timestamp: new Date().toISOString(),
            };
            return res.status(404).json(response);
        }

        const response: ApiResponse<FeatureToggle & { name: string }> = {
            success: true,
            data: {
                name: toggle.name,
                enabled: toggle.enabled,
                description: toggle.description,
                category: toggle.category,
                ...toggle.metadata
            },
            timestamp: new Date().toISOString(),
        };

        res.json(response);
    } catch (error) {
        console.error('Database error:', error);
        const response: ApiResponse = {
            success: false,
            error: 'Failed to read toggle from database',
            timestamp: new Date().toISOString(),
        };
        res.status(500).json(response);
    }
});

/**
 * PATCH /api/toggles/:name
 * Update a toggle's enabled state
 */
router.patch('/:name', async (req: Request, res: Response) => {
    try {
        const { name } = req.params;
        const body = req.body as ToggleUpdateRequest;

        if (typeof body.enabled !== 'boolean') {
            const response: ApiResponse = {
                success: false,
                error: 'Request body must include "enabled" boolean field',
                timestamp: new Date().toISOString(),
            };
            return res.status(400).json(response);
        }

        const updatedToggle = await db.updateToggle(name, body.enabled);

        if (!updatedToggle) {
            const response: ApiResponse = {
                success: false,
                error: `Toggle '${name}' not found`,
                timestamp: new Date().toISOString(),
            };
            return res.status(404).json(response);
        }

        console.log(`🎛️  Toggle '${name}' set to ${body.enabled ? 'ENABLED' : 'DISABLED'}`);

        const response: ApiResponse<FeatureToggle & { name: string }> = {
            success: true,
            data: {
                name: updatedToggle.name,
                enabled: updatedToggle.enabled,
                description: updatedToggle.description,
                category: updatedToggle.category,
                ...updatedToggle.metadata
            },
            timestamp: new Date().toISOString(),
        };

        res.json(response);
    } catch (error) {
        console.error('Database error:', error);
        const response: ApiResponse = {
            success: false,
            error: 'Failed to update toggle in database',
            timestamp: new Date().toISOString(),
        };
        res.status(500).json(response);
    }
});

/**
 * GET /api/toggles/auth-bypass/user
 * Get the demo user for auth bypass (only when bypass is enabled)
 */
router.get('/auth-bypass/user', async (_req: Request, res: Response) => {
    try {
        const demoUser = await db.getDemoUser('authBypass');

        if (!demoUser) {
            const response: ApiResponse = {
                success: false,
                error: 'Auth bypass is disabled or demo user not configured',
                timestamp: new Date().toISOString(),
            };
            return res.status(404).json(response);
        }

        const response: ApiResponse<DemoUser> = {
            success: true,
            data: demoUser,
            timestamp: new Date().toISOString(),
        };

        res.json(response);
    } catch (error) {
        console.error('Database error:', error);
        const response: ApiResponse = {
            success: false,
            error: 'Failed to get demo user from database',
            timestamp: new Date().toISOString(),
        };
        res.status(500).json(response);
    }
});

export default router;