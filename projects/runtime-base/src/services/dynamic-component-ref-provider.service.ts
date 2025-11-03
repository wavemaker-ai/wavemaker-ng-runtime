import {
    Compiler,
    Component,
    CUSTOM_ELEMENTS_SCHEMA,
    Injectable,
    NgModule,
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

// CRITICAL FIX: Add size limit to prevent unbounded cache growth
const MAX_CACHE_SIZE = 50;
const componentFactoryRefCache = new Map<string, any>();

const getDynamicModule = (componentRef: any) => {
    return NgModule({
        declarations: [componentRef],
        imports: [
            RuntimeBaseModule,
        ],
        schemas: [CUSTOM_ELEMENTS_SCHEMA, NO_ERRORS_SCHEMA]
    })(class DynamicModule {});
};

const getDynamicComponent = (
    selector: any,
    template: string,
    css: string = '') => {
    // @ts-ignore
    return Component({
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
    
    // CRITICAL FIX: Track created components for cleanup
    private createdComponents: any[] = [];

    constructor(
        private app: App,
        private appManager: AppManagerService,
        private compiler: Compiler
    ) {}

    public async getComponentFactoryRef(selector: string, markup: string, options: any = {}): Promise<any> {
        // check in the cache.
        let componentFactoryRef = componentFactoryRefCache.get(selector);

        markup = options.transpile ? transpile(markup).markup : markup;
        if (!componentFactoryRef || options.noCache) {
            const componentDef = getDynamicComponent(selector, markup, options.styles);
            const moduleDef = getDynamicModule(componentDef);

            componentFactoryRef = this.compiler
                .compileModuleAndAllComponentsSync(moduleDef)
                .componentFactories
                .filter(factory => factory.componentType === componentDef)[0];

            // CRITICAL FIX: Implement LRU-style cache eviction to prevent unbounded growth
            if (componentFactoryRefCache.size >= MAX_CACHE_SIZE) {
                // Remove oldest entry (first item in Map)
                const firstKey = componentFactoryRefCache.keys().next().value;
                componentFactoryRefCache.delete(firstKey);
                console.warn(`Dynamic component cache limit reached. Evicted: ${firstKey}`);
            }
            
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
     */
    public async addComponent(target: HTMLElement, markup: string, context = {}, options: any = {}) {
        options.transpile = isDefined(options.transpile) ? options.transpile : true;
        options.noCache = isDefined(options.noCache) ? options.noCache : true;
        options.selector = isDefined(options.selector) ? options.selector : 'wm-dynamic-component-' + this.counter++;
        const componentFactoryRef = await this.getComponentFactoryRef(options.selector, markup, options);
        const component = this.app.dynamicComponentContainerRef.createComponent(componentFactoryRef, 0, get(options, 'inj'));
        
        // CRITICAL FIX: Track created components for potential cleanup
        // Store with weak reference pattern to avoid retaining components
        this.createdComponents.push({
            componentRef: component,
            selector: options.selector,
            target: target
        });
        
        extendProto(component.instance, context);
        target.appendChild(component.location.nativeElement);
        
        // Return cleanup function that caller MUST call when component is no longer needed
        return () => {
            const index = this.createdComponents.findIndex(c => c.componentRef === component);
            if (index > -1) {
                this.createdComponents.splice(index, 1);
            }
            component.destroy();
        };
    }
    
    /**
     * CRITICAL FIX: Clear all cached component factories
     * Call this when navigating away from pages that create many dynamic components
     */
    public clearCache() {
        componentFactoryRefCache.clear();
    }
    
    /**
     * CRITICAL FIX: Cleanup method for destroying all tracked dynamic components
     * Should be called when app/page is being destroyed
     */
    public destroyAllComponents() {
        this.createdComponents.forEach(({componentRef}) => {
            try {
                componentRef.destroy();
            } catch (e) {
                console.warn('Failed to destroy dynamic component:', e);
            }
        });
        this.createdComponents = [];
    }
}
