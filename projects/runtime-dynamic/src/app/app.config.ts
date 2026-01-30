import { ApplicationConfig, importProvidersFrom, LOCALE_ID, RendererFactory2, APP_INITIALIZER } from "@angular/core";
import { provideRouter, RouteReuseStrategy, withComponentInputBinding, withHashLocation } from "@angular/router";
import {
    HTTP_INTERCEPTORS,
    provideHttpClient,
    withInterceptorsFromDi,
    withXsrfConfiguration,
    withFetch
} from "@angular/common/http";
import { provideAnimations } from "@angular/platform-browser/animations";
import { XhrFactory } from "@angular/common";
import { InjectionToken } from "@angular/core";
import { routes } from "./app.routes";
import { HttpServiceImpl } from "@wm/http";
import { SecurityService } from "@wm/security";
import { VariablesService, MetadataService } from "@wm/variables";
import { OAuthService } from "@wm/oAuth";
import {
    AppBeforeLoadResolve,
    AppDefaultsService,
    AppExtensionJSResolve,
    AppExtensionProvider,
    AppJSProvider,
    AppJSResolve,
    AppManagerService,
    AppRef,
    AppVariablesProvider,
    AppVariablesResolve,
    AuthGuard,
    CanDeactivatePageGuard,
    ComponentRefProvider,
    CustomwidgetConfigProvider,
    DynamicComponentRefProviderService,
    HttpCallInterceptor,
    I18nResolve,
    I18nServiceImpl,
    NavigationServiceImpl,
    PageNotFoundGuard,
    PipeService,
    PrefabConfigProvider,
    PrefabManagerService,
    RoleGuard,
    SpinnerServiceImpl,
    ToasterServiceImpl,
    WmRouteReuseStrategy,
    WMDomRendererFactory2,
    MAX_CACHE_SIZE,
    MAX_CACHE_AGE
} from "@wm/runtime/base";
import {
    _WM_APP_PROJECT,
    AbstractDialogService,
    AbstractHttpService,
    AbstractI18nService,
    AbstractNavigationService,
    AbstractSpinnerService,
    AbstractToasterService,
    App,
    AppDefaults,
    CustomWidgetRefProvider,
    DynamicComponentRefProvider,
    getWmProjectProperties,
    PartialRefProvider,
    CustomIconsLoaderService,
    Viewport
} from "@wm/core";
import { ToastNoAnimationModule } from "ngx-toastr";
import { ModalModule } from "ngx-bootstrap/modal";
import { BsDatepickerModule } from "ngx-bootstrap/datepicker";
import { NgCircleProgressModule } from "ng-circle-progress";
import { DatePipe, DecimalPipe, Location } from "@angular/common";
import { CustomwidgetConfigProviderService } from "./services/customwidget-config-provider.service";
import { AppJSProviderService } from "./services/app-js-provider.service";
import { AppVariablesProviderService } from "./services/app-variables-provider.service";
import { AppExtensionProviderService } from "./services/app-extension.service";
import { ComponentRefProviderService } from "./services/component-ref-provider.service";
import { PrefabConfigProviderService } from "./services/prefab-config-provider.service";
import { AppResourceManagerService } from "./services/app-resource-manager.service";
import {
    CustomPipe,
    DialogServiceImpl,
    FilterPipe,
    ImagePipe,
    SanitizePipe,
    ToDatePipe,
    TrailingZeroDecimalPipe,
    TrustAsPipe
} from "@wm/components/base";


// XhrFactory implementation for Angular 20
class BrowserXhrFactory extends XhrFactory {
    build(): XMLHttpRequest {
        return new XMLHttpRequest();
    }
}

// Create the internal injection token that HttpXhrBackend actually uses
const XHR_FACTORY_TOKEN = new InjectionToken<XhrFactory>('XhrFactory', {
    providedIn: 'root',
    factory: () => new BrowserXhrFactory()
});

const wmModules = [
    importProvidersFrom(
        ModalModule.forRoot(),
        ToastNoAnimationModule.forRoot({ maxOpened: 1, autoDismiss: true }),
        BsDatepickerModule.forRoot(),
        NgCircleProgressModule.forRoot()
    )
];

export const xsrfHeaderName = getWmProjectProperties().xsrf_header_name || "X-WM-XSRF-TOKEN";

export const initializeProjectDetails = () => {
    let cdnUrl = document.querySelector('[name="deployUrl"]') && document.querySelector('[name="deployUrl"]').getAttribute('content');
    _WM_APP_PROJECT.isPreview = cdnUrl ? false : true;
    const apiUrl = document.querySelector('[name="apiUrl"]') && document.querySelector('[name="apiUrl"]').getAttribute('content');
    //for preview
    if (!cdnUrl) {
        cdnUrl = document.querySelector('[name="cdnUrl"]') && document.querySelector('[name="cdnUrl"]').getAttribute('content');
    }
    _WM_APP_PROJECT.id = location.href.split('/')[3];
    // Integration with third party apps like in SSPA/WebComponents, this meta tag with cdnUrl will not be there then default it to ng-bundle/
    _WM_APP_PROJECT.apiUrl = apiUrl || './';
    _WM_APP_PROJECT.cdnUrl = cdnUrl || 'ng-bundle/';
    _WM_APP_PROJECT.ngDest = 'ng-bundle/';
    try {
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        //@ts-ignore
        __webpack_require__.p = __webpack_public_path__ = cdnUrl;
    } catch (e) {
        //for app preview there is no webpack. Don't do anything.
    }
};

export function InitializeApp(I18nService, AppJSResolve, AppBeforeLoadResolve, AppVariablesResolve, AppExtensionJSResolve) {
    return async () => {
        initializeProjectDetails();
        await AppJSResolve.resolve();
        await AppVariablesResolve.resolve();
        await AppExtensionJSResolve.resolve();
        await I18nService.loadDefaultLocale();
        return AppBeforeLoadResolve.resolve();
    };
}

export function setAngularLocale(I18nService) {
    initializeProjectDetails();
    return I18nService.deduceAppLocale();
}

export const appConfig: ApplicationConfig = {
    providers: [
        { provide: HTTP_INTERCEPTORS, useClass: HttpCallInterceptor, multi: true },
        // Provide Angular core services FIRST
        provideRouter(routes, withHashLocation(), withComponentInputBinding()),
        provideAnimations(),
        // Provide XhrFactory using both the class token and our custom token
        { provide: XhrFactory, useClass: BrowserXhrFactory },
        { provide: XHR_FACTORY_TOKEN, useClass: BrowserXhrFactory },
        
        provideHttpClient(
            withXsrfConfiguration({
                cookieName: "wm_xsrf_token",
                headerName: xsrfHeaderName
            }),
            withInterceptorsFromDi(),
            withFetch()
        ),
        
        // Custom renderer overrides (must be early)
        { provide: RendererFactory2, useClass: WMDomRendererFactory2 },
        // Provide HttpService EARLY (AppManagerService needs it)
        { provide: AbstractHttpService, useClass: HttpServiceImpl },
        // Provide base services (before APP_INITIALIZER that depends on them)
        { provide: App, useClass: AppRef },
        { provide: AbstractToasterService, useClass: ToasterServiceImpl },
        { provide: AbstractI18nService, useClass: I18nServiceImpl },
        { provide: AbstractSpinnerService, useClass: SpinnerServiceImpl },
        { provide: AbstractNavigationService, useClass: NavigationServiceImpl },
        { provide: AbstractDialogService, useClass: DialogServiceImpl },
        { provide: AppDefaults, useClass: AppDefaultsService },
        { provide: DynamicComponentRefProvider, useClass: DynamicComponentRefProviderService },
        { provide: AppJSProvider, useClass: AppJSProviderService },
        { provide: AppVariablesProvider, useClass: AppVariablesProviderService },
        { provide: AppExtensionProvider, useClass: AppExtensionProviderService },
        { provide: ComponentRefProvider, useClass: ComponentRefProviderService },
        { provide: PartialRefProvider, useClass: ComponentRefProviderService },
        { provide: CustomWidgetRefProvider, useClass: ComponentRefProviderService },
        { provide: CustomwidgetConfigProvider, useClass: CustomwidgetConfigProviderService },
        { provide: PrefabConfigProvider, useClass: PrefabConfigProviderService },
        { provide: RouteReuseStrategy, useClass: WmRouteReuseStrategy },
        AppResourceManagerService,
        PipeService,
        CustomIconsLoaderService,
        Viewport,
        DecimalPipe,
        SanitizePipe,
        ToDatePipe,
        FilterPipe,
        TrailingZeroDecimalPipe,
        TrustAsPipe,
        ImagePipe,
        CustomPipe,
        Location,
        DatePipe,
        AppManagerService,
        PrefabManagerService,
        AuthGuard,
        RoleGuard,
        PageNotFoundGuard,
        CanDeactivatePageGuard,
        AppJSResolve,
        AppVariablesResolve,
        AppExtensionJSResolve,
        I18nResolve,
        AppBeforeLoadResolve,
        SecurityService,
        OAuthService,
        VariablesService,
        MetadataService,
        // Route reuse strategy cache settings
        { provide: MAX_CACHE_SIZE, useValue: 10 },
        { provide: MAX_CACHE_AGE, useValue: 30 * 60 },
        // Third-party standalone providers
        ...wmModules,
        // APP_INITIALIZER for locale and app initialization
        {
            provide: APP_INITIALIZER,
            useFactory: InitializeApp,
            deps: [AbstractI18nService, AppJSResolve, AppBeforeLoadResolve, AppVariablesResolve, AppExtensionJSResolve],
            multi: true
        },
        // LOCALE_ID will be set by I18n service
        {
            provide: LOCALE_ID,
            useFactory: setAngularLocale,
            deps: [AbstractI18nService]
        }
    ]
};