/**
 * Feature Context Toggle - Redis Cache Layer
 * 
 * Provides high-performance caching for toggle reads with automatic
 * invalidation on updates.
 */

import { createClient, RedisClientType } from 'redis';
import type { Toggle } from './database.js';

// =============================================================================
// Configuration
// =============================================================================

const CACHE_TTL_SECONDS = 5; // Short TTL to ensure freshness
const CACHE_KEY_PREFIX = 'toggle:';
const ALL_TOGGLES_KEY = 'toggles:all';

// =============================================================================
// Cache Manager
// =============================================================================

export class CacheManager {
    private client: RedisClientType | null = null;
    private connected: boolean = false;
    private connecting: boolean = false;

    /**
     * Initialize Redis connection
     */
    async initialize(): Promise<boolean> {
        if (this.connected || this.connecting) {
            return this.connected;
        }

        this.connecting = true;
        const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379/2';

        try {
            this.client = createClient({ url: redisUrl });

            this.client.on('error', (err) => {
                console.warn('Redis cache error:', err.message);
                this.connected = false;
            });

            this.client.on('connect', () => {
                console.log('✅ Redis cache connected');
            });

            this.client.on('reconnecting', () => {
                console.log('🔄 Redis cache reconnecting...');
            });

            await this.client.connect();
            this.connected = true;
            this.connecting = false;
            return true;
        } catch (error) {
            console.warn('⚠️ Redis cache not available, running without cache:',
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
        if (!this.isAvailable()) return null;

        try {
            const cached = await this.client!.get(`${CACHE_KEY_PREFIX}${name}`);
            if (cached) {
                return JSON.parse(cached);
            }
        } catch (error) {
            console.warn('Cache get error:', error);
        }

        return null;
    }

    /**
     * Set a single toggle in cache
     */
    async setToggle(name: string, toggle: Toggle): Promise<void> {
        if (!this.isAvailable()) return;

        try {
            await this.client!.setEx(
                `${CACHE_KEY_PREFIX}${name}`,
                CACHE_TTL_SECONDS,
                JSON.stringify(toggle)
            );
        } catch (error) {
            console.warn('Cache set error:', error);
        }
    }

    /**
     * Get all toggles from cache
     */
    async getAllToggles(): Promise<Toggle[] | null> {
        if (!this.isAvailable()) return null;

        try {
            const cached = await this.client!.get(ALL_TOGGLES_KEY);
            if (cached) {
                return JSON.parse(cached);
            }
        } catch (error) {
            console.warn('Cache get all error:', error);
        }

        return null;
    }

    /**
     * Set all toggles in cache
     */
    async setAllToggles(toggles: Toggle[]): Promise<void> {
        if (!this.isAvailable()) return;

        try {
            await this.client!.setEx(
                ALL_TOGGLES_KEY,
                CACHE_TTL_SECONDS,
                JSON.stringify(toggles)
            );

            // Also cache individual toggles
            const pipeline = this.client!.multi();
            for (const toggle of toggles) {
                pipeline.setEx(
                    `${CACHE_KEY_PREFIX}${toggle.name}`,
                    CACHE_TTL_SECONDS,
                    JSON.stringify(toggle)
                );
            }
            await pipeline.exec();
        } catch (error) {
            console.warn('Cache set all error:', error);
        }
    }

    /**
     * Invalidate a single toggle
     */
    async invalidateToggle(name: string): Promise<void> {
        if (!this.isAvailable()) return;

        try {
            await this.client!.del([
                `${CACHE_KEY_PREFIX}${name}`,
                ALL_TOGGLES_KEY,
            ]);
        } catch (error) {
            console.warn('Cache invalidate error:', error);
        }
    }

    /**
     * Invalidate all cached toggles
     */
    async invalidateAll(): Promise<void> {
        if (!this.isAvailable()) return;

        try {
            // Get all toggle keys and delete them
            const keys = await this.client!.keys(`${CACHE_KEY_PREFIX}*`);
            if (keys.length > 0) {
                await this.client!.del(keys);
            }
            await this.client!.del(ALL_TOGGLES_KEY);
        } catch (error) {
            console.warn('Cache invalidate all error:', error);
        }
    }

    /**
     * Health check
     */
    async healthCheck(): Promise<{ healthy: boolean; latencyMs: number }> {
        if (!this.isAvailable()) {
            return { healthy: false, latencyMs: 0 };
        }

        const start = Date.now();
        try {
            await this.client!.ping();
            return {
                healthy: true,
                latencyMs: Date.now() - start,
            };
        } catch {
            return {
                healthy: false,
                latencyMs: Date.now() - start,
            };
        }
    }

    /**
     * Close Redis connection
     */
    async close(): Promise<void> {
        if (this.client && this.connected) {
            await this.client.quit();
            this.connected = false;
        }
    }
}

// Export singleton instance
export const cache = new CacheManager();
