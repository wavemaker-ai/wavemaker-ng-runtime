import { noop } from '@wm/core';

import { Subject, Subscription } from 'rxjs';
import { Directive } from "@angular/core";

@Directive()
export abstract class FragmentMonitor {
    fragments = 0;
    viewInit$: Subject<any>;
    isViewInitialized: boolean;
    isPageComponent: boolean = true;

    fragmentsLoaded$ = new Subject();
    private viewInitSubscription: Subscription; // MEMORY LEAK FIX: Store subscription reference

    constructor() {}

    init() {

        // MEMORY LEAK FIX: Store subscription reference for cleanup
        this.viewInitSubscription = this.viewInit$.subscribe(noop, noop, () => {
            this.isViewInitialized = true;
            this.isReady();
        });
    }

    /**
     * MEMORY LEAK FIX: Clean up FragmentMonitor resources
     * Should be called from implementing class's ngOnDestroy
     */
    protected cleanupFragmentMonitor() {
        // MEMORY LEAK FIX: Unsubscribe from viewInit$ subscription
        if (this.viewInitSubscription) {
            this.viewInitSubscription.unsubscribe();
            this.viewInitSubscription = null;
        }

        // MEMORY LEAK FIX: Complete Subjects to release subscriptions (if not already completed)
        if (this.viewInit$ && !this.viewInit$.closed) {
            this.viewInit$.complete();
        }
        this.viewInit$ = null;

        if (this.fragmentsLoaded$ && !this.fragmentsLoaded$.closed) {
            this.fragmentsLoaded$.complete();
        }
        this.fragmentsLoaded$ = null;
    }

    registerFragment() {
        this.fragments++;
    }

    resolveFragment() {
        this.fragments--;
        this.isReady();
    }

    isReady() {
        if (this.isViewInitialized && !this.fragments) {
            this.registerFragment = noop;
            this.resolveFragment = noop;
            this.fragmentsLoaded$.complete();
        }
    }
}
