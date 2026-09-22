import { Attribute, Directive, ElementRef, EnvironmentInjector, Inject, Injector, OnDestroy, Self, ViewContainerRef } from '@angular/core';

import { debounceTime, filter } from 'rxjs/operators';

import { $appDigest, $invokeWatchers, App, ComponentType, noop, PartialRefProvider } from '@wm/core';

import { WidgetRef } from "../../framework/types";
import { debounce } from "lodash-es";

@Directive({
    standalone: true,
    selector: '[partialContainer]'
})
export class PartialContainerDirective implements OnDestroy {

    private contentInitialized = false;
    private $target;
    private instanceRef;

    get name() {
        return this.componentInstance.name;
    }

    async _renderPartial(partialName: string): Promise<void> {
        if (!partialName) {
            return;
        }

        try {
            // Destroy the existing partial before creating new one
            this.vcRef.clear();
            this.instanceRef = null;

            // Trigger watchers for container-target query
            $invokeWatchers(true);

            // Resolve prefab context for partials inside prefabs
            const prefabName = this.resolvePrefabContext();

            // Load the partial component class
            const PartialComponentClass = await this.partialRefProvider.getComponentFactoryRef(
                partialName,
                ComponentType.PARTIAL,
                { prefab: prefabName }
            );

            if (!PartialComponentClass) {
                console.error(`Failed to load partial component: ${partialName}`);
                return;
            }

            // Create component with both environmentInjector (for standalone imports/providers)
            // and injector (for element-level dependencies)
            const componentRef = this.vcRef.createComponent(PartialComponentClass, {
                index: 0,
                environmentInjector: this.envInjector,
                injector: this.inj
            });

            this.instanceRef = componentRef;

            // Set prefab context on the partial instance if applicable
            if (componentRef.instance && prefabName) {
                (componentRef.instance as any).prefabName = prefabName;
            }

            // Resolve target container
            if (!this.$target) {
                this.$target = this.elRef.nativeElement.querySelector('[partial-container-target]')
                    || this.elRef.nativeElement;
            }

            // Render the partial
            this.$target.innerHTML = '';
            this.$target.appendChild(componentRef.location.nativeElement);
            this.contentInitialized = true;

            // Notify load success after render
            setTimeout(() => this.onLoadSuccess(), 200);
        } catch (error) {
            console.error(`Error rendering partial ${partialName}:`, error);
        }
    }

    /**
     * Resolve prefab context for the partial
     * Checks if partial is inside a prefab and returns the prefab name
     */
    private resolvePrefabContext(): string | undefined {
        const prefab = $(this.elRef.nativeElement).closest('.app-prefab');

        if (prefab.length) {
            return prefab.attr('prefabname');
        }

        if (this.componentInstance.viewParent?.prefabName) {
            return this.componentInstance.viewParent.prefabName;
        }

        return undefined;
    }

    renderPartial = debounce(this._renderPartial, 200);

    onLoadSuccess() {
        this.componentInstance.invokeEventCallback('load');

        this.app.notify('partialLoaded');
    }

    private handleContentChange(componentInstance, nv: string) {
        if ('isInlineContent' in componentInstance) {
            componentInstance.isInlineContent = !(nv && nv !== '');
        }
        if (componentInstance.$lazyLoad) {
            componentInstance.$lazyLoad = () => {
                this.renderPartial(nv);
                componentInstance.$lazyLoad = noop;
            };
        } else {
            this.renderPartial(nv);
        }
    }

    constructor(
        @Self() @Inject(WidgetRef) public componentInstance,
        public vcRef: ViewContainerRef,
        public elRef: ElementRef,
        public inj: Injector,
        private readonly envInjector: EnvironmentInjector,
        private readonly app: App,
        @Attribute('content') initialContent: string,
        private readonly partialRefProvider: PartialRefProvider
    ) {

        componentInstance.registerPropertyChangeListener((key: string, nv: any, ov?: any) => {
            if (key === 'content') {
                this.handleContentChange(componentInstance, nv);
            }
        });

        // 'content' is usually a static attribute, so its one-and-only property-change
        // notification (fired via the widget proxy as this component initializes) can
        // land before this constructor runs and subscribes above -- registerPropertyChangeListener
        // is backed by a plain RxJS Subject, which does not replay past emissions to late
        // subscribers. Without this, the listener is the only thing that ever calls
        // renderPartial, and it silently misses the sole emission, leaving the partial
        // permanently empty. componentInstance.content (set by the time this constructor
        // runs, if the proxy notification already fired) is preferred over the raw
        // @Attribute() snapshot since it reflects any WM-side processing of the value;
        // @Attribute() is the fallback for the case where it hasn't been set yet either.
        const contentValue = componentInstance.content || initialContent;
        if (contentValue) {
            this.handleContentChange(componentInstance, contentValue);
        }

        const subscription = componentInstance.params$
            .pipe(
                filter(() => this.contentInitialized),
                debounceTime(200)
            )
            .subscribe(() => {
                // A param value changed, not the partial itself — digest the live instance
                // in place instead of destroying and recreating it (that used to cause a
                // visible flicker on every param change). Fall back to a full render only if
                // there's no live instance yet to refresh.
                if (this.instanceRef?.instance) {
                    $appDigest(true);
                } else {
                    this.renderPartial(componentInstance.content);
                }
            });
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

        // MEMORY LEAK FIX: Clear DOM reference
        this.$target = null;
        this.instanceRef = null;

        // MEMORY LEAK FIX: Clear component instance reference
        // Note: We don't null componentInstance as it's injected and managed by Angular
        // but we clear our internal references

        // Reset content flag
        this.contentInitialized = false;
    }
}
