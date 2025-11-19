import { Attribute, ComponentFactoryResolver, Directive, ElementRef, Inject, Injector, OnDestroy, Self, ViewContainerRef } from '@angular/core';

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
    private $target;
    // MEMORY LEAK FIX: Track pending timeouts for cleanup
    protected pendingTimeouts: Set<number> = new Set();
    // PERFORMANCE OPTIMIZATION: Cache prefab element and name to avoid repeated jQuery queries
    private cachedPrefabElement: any = null;
    private cachedPrefabName: string | null = null;

    get name() {
        return this.componentInstance.name;
    }

    async _renderPartial(nv) {
        // destroy the existing partial
        this.vcRef.clear();
        // when the container-target is inside the component template, it can be queried after viewInit of the component.
        $invokeWatchers(true);
        // PERFORMANCE OPTIMIZATION: Cache prefab lookup to avoid repeated jQuery queries
        // for partials with popovers and page dialogs which are inside a prefab, prefab name needs to be computed and appended
        let prefabName = this.cachedPrefabName;
        if (prefabName === null) {
            // Only query DOM if not cached
            if (!this.cachedPrefabElement) {
                this.cachedPrefabElement = $(this.elRef.nativeElement).closest('.app-prefab');
            }
            if (this.cachedPrefabElement && this.cachedPrefabElement.length) {
                prefabName = this.cachedPrefabElement.attr('prefabname');
            } else if (this.componentInstance.viewParent) {
                prefabName = this.componentInstance.viewParent.prefabName;
            }
            this.cachedPrefabName = prefabName || '';
        }

        try {
            const componentFactory = await this.partialRefProvider.getComponentFactoryRef(nv, ComponentType.PARTIAL, {prefab: prefabName});
            
            // DEFENSIVE FIX: Check if componentFactory is valid before using
            if (!componentFactory) {
                console.error(`Failed to load partial: ${nv}, prefab: ${prefabName}`);
                return;
            }
            
            const instanceRef = this.vcRef.createComponent(componentFactory, 0, this.inj);
            if (instanceRef && instanceRef['instance'] && prefabName) {
                // @ts-ignore
                instanceRef['instance'].prefabName = prefabName;
            }
            if (!this.$target) {
                this.$target = this.elRef.nativeElement.querySelector('[partial-container-target]') || this.elRef.nativeElement;
            }

            this.$target.innerHTML = '';
            this.$target.appendChild(instanceRef.location.nativeElement);
            this.contentInitialized = true;
            // MEMORY LEAK FIX: Track timeout for cleanup
            const timeoutId = window.setTimeout(() => {
                this.pendingTimeouts.delete(timeoutId);
                this.onLoadSuccess();
            }, 200);
            this.pendingTimeouts.add(timeoutId);
        } catch (error) {
            console.error(`Error rendering partial ${nv}:`, error);
        }
    }

    // MEMORY LEAK FIX: Store debounced function reference for cleanup
    private renderPartial: Function;

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
        private partialRefProvider: PartialRefProvider
    ) {
        // MEMORY LEAK FIX: Create debounced function and store reference for cleanup
        this.renderPartial = debounce(this._renderPartial.bind(this), 200);

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
        // Clear the ViewContainerRef to prevent memory leaks
        this.vcRef.clear();
        
        // MEMORY LEAK FIX: Clear all pending timeouts
        this.pendingTimeouts.forEach(timeoutId => clearTimeout(timeoutId));
        this.pendingTimeouts.clear();
        
        // MEMORY LEAK FIX: Cancel debounced function to prevent memory leaks
        // Debounced functions hold references to the original function and arguments
        if (this.renderPartial && typeof (this.renderPartial as any).cancel === 'function') {
            (this.renderPartial as any).cancel();
        }
        
        // PERFORMANCE OPTIMIZATION: Clear cached references
        this.cachedPrefabElement = null;
        this.cachedPrefabName = null;
        this.$target = null;
    }
}
