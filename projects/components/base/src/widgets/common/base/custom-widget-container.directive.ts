import { Attribute, Directive, ElementRef, Inject, Injector, OnDestroy, Renderer2, Self, ViewContainerRef } from '@angular/core';
import { App, ComponentType, CustomWidgetRefProvider } from '@wm/core';
import { WidgetRef } from "../../framework/types";


declare const _;

@Directive({
  standalone: true,
    selector: '[customWidgetContainer][widgetname]'
})
export class CustomWidgetContainerDirective implements OnDestroy {

    constructor(
        @Self() @Inject(WidgetRef) public componentInstance,
        public vcRef: ViewContainerRef,
        public elRef: ElementRef,
        public inj: Injector,
        private app: App,
        @Attribute('widgetname') widgetname: string,
        private customWidgetRefProvider: CustomWidgetRefProvider,
        private renderer: Renderer2
    ) {
        const widgetnames = this.componentInstance.widgetname;
        this.customWidgetRefProvider.getComponentFactoryRef(widgetname, ComponentType.WIDGET).then((componentFactory) => {
            if (componentFactory) {
                // ✅ FIXED: Create component and ensure it's inside the host element
                const instanceRef = this.vcRef.createComponent(componentFactory, 0, this.inj);
                
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
