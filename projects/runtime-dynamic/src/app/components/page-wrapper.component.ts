import {
    ApplicationRef,
    Component,
    ElementRef,
    EnvironmentInjector,
    Injector,
    NgZone,
    OnDestroy,
    OnInit,
    ViewContainerRef, ChangeDetectionStrategy} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';

import { Subscription } from 'rxjs';

import { AbstractSpinnerService, App} from '@wm/core';
import { MetadataService } from '@wm/variables';
import { SecurityService } from '@wm/security';
import { AppManagerService, BasePageComponent, ComponentRefProvider, ComponentType } from '@wm/runtime/base';

@Component({
    changeDetection: ChangeDetectionStrategy.Eager,
    standalone: true, 
    selector: 'app-page-outlet',
    template: '<div></div>'
})
export class PageWrapperComponent implements OnInit, OnDestroy {

    subscription: Subscription;
    instance: any;

    constructor(
        private readonly injector: Injector,
        private readonly envInjector: EnvironmentInjector,
        private readonly route: ActivatedRoute,
        private readonly vcRef: ViewContainerRef,
        private readonly appRef: ApplicationRef,
        private readonly metadataService: MetadataService,
        private readonly securityService: SecurityService,
        private readonly appManager: AppManagerService,
        private readonly app: App,
        private readonly ngZone: NgZone,
        private readonly elRef: ElementRef,
        private readonly spinnerService: AbstractSpinnerService,
        private readonly componentRefProvider: ComponentRefProvider,
        private readonly router: Router
    ) {}

    getTargetNode() {
        return this.elRef.nativeElement;
    }

    resetViewContainer() {
        this.vcRef.clear();
        const $target = this.getTargetNode();
        $target.innerHTML = '';
    }

    renderPage(pageName: string): void {
        const $target = this.getTargetNode();

        this.appManager.loadAppVariables()
            .then(async () => {
                const PageComponentClass = await this.componentRefProvider.getComponentFactoryRef(pageName, ComponentType.PAGE);
                
                if (!PageComponentClass) {
                    console.error(`Failed to load page component: ${pageName}`);
                    BasePageComponent.clear();
                    return;
                }

                try {
                    // Create a child injector that explicitly provides the route-specific
                    // ActivatedRoute from PageWrapperComponent. This ensures dynamically
                    // created page components get the correct ActivatedRoute with proper
                    // queryParams, rather than a root-level ActivatedRoute.
                    const childInjector = Injector.create({
                        providers: [
                            { provide: ActivatedRoute, useValue: this.route }
                        ],
                        parent: this.injector
                    });

                    const componentRef = this.vcRef.createComponent(PageComponentClass, {
                        index: 0,
                        environmentInjector: this.envInjector,
                        injector: childInjector
                    });
                    
                    this.instance = componentRef.instance;
                    $target.appendChild(componentRef.location.nativeElement);
                    
                    // Clean up any duplicate component instances
                    if (this.vcRef.length > 1) {
                        this.vcRef.remove(1);
                    }
                } catch (error) {
                    console.error(`Error creating page component ${pageName}:`, error);
                    BasePageComponent.clear();
                }
            })
            .catch(error => {
                console.error(`Error loading app variables for page ${pageName}:`, error);
                BasePageComponent.clear();
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
        this.vcRef.clear();
        
        // MEMORY LEAK FIX: Unsubscribe from route params subscription
        if (this.subscription) {
            this.subscription.unsubscribe();
            this.subscription = null;
        }

        // MEMORY LEAK FIX: Clear instance reference
        this.instance = null;
    }

    ngOnAttach() {
        this.getTargetNode().appendChild(this.instance.$page[0]);
        this.instance.ngOnAttach();
    }

    ngOnDetach() {
        this.instance.ngOnDetach();
    }
}
