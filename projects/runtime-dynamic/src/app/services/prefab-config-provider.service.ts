import { Injectable } from '@angular/core';

import { getPrefabConfigUrl, PrefabConfigProvider } from '@wm/runtime/base';

import { AppResourceManagerService } from './app-resource-manager.service';

// PERFORMANCE OPTIMIZATION: Add size limit to prevent unbounded cache growth
// Prefab configs can be large and accumulate over time
const MAX_PREFAB_CONFIG_CACHE_SIZE = 50;
const cache = new Map<string, any>();

@Injectable()
export class PrefabConfigProviderService extends PrefabConfigProvider {

    constructor(private resourceMngr: AppResourceManagerService) {
        super();
    }

    public getConfig(prefabName: string): Promise<any> {
        const config = cache.get(prefabName);
        if (config) {
            return Promise.resolve(config);
        }

        return this.resourceMngr.get(getPrefabConfigUrl(prefabName))
            .then(_config => {
                // PERFORMANCE OPTIMIZATION: Implement LRU-style cache eviction
                // When cache reaches max size, remove oldest entry to prevent unbounded growth
                if (cache.size >= MAX_PREFAB_CONFIG_CACHE_SIZE) {
                    const firstKey = cache.keys().next().value;
                    cache.delete(firstKey);
                    console.warn(`Prefab config cache limit reached (${MAX_PREFAB_CONFIG_CACHE_SIZE}). Evicted: ${firstKey}`);
                }
                
                cache.set(prefabName, _config);
                return _config;
            });
    }
    
    /**
     * PERFORMANCE OPTIMIZATION: Clear cache method for manual cleanup
     */
    public clearCache() {
        cache.clear();
    }
}
