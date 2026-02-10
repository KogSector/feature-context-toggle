/**
 * Feature Context Toggle - In-Memory Cache Layer
 * 
 * Provides high-performance in-memory caching for toggle reads with automatic
 * invalidation on updates. No external dependencies required.
 */

import type { Toggle } from './db/client.js';
import { getConfig } from './config.js';

// =============================================================================
// Cache Entry with TTL
// =============================================================================

interface CacheEntry<T> {
    data: T;
    expiresAt: number;
}

// =============================================================================
// Cache Manager
// =============================================================================

export class CacheManager {
    private store: Map<string, CacheEntry<any>> = new Map();
    private initialized: boolean = false;
    private cacheTtlSeconds: number = 5;
    private cacheKeyPrefix: string = 'toggle:';
    private allTogglesKey: string = 'toggles:all';
    private cleanupInterval: ReturnType<typeof setInterval> | null = null;

    /**
     * Initialize in-memory cache
     */
    async initialize(): Promise<boolean> {
        console.log('[CACHE] Initializing in-memory cache...');
        if (this.initialized) {
            console.log('[CACHE] Already initialized, skipping...');
            return true;
        }

        // Load configuration
        const config = getConfig();
        this.cacheTtlSeconds = config.cacheTtlSeconds;
        this.cacheKeyPrefix = config.cacheKeyPrefix;
        this.allTogglesKey = config.allTogglesKey;

        // Periodic cleanup of expired entries every 30 seconds
        this.cleanupInterval = setInterval(() => this.cleanup(), 30_000);

        this.initialized = true;
        console.log('[CACHE] ✅ In-memory cache initialized successfully');
        return true;
    }

    /**
     * Check if cache is available
     */
    isAvailable(): boolean {
        return this.initialized;
    }

    /**
     * Get a single toggle from cache
     */
    async getToggle(name: string): Promise<Toggle | null> {
        if (!this.isAvailable()) {
            console.log(`[CACHE] [GET] Cache unavailable for toggle: ${name}`);
            return null;
        }

        const key = `${this.cacheKeyPrefix}${name}`;
        const entry = this.store.get(key);

        if (entry && entry.expiresAt > Date.now()) {
            console.log(`[CACHE] [HIT] Toggle '${name}' found in cache`);
            return entry.data;
        }

        // Remove expired entry
        if (entry) {
            this.store.delete(key);
        }

        console.log(`[CACHE] [MISS] Toggle '${name}' not in cache`);
        return null;
    }

    /**
     * Set a single toggle in cache
     */
    async setToggle(name: string, toggle: Toggle): Promise<void> {
        if (!this.isAvailable()) {
            console.log(`[CACHE] [SET] Cache unavailable, skipping set for: ${name}`);
            return;
        }

        console.log(`[CACHE] [SET] Caching toggle: ${name}`);
        const key = `${this.cacheKeyPrefix}${name}`;
        this.store.set(key, {
            data: toggle,
            expiresAt: Date.now() + (this.cacheTtlSeconds * 1000),
        });
        console.log(`[CACHE] [SET] Toggle '${name}' cached successfully`);
    }

    /**
     * Get all toggles from cache
     */
    async getAllToggles(): Promise<Toggle[] | null> {
        if (!this.isAvailable()) {
            console.log('[CACHE] [GET-ALL] Cache unavailable');
            return null;
        }

        const entry = this.store.get(this.allTogglesKey);
        if (entry && entry.expiresAt > Date.now()) {
            console.log(`[CACHE] [HIT-ALL] Found ${entry.data.length} toggles in cache`);
            return entry.data;
        }

        // Remove expired entry
        if (entry) {
            this.store.delete(this.allTogglesKey);
        }

        console.log('[CACHE] [MISS-ALL] All toggles not in cache');
        return null;
    }

    /**
     * Set all toggles in cache
     */
    async setAllToggles(toggles: Toggle[]): Promise<void> {
        if (!this.isAvailable()) {
            console.log('[CACHE] [SET-ALL] Cache unavailable, skipping');
            return;
        }

        console.log(`[CACHE] [SET-ALL] Caching ${toggles.length} toggles`);
        const expiresAt = Date.now() + (this.cacheTtlSeconds * 1000);

        this.store.set(this.allTogglesKey, { data: toggles, expiresAt });

        // Also cache individual toggles
        for (const toggle of toggles) {
            this.store.set(`${this.cacheKeyPrefix}${toggle.name}`, {
                data: toggle,
                expiresAt,
            });
        }
        console.log(`[CACHE] [SET-ALL] ${toggles.length} toggles cached successfully`);
    }

    /**
     * Invalidate a single toggle
     */
    async invalidateToggle(name: string): Promise<void> {
        if (!this.isAvailable()) {
            console.log(`[CACHE] [INVALIDATE] Cache unavailable, skipping for: ${name}`);
            return;
        }

        console.log(`[CACHE] [INVALIDATE] Invalidating cache for toggle: ${name}`);
        this.store.delete(`${this.cacheKeyPrefix}${name}`);
        this.store.delete(this.allTogglesKey);
        console.log(`[CACHE] [INVALIDATE] Cache invalidated for toggle: ${name}`);
    }

    /**
     * Invalidate all cached toggles
     */
    async invalidateAll(): Promise<void> {
        if (!this.isAvailable()) {
            console.log('[CACHE] [INVALIDATE-ALL] Cache unavailable, skipping');
            return;
        }

        console.log('[CACHE] [INVALIDATE-ALL] Invalidating all cached toggles');
        this.store.clear();
        console.log('[CACHE] [INVALIDATE-ALL] All cache invalidated successfully');
    }

    /**
     * Health check
     */
    async healthCheck(): Promise<{ healthy: boolean; latencyMs: number }> {
        console.log('[CACHE] [HEALTH] Performing health check...');
        if (!this.isAvailable()) {
            console.log('[CACHE] [HEALTH] Cache not initialized');
            return { healthy: false, latencyMs: 0 };
        }
        console.log('[CACHE] [HEALTH] Health check passed (in-memory)');
        return { healthy: true, latencyMs: 0 };
    }

    /**
     * Clean up expired entries
     */
    private cleanup(): void {
        const now = Date.now();
        let cleaned = 0;
        for (const [key, entry] of this.store.entries()) {
            if (entry.expiresAt <= now) {
                this.store.delete(key);
                cleaned++;
            }
        }
        if (cleaned > 0) {
            console.log(`[CACHE] Cleaned up ${cleaned} expired entries`);
        }
    }

    /**
     * Close cache (cleanup resources)
     */
    async close(): Promise<void> {
        console.log('[CACHE] Closing in-memory cache...');
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
            this.cleanupInterval = null;
        }
        this.store.clear();
        this.initialized = false;
        console.log('[CACHE] In-memory cache closed');
    }
}

// Export singleton instance
export const cache = new CacheManager();
