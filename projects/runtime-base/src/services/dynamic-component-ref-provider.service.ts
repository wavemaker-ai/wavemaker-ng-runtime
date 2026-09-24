import {
    ChangeDetectionStrategy,
    Component,
    CUSTOM_ELEMENTS_SCHEMA,
    Injectable,
    NO_ERRORS_SCHEMA,
    ViewEncapsulation
} from '@angular/core';

import {App, extendProto, isDefined} from '@wm/core';
import {transpile} from '@wm/transpiler';
import {initComponentsBuildTask} from '@wm/build-task';

import {AppManagerService} from './app.manager.service';
import {RuntimeBaseModule} from '../runtime-base.module';
import {get} from "lodash-es";

initComponentsBuildTask();

// Angular 22 removed Compiler.compileModuleAndAllComponentsSync() and the ComponentFactory-based
// ViewContainerRef.createComponent() overload — both required to get a usable component reference
// out of a runtime-constructed NgModule. Fixed by making the dynamic component standalone (moving
// the wrapping NgModule's `imports`/`schemas` directly onto the @Component() call below) and
// creating it straight from its class via the new createComponent(Type, options) API — no
// NgModule/Compiler step needed at all. "componentFactoryRef" below is now a component *class*,
// not a ComponentFactory instance — kept the name to minimize diff/blast-radius across callers.
const componentFactoryRefCache = new Map<string, any>();

const getDynamicComponent = (
    selector: any,
    template: string,
    css: string = '') => {
    // @ts-ignore
    return Component({
        // Angular 22: changeDetection now defaults to OnPush — this dynamic factory needs the
        // pre-22 default pinned explicitly, same as every static @Component() in this repo (§27a).
        changeDetection: ChangeDetectionStrategy.Eager,
        standalone: true,
        imports: [RuntimeBaseModule],
        schemas: [CUSTOM_ELEMENTS_SCHEMA, NO_ERRORS_SCHEMA],
        template,
        styles: [css],
        encapsulation: ViewEncapsulation.None,
        selector
    })(class DynamicComponent {
        isDynamicComponent: boolean = true;
    });
};

@Injectable()
export class DynamicComponentRefProviderService {
    private counter = 1;

    constructor(
        private app: App,
        private appManager: AppManagerService
    ) {}

    public async getComponentFactoryRef(selector: string, markup: string, options: any = {}): Promise<any> {
        // check in the cache.
        let componentFactoryRef = componentFactoryRefCache.get(selector);

        markup = options.transpile ? transpile(markup).markup : markup;
        if (!componentFactoryRef || options.noCache) {
            componentFactoryRef = getDynamicComponent(selector, markup, options.styles);
            componentFactoryRefCache.set(selector, componentFactoryRef);
        }
        return componentFactoryRef;
    }

    /**
     * Creates the component dynamically and add it to the DOM
     * @param target: HTML element where we need to append the created component
     * @param markup: Template of the component
     * @param context: Scope of the component
     * @param options: We have options like
                       selector: selector of the component
                       transpile: flag for transpiling HTML. By default it is true
                       nocache: flag for render it from cache or not. By default it is true
     * @returns ComponentRef - the created component reference for cleanup
     */
    public async addComponent(target: HTMLElement, markup: string, context = {}, options: any = {}) {
        options.transpile = isDefined(options.transpile) ? options.transpile : true;
        options.noCache = isDefined(options.noCache) ? options.noCache : true;
        options.selector = isDefined(options.selector) ? options.selector : 'wm-dynamic-component-' + this.counter++;
        const componentFactoryRef = await this.getComponentFactoryRef(options.selector, markup, options);
        const component = this.app.dynamicComponentContainerRef.createComponent(componentFactoryRef, { index: 0, injector: get(options, 'inj') });
        extendProto(component.instance, context);
        target.appendChild(component.location.nativeElement);
        // MEMORY LEAK FIX: Return component reference so caller can destroy it
        return component;
    }
}
