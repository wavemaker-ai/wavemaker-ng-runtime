import { ComponentFactoryResolver, Injectable, Inject } from '@angular/core';

import { ComponentRefProvider, ComponentType } from '@wm/runtime/base';
import { LazyComponentRefProviderService } from './lazy-component-ref-provider.service';

const componentRefCache = new Map<ComponentType, Map<string, any>>();

componentRefCache.set(ComponentType.PAGE, new Map<string, any>());
componentRefCache.set(ComponentType.PARTIAL, new Map<string, any>());
componentRefCache.set(ComponentType.PREFAB, new Map<string, any>());

@Injectable()
export class ComponentRefProviderService extends ComponentRefProvider {

    static registerComponentRef(name: string, type: ComponentType, ref: any, componentFactory?: any) {
        componentRefCache.get(type).set(name, {ref: ref, componentFactory: componentFactory});
    }
    
    /**
     * MEMORY LEAK FIX: Clear component reference cache
     * This should be called when navigating away from pages to prevent unbounded cache growth
     * Component factories can hold references to compiled code and prevent garbage collection
     */
    static clearComponentRefCache(type?: ComponentType) {
        if (type) {
            const cache = componentRefCache.get(type);
            if (cache) {
                cache.clear();
            }
        } else {
            // Clear all caches
            componentRefCache.forEach(cache => cache.clear());
        }
    }

    constructor(private componentFactoryResolver: ComponentFactoryResolver, @Inject(LazyComponentRefProviderService) private lazyComponentRef) {
        super();
    }

    public async getComponentFactoryRef(componentName: string, componentType: ComponentType, options?: {}): Promise<any> {
        const componentRefMap = componentRefCache.get(componentType);
        const value = componentRefMap ? componentRefMap.get(componentName) : undefined;

        if (!value && (componentType === ComponentType.PARTIAL || componentType === ComponentType.PREFAB)) {
            const partialRef = await this.lazyComponentRef.getComponentFactoryRef(
                componentName,
                componentType,
                options
            );
            if (partialRef) {
                return Promise.resolve(partialRef);
            }
        }
        if (!value) {
            console.error(`ComponentRefProviderService: Component "${componentName}" of type "${ComponentType[componentType]}" is not registered.`);
            return null;
        }

        if (!value.componentFactory) {
            value.componentFactory = this.componentFactoryResolver.resolveComponentFactory(value.ref);
        }
        return Promise.resolve(value.componentFactory);
    }
}
