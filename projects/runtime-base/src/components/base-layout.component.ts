import {AfterViewInit, Directive, Injector, OnDestroy, ViewChild} from '@angular/core';
import {ActivatedRoute, RouterOutlet} from '@angular/router';

import {PageDirective} from "@wm/components/page";
import {App, registerFnByExpr} from "@wm/core";
import {each, extend} from "lodash-es";

@Directive()
export abstract class BaseLayoutComponent implements AfterViewInit, OnDestroy {
    injector: Injector;
    App: App;
    layoutName: string;
    layoutPages: string[];

    private routerOutletPatched = false;

    @ViewChild(RouterOutlet) routerOutlet: RouterOutlet;
    @ViewChild(PageDirective) pageDirective: PageDirective;

    abstract getExpressions();

    /**
     * function to register bind expressions generated in this page instance
     * getExpressions function is defined in the generated page.comp.ts file
     * @param expressions, map of bind expression vs generated function
     */
    registerExpressions() {
        const expressions = this.getExpressions();
        each(expressions, (fn, expr) => {
            registerFnByExpr(expr, fn[0], fn[1]);
        });
    }

    private scheduleOverrideRouterOutlet(attempt = 0) {
        const maxAttempts = 50;
        if (this.routerOutlet?.attach && !this.routerOutletPatched) {
            this.overrideRouterOutlet();
            this.routerOutletPatched = true;
            return;
        }
        if (attempt < maxAttempts) {
            setTimeout(() => this.scheduleOverrideRouterOutlet(attempt + 1), 20);
        }
    }

    private overrideRouterOutlet() {
        const outlet = this.routerOutlet;
        if (!outlet?.attach || !outlet?.detach) {
            return;
        }
        const oAttach = outlet.attach.bind(outlet);
        const oDetach = outlet.detach.bind(outlet);
        outlet.attach = (componentRef: any, activatedRoute: ActivatedRoute) => {
            oAttach(componentRef, activatedRoute);
            componentRef.instance.ngOnAttach();
        };
        outlet.detach = () => oDetach();
    }

    ngAfterViewInit() {
        this.scheduleOverrideRouterOutlet();
    }

    init() {
        this.App = this.injector.get(App);
        this.App.activeLayoutName = this.layoutName;
        this.App.layoutPages = this.layoutPages;

        // register functions for binding evaluation
        this.registerExpressions();
    }

    //TODO: To work cache properly need to implement the below methods and WmRouteReuseStrategy
    ngOnDestroy(): void {
        // MEMORY LEAK FIX: Clear references to prevent memory leaks
        this.App = null;
        this.routerOutlet = null;
        this.pageDirective = null;
        this.layoutPages = null;
        this.layoutName = null;
    }

    canReuse() {
    }

    ngOnAttach() {
    }

    ngOnDetach() {
    }

    // This will be called when child route (Page component in the layout) is activated
    onActivate(pageComponent: any) {
        //Add page component scope to layout component so that bindings and watchers in the layout will use the page scope
        extend(this, pageComponent);
    }
}
