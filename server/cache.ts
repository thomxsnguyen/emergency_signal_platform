/**
 * In-memory caching module with TTL (Time To Live) support
 * Provides efficient caching mechanism for API responses
 */

interface CacheEntry<T = any> {
  data: T;
  timestamp: number;
  expiresAt: number;
}

interface CacheStats {
  hits: number;
  misses: number;
  size: number;
}

class CacheManager {
  private cache: Map<string, CacheEntry>;
  private readonly cacheDuration: number;
  private stats: CacheStats;

  constructor(cacheDurationMs: number = 5 * 60 * 1000) {
    this.cache = new Map();
    this.cacheDuration = cacheDurationMs;
    this.stats = { hits: 0, misses: 0, size: 0 };

    // Clean up expired entries every minute
    setInterval(() => this.cleanupExpired(), 60000);
  }

  /**
   * Retrieve data from cache
   * @param key - Cache key
   * @returns Cached data or null if expired/not found
   */
  get<T = any>(key: string): T | null {
    const entry = this.cache.get(key);

    if (!entry) {
      this.stats.misses++;
      return null;
    }

    const now = Date.now();
    if (now > entry.expiresAt) {
      this.cache.delete(key);
      this.stats.misses++;
      this.stats.size = this.cache.size;
      return null;
    }

    this.stats.hits++;
    return entry.data as T;
  }

  /**
   * Store data in cache
   * @param key - Cache key
   * @param data - Data to cache
   */
  set<T = any>(key: string, data: T): void {
    const now = Date.now();
    this.cache.set(key, {
      data,
      timestamp: now,
      expiresAt: now + this.cacheDuration,
    });
    this.stats.size = this.cache.size;
  }

  /**
   * Remove specific key from cache
   * @param key - Cache key to remove
   */
  delete(key: string): boolean {
    const result = this.cache.delete(key);
    this.stats.size = this.cache.size;
    return result;
  }

  /**
   * Clear all cache entries
   */
  clear(): void {
    this.cache.clear();
    this.stats = { hits: 0, misses: 0, size: 0 };
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    return { ...this.stats };
  }

  /**
   * Clean up expired cache entries
   */
  private cleanupExpired(): void {
    const now = Date.now();
    let removed = 0;

    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiresAt) {
        this.cache.delete(key);
        removed++;
      }
    }

    if (removed > 0) {
      this.stats.size = this.cache.size;
      console.log(`[Cache] Cleaned up ${removed} expired entries`);
    }
  }
}

// Singleton instance
const cacheManager = new CacheManager(
  parseInt(process.env.CACHE_DURATION || "300000")
);

// Export convenience functions
export function getFromCache<T = any>(key: string): T | null {
  return cacheManager.get<T>(key);
}

export function setCache<T = any>(key: string, data: T): void {
  cacheManager.set(key, data);
}

export function clearCache(): void {
  cacheManager.clear();
}

export function getCacheStats(): CacheStats {
  return cacheManager.getStats();
}

export default cacheManager;
