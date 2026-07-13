import {
    Directive,
    ElementRef,
    EnvironmentInjector,
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
        private envInjector: EnvironmentInjector,
        private injector: Injector,
        private componentRefProvider: ComponentRefProvider
    ) {
        const prefabName = this.componentInstance.prefabName;

        this.prefabMngr.loadDependencies(prefabName)
            .then(async () => {
                const componentFactory = await this.componentRefProvider.getComponentFactoryRef(prefabName, ComponentType.PREFAB);
                if (componentFactory) {
                    const instanceRef = this.vcRef.createComponent(componentFactory, {
                        index: 0,
                        environmentInjector: envInjector,
                        injector
                    });
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
