import { Attribute, ComponentFactoryResolver, Directive, ElementRef, Inject, Injector, OnDestroy, Self, ViewContainerRef } from '@angular/core';
import { App, $invokeWatchers, noop, ComponentType, CustomWidgetRefProvider } from '@wm/core';
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
        private customWidgetRefProvider: CustomWidgetRefProvider
    ) {
        const widgetnames = this.componentInstance.widgetname;
        this.customWidgetRefProvider.getComponentFactoryRef(widgetname, ComponentType.WIDGET).then((componentFactory) => {
            if (componentFactory) {
                const instanceRef = this.vcRef.createComponent(componentFactory, {
                    index: 0,
                    injector: this.inj
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
