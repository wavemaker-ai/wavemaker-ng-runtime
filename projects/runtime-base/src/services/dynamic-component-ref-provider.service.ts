import {
    Component,
    CUSTOM_ELEMENTS_SCHEMA,
    EnvironmentInjector,
    Injectable,
    NO_ERRORS_SCHEMA,
    ViewEncapsulation
} from '@angular/core';
import {CommonModule} from '@angular/common';
import {FormsModule, ReactiveFormsModule} from '@angular/forms';

import {App, extendProto, isDefined} from '@wm/core';
import {transpile} from '@wm/transpiler';
import {initComponentsBuildTask} from '@wm/build-task';

import {AppManagerService} from './app.manager.service';
import {REQUIRED_MODULES_FOR_DYNAMIC_COMPONENTS} from '../runtime-base.module';
import {get} from "lodash-es";

initComponentsBuildTask();

const componentFactoryRefCache = new Map<string, any>();

const getDynamicComponent = (
    selector: any,
    template: string,
    css: string = '') => {
    // @ts-ignore
    return Component({
        template,
        styles: [css],
        encapsulation: ViewEncapsulation.None,
        selector,
        standalone: true,
        // Angular 17+/20: standalone dynamic components must import the standalone directives/components
        // used inside the runtime-transpiled markup, or they're treated as unknown elements.
        imports: [CommonModule, FormsModule, ReactiveFormsModule, ...REQUIRED_MODULES_FOR_DYNAMIC_COMPONENTS],
        schemas: [CUSTOM_ELEMENTS_SCHEMA, NO_ERRORS_SCHEMA]
    })(class DynamicComponent {
        isDynamicComponent: boolean = true;
    });
};

@Injectable()
export class DynamicComponentRefProviderService {
    private counter = 1;

    constructor(
        private app: App,
        private appManager: AppManagerService,
        private envInjector: EnvironmentInjector
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
        const component = this.app.dynamicComponentContainerRef.createComponent(componentFactoryRef, {
            index: 0,
            environmentInjector: this.envInjector,
            injector: get(options, 'inj')
        });
        extendProto(component.instance, context);
        target.appendChild(component.location.nativeElement);
        // MEMORY LEAK FIX: Return component reference so caller can destroy it
        return component;
    }
}
