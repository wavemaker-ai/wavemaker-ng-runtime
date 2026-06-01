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
        private injector: Injector,
        private envInjector: EnvironmentInjector,
        private componentRefProvider: ComponentRefProvider
    ) {
        const prefabName = this.componentInstance.prefabName;

        this.prefabMngr.loadDependencies(prefabName)
            .then(async () => {
                const PrefabComponentClass = await this.componentRefProvider.getComponentFactoryRef(prefabName, ComponentType.PREFAB);
                
                if (!PrefabComponentClass) {
                    console.error(`Failed to load prefab component: ${prefabName}`);
                    return;
                }

                try {
                    // Create component with both environmentInjector (for standalone imports/providers)
                    // and injector (for element-level dependencies)
                    const componentRef = this.vcRef.createComponent(PrefabComponentClass, {
                        index: 0,
                        environmentInjector: this.envInjector,
                        injector: this.injector
                    });
                    
                    this.elRef.nativeElement.appendChild(componentRef.location.nativeElement);
                } catch (error) {
                    console.error(`Error creating prefab component ${prefabName}:`, error);
                }
            })
            .catch(error => {
                console.error(`Error loading dependencies for prefab ${prefabName}:`, error);
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
