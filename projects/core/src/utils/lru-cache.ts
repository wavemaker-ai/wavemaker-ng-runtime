import {isNil} from "lodash-es";

interface CachedData<T> {
    instance: T;
    lastAccessedTime: number;
    accessCount: number; // OPTIMIZATION: Track access frequency for progressive eviction
}

export class LRUCache<T> {
    private cache = new Map<string, CachedData<T>>();
    private evictQueue: string[] = [];
    private evictionIntervalId: any;
    private useProgressiveEviction: boolean; // OPTIMIZATION: Enable progressive eviction based on access patterns

    constructor(
        private maxSize = 100,
        private maxAge = 60,
        private onEvict?: ((key: string, value: T) => any),
        useProgressiveEviction = false // OPTIMIZATION: Progressive eviction option
    ) {
        this.useProgressiveEviction = useProgressiveEviction;
            if(this.maxAge > 0) {
                if (this.maxAge <= 30) {
                    console.warn(`Cache age ${this.maxAge}s is very less. Keep it atleast 30s.`);
                }
                this.maxAge = this.maxAge * 1000;
                // CRITICAL FIX: Store interval ID so it can be cleared
                this.evictionIntervalId = setInterval(() => {
                    const max = Date.now() - this.maxAge;
                    const expiredData = this.evictQueue.filter(k => {
                        return this.cache.get(k).lastAccessedTime <= max;
                    });
                    this.evict(expiredData.length);
                }, this.maxAge);
            }
    }

    private addToEvictQueue(key: string) {
        const index = this.evictQueue.findIndex(k => (k === key));
        if (index >= 0) {
            this.evictQueue.splice(index, 1);
        }
        this.evictQueue.push(key);
    }

    private evict(count = 1): void {
        for (let i = 0; i < count; i++) {
            this.delete(this.evictQueue[0]);
        }
    }

    public keys() {
        return this.cache.keys();
    }

    public set(key: string, dataToCache: T): void {
        if (isNil(dataToCache)) {
            return;
        }
        
        const existing = this.cache.get(key);
        const cachedData: CachedData<T> = {
            instance: dataToCache,
            lastAccessedTime: Date.now(),
            accessCount: existing ? existing.accessCount : 0 // OPTIMIZATION: Preserve access count if updating
        };
        this.cache.set(key, cachedData);
        this.addToEvictQueue(key);
        
        // OPTIMIZATION: Use progressive eviction if enabled, otherwise use simple LRU
        if (this.useProgressiveEviction && this.evictQueue.length > this.maxSize) {
            this.evictLeastUsed();
        } else {
            this.evict(this.evictQueue.length - this.maxSize);
        }
    }

    public get(key: string): T {
        const cachedData = this.cache.get(key);
        if (cachedData) {
            cachedData.lastAccessedTime = Date.now();
            cachedData.accessCount = (cachedData.accessCount || 0) + 1; // OPTIMIZATION: Increment access count
            this.addToEvictQueue(key);
            return cachedData.instance;
        }
        return null;
    }

    public delete(key: string) {
        if(key && this.cache.has(key)) {
            const cachedData = this.cache.get(key);
            this.cache.delete(key);
            this.onEvict && this.onEvict(key, cachedData.instance);
            const index = this.evictQueue.findIndex(k => (k === key));
            if (index >= 0) {
                this.evictQueue.splice(index, 1);
            }
        }
    }

    public has(key: string): boolean {
        return this.cache.has(key);
    }

    public size(): number {
        return this.evictQueue.length;
    }

    public clear() {
        this.evict(this.evictQueue.length);
    }
    
    public destroy() {
        // CRITICAL FIX: Clear the eviction interval to prevent memory leaks
        // Without this, the setInterval keeps running and holds references to this cache
        if (this.evictionIntervalId) {
            clearInterval(this.evictionIntervalId);
            this.evictionIntervalId = null;
        }
        this.clear();
    }
    
    /**
     * OPTIMIZATION: Progressive eviction based on access patterns
     * Evicts entry with lowest score: (frequency * weight) + (recency * weight)
     * This keeps frequently accessed items longer even if not recently used
     */
    private evictLeastUsed(): void {
        if (this.evictQueue.length === 0) return;
        
        const FREQUENCY_WEIGHT = 0.7; // Weight for access frequency
        const RECENCY_WEIGHT = 0.3;   // Weight for recency
        const now = Date.now();
        const ONE_HOUR = 3600000; // Normalize recency to hours
        
        let minScore = Infinity;
        let keyToEvict = null;
        
        // Calculate score for each cache entry
        this.cache.forEach((cachedData, key) => {
            const frequency = cachedData.accessCount || 0;
            const recency = Math.max(0, now - cachedData.lastAccessedTime) / ONE_HOUR;
            
            // Lower is worse - we want to evict entries with lowest scores
            const frequencyScore = frequency * FREQUENCY_WEIGHT;
            const recencyScore = Math.max(0, 1 - recency) * RECENCY_WEIGHT; // Invert recency
            const totalScore = frequencyScore + recencyScore;
            
            if (totalScore < minScore) {
                minScore = totalScore;
                keyToEvict = key;
            }
        });
        
        if (keyToEvict) {
            this.delete(keyToEvict);
        } else if (this.evictQueue.length > 0) {
            // Fallback to simple LRU if no scores calculated
            this.delete(this.evictQueue[0]);
        }
    }
    
    /**
     * OPTIMIZATION: Get cache statistics for monitoring
     */
    public getStats() {
        let totalAccessCount = 0;
        let maxAccessCount = 0;
        let minAccessCount = Infinity;
        
        this.cache.forEach((cachedData) => {
            const count = cachedData.accessCount || 0;
            totalAccessCount += count;
            maxAccessCount = Math.max(maxAccessCount, count);
            minAccessCount = Math.min(minAccessCount, count);
        });
        
        const avgAccessCount = this.cache.size > 0 ? totalAccessCount / this.cache.size : 0;
        
        return {
            size: this.cache.size,
            maxSize: this.maxSize,
            totalAccessCount,
            avgAccessCount: avgAccessCount.toFixed(2),
            maxAccessCount,
            minAccessCount: minAccessCount === Infinity ? 0 : minAccessCount
        };
    }
}
