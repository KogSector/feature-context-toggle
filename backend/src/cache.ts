/**
 * Feature Toggle - In-Memory Cache Layer
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

        if (this.initialized) {

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

            return null;
        }

        const key = `${this.cacheKeyPrefix}${name}`;
        const entry = this.store.get(key);

        if (entry && entry.expiresAt > Date.now()) {

            return entry.data;
        }

        // Remove expired entry
        if (entry) {
            this.store.delete(key);
        }


        return null;
    }

    /**
     * Set a single toggle in cache
     */
    async setToggle(name: string, toggle: Toggle): Promise<void> {
        if (!this.isAvailable()) {

            return;
        }


        const key = `${this.cacheKeyPrefix}${name}`;
        this.store.set(key, {
            data: toggle,
            expiresAt: Date.now() + (this.cacheTtlSeconds * 1000),
        });

    }

    /**
     * Get all toggles from cache
     */
    async getAllToggles(): Promise<Toggle[] | null> {
        if (!this.isAvailable()) {

            return null;
        }

        const entry = this.store.get(this.allTogglesKey);
        if (entry && entry.expiresAt > Date.now()) {

            return entry.data;
        }

        // Remove expired entry
        if (entry) {
            this.store.delete(this.allTogglesKey);
        }


        return null;
    }

    /**
     * Set all toggles in cache
     */
    async setAllToggles(toggles: Toggle[]): Promise<void> {
        if (!this.isAvailable()) {

            return;
        }


        const expiresAt = Date.now() + (this.cacheTtlSeconds * 1000);

        this.store.set(this.allTogglesKey, { data: toggles, expiresAt });

        // Also cache individual toggles
        for (const toggle of toggles) {
            this.store.set(`${this.cacheKeyPrefix}${toggle.name}`, {
                data: toggle,
                expiresAt,
            });
        }

    }

    /**
     * Invalidate a single toggle
     */
    async invalidateToggle(name: string): Promise<void> {
        if (!this.isAvailable()) {

            return;
        }


        this.store.delete(`${this.cacheKeyPrefix}${name}`);
        this.store.delete(this.allTogglesKey);

    }

    /**
     * Invalidate all cached toggles
     */
    async invalidateAll(): Promise<void> {
        if (!this.isAvailable()) {

            return;
        }


        this.store.clear();

    }

    /**
     * Health check
     */
    async healthCheck(): Promise<{ healthy: boolean; latencyMs: number }> {

        if (!this.isAvailable()) {

            return { healthy: false, latencyMs: 0 };
        }

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

        }
    }

    /**
     * Close cache (cleanup resources)
     */
    async close(): Promise<void> {

        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
            this.cleanupInterval = null;
        }
        this.store.clear();
        this.initialized = false;

    }
}

// Export singleton instance
export const cache = new CacheManager();
