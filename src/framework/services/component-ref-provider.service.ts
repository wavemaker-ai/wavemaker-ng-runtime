import { Injectable, Inject } from '@angular/core';

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

    constructor(@Inject(LazyComponentRefProviderService) private lazyComponentRef) {
        super();
    }

    public async getComponentFactoryRef(componentName: string, componentType: ComponentType, options?: {}): Promise<any> {
        const value = componentRefCache.get(componentType).get(componentName);
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
        // Guard against undefined value
        if (!value) {
            return Promise.resolve(null);
        }
        // Angular 22 removed ComponentFactoryResolver / ComponentFactory-based createComponent()
        // entirely — value.ref is already a component class (registered via
        // ComponentRefProviderService.registerComponentRef), which the new
        // ViewContainerRef.createComponent(Type, options) API accepts directly. No factory
        // resolution step needed at all anymore.
        if (!value.componentFactory) {
            value.componentFactory = value.ref;
        }
        return Promise.resolve(value.componentFactory);
    }
}
