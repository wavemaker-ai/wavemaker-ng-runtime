import { Injectable, Inject, Type } from '@angular/core';

import { ComponentRefProvider, ComponentType } from '@wm/runtime/base';
import { LazyComponentRefProviderService } from './lazy-component-ref-provider.service';

interface ComponentCacheEntry {
    ref: Type<unknown>;
    componentFactory?: any; // Legacy support for non-standalone components
}

const componentCache = new Map<ComponentType, Map<string, ComponentCacheEntry>>();

componentCache.set(ComponentType.PAGE, new Map<string, ComponentCacheEntry>());
componentCache.set(ComponentType.PARTIAL, new Map<string, ComponentCacheEntry>());
componentCache.set(ComponentType.PREFAB, new Map<string, ComponentCacheEntry>());

@Injectable()
export class ComponentRefProviderService extends ComponentRefProvider {

    /**
     * Register a component class for dynamic instantiation
     * @param name - Component name identifier
     * @param type - Component type (PAGE, PARTIAL, PREFAB)
     * @param ref - Component class reference
     * @param componentFactory - Optional legacy component factory (for backward compatibility)
     */
    static registerComponentRef(name: string, type: ComponentType, ref: Type<unknown>, componentFactory?: any): void {
        componentCache.get(type).set(name, { ref, componentFactory });
    }

    constructor(@Inject(LazyComponentRefProviderService) private lazyComponentLoader: LazyComponentRefProviderService) {
        super();
    }

    /**
     * Get component class for dynamic instantiation
     * Returns the component Type which can be used with ViewContainerRef.createComponent()
     * 
     * @param componentName - Name of the component to load
     * @param componentType - Type of component (PAGE, PARTIAL, PREFAB)
     * @param options - Additional options (e.g., prefab name for partial resolution)
     * @returns Promise resolving to component Type or null if not found
     */
    public async getComponentFactoryRef(componentName: string, componentType: ComponentType, options?: Record<string, unknown>): Promise<Type<unknown> | null> {
        const cachedEntry = componentCache.get(componentType)?.get(componentName);
        
        // Try lazy loading for PARTIAL and PREFAB types if not in cache
        if (!cachedEntry && (componentType === ComponentType.PARTIAL || componentType === ComponentType.PREFAB)) {
            const lazyComponent = await this.lazyComponentLoader.getComponentFactoryRef(
                componentName,
                componentType,
                options
            );
            if (lazyComponent) {
                return lazyComponent;
            }
        }
        
        // Return null if component not found
        if (!cachedEntry) {
            console.warn(`Component not found: ${componentName} (type: ${componentType})`);
            return null;
        }
        
        // Return component class (modern Angular 13+ approach for standalone components)
        // For legacy components, the componentFactory would be used, but we return the ref
        // as createComponent() handles both standalone and non-standalone components
        return cachedEntry.ref;
    }
}
