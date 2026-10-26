import {
    ChangeDetectionStrategy,
    Component,
    CUSTOM_ELEMENTS_SCHEMA,
    Inject,
    Injectable,
    Injector,
    NO_ERRORS_SCHEMA,
    ViewEncapsulation,
    Type,
    inject
} from '@angular/core';

import { App, getValidJSON, UserDefinedExecutionContext } from '@wm/core';
import { transpile, scopeComponentStyles } from '@wm/transpiler';
import {
    AppManagerService,
    BasePageComponent,
    BasePartialComponent,
    BaseCustomWidgetComponent,
    BasePrefabComponent,
    ComponentRefProvider,
    ComponentType,
    getPrefabMinJsonUrl,
    getPrefabPartialJsonUrl,
    REQUIRED_MODULES_FOR_DYNAMIC_COMPONENTS,
    AccessrolesDirective, AppSpinnerComponent, CustomToasterComponent, AppComponent,
    PrefabPreviewComponent, EmptyPageComponent, PrefabDirective as PrefabLoader
} from '@wm/runtime/base';
import { AppResourceManagerService } from './app-resource-manager.service';
import { isString, isUndefined } from "lodash-es";
import * as customWidgets from '@wavemaker-ai/custom-widgets-m3';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';

// All the directive/component imports
import {
    ContentComponent, LayoutDirective, PageContentComponent, PageDirective,
    RouterOutletDirective, SpaPageDirective
} from '@wm/components/page';
import { PartialDirective } from '@wm/components/base';
import { ProgressBarComponent } from '@wm/components/basic/progress/progress-bar';
import { PrefabContainerDirective } from '@wm/components/prefab';

// ==================== Types ====================

interface PageMinJSON {
    markup: string;
    script: string;
    styles: string;
    variables: string;
    config?: string;
}

interface FragmentOptions {
    prefab?: string;
    [key: string]: unknown;
}

type ScriptFn = (instance: Record<string, unknown>, app: Record<string, unknown>, utils: Record<string, unknown>) => void;

// ==================== Caches ====================

const fragmentCache = new Map<string, Promise<PageMinJSON>>();
const componentCache = new Map<ComponentType, Map<string, Type<unknown>>>([
    [ComponentType.PAGE, new Map()],
    [ComponentType.PARTIAL, new Map()],
    [ComponentType.PREFAB, new Map()],
    [ComponentType.WIDGET, new Map()]
]);
const scriptCache = new Map<string, ScriptFn>();

declare global {
    interface Window { resourceCache?: Map<string, Promise<PageMinJSON>>; }
}
window.resourceCache = fragmentCache;

// ==================== Utilities ====================

const decode = (str: string): string => {
    try {
        return decodeURIComponent(str.replace(/\+/g, ' '));
    } catch {
        return str;
    }
};

const getUrl = (name: string, type: ComponentType, options?: FragmentOptions): string => {
    if (type === ComponentType.PAGE || type === ComponentType.PARTIAL) {
        return options?.prefab ? getPrefabPartialJsonUrl(options.prefab, name) : `./pages/${name}/page.min.json`;
    }
    return type === ComponentType.PREFAB ? getPrefabMinJsonUrl(name) : `./custom-widgets/${name}/page.min.json`;
};

const execScript = (script: string, id: string, ctx: string, instance: Record<string, unknown>,
    app: Record<string, unknown>, utils: Record<string, unknown>): void => {
    let fn = scriptCache.get(id);
    if ((ctx === 'Partial' && !isUndefined(instance.Prefab)) || !fn) {
        fn = new Function(ctx, 'App', 'Utils', script) as ScriptFn;
        scriptCache.set(id, fn);
    }
    fn(instance, app, utils);
};

// ==================== Component Imports ====================

const IMPORTS = [
    ...REQUIRED_MODULES_FOR_DYNAMIC_COMPONENTS, CommonModule, FormsModule, ReactiveFormsModule,
    PartialDirective, PageDirective, AccessrolesDirective, AppSpinnerComponent, CustomToasterComponent,
    AppComponent, PrefabLoader, PrefabPreviewComponent, EmptyPageComponent, LayoutDirective,
    ContentComponent, PageContentComponent, SpaPageDirective, RouterOutletDirective,
    ProgressBarComponent, PrefabContainerDirective
] as const;

// ==================== Component Factory ====================

const CONFIG_MAP = {
    [ComponentType.PAGE]: { Base: BasePageComponent, prefix: 'app-page-', ctx: 'Page' },
    [ComponentType.PARTIAL]: { Base: BasePartialComponent, prefix: 'app-partial-', ctx: 'Partial' },
    [ComponentType.PREFAB]: { Base: BasePrefabComponent, prefix: 'app-prefab-', ctx: 'Prefab' },
    [ComponentType.WIDGET]: { Base: BaseCustomWidgetComponent, prefix: 'app-custom-', ctx: 'Widget' }
};

const createComponent = (name: string, type: ComponentType, template: string,
    css: string, script: string, variables: string): Type<unknown> => {
    const { Base, prefix, ctx } = CONFIG_MAP[type];
    const selector = prefix + name;

    class DynamicComponent extends Base {
        isDynamicComponent = true;
        pageName?: string;
        partialName?: string;
        prefabName?: string;
        customWidgetName?: string;

        constructor(@Inject(Injector) public injector: Injector) {
            super();
            this.injector = injector;

            // Set component name based on type
            if (type === ComponentType.PAGE) this.pageName = name;
            else if (type === ComponentType.PARTIAL) this.partialName = name;
            else if (type === ComponentType.PREFAB) this.prefabName = name;
            else this.customWidgetName = name;

            super.init();
        }

        evalUserScript(instance: Record<string, unknown>, app: Record<string, unknown>, utils: Record<string, unknown>): void {
            execScript(script, selector, ctx, instance, app, utils);
        }

        getVariables(): Record<string, unknown> {
            try {
                return JSON.parse(variables) || {};
            } catch {
                return {};
            }
        }

        getExpressions(): Record<string, unknown> {
            return {};
        }
    }

    return Component({
        template,
        styles: [css],
        encapsulation: ViewEncapsulation.None,
        selector,
        standalone: true,
        // Angular 22 changed the default changeDetection strategy for components with no
        // explicit setting (patterns/runtime.md §27a). The 76 statically-declared production
        // components got ChangeDetectionStrategy.Eager pinned during the upgrade, but this
        // dynamic Component() call -- which builds every page/partial/prefab/widget component
        // in the entire app at runtime -- was missed, since it's not a static @Component()
        // decorator a repo-wide grep would catch. Without this, the created component's host
        // element is inserted into the DOM (so createComponent() "succeeds", no error), but
        // its own template content never gets checked/rendered under the new default strategy.
        changeDetection: ChangeDetectionStrategy.Eager,
        imports: [...IMPORTS],
        providers: [{ provide: UserDefinedExecutionContext, useExisting: DynamicComponent }],
        schemas: [CUSTOM_ELEMENTS_SCHEMA, NO_ERRORS_SCHEMA]
    })(DynamicComponent);
};

// ==================== Service ====================

@Injectable()
export class ComponentRefProviderService extends ComponentRefProvider {
    private readonly cache = new Map<string, Type<unknown>>();
    private readonly app = inject(App);
    private readonly appManager = inject(AppManagerService);
    private readonly resourceMngr = inject(AppResourceManagerService);

    constructor() {
        super();
    }

    /**
     * Load component fragment (markup, script, styles, variables) from JSON resources
     * Fetches and processes .min.json files for pages, partials, prefabs, and widgets
     * 
     * @param name - Component name
     * @param type - Component type (PAGE, PARTIAL, PREFAB, WIDGET)
     * @param options - Additional options (e.g., prefab context)
     * @returns Promise resolving to processed component definition
     * @throws Error with user-friendly message if loading fails (404, 403, etc.)
     * @private
     */
    private async loadFragment(name: string, type: ComponentType, options?: FragmentOptions): Promise<PageMinJSON> {
        const url = getUrl(name, type, options);

        // Return cached promise if already loading/loaded
        if (fragmentCache.has(url)) {
            return fragmentCache.get(url)!;
        }

        // Create loading promise
        const loadPromise = (async () => {
            try {
                // Determine if we need to fetch from server or use bundled custom widgets
                const shouldFetch = type === ComponentType.WIDGET && !customWidgets[name];
                const rawData = shouldFetch || type !== ComponentType.WIDGET
                    ? await this.resourceMngr.get(url, true)
                    : customWidgets[name];

                // Process and return component definition
                return {
                    markup: transpile(decode(rawData.markup)).markup,
                    script: decode(rawData.script),
                    styles: scopeComponentStyles(name, type, decode(rawData.styles)),
                    variables: getValidJSON(decode(rawData.variables)),
                    ...(rawData.config && { config: getValidJSON(decode(rawData.config)) })
                };
            } catch (err: unknown) {
                // Provide user-friendly error messages
                const status = (err as { details?: { status?: number } })?.details?.status;
                const errorMessages: Record<number, string> = {
                    404: this.app.appLocale?.MESSAGE_PAGE_NOT_FOUND || 'Page not available',
                    403: this.app.appLocale?.LABEL_ACCESS_DENIED || 'Access Denied'
                };
                throw errorMessages[status!] || 'Unknown error loading component';
            }
        })();

        // Cache the promise to prevent duplicate requests
        fragmentCache.set(url, loadPromise);
        return loadPromise;
    }

    /**
     * Get component class by loading and compiling from JSON resources
     * Loads page/partial/prefab/widget definitions from .min.json files and creates standalone components
     * 
     * @param name - Component name (e.g., 'Main', 'Header')
     * @param type - Component type (PAGE, PARTIAL, PREFAB, WIDGET)
     * @param options - Additional options (e.g., prefab context for partials)
     * @returns Promise resolving to component Type or undefined if loading fails
     */
    public async getComponentFactoryRef(name: string, type: ComponentType, options?: FragmentOptions): Promise<Type<unknown> | undefined> {
        const cacheKey = options?.prefab ? `${options.prefab}${name}` : name;
        const fullKey = `${type}-${cacheKey}`;

        // Check component cache (by type and name)
        const typeCache = componentCache.get(type);
        if (typeCache?.has(cacheKey)) {
            return typeCache.get(cacheKey);
        }
        
        // Check full cache (by full key)
        if (this.cache.has(fullKey)) {
            return this.cache.get(fullKey);
        }

        try {
            // Load component definition from JSON file
            const { markup, script, styles, variables } = await this.loadFragment(name, type, options);
            
            // Create standalone component class from definition
            const ComponentClass = createComponent(
                name, 
                type, 
                markup, 
                styles, 
                script, 
                JSON.stringify(variables)
            );

            // Store in both caches for fast lookup
            this.cache.set(fullKey, ComponentClass);
            typeCache?.set(cacheKey, ComponentClass);

            return ComponentClass;
        } catch (err: unknown) {
            const errorMsg = isString(err) ? err : 'Error loading component, check console';
            console.error(`Failed to load ${type} component '${name}':`, err);
            this.appManager.notifyApp(errorMsg, 'error');
            return undefined;
        }
    }

    public clearComponentFactoryRefCache(): void {
        this.resourceMngr.clearCache();
        fragmentCache.clear();
        this.cache.clear();
        componentCache.forEach(m => m.clear());
    }
}