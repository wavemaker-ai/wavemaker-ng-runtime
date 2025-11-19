import {
    Component,
    CUSTOM_ELEMENTS_SCHEMA, Inject,
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
    AccessrolesDirective,
    AppSpinnerComponent,
    CustomToasterComponent,
    AppComponent,
    PrefabPreviewComponent,
    EmptyPageComponent,
    PrefabDirective as PrefabLoader,
    REQUIRED_MODULES_FOR_DYNAMIC_COMPONENTS,
} from '@wm/runtime/base';
import { AppResourceManagerService } from './app-resource-manager.service';
import { isString, isUndefined } from "lodash-es";
import * as customWidgets from '@wavemaker/custom-widgets-m3';
import { ContentComponent, LayoutDirective, PageContentComponent, PageDirective, RouterOutletDirective, SpaPageDirective } from '@wm/components/page';
import { CommonModule } from '@angular/common';
import { PartialDirective } from '@wm/components/base';
import { ProgressBarComponent } from '@wm/components/basic/progress/progress-bar';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { PrefabContainerDirective } from '@wm/components/prefab';

interface IPageMinJSON {
    markup: string;
    script: string;
    styles: string;
    variables: string;
    config?: string;
}

declare const window: Window & { resourceCache?: Map<string, any> };

const fragmentCache = new Map<string, Promise<IPageMinJSON>>();

window.resourceCache = fragmentCache;

const componentFactoryRefCache = new Map<ComponentType, Map<string, Type<any>>>();

componentFactoryRefCache.set(ComponentType.PAGE, new Map<string, Type<any>>());
componentFactoryRefCache.set(ComponentType.PARTIAL, new Map<string, Type<any>>());
componentFactoryRefCache.set(ComponentType.PREFAB, new Map<string, Type<any>>());
componentFactoryRefCache.set(ComponentType.WIDGET, new Map<string, Type<any>>());

const _decodeURIComponent = (str: string) => decodeURIComponent(str.replace(/\+/g, ' '));

const getFragmentUrl = (fragmentName: string, type: ComponentType, options?: any): string | undefined => {
    if (type === ComponentType.PAGE || type === ComponentType.PARTIAL) {
        return options && options.prefab ? getPrefabPartialJsonUrl(options.prefab, fragmentName) : `./pages/${fragmentName}/page.min.json`;
    } else if (type === ComponentType.PREFAB) {
        return getPrefabMinJsonUrl(fragmentName);
    } else if (type === ComponentType.WIDGET) {
        return `./custom-widgets/${fragmentName}/page.min.json`
    }
};

const scriptCache = new Map<string, Function>();
const execScript = (
    script: string,
    identifier: string,
    ctx: string,
    instance: any,
    app: any,
    utils: any
): void => {
    let fn = scriptCache.get(identifier);
    // Fix for [WMS-21196]: Incorrect script is being assigned,  when 2 prefabs have same partial name (i.e. same identifier).
    if ((ctx === 'Partial' && !isUndefined(instance.Prefab)) || !fn) {
        fn = new Function(ctx, 'App', 'Utils', script) as (instance: any, app: any, utils: any) => void;
        scriptCache.set(identifier, fn);
    }
    fn(instance, app, utils);
};

class BaseDynamicComponent {
    init() { }
}

const imports = [
    PartialDirective,
    PageDirective,
    AccessrolesDirective,
    AppSpinnerComponent,
    CustomToasterComponent,
    AppComponent,
    PrefabLoader,
    PrefabPreviewComponent,
    EmptyPageComponent,
    LayoutDirective,
    ContentComponent,
    PageContentComponent,
    SpaPageDirective,
    RouterOutletDirective,
    ProgressBarComponent,
    PrefabContainerDirective,
]

// Providers are now included directly in standalone components
// The getDynamicProviders function is no longer needed since providers
// are declared in the component decorator

const getDynamicComponent = (
    componentName: string,
    type: ComponentType,
    template: string,
    css: string,
    script: string,
    variables: string,
): Type<any> => {

    const componentDef = {
        template,
        styles: [css],
        encapsulation: ViewEncapsulation.None
    };

    let BaseClass: any = BaseDynamicComponent;
    let selector = '';
    let context = '';

    switch (type) {
        case ComponentType.PAGE:
            BaseClass = BasePageComponent;
            selector = `app-page-${componentName}`;
            context = 'Page';
            break;
        case ComponentType.PARTIAL:
            BaseClass = BasePartialComponent;
            selector = `app-partial-${componentName}`;
            context = 'Partial';
            break;
        case ComponentType.PREFAB:
            BaseClass = BasePrefabComponent;
            selector = `app-prefab-${componentName}`;
            context = 'Prefab';
            break;
        case ComponentType.WIDGET:
            BaseClass = BaseCustomWidgetComponent;
            selector = `app-custom-${componentName}`;
            context = 'Widget';
            break;
    }

    class DynamicComponent extends BaseClass {
        isDynamicComponent: boolean = true;
        pageName;
        partialName;
        prefabName;
        customWidgetName;
        constructor(@Inject(Injector) public injector: Injector) {
            super();
            this.injector = injector;
            switch (type) {
                case ComponentType.PAGE:
                    this.pageName = componentName;
                    break;
                case ComponentType.PARTIAL:
                    this.partialName = componentName;
                    break;
                case ComponentType.PREFAB:
                    this.prefabName = componentName;
                    break;
                case ComponentType.WIDGET:
                    this.customWidgetName = componentName;
                    break;
            }

            super.init();
        }

        evalUserScript(instance: any, appContext: any, utils: any): void {
            execScript(script, selector, context, instance, appContext, utils);
        }

        getVariables() {
            return JSON.parse(variables);
        }

        // in preview mode, there will be no function registered. functions will be generated dynamically through $parseEvent and $parseExpr
        getExpressions() {
            return {};
        }
    }

    const component = Component({
        ...componentDef,
        selector,
        standalone: true,
        imports: [
            ...REQUIRED_MODULES_FOR_DYNAMIC_COMPONENTS,
            CommonModule,
            FormsModule,
            ReactiveFormsModule,
            ...imports
        ],
        providers: [
            {
                provide: UserDefinedExecutionContext,
                useExisting: DynamicComponent
            }
        ],
        schemas: [CUSTOM_ELEMENTS_SCHEMA, NO_ERRORS_SCHEMA]
    })(DynamicComponent)
    return component;
};

@Injectable()
export class ComponentRefProviderService extends ComponentRefProvider {
    private dynamicComponentCache = new Map<string, Type<any>>(); 
    private app: App = inject(App);
    private appManager: AppManagerService = inject(AppManagerService);
    private resouceMngr: AppResourceManagerService = inject(AppResourceManagerService);

    private loadResourcesOfFragment(componentName: string, componentType: ComponentType, options?: any): Promise<IPageMinJSON> {
        const url = getFragmentUrl(componentName, componentType, options);

        const resource = fragmentCache.get(url);

        if (resource) {
            return resource;
        }
        const promise = (((componentType === ComponentType.WIDGET && !customWidgets[componentName]) || componentType !== ComponentType.WIDGET) ? this.resouceMngr.get(url, true) : Promise.resolve(customWidgets[componentName]))
            .then(({ markup, script, styles, variables, config }: IPageMinJSON) => {
                const response = {
                    markup: transpile(_decodeURIComponent(markup)).markup,
                    script: _decodeURIComponent(script),
                    styles: scopeComponentStyles(componentName, componentType, _decodeURIComponent(styles)),
                    variables: getValidJSON(_decodeURIComponent(variables)),
                    ...(config ? { config: getValidJSON(_decodeURIComponent(config)) } : {})
                };
                fragmentCache.set(url, Promise.resolve(response));

                return response;
            }, (e: any) => {
                const status = e.details.status;
                const errorMsgMap = {
                    404: this.app.appLocale.MESSAGE_PAGE_NOT_FOUND || 'The page you are trying to reach is not available',
                    403: this.app.appLocale.LABEL_ACCESS_DENIED || 'Access Denied'
                };
                return Promise.reject(errorMsgMap[status]);
            });
        fragmentCache.set(url, promise);
        return promise as Promise<IPageMinJSON>;
    }

    constructor() {
        super();
    }

    public async getComponentFactoryRef(componentName: string, componentType: ComponentType, options?: Record<string, string>): Promise<Type<any> | void> {
        // check in the cache.
        const componentFactoryMap = componentFactoryRefCache.get(componentType);
        let componentClass: Type<any>;
        const updatedComponentName = (options && options['prefab']) ? options['prefab'] + componentName : componentName;
        
        if (componentFactoryMap) {
            componentClass = componentFactoryMap.get(updatedComponentName);
            if (componentClass) {
                return componentClass;
            }
        }

        // Check dynamic component cache
        const cacheKey = `${componentType}-${updatedComponentName}`;
        const cachedComponent = this.dynamicComponentCache.get(cacheKey);
        if (cachedComponent) {
            return cachedComponent;
        }

        return this.loadResourcesOfFragment(componentName, componentType, options)
            .then(({ markup, script, styles, variables }) => {
                componentClass = getDynamicComponent(componentName, componentType, markup, styles, script, JSON.stringify(variables));
                
                // Store in both caches
                this.dynamicComponentCache.set(cacheKey, componentClass);
                componentFactoryRefCache.get(componentType).set(updatedComponentName, componentClass);

                return componentClass;
            }, (err: any) => {
                if (err) {
                    const msg = "Error while loading page";
                    // console the error for easy debugging
                    console.log(msg, err);
                    this.appManager.notifyApp(
                        isString(err) ? err : msg + ', check browser console for error details',
                        'error'
                    );
                }
            });
    }

    // clears the cache map
    public clearComponentFactoryRefCache() {
        this.resouceMngr.clearCache();
        fragmentCache.clear();
        this.dynamicComponentCache.clear();
        componentFactoryRefCache.forEach(map => {
            map.clear();
        });
    }
}
