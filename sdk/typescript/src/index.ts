/**
 * @confuse/feature-toggle-sdk
 * 
 * TypeScript SDK for the ConFuse Feature Toggle service.
 * 
 * @example
 * ```typescript
 * import { initToggleClient, isToggleEnabled, requireToggle } from '@confuse/feature-toggle-sdk';
 * 
 * // Initialize once at app startup (requires FEATURE_TOGGLE_SERVICE_URL env var)
 * if (!process.env.FEATURE_TOGGLE_SERVICE_URL) {
 *   throw new Error('FEATURE_TOGGLE_SERVICE_URL environment variable is required');
 * }
 * 
 * initToggleClient({
 *   serviceUrl: process.env.FEATURE_TOGGLE_SERVICE_URL,
 *   serviceName: process.env.SERVICE_NAME || 'my-service',
 * });
 * 
 * // Check toggle
 * if (await isToggleEnabled('myFeature')) {
 *   // Feature enabled
 * }
 * 
 * // Protect Express route
 * app.get('/beta', requireToggle({ toggle: 'betaFeature' }), handler);
 * ```
 */

// Re-export all types
export type {
    CategoryType,
    FeatureToggle,
    DemoUser,
    ToggleState,
    ApiResponse,
    ToggleClientConfig,
    ToggleMiddlewareOptions,
} from './types.js';

// Re-export client
export {
    ToggleClient,
    createToggleClient,
    initToggleClient,
    getToggleClient,
    isToggleEnabled,
} from './client.js';

// Re-export middleware
export {
    requireToggle,
    attachToggles,
    checkAuthBypass,
} from './middleware.js';
