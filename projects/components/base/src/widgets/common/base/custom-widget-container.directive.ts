import { Attribute, Directive, ElementRef, EnvironmentInjector, Inject, Injector, OnDestroy, Self, ViewContainerRef } from '@angular/core';
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
        private readonly envInjector: EnvironmentInjector,
        private readonly app: App,
        @Attribute('widgetname') widgetname: string,
        private readonly customWidgetRefProvider: CustomWidgetRefProvider
    ) {
        this.loadCustomWidget(widgetname);
    }

    private async loadCustomWidget(widgetName: string): Promise<void> {
        if (!widgetName) {
            console.error('Custom widget name is required');
            return;
        }

        try {
            const WidgetComponentClass = await this.customWidgetRefProvider.getComponentFactoryRef(
                widgetName, 
                ComponentType.WIDGET
            );
            
            if (!WidgetComponentClass) {
                console.error(`Failed to load custom widget: ${widgetName}`);
                return;
            }

            // Create component with both environmentInjector (for standalone imports/providers)
            // and injector (for element-level dependencies)
            const componentRef = this.vcRef.createComponent(WidgetComponentClass, {
                index: 0,
                environmentInjector: this.envInjector,
                injector: this.inj
            });
            
            this.elRef.nativeElement.appendChild(componentRef.location.nativeElement);
        } catch (error) {
            console.error(`Error creating custom widget ${widgetName}:`, error);
        }
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
