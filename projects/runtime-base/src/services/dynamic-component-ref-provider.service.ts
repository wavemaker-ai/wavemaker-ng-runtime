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

import { extendProto, isDefined } from '@wm/core';
import { transpile } from '@wm/transpiler';
import { initComponentsBuildTask } from '@wm/build-task';
import { AppManagerService } from './app.manager.service';

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

    public async getComponentFactoryRef(selector: string, markup: string, opts: DynamicOptions = {}): Promise<Type<unknown>> {
        if (!isValidSelector(selector)) throw new Error(`Invalid selector: ${selector}`);

        const options = this.normalize(opts);

        // Check cache
        if (!options.noCache && cache.has(selector)) {
            return cache.get(selector)!;
        }

        try {
            const processed = options.transpile ? transpile(markup).markup : markup;
            const component = createDynamicComponent(selector, processed, options.styles);

            if (!options.noCache) cache.set(selector, component);
            return component;
        } catch (err) {
            this.handleError(err, selector);
            throw err;
        }
    }

    public async addComponent(
        target: HTMLElement,
        markup: string,
        context: Record<string, unknown> = {},
        opts: DynamicOptions = {}
    ): Promise<ComponentRef<unknown>> {
        if (!(target instanceof HTMLElement)) throw new Error('Invalid target element');

        const options = this.normalize(opts);

        try {
            const componentType = await this.getComponentFactoryRef(options.selector, markup, options);
            const ref = createComponent(componentType, {
                environmentInjector: this.envInjector,
                elementInjector: options.inj
            });

            if (Object.keys(context).length) extendProto(ref.instance, context);

            this.appRef.attachView(ref.hostView);
            target.appendChild(ref.location.nativeElement);

            ref.onDestroy(() => this.appRef.detachView(ref.hostView));

            return ref;
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