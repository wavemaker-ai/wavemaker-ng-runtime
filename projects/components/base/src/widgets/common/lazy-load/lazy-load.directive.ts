import {
    Directive,
    Inject,
    inject,
    Injector,
    Input,
    OnDestroy,
    Optional,
    TemplateRef,
    ViewContainerRef
} from '@angular/core';

import {$watch, App, findParent} from '@wm/core';
import {extend} from "lodash-es";

@Directive({
  standalone: true,
    selector: '[lazyLoad]'
})
export class LazyLoadDirective implements OnDestroy {
    private readonly viewParent: any;
    private context: any = {}; // Changed from readonly to allow cleanup
    private embeddedView;
    private unSubscribeFn: Function;

    constructor(
        private inj: Injector,
        private templateRef: TemplateRef<any>,
        private viewContainer: ViewContainerRef,
        @Inject('EXPLICIT_CONTEXT') @Optional() explicitContext: any = {}
    ) {
        let viewParentApp = this.inj ? this.inj.get(App) : inject(App);
        let lView = (this.inj as any)._lView;
        this.viewParent = findParent(lView, viewParentApp)
        //this.context = (inj as any).view.context;
        extend(this.context, (this.inj as any)._lView[8], explicitContext);
    }

    @Input()
    set lazyLoad(expr) {
        // MEMORY LEAK FIX: Unsubscribe from previous watcher if it exists
        if (this.unSubscribeFn && typeof this.unSubscribeFn === 'function') {
            try {
                this.unSubscribeFn();
            } catch (e) {
                console.warn('Error unsubscribing from previous lazyLoad watcher:', e);
            }
            this.unSubscribeFn = null;
        }
        
        this.unSubscribeFn = $watch(
            expr,
            this.viewParent,
            this.context,
            (val) => {
                if (!this.embeddedView && val) {
                    this.embeddedView = this.viewContainer.createEmbeddedView(this.templateRef, this.context, {
                        injector: Injector.create({
                            parent: this.inj,
                            providers: [{provide: 'EXPLICIT_CONTEXT', useValue: this.context}]
                        })
                    });
                    // Unsubscribe after creating the view (lazy load is complete)
                    if (this.unSubscribeFn && typeof this.unSubscribeFn === 'function') {
                        try {
                            this.unSubscribeFn();
                            this.unSubscribeFn = null; // Clear after calling to prevent double-call
                        } catch (e) {
                            console.warn('Error unsubscribing from lazyLoad watcher:', e);
                            this.unSubscribeFn = null;
                        }
                    }
                }
            }
        );
    }

    ngOnDestroy() {
        // MEMORY LEAK FIX: Safely unsubscribe from watcher
        if (this.unSubscribeFn && typeof this.unSubscribeFn === 'function') {
            try {
                this.unSubscribeFn();
            } catch (e) {
                console.warn('Error unsubscribing from lazyLoad watcher in ngOnDestroy:', e);
            }
            this.unSubscribeFn = null;
        }
        
        // MEMORY LEAK FIX: Clear context to release references to parent scope data
        if (this.context) {
            Object.keys(this.context).forEach(key => {
                delete this.context[key];
            });
            this.context = null;
        }
        
        // MEMORY LEAK FIX: Clear embedded view reference
        if (this.embeddedView) {
            this.embeddedView = null;
        }
    }
}
