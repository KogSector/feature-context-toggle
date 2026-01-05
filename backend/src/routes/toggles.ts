/**
 * Feature Context Toggle - Toggle Routes
 * 
 * REST API for managing feature toggles
 */

import { Router, Request, Response } from 'express';
import * as fs from 'fs';
import * as path from 'path';
import type { ToggleState, FeatureToggle, ToggleUpdateRequest, ApiResponse, DemoUser } from '../types/index.js';

const router = Router();

// Path to toggles.json (relative to project root)
const TOGGLES_FILE = path.resolve(__dirname, '../../../toggles.json');

/**
 * Read toggles from file
 */
function readToggles(): ToggleState {
    try {
        const content = fs.readFileSync(TOGGLES_FILE, 'utf-8');
        return JSON.parse(content) as ToggleState;
    } catch (error) {
        console.error('Failed to read toggles file:', error);
        return {};
    }
}

/**
 * Write toggles to file
 */
function writeToggles(toggles: ToggleState): boolean {
    try {
        fs.writeFileSync(TOGGLES_FILE, JSON.stringify(toggles, null, 2), 'utf-8');
        return true;
    } catch (error) {
        console.error('Failed to write toggles file:', error);
        return false;
    }
}

/**
 * GET /api/toggles
 * Get all feature toggles
 */
router.get('/', (_req: Request, res: Response) => {
    const toggles = readToggles();

    const response: ApiResponse<ToggleState> = {
        success: true,
        data: toggles,
        timestamp: new Date().toISOString(),
    };

    res.json(response);
});

/**
 * GET /api/toggles/:name
 * Get a specific toggle by name
 */
router.get('/:name', (req: Request, res: Response) => {
    const { name } = req.params;
    const toggles = readToggles();
    const toggle = toggles[name];

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
        data: { ...toggle, name },
        timestamp: new Date().toISOString(),
    };

    res.json(response);
});

/**
 * PATCH /api/toggles/:name
 * Update a toggle's enabled state
 */
router.patch('/:name', (req: Request, res: Response) => {
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

    const toggles = readToggles();

    if (!toggles[name]) {
        const response: ApiResponse = {
            success: false,
            error: `Toggle '${name}' not found`,
            timestamp: new Date().toISOString(),
        };
        return res.status(404).json(response);
    }

    // Update the toggle
    toggles[name].enabled = body.enabled;

    if (!writeToggles(toggles)) {
        const response: ApiResponse = {
            success: false,
            error: 'Failed to persist toggle state',
            timestamp: new Date().toISOString(),
        };
        return res.status(500).json(response);
    }

    console.log(`Toggle '${name}' set to ${body.enabled ? 'ENABLED' : 'DISABLED'}`);

    const response: ApiResponse<FeatureToggle & { name: string }> = {
        success: true,
        data: { ...toggles[name], name },
        timestamp: new Date().toISOString(),
    };

    res.json(response);
});

/**
 * GET /api/toggles/auth-bypass/user
 * Get the demo user for auth bypass (only when bypass is enabled)
 */
router.get('/auth-bypass/user', (_req: Request, res: Response) => {
    const toggles = readToggles();
    const authBypass = toggles['authBypass'];

    if (!authBypass) {
        const response: ApiResponse = {
            success: false,
            error: 'Auth bypass toggle not configured',
            timestamp: new Date().toISOString(),
        };
        return res.status(404).json(response);
    }

    if (!authBypass.enabled) {
        const response: ApiResponse = {
            success: false,
            error: 'Auth bypass is not enabled',
            timestamp: new Date().toISOString(),
        };
        return res.status(403).json(response);
    }

    if (!authBypass.demoUser) {
        const response: ApiResponse = {
            success: false,
            error: 'Demo user not configured',
            timestamp: new Date().toISOString(),
        };
        return res.status(404).json(response);
    }

    const response: ApiResponse<DemoUser> = {
        success: true,
        data: authBypass.demoUser,
        timestamp: new Date().toISOString(),
    };

    res.json(response);
});

export default router;
