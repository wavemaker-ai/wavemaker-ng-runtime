# WaveMaker Angular Runtime — Architecture

## Monorepo Structure

The repository is an **Angular workspace** managed via `angular.json`. All publishable packages live under `projects/`. The workspace root contains:

```
angular.json              # Angular workspace config; defines all library projects
package.json              # Workspace-level dependencies
tsconfig.json             # Shared TypeScript config
projects/                 # All library and application projects
  core/
  components/
    base/
    transpile/
    widgets/
      advanced/ basic/ chart/ containers/ data/ dialogs/
      input/ navigation/ page/ prefab/
  variables/
  runtime-base/
  runtime-dynamic/
  security/
  http-service/
  oAuth/
  coverage/               # Coverage aggregation (non-publishable)
  swipey/                 # Touch/swipe gesture library
  jquery.ui.touch-punch/  # jQuery touch polyfill
src/                      # Host application for dev/testing
build-scripts/            # Custom build helpers
build-helpers/
```

---

## Package Descriptions

### `@wm/core` (`projects/core`)

Foundation layer. No Angular component dependencies — pure services, utilities, and types.

**Key exports:**

| Module | Contents |
|--------|----------|
| `enums/enums.ts` | `FormWidgetType`, `DataType`, `MatchMode`, `DEFAULT_FORMATS` |
| `types/types.ts` | `App` abstract class, `IDataSource`, all Abstract service interfaces, `ComponentType`, `Operation` enums |
| `constants/currency-constants.ts` | 180+ currency definitions |
| `utils/utils.ts` | 1000+ lines: browser detection, type checking, date/time, DOM helpers, URL encoding, data manipulation, promise utilities |
| `utils/watcher.ts` | `$watch`, `$unwatch`, `$invokeWatchers`, `muteWatchers`, `$appDigest` — the reactive binding engine |
| `utils/expression-parser.ts` | `$parseExpr`, `$parseEvent` — compile Angular-like expressions to functions |
| `utils/event-notifier.ts` | Pub-sub event bus |
| `utils/id-generator.ts` | Sequential unique ID generator |
| `utils/lru-cache.ts` | Generic LRU cache with TTL |
| `services/viewport.service.ts` | Device/viewport detection; `ViewportEvent.RESIZE` / `ORIENTATION_CHANGE` |
| `services/state-persistence.service.ts` | Widget state in URL / localStorage / sessionStorage |
| `services/script-loader.service.ts` | Dynamic `<script>` injection |
| `services/custom-pipe-manager.service.ts` | Custom Angular pipe registry |
| `utils/build-utils.ts` | `getFormWidgetTemplate()` — generates widget markup during transpilation |

---

### `@wm/components/base` (`projects/components/base`)

Widget framework foundation. All UI components depend on this.

**Key exports:**

| Path | Contents |
|------|----------|
| `widgets/common/base/base.component.ts` | `BaseComponent` — abstract base for all widgets; event system, property change, proxy creation, widget registry |
| `widgets/common/base/stylable.component.ts` | `StylableComponent` — all CSS style properties as Angular inputs |
| `widgets/common/base/base-container.component.ts` | `BaseContainerComponent` — container base with `Widgets` map and redraw support |
| `widgets/framework/widget-proxy-provider.ts` | `WidgetProxyProvider.create()` — wraps widget in ES6 Proxy |
| `widgets/framework/widget-registry.ts` | Global registry by widgetId; `register()`, `getById()` |
| `widgets/framework/property-change-handler.ts` | `globalPropertyChangeHandler` — central change processor |
| `widgets/framework/widget-props.ts` | Per-widget property metadata registry |
| `widgets/framework/styler.ts` | CSS property application; `APPLY_STYLES_TYPE` enum |
| `widgets/framework/constants.ts` | `BOOLEAN_ATTRS`, `DIMENSION_PROPS`, `EVENTS_MAP`, `DISPLAY_TYPE` |
| `widgets/common/container/` | `ContainerDirective` (`[wmContainer]`) |
| `widgets/common/partial/` | `PartialDirective` (`[wmPartial]`), `PartialContainerDirective` |
| `widgets/common/partial-param/` | `PartialParamDirective`, `PartialParamHandlerDirective` |
| `widgets/common/repeat-template/` | `RepeatTemplateDirective` — `*ngFor` item wrapper |
| `widgets/common/item-template/` | `ItemTemplateDirective` — template partial per list item |
| `widgets/common/lazy-load/` | `LazyLoadDirective` — conditional view creation |
| `widgets/common/redraw/` | `RedrawableDirective` — trigger chart/component redraws |
| `widgets/common/dialog/` | `DialogServiceImpl` — open/close/register dialogs |
| `widgets/common/message/` | `MessageComponent` (`[wmMessage]`) |
| `widgets/common/pull-to-refresh/` | Touch pull-to-refresh gesture |
| `directives/show-in-device.directive.ts` | `[wmShowInDevice]` — responsive visibility |
| `pipes/custom-pipes.ts` | `ToDatePipe`, `TrailingZeroDecimalPipe`, `ToNumberPipe` |
| `pipes/trust-as.pipe.ts` | `trustAs` — DomSanitizer bypass |
| `pipes/sanitize.pipe.ts` | `sanitize` — DomSanitizer sanitize |
| `pipes/image.pipe.ts` | `image` — URL processing |
| `utils/widget-utils.ts` | `getEvaluatedData`, `getImageUrl`, `isDataSetWidget`, match modes, nav utils |
| `utils/form-utils.ts` | `getOrderedDataset`, `extractDataAsArray`, group-by options |
| `utils/live-utils.ts` | Row operations column, layout config, edit mode, filter widget selection |
| `utils/data-utils.ts` | `performDataOperation`, `refreshDataSource` |
| `utils/autolayout-utils.ts` | Flex layout alignment and gap utilities |

---

### `@wm/components/transpile` (`projects/components/transpile`)

Build utilities for the runtime-dynamic transpilation step. Exports build definitions for every widget type (selectors, attribute transformations, template wrappers). Also re-exports from the external `@wm/transpiler` package.

---

### Widget Libraries (`projects/components/widgets/*`)

Eleven Angular libraries, each a standalone `ng-package` that declares its own `NgModule`:

| Package suffix | Key widgets |
|----------------|------------|
| `basic` | Anchor, Label, Icon, Picture, Audio, Video, Iframe, HTML, Spinner, Progress (Bar + Circle), Tree, Search, Rich Text Editor, Lottie |
| `input` | Text, Number, Currency, Textarea, Checkbox, Checkboxset, Radioset, Select, Switch, Slider, Rating, Calendar (FullCalendar v5), Color Picker, Chips, File Upload, Button, Button Group, Composite, Epoch |
| `containers` | Accordion, Tabs, Panel, Layout Grid, Linear Layout, Tile, Wizard |
| `data` | Table (with inline/quickedit/dialog editing, server-side sort/filter/pagination), Form (CRUD-aware, nested forms, metadata-driven), List, Live Table, Card, Pagination |
| `dialogs` | Alert, Confirm, Design, Iframe, Login, Partial dialogs |
| `navigation` | Breadcrumb, Menu, Navbar, Popover |
| `advanced` | Carousel, Custom widget, Login form, Marquee |
| `chart` | Chart types via third-party library |
| `page` | Page container, Header, Footer, Left Panel, Right Panel, Top Nav |
| `prefab` | Prefab host component |

All widget components extend `StylableComponent` (from `@wm/components/base`) and implement `onPropertyChange` / `onStyleChange`. Dataset-bound form widgets extend `DatasetAwareFormComponent`.

---

### `@wm/variables` (`projects/variables`)

The complete variable system.

| Path | Contents |
|------|----------|
| `factory/variable.factory.ts` | `VariableFactory.create()` — instantiate correct class by `category` |
| `factory/variable-manager.factory.ts` | `VariableManagerFactory.get()` — retrieve cached manager by type |
| `model/variable/` | WebSocketVariable (extends ApiAwareVariable) |
| `model/action/` | NavigationAction, NotificationAction, LoginAction, LogoutAction (all extend BaseAction) |
| `manager/variable/` | BaseVariableManager, WebSocketVariableManager |
| `manager/action/` | BaseActionManager, NavigationActionManager, NotificationActionManager, LoginActionManager, LogoutActionManager |
| `service/variables.service.ts` | `VariablesService.register()` — parse variables.json, create instances, wire bindings and events |
| `service/metadata-service/` | `MetadataService` — load and query `app-servicedefs.json` (OpenAPI/swagger metadata) |
| `util/variable/` | Model data manipulation (`setData`, `getValue`, `addItem`, etc.) |
| `util/action/` | Navigation execution, OAuth helpers |
| `constants/` | `VARIABLE_CONSTANTS`: categories, events, service types, match modes |
| `advanced-options.ts` | `AdvancedOptions` interface (xhrObj, pagination) |

External base classes (`ModelVariable`, `ServiceVariable`, `LiveVariable`, `CrudVariable`, `TimerAction`, `BaseAction`) come from `@wavemaker/variables`, a separate library.

---

### `@wm/runtime-base` (`projects/runtime-base`)

Core runtime infrastructure. Provides abstract service implementations and base components extended by both runtime modes.

**Components:**

| Class | Role |
|-------|------|
| `AppComponent` | Root Angular component; router outlet with attach/detach hooks; spinner overlay; OAuth dialog |
| `BasePageComponent` | Base for all page components; init sequence, variable firing, fragment monitoring, scroll save/restore, can-deactivate |
| `BasePartialComponent` | Base for partial components; registers with parent's fragment monitor |
| `BasePrefabComponent` | Base for prefab components; loads config, registers properties/events/methods |
| `BaseSpaPageComponent` | SPA variant of BasePageComponent for layout-based navigation |
| `BaseLayoutComponent` | Layout container with nested router outlet |

**Services:**

| Service | Role |
|---------|------|
| `AppRef` (implements `App`) | Central app state; event bus (`subscribe`/`notify`); active page tracking |
| `AppManagerService` | Security config loading, app variable initialization, 401 handling, session timeout |
| `NavigationServiceImpl` | `goToPage`, `goToPrevious`, `goToView` with transition animations |
| `I18nServiceImpl` | Locale bundle loading, timezone, RTL detection, Angular/moment locale init |
| `ToasterServiceImpl` | Toast notifications wrapping ngx-toastr |
| `SpinnerServiceImpl` | Global and context-specific loading spinners |
| `PrefabManagerService` | Lazy load prefab config, styles, scripts, metadata |
| `PipeService` | Pipe registry for use in binding expressions |
| `AppDefaultsService` | Date/time/currency format defaults from locale bundle |
| `HttpCallInterceptor` | Angular `HttpInterceptor`; adds API base URL; invokes `onBeforeServiceCall`, `onServiceSuccess`, `onServiceError` hooks; handles 401 |
| `DynamicComponentRefProviderService` | Abstract implementation placeholder for component factory resolution |

**Guards:** `AuthGuard`, `RoleGuard`, `PageNotFoundGuard`, `CanDeactivatePageGuard`

**Resolves:** `AppJSResolve`, `AppExtensionJSResolve`, `I18nResolve`, `SecurityConfigResolve`, `MetadataResolve`

---

### `@wm/runtime-dynamic` (`projects/runtime-dynamic`)

Extends `runtime-base` with full dynamic compilation.

| File | Role |
|------|------|
| `src/app/app.config.ts` | Angular `ApplicationConfig`; all providers (router, HTTP, interceptors, all runtime services) |
| `src/app/app.routes.ts` | Route definitions with guards and resolves |
| `src/app/components/page-wrapper/` | `PageWrapperComponent` — dynamically creates page component from route name |
| `src/app/services/component-ref-provider.service.ts` | `ComponentRefProviderService` — fetch `page.min.json`, transpile markup, scope styles, compile `NgModule` with `@angular/compiler`, cache factory |
| `src/main.ts` | Entry point: load font config, bootstrap `AppComponent` with `appConfig` |

**Resolves added by runtime-dynamic:** `AppVariablesResolve`, `AppBeforeLoadResolve`

---

### `@wm/security` (`projects/security`)

`SecurityService`: load security config from backend, check authentication, `appLogin`, `appLogout`, role-based page routing, XSRF detection, session management.

---

### `@wm/http-service` (`projects/http-service`)

`HttpServiceImpl`: wraps Angular `HttpClient`; provides `send`, `get`, `post`, `put`, `delete`, `upload`, `jsonp`; session timeout queue (`on401`, `pushToSessionFailureQueue`, `executeSessionFailureRequests`); `WmHttpRequest` / `WmHttpResponse` wrappers.

---

### `@wm/oAuth` (`projects/oAuth`)

`OAuthService` + utilities: supports **Implicit**, **PKCE** (S256 and plain), and **Authorization Code** flows; token storage in localStorage; popup window management; IE11 fallback.

---

## Dependency Graph

```
@wm/core                       (no @wm/* deps)
    │
    ├── @wm/security            → @wm/core
    ├── @wm/http-service        → @wm/core
    ├── @wm/oAuth               → @wm/core, @wm/http-service
    │
    ├── @wm/components/base     → @wm/core
    │       │
    │       ├── @wm/components/transpile  → @wm/components/base, @wm/core
    │       │
    │       └── @wm/components/widgets/* → @wm/components/base, @wm/core
    │
    ├── @wm/variables           → @wm/core, @wm/security, @wm/http-service, @wm/oAuth
    │                             @wavemaker/variables (external)
    │
    └── @wm/runtime-base        → @wm/core, @wm/variables, @wm/components/base,
                │                  @wm/components/widgets/*, @wm/security,
                │                  @wm/http-service, @wm/oAuth
                │
                └── @wm/runtime-dynamic → @wm/runtime-base, @wm/components/transpile,
                                          @angular/compiler (JIT required)
```

---

## Module Composition in runtime-dynamic

`bootstrapApplication(AppComponent, appConfig)` brings together:

```
appConfig (ApplicationConfig)
  ├── provideRouter(routes)           — hash strategy, guards, resolves
  ├── provideHttpClient(interceptors) — HttpCallInterceptor
  ├── provideAnimations()
  ├── App → AppRef
  ├── AbstractToasterService → ToasterServiceImpl
  ├── AbstractI18nService → I18nServiceImpl
  ├── AbstractSpinnerService → SpinnerServiceImpl
  ├── AbstractNavigationService → NavigationServiceImpl
  ├── AbstractHttpService → HttpServiceImpl
  ├── DynamicComponentRefProvider → ComponentRefProviderService
  └── APP_INITIALIZER:
        initializeProjectDetails() — CDN URL, API URL from meta tags
        AppJSResolve.resolve()    — load + exec app.js
        AppVariablesResolve       — security, metadata, app variables
        I18nService.loadDefaultLocale()
        AppBeforeLoadResolve       — onBeforeAppReady() hook
```

---

## Angular-Native App (Non-dynamic Mode)

In production, WaveMaker Studio generates an Angular project where each page is a precompiled component. That project:

- Imports `@wm/runtime-base` but **not** `@wm/runtime-dynamic`
- Uses `AppModule` (or standalone components) with AOT-compiled page components
- Declares page components in `AppModule.declarations` rather than compiling them at runtime
- Does not require `REQUIRED_MODULES_FOR_DYNAMIC_COMPONENTS` pre-declaration
- Has no dependency on `@angular/compiler` at runtime

The base component classes (`BasePageComponent`, `BasePartialComponent`, `BasePrefabComponent`), all services, guards, resolves, and the widget libraries are **identical** between the two modes.

---

## Build System

Each package has an `ng-package.json` defining its entry point and secondary entry points. Build commands:

```bash
./build.sh                   # Build all packages in dependency order
npm run build:runtime        # Build runtime-base + runtime-dynamic
npm run build:components     # Build all component libraries
./bundle-runtime-cli.sh      # Bundle for CDN delivery
./bundle-angular-app-cli.sh  # Bundle for generated Angular app
```

Jest is used for unit testing (`jest.config.js`). Coverage is aggregated via `combine-coverage.js`.
