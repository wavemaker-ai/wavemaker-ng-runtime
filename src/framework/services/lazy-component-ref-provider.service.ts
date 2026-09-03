import { Injectable, Type } from '@angular/core';
import { PartialRefProvider } from '@wm/core';
import { ComponentType } from '@wm/runtime/base';
import { partialLazyModules, prefabLazyModules, prefabPartialLazyModules } from '../util/lazy-module-routes';

interface LazyLoadOptions {
    prefab?: string;
}

interface LazyModule {
    loadComponent: () => Promise<Type<unknown>>;
}

@Injectable({
    providedIn: 'root'
})
export class LazyComponentRefProviderService extends PartialRefProvider {
    constructor() {
        super();
    }

    /**
     * Resolve the appropriate lazy module based on component type and options
     * @private
     */
    private getLazyModule(componentName: string, componentType: ComponentType, options?: LazyLoadOptions): LazyModule | undefined {
        // Prefab-scoped partial (e.g., partial inside a prefab)
        if (componentType === ComponentType.PARTIAL && options?.prefab) {
            return prefabPartialLazyModules[`${options.prefab}_${componentName}`];
        }
        
        // Standard partial
        if (componentType === ComponentType.PARTIAL) {
            return partialLazyModules[componentName];
        }
        
        // Prefab
        if (componentType === ComponentType.PREFAB) {
            return prefabLazyModules[componentName];
        }
        
        return undefined;
    }

    /**
     * Lazy load and return a component class
     * Returns the component Type which can be used with ViewContainerRef.createComponent()
     * 
     * @param componentName - Name of the component to lazy load
     * @param componentType - Type of component (PARTIAL, PREFAB)
     * @param options - Additional options (e.g., prefab name for partial resolution)
     * @returns Promise resolving to component Type or null if loading fails
     */
    public async getComponentFactoryRef(componentName: string, componentType: ComponentType, options?: LazyLoadOptions): Promise<Type<unknown> | null> {
        try {
            const lazyModule = this.getLazyModule(componentName, componentType, options);

            if (!lazyModule) {
                console.error(`No lazy module found for ${componentName}`);
                return null;
            }

            // Dynamically load the component class
            const componentClass = await lazyModule.loadComponent();

            if (!componentClass) {
                console.error(`Failed to load component class: ${componentName}`);
                return null;
            }

            // Return the component class directly (Angular 13+ standalone component approach)
            // This can be used directly with ViewContainerRef.createComponent()
            return componentClass;
        } catch (error) {
            console.error(`Error lazy loading component ${componentName}:`, error);
            return null;
        }
    }
}
