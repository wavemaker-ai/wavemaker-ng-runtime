import { Injectable } from '@angular/core';

import { AbstractHttpService, App } from '@wm/core';

// PERFORMANCE OPTIMIZATION: Add size limit to prevent unbounded cache growth
// Large applications with many pages/partials can cause memory bloat without limits
const MAX_CACHE_SIZE = 100;
const cache = new Map<string, string>();

@Injectable()
export class AppResourceManagerService {

    get(url: string, useCache?: boolean): string | any {
        const cachedResponse = cache.get(url);

        if (cachedResponse) {
            return Promise.resolve(cachedResponse);
        }

        return this.$http.get(url).then(response => {
            if (useCache) {
                // PERFORMANCE OPTIMIZATION: Implement LRU-style cache eviction
                // When cache reaches max size, remove oldest entry (first item in Map)
                if (cache.size >= MAX_CACHE_SIZE) {
                    const firstKey = cache.keys().next().value;
                    cache.delete(firstKey);
                    console.warn(`Resource cache limit reached (${MAX_CACHE_SIZE}). Evicted: ${firstKey}`);
                }
                cache.set(url, response);
            }
            return response;
        });
    }

    public clearCache() {
        cache.clear();
    }
    
    /**
     * PERFORMANCE OPTIMIZATION: Get cache size for monitoring
     */
    public getCacheSize(): number {
        return cache.size;
    }

    constructor(private $http: AbstractHttpService) {}
}
