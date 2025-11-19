import {
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
} from '@wm/runtime/base';
import { AppResourceManagerService } from './app-resource-manager.service';
import { isString, isUndefined } from "lodash-es";
import * as customWidgets from '@wavemaker/custom-widgets-m3';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';

// All the directive/component imports
import {
    AccessrolesDirective, AppSpinnerComponent, CustomToasterComponent, AppComponent,
    PrefabPreviewComponent, EmptyPageComponent, PrefabDirective as PrefabLoader
} from '@wm/runtime/base';
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
            else if (type === ComponentType.WIDGET) this.customWidgetName = name;

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

    private async loadFragment(name: string, type: ComponentType, options?: FragmentOptions): Promise<PageMinJSON> {
        const url = getUrl(name, type, options);

        if (fragmentCache.has(url)) {
            return fragmentCache.get(url)!;
        }

        const promise = (async () => {
            try {
                const shouldFetch = type === ComponentType.WIDGET && !customWidgets[name];
                const raw = shouldFetch || type !== ComponentType.WIDGET
                    ? await this.resourceMngr.get(url, true)
                    : customWidgets[name];

                return {
                    markup: transpile(decode(raw.markup)).markup,
                    script: decode(raw.script),
                    styles: scopeComponentStyles(name, type, decode(raw.styles)),
                    variables: getValidJSON(decode(raw.variables)),
                    ...(raw.config && { config: getValidJSON(decode(raw.config)) })
                };
            } catch (err: unknown) {
                const status = (err as { details?: { status?: number } })?.details?.status;
                const msgs: Record<number, string> = {
                    404: this.app.appLocale?.MESSAGE_PAGE_NOT_FOUND || 'Page not available',
                    403: this.app.appLocale?.LABEL_ACCESS_DENIED || 'Access Denied'
                };
                throw msgs[status!] || 'Unknown error';
            }
        })();

        fragmentCache.set(url, promise);
        return promise;
    }

    public async getComponentFactoryRef(name: string, type: ComponentType, options?: FragmentOptions): Promise<Type<unknown> | void> {
        const cacheKey = options?.prefab ? `${options.prefab}${name}` : name;
        const fullKey = `${type}-${cacheKey}`;

        // Check both caches
        const map = componentCache.get(type);
        if (map?.has(cacheKey)) return map.get(cacheKey);
        if (this.cache.has(fullKey)) return this.cache.get(fullKey);

        try {
            const { markup, script, styles, variables } = await this.loadFragment(name, type, options);
            const component = createComponent(name, type, markup, styles, script, JSON.stringify(variables));

            // Store in both caches
            this.cache.set(fullKey, component);
            map?.set(cacheKey, component);

            return component;
        } catch (err: unknown) {
            const msg = isString(err) ? err : 'Error loading page, check console';
            console.error('Component load error:', err);
            this.appManager.notifyApp(msg, 'error');
        }
    }

    public clearComponentFactoryRefCache(): void {
        this.resourceMngr.clearCache();
        fragmentCache.clear();
        this.cache.clear();
        componentCache.forEach(m => m.clear());
    }
}