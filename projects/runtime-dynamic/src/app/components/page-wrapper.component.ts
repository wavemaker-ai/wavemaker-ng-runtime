import {
    ApplicationRef,
    Component,
    ComponentRef,
    ElementRef,
    Injector,
    NgZone,
    OnDestroy,
    OnInit,
    ViewChild,
    ViewContainerRef} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';

import { Subscription } from 'rxjs';

import { AbstractSpinnerService, App} from '@wm/core';
import { MetadataService } from '@wm/variables';
import { SecurityService } from '@wm/security';
import { AppManagerService, BasePageComponent, ComponentRefProvider, ComponentType } from '@wm/runtime/base';

@Component({
    standalone: true, 
    selector: 'app-page-outlet',
    template: '<ng-container #pageContainer></ng-container>'
})
export class PageWrapperComponent implements OnInit, OnDestroy {
    @ViewChild('pageContainer', { read: ViewContainerRef, static: true }) pageVcRef: ViewContainerRef;
    
    subscription: Subscription;
    instance: any;
    private currentComponentRef: ComponentRef<any>;

    constructor(
        private injector: Injector,
        private route: ActivatedRoute,
        private appRef: ApplicationRef,
        private metadataService: MetadataService,
        private securityService: SecurityService,
        private appManager: AppManagerService,
        private app: App,
        private ngZone: NgZone,
        private elRef: ElementRef,
        private spinnerService: AbstractSpinnerService,
        private componentRefProvider: ComponentRefProvider,
        private router: Router
    ) {}

    getTargetNode() {
        return this.elRef.nativeElement;
    }

    resetViewContainer() {
        if (this.pageVcRef) {
            this.pageVcRef.clear();
        }
        const $target = this.getTargetNode();
        $target.innerHTML = '';
    }

    renderPage(pageName) {
        this.appManager.loadAppVariables()
            .then(async () => {
                const pageComponentFactoryRef = await this.componentRefProvider.getComponentFactoryRef(pageName, ComponentType.PAGE);
                if (pageComponentFactoryRef) {
                    // ✅ FIXED: Create component inside the outlet using the template's ViewContainerRef
                    const componentRef = this.pageVcRef.createComponent(pageComponentFactoryRef, 0, this.injector);
                    this.instance = componentRef.instance;
                    
                    // Store reference for cleanup
                    if (this.currentComponentRef) {
                        this.currentComponentRef.destroy();
                    }
                    this.currentComponentRef = componentRef;
                    
                    // The component is now properly rendered inside <app-page-outlet>
                } else {
                    BasePageComponent.clear();
                }
                
                // Clean up any extra components
                if (this.pageVcRef.length > 1) {
                    this.pageVcRef.remove(1);
                }
            });
    }

    renderPrefabPreviewPage() {
        this.router.navigate(['prefab-preview']);
    }

    loadPage(pageName) {
        this.ngZone.run(() => {
            if (pageName) {
                this.renderPage(pageName);
            }
        });
    }

    ngOnInit() {
        if (this.app.isPrefabType) {
            // there is only one route
            this.renderPrefabPreviewPage();
        } else {
            $(this.getTargetNode()).find('>div').first().remove();
            this.subscription = this.route.params.subscribe(({pageName}: any) => {
               this.loadPage(pageName);
            });
        }
    }

    ngOnDestroy() {
        // MEMORY LEAK FIX: Clear ViewContainerRef to destroy dynamically created components
        // ✅ FIXED: Properly destroy component reference
        if (this.currentComponentRef) {
            this.currentComponentRef.destroy();
            this.currentComponentRef = null;
        }
        
        if (this.pageVcRef) {
            this.pageVcRef.clear();
        
        // MEMORY LEAK FIX: Unsubscribe from route params subscription
        }
        
        if (this.subscription) {
            this.subscription.unsubscribe();
            this.subscription = null;
        }

        // MEMORY LEAK FIX: Clear instance reference
        this.instance = null;
    }

    ngOnAttach() {
        // ⚠️ WARNING: This is also doing manual DOM manipulation!
        // this.getTargetNode().appendChild(this.instance.$page[0]);
        // This should be handled by Angular's view management
        
        if (this.instance && this.instance.ngOnAttach) {
            this.instance.ngOnAttach();
        }
    }

    ngOnDetach() {
        if (this.instance && this.instance.ngOnDetach) {
            this.instance.ngOnDetach();
        }
    }
}