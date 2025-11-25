import {
    ComponentFactoryResolver,
    Directive,
    ElementRef,
    Inject,
    Injector,
    OnDestroy,
    Renderer2,
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
        private resolver: ComponentFactoryResolver,
        private injector: Injector,
        private componentRefProvider: ComponentRefProvider,
        private renderer: Renderer2
    ) {
        const prefabName = this.componentInstance.prefabName;

        this.prefabMngr.loadDependencies(prefabName)
            .then(async () => {
                const componentFactory = await this.componentRefProvider.getComponentFactoryRef(prefabName, ComponentType.PREFAB);
                if (componentFactory) {
                    // ✅ FIXED: Create component and ensure it's inside the host element
                    const instanceRef = this.vcRef.createComponent(componentFactory, 0, injector);
                    
                    // If the component was created as a sibling, move it inside the host element
                    const componentEl = instanceRef.location.nativeElement;
                    const hostEl = this.elRef.nativeElement;
                    
                    // Check if component is inside the host element
                    if (componentEl.parentElement !== hostEl) {
                        this.renderer.appendChild(hostEl, componentEl);
                    }
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
