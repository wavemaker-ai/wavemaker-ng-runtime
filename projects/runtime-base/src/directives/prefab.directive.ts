import {
    Directive,
    ElementRef,
    Inject,
    Injector,
    OnDestroy,
    Self,
    ViewContainerRef
} from '@angular/core';

import { WidgetRef } from '@wm/components/base';

import { PrefabManagerService } from '../services/prefab-manager.service';
import { ComponentRefProvider, ComponentType } from '../types/types';

@Directive({
  standalone: true,
    selector: '[wmPrefab][prefabname]'
})
export class PrefabDirective implements OnDestroy {

    constructor(
        @Self() @Inject(WidgetRef) public componentInstance,
        public vcRef: ViewContainerRef,
        public elRef: ElementRef,
        private prefabMngr: PrefabManagerService,
        private injector: Injector,
        private componentRefProvider: ComponentRefProvider
    ) {
        const prefabName = this.componentInstance.prefabName;

        this.prefabMngr.loadDependencies(prefabName)
            .then(async () => {
                const componentFactory = await this.componentRefProvider.getComponentFactoryRef(prefabName, ComponentType.PREFAB);
                if (componentFactory) {
                    // Angular 22 removed the positional (factory, index, injector) createComponent()
                    // overload — componentFactory is now a component class, not a ComponentFactory
                    // (see component-ref-provider.service.ts / dynamic-component-ref-provider.service.ts).
                    const instanceRef = this.vcRef.createComponent(componentFactory, { index: 0, injector });
                    this.elRef.nativeElement.appendChild(instanceRef.location.nativeElement);
                }
            });
    }

    ngOnDestroy() {
        // MEMORY LEAK FIX: Clear ViewContainerRef to destroy dynamically created components
        if (this.vcRef) {
            this.vcRef.clear();
        }

        // MEMORY LEAK FIX: Clear ElementRef reference
        this.elRef = null;
    }
}
