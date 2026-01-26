/**
 * Feature Context Toggle - Redis Cache Layer
 * 
 * Provides high-performance caching for toggle reads with automatic
 * invalidation on updates.
 */

import { createClient, RedisClientType } from 'redis';
import type { Toggle } from './database.js';
import { getConfig } from './config.js';

// =============================================================================
// Cache Manager
// =============================================================================

export class CacheManager {
    private client: RedisClientType | null = null;
    private connected: boolean = false;
    private connecting: boolean = false;
    private cacheTtlSeconds: number = 5;
    private cacheKeyPrefix: string = 'toggle:';
    private allTogglesKey: string = 'toggles:all';

    /**
     * Initialize Redis connection
     */
    async initialize(): Promise<boolean> {
        console.log('[CACHE] Initializing Redis connection...');
        if (this.connected || this.connecting) {
            console.log('[CACHE] Already connected or connecting, skipping...');
            return this.connected;
        }

        this.connecting = true;

        // Load configuration
        const config = getConfig();
        const redisUrl = config.redis.url;
        this.cacheTtlSeconds = config.redis.cacheTtlSeconds;
        this.cacheKeyPrefix = config.redis.cacheKeyPrefix;
        this.allTogglesKey = config.redis.allTogglesKey;

        try {
            console.log(`[CACHE] Connecting to Redis at: ${redisUrl}`);
            this.client = createClient({ url: redisUrl });

            this.client.on('error', (err) => {
                console.warn('[CACHE] [ERROR] Redis cache error:', err.message);
                this.connected = false;
            });

            this.client.on('connect', () => {
                console.log('[CACHE] ✅ Redis cache connected');
            });

            this.client.on('reconnecting', () => {
                console.log('[CACHE] 🔄 Redis cache reconnecting...');
            });

            await this.client.connect();
            this.connected = true;
            this.connecting = false;
            console.log('[CACHE] Redis connection established successfully');
            return true;
        } catch (error) {
            console.warn('[CACHE] ⚠️ Redis cache not available, running without cache:',
                error instanceof Error ? error.message : 'Unknown error');
            this.connected = false;
            this.connecting = false;
            return false;
        }
    }

    /**
     * Check if cache is available
     */
    isAvailable(): boolean {
        return this.connected && this.client !== null;
    }

    /**
     * Get a single toggle from cache
     */
    async getToggle(name: string): Promise<Toggle | null> {
        if (!this.isAvailable()) {
            console.log(`[CACHE] [GET] Cache unavailable for toggle: ${name}`);
            return null;
        }

        try {
            const cached = await this.client!.get(`${this.cacheKeyPrefix}${name}`);
            if (cached) {
                console.log(`[CACHE] [HIT] Toggle '${name}' found in cache`);
                return JSON.parse(cached);
            }
            console.log(`[CACHE] [MISS] Toggle '${name}' not in cache`);
        } catch (error) {
            console.warn(`[CACHE] [ERROR] Cache get error for '${name}':`, error);
        }

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

        try {
            console.log(`[CACHE] [SET] Caching toggle: ${name}`);
            await this.client!.setEx(
                `${this.cacheKeyPrefix}${name}`,
                this.cacheTtlSeconds,
                JSON.stringify(toggle)
            );
        console.log(`[CACHE] [SET] Toggle '${name}' cached successfully`);
        } catch (error) {
            console.warn(`[CACHE] [ERROR] Cache set error for '${name}':`, error);
        }
    }

    /**
     * Get all toggles from cache
     */
    async getAllToggles(): Promise<Toggle[] | null> {
        if (!this.isAvailable()) {
            console.log('[CACHE] [GET-ALL] Cache unavailable');
            return null;
        }

        try {
            const cached = await this.client!.get(this.allTogglesKey);
            if (cached) {
                const toggles = JSON.parse(cached);
                console.log(`[CACHE] [HIT-ALL] Found ${toggles.length} toggles in cache`);
                return toggles;
            }
            console.log('[CACHE] [MISS-ALL] All toggles not in cache');
        } catch (error) {
            console.warn('[CACHE] [ERROR] Cache get all error:', error);
        }

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

        try {
            console.log(`[CACHE] [SET-ALL] Caching ${toggles.length} toggles`);
            await this.client!.setEx(
                this.allTogglesKey,
                this.cacheTtlSeconds,
                JSON.stringify(toggles)
            );

            // Also cache individual toggles
            const pipeline = this.client!.multi();
            for (const toggle of toggles) {
                pipeline.setEx(
                    `${this.cacheKeyPrefix}${toggle.name}`,
                    this.cacheTtlSeconds,
                    JSON.stringify(toggle)
                );
            }
            await pipeline.exec();
            console.log(`[CACHE] [SET-ALL] ${toggles.length} toggles cached successfully`);
        } catch (error) {
            console.warn('[CACHE] [ERROR] Cache set all error:', error);
        }
    }

    /**
     * Invalidate a single toggle
     */
    async invalidateToggle(name: string): Promise<void> {
        if (!this.isAvailable()) {
            console.log(`[CACHE] [INVALIDATE] Cache unavailable, skipping for: ${name}`);
            return;
        }

        try {
            console.log(`[CACHE] [INVALIDATE] Invalidating cache for toggle: ${name}`);
            await this.client!.del([
                `${this.cacheKeyPrefix}${name}`,
                this.allTogglesKey,
            ]);
            console.log(`[CACHE] [INVALIDATE] Cache invalidated for toggle: ${name}`);
        } catch (error) {
            console.warn(`[CACHE] [ERROR] Cache invalidate error for '${name}':`, error);
        }
    }

    /**
     * Invalidate all cached toggles
     */
    async invalidateAll(): Promise<void> {
        if (!this.isAvailable()) {
            console.log('[CACHE] [INVALIDATE-ALL] Cache unavailable, skipping');
            return;
        }

        try {
            console.log('[CACHE] [INVALIDATE-ALL] Invalidating all cached toggles');
            // Get all toggle keys and delete them
            const keys = await this.client!.keys(`${this.cacheKeyPrefix}*`);
            if (keys.length > 0) {
                await this.client!.del(keys);
                console.log(`[CACHE] [INVALIDATE-ALL] Deleted ${keys.length} individual toggle keys`);
            }
            await this.client!.del(this.allTogglesKey);
            console.log('[CACHE] [INVALIDATE-ALL] All cache invalidated successfully');
        } catch (error) {
            console.warn('[CACHE] [ERROR] Cache invalidate all error:', error);
        }
    }

    /**
     * Health check
     */
    async healthCheck(): Promise<{ healthy: boolean; latencyMs: number }> {
        console.log('[CACHE] [HEALTH] Performing health check...');
        if (!this.isAvailable()) {
            console.log('[CACHE] [HEALTH] Cache not available');
            return { healthy: false, latencyMs: 0 };
        }

        const start = Date.now();
        try {
            await this.client!.ping();
            const latency = Date.now() - start;
            console.log(`[CACHE] [HEALTH] Health check passed, latency: ${latency}ms`);
            return {
                healthy: true,
                latencyMs: latency,
            };
        } catch (error) {
            const latency = Date.now() - start;
            console.error(`[CACHE] [HEALTH] Health check failed, latency: ${latency}ms`, error);
            return {
                healthy: false,
                latencyMs: latency,
            };
        }
    }

    /**
     * Close Redis connection
     */
    async close(): Promise<void> {
        console.log('[CACHE] Closing Redis connection...');
        if (this.client && this.connected) {
            await this.client.quit();
            this.connected = false;
            console.log('[CACHE] Redis connection closed');
        } else {
            console.log('[CACHE] No active connection to close');
        }
    }
}

// Export singleton instance
export const cache = new CacheManager();
