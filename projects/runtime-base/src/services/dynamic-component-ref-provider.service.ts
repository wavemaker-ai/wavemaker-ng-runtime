import {
    Component,
    ComponentRef,
    ApplicationRef,
    CUSTOM_ELEMENTS_SCHEMA,
    EnvironmentInjector,
    Injectable,
    Injector,
    NO_ERRORS_SCHEMA,
    Type,
    ViewEncapsulation,
    createComponent,
    inject
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';

import { extendProto, isDefined } from '@wm/core';
import { transpile } from '@wm/transpiler';
import { initComponentsBuildTask } from '@wm/build-task';
import { AppManagerService } from './app.manager.service';
import { REQUIRED_MODULES_FOR_DYNAMIC_COMPONENTS } from '../runtime-base.module';

initComponentsBuildTask();

// ==================== Types ====================

interface DynamicOptions {
    selector?: string;
    transpile?: boolean;
    noCache?: boolean;
    styles?: string;
    inj?: Injector;
}

// ==================== Cache ====================

const cache = new Map<string, Type<unknown>>();

// ==================== Utilities ====================

const isValidSelector = (s: string) => /^[a-zA-Z][a-zA-Z0-9-]*$/.test(s);
const isValidMarkup = (m: string) => typeof m === 'string' && m.trim().length > 0;

// ==================== Component Factory ====================

let counter = 1;

const createDynamicComponent = (selector: string, template: string, css = ''): Type<unknown> => {
    if (!isValidSelector(selector)) throw new Error(`Invalid selector: ${selector}`);
    if (!isValidMarkup(template)) throw new Error('Invalid markup');

    class DynamicComponent {
        readonly isDynamicComponent = true;
    }

    // Apply Component decorator as a function to avoid AOT compilation issues
    return Component({
        template,
        styles: [css],
        encapsulation: ViewEncapsulation.None,
        selector,
        standalone: true,
        // Angular 17+ / 20: standalone dynamic components MUST import the standalone directives/components
        // used inside the runtime-transpiled markup. Without this, tags like <wm-input> and attribute
        // directives like [wmFormField] will be treated as unknown (and silently ignored due to schemas),
        // causing "directive not initialized" symptoms in dynamic wizard/tabs/accordion paths.
        imports: [CommonModule, FormsModule, ReactiveFormsModule, ...REQUIRED_MODULES_FOR_DYNAMIC_COMPONENTS],
        schemas: [CUSTOM_ELEMENTS_SCHEMA, NO_ERRORS_SCHEMA]
    })(DynamicComponent);
};

// ==================== Service ====================

@Injectable()
export class DynamicComponentRefProviderService {
    private readonly appManager = inject(AppManagerService);
    private readonly envInjector = inject(EnvironmentInjector);
    private readonly injector = inject(Injector);
    private readonly appRef = inject(ApplicationRef);

    private normalize(opts: DynamicOptions = {}): Required<DynamicOptions> {
        return {
            selector: opts.selector ?? `wm-dynamic-component-${counter++}`,
            transpile: isDefined(opts.transpile) ? opts.transpile : true,
            noCache: isDefined(opts.noCache) ? opts.noCache : true,
            styles: opts.styles ?? '',
            inj: opts.inj ?? this.injector
        };
    }

    /**
     * Get dynamically compiled component class from markup
     * Creates a standalone component from HTML markup at runtime
     * 
     * @param selector - Unique selector for the component (e.g., 'app-table-dynamic-123')
     * @param markup - HTML template markup to compile
     * @param opts - Options for transpilation, caching, and styling
     * @returns Promise resolving to compiled component Type
     * @throws Error if selector is invalid or compilation fails
     */
    public async getComponentFactoryRef(selector: string, markup: string, opts: DynamicOptions = {}): Promise<Type<unknown>> {
        if (!isValidSelector(selector)) {
            throw new Error(`Invalid selector: ${selector}`);
        }

        const options = this.normalize(opts);

        // Return cached component if available
        if (!options.noCache && cache.has(selector)) {
            return cache.get(selector)!;
        }

        try {
            // Transpile markup if needed (converts WaveMaker syntax to Angular)
            const processedMarkup = options.transpile ? transpile(markup).markup : markup;
            
            // Create standalone component class
            const ComponentClass = createDynamicComponent(selector, processedMarkup, options.styles);

            // Cache for reuse unless noCache is true
            if (!options.noCache) {
                cache.set(selector, ComponentClass);
            }
            
            return ComponentClass;
        } catch (err) {
            this.handleError(err, selector);
            throw err;
        }
    }

    /**
     * Creates a dynamic component and adds it to the DOM
     * Compiles markup into a standalone component and renders it in the target element
     * 
     * @param target - HTML element where the component will be appended
     * @param markup - HTML template markup to compile
     * @param context - Context object to extend the component instance with
     * @param opts - Options for selector, transpilation, caching, and injection
     * @returns Promise resolving to ComponentRef for cleanup and lifecycle management
     * @throws Error if target is invalid or component creation fails
     */
    public async addComponent(
        target: HTMLElement,
        markup: string,
        context: Record<string, unknown> = {},
        opts: DynamicOptions = {}
    ): Promise<ComponentRef<unknown>> {
        if (!(target instanceof HTMLElement)) {
            throw new Error('Invalid target element');
        }

        const options = this.normalize(opts);

        try {
            // Get compiled component class
            const ComponentClass = await this.getComponentFactoryRef(options.selector, markup, options);
            
            // Create component instance with both environmentInjector (for standalone imports/providers)
            // and elementInjector (for element-level dependencies)
            const componentRef = createComponent(ComponentClass, {
                environmentInjector: this.envInjector,
                elementInjector: options.inj
            });

            // Extend component instance with provided context
            if (Object.keys(context).length) {
                extendProto(componentRef.instance, context);
            }

            // Attach to Angular's change detection
            this.appRef.attachView(componentRef.hostView);
            
            // Add to DOM
            target.appendChild(componentRef.location.nativeElement);

            // Cleanup on destroy
            componentRef.onDestroy(() => this.appRef.detachView(componentRef.hostView));

            return componentRef;
        } catch (err) {
            this.handleError(err, options.selector);
            throw err;
        }
    }

    public clearCache(): void {
        cache.clear();
    }

    public getCacheSize(): number {
        return cache.size;
    }

    private handleError(err: unknown, selector: string): void {
        const msg = err instanceof Error ? err.message : 'Unknown error';
        console.error(`Error creating component [${selector}]:`, msg, err);
        this.appManager.notifyApp?.(`Failed to create component: ${msg}`, 'error');
    }
}