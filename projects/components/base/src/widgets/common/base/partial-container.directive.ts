import { Attribute, ComponentFactoryResolver, Directive, ElementRef, Inject, Injector, OnDestroy, Renderer2, Self, ViewContainerRef } from '@angular/core';

import { debounceTime, filter } from 'rxjs/operators';

import { App, $invokeWatchers, noop, ComponentType, PartialRefProvider } from '@wm/core';

import { WidgetRef } from "../../framework/types";
import {debounce} from "lodash-es";

@Directive({
  standalone: true,
    selector: '[partialContainer]'
})
export class PartialContainerDirective implements OnDestroy {

    private contentInitialized = false;

    get name() {
        return this.componentInstance.name;
    }

    async _renderPartial(nv) {
        // destroy the existing partial
        this.vcRef.clear();
        // when the container-target is inside the component template, it can be queried after viewInit of the component.
        $invokeWatchers(true);
        // for partials with popovers and page dialogs which are inside a prefab, prefab name needs to be computed and appended
        const prefab = $(this.elRef.nativeElement).closest('.app-prefab');
        let prefabName;
        if (prefab.length) {
            prefabName = prefab.attr('prefabname');
        } else if (this.componentInstance.viewParent) {
            prefabName = this.componentInstance.viewParent.prefabName;
        }

        const componentFactory = await this.partialRefProvider.getComponentFactoryRef(nv, ComponentType.PARTIAL, {prefab: prefabName});
        if (componentFactory) {
            const instanceRef = this.vcRef.createComponent(componentFactory, 0, this.inj);
            if (instanceRef && instanceRef['instance'] && prefabName) {
                // @ts-ignore
                instanceRef['instance'].prefabName = prefabName;
            }
            
            // ✅ FIXED: Move component to correct location while maintaining Angular lifecycle
            const componentElement = instanceRef.location.nativeElement;
            const targetElement = this.elRef.nativeElement.querySelector('[partial-container-target]');
            const hostElement = this.elRef.nativeElement;
            
            if (targetElement) {
                // If there's a specific target element, use it
                // Clear existing content using Renderer2
                while (targetElement.firstChild) {
                    this.renderer.removeChild(targetElement, targetElement.firstChild);
                }
                this.renderer.appendChild(targetElement, componentElement);
            } else {
                // If no target element, append directly to the host element
                // This handles cases like topnav where content should be inside the section
                this.renderer.appendChild(hostElement, componentElement);
            }
            
            this.contentInitialized = true;
            setTimeout(() => this.onLoadSuccess(), 200);
        }
    }

    renderPartial = debounce(this._renderPartial, 200);

    onLoadSuccess() {
        this.componentInstance.invokeEventCallback('load');

        this.app.notify('partialLoaded');
    }

    constructor(
        @Self() @Inject(WidgetRef) public componentInstance,
        public vcRef: ViewContainerRef,
        public elRef: ElementRef,
        public inj: Injector,
        private app: App,
        @Attribute('content') _content: string,
        private resolver: ComponentFactoryResolver,
        private partialRefProvider: PartialRefProvider,
        private renderer: Renderer2
    ) {

        componentInstance.registerPropertyChangeListener((key: string, nv: any, ov?: any) => {
            if (key === 'content') {
                if (componentInstance.$lazyLoad) {
                    componentInstance.$lazyLoad = () => {
                        this.renderPartial(nv);
                        componentInstance.$lazyLoad = noop;
                    };
                } else {
                    this.renderPartial(nv);
                }
            }
        });

        const subscription = componentInstance.params$
            .pipe(
                filter(() => this.contentInitialized),
                debounceTime(200)
            )
            .subscribe(() => this.renderPartial(componentInstance.content));
        // reload the partial content on partial param change
        componentInstance.registerDestroyListener(() => subscription.unsubscribe());
    }

    ngOnDestroy() {
        // MEMORY LEAK FIX: Clear ViewContainerRef to destroy dynamically created components
        if (this.vcRef) {
            this.vcRef.clear();
        }

        // MEMORY LEAK FIX: Nullify debounced function to break closure
        // The debounced function captures 'this' and has internal timeouts
        if (this.renderPartial && (this.renderPartial as any).cancel) {
            (this.renderPartial as any).cancel();
        }
        this.renderPartial = null;

        // Reset content flag
        this.contentInitialized = false;
    }
}
