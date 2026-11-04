# Runtime Lifecycle

Covers the full lifecycle of a WaveMaker Angular application from bootstrap through page, partial, and prefab rendering.

---

## 1. App Bootstrap Sequence (runtime-dynamic)

### 1.1 Entry Point (`main.ts`)

The runtime-dynamic bootstrap entry performs three setup steps before Angular starts:

1. **Font configuration** — loads `font.config.js` to register custom fonts
2. **Custom icons** — `CustomIconsLoaderService.load()` registers any app-defined icon fonts
3. **Debug mode** — reads `sessionStorage.debugMode`; if set, enables verbose logging

Angular is then bootstrapped via:

```typescript
bootstrapApplication(AppComponent, appConfig)
```

### 1.2 `appConfig` Providers

`app.config.ts` wires all providers for the standalone bootstrap:

- Angular Router (hash location strategy)
- `HttpClient` with XSRF protection
- All runtime services: `App`, `AbstractToasterService`, `AbstractI18nService`, `AbstractSpinnerService`, `AbstractNavigationService`, `DynamicComponentRefProvider`
- HTTP interceptor (`HttpCallInterceptor`)
- Animation support and Zone-based change detection

### 1.3 `APP_INITIALIZER` Sequence

Before any component renders, Angular runs the following resolves in order:

| Step | Resolver | What It Does |
|------|----------|--------------|
| 1 | `initializeProjectDetails()` | Reads `<meta>` tags for CDN URL and API URL; populates `_WM_APP_PROJECT`; sets webpack `__webpack_public_path__` |
| 2 | `AppJSResolve` | Fetches and executes `app.js` (user-authored app initialization script) |
| 3 | `AppVariablesResolve` | Loads security config → metadata → app-level variables; initializes app variables |
| 4 | `AppExtensionJSResolve` | Loads `app-extensions.js` (custom formatters, pipes) |
| 5 | `I18nResolve` | Calls `I18nService.loadDefaultLocale()` — loads locale bundle, moment locale, Angular locale data |
| 6 | `AppBeforeLoadResolve` | Invokes `appManager.beforeAppReady()` → fires user's `onBeforeAppReady` hook |

### 1.4 AppComponent Initialization

Once Angular renders `AppComponent`:

- **Router outlet override**: `attach()` and `detach()` are monkey-patched so every page component's `ngOnAttach()` / `ngOnDetach()` is called on route reuse
- **Global spinner subscription**: listens for `toggle-variable-state` events to show/hide the app spinner
- **OAuth dialog** listener: watches for OAuth authorization requests
- **Navigation progress**: subscribes to router events to show progress indicator
- **`ngAfterViewInit`**: applies locale direction (RTL/LTR), calls `App.start()`, sets up skip-to-main-content link

---

## 2. Page Lifecycle

### 2.1 Dynamic Compilation (`ComponentRefProvider`)

When the router navigates to a page, `PageWrapperComponent.loadPage(pageName)` is called, which delegates to `ComponentRefProvider.getComponentFactoryRef(pageName, ComponentType.PAGE)`:

```
1. Check componentFactoryRefCache → return if cached
2. Load ./pages/{pageName}/page.min.json
   → Contains: markup, script, styles, variables JSON, config
3. Transpile markup (WaveMaker template syntax → Angular template)
4. Scope component styles
5. Parse variables JSON
6. Create DynamicComponent class extending BasePageComponent
   - evalUserScript() executes the page script
   - getVariables() returns parsed variables
7. Create NgModule with all REQUIRED_MODULES_FOR_DYNAMIC_COMPONENTS
8. compiler.compileModuleAndAllComponentsSync(moduleDef)
9. Cache and return ComponentFactory
```

The compiled component factory is cached per page name so subsequent navigation to the same page is instantaneous.

### 2.2 `BasePageComponent.init()` Sequence

After the component is created by the ViewContainerRef, `init()` runs:

```
1.  muteWatchers()               — Suppress watcher notifications during init
2.  Inject services               — App, Route, AppManager, Navigation, etc.
3.  registerExpressions()         — Compile and register bind expressions
4.  initUserScript()              — Execute page script (sets up user callbacks)
5.  registerWidgets()             — Build the Widgets object from page DOM
6.  initVariables()               — Create all Variable/Action instances, process bindings
7.  App.activePageName = name     — Track current page
8.  App.activePage = this         — Track current page instance
9.  registerPageParams()          — Subscribe to route queryParams → update page params
10. defineI18nProps()             — Expose appLocale reference
11. super.init()                  — Calls FragmentMonitor.init()
```

### 2.3 Variable Firing and Content Display

After `ngAfterViewInit()`, `viewInit$` completes and triggers:

```
IF app variables have not yet been fired:
    Fire all app-level Variables/Actions (startUpdate=true)
    Mark app variables as fired (once per app session)

Fire all page-level Variables/Actions (startUpdate=true)

After 100ms delay:
    showPageContent = true   → page content becomes visible
```

### 2.4 Page Lifecycle Hooks

All hooks are user-overridable methods on the generated page class:

| Hook | When Called | Notes |
|------|-------------|-------|
| `onBeforePageReady()` | `ngAfterContentInit` | Before variables fire; good for early setup |
| `onPageContentReady()` | When `compilePageContent = true` | Template compiled and rendered |
| `onReady()` | After all fragments (partials/prefabs) resolve | Main user hook; all data available |
| `onBeforePageLeave()` | Before navigation away | Return `false` to block navigation |

### 2.5 Page Transitions

When navigating between pages, `NavigationService.runPageTransition(transition)` plays a CSS animation. Available transitions: slide, fade, pop, flip, turn, flow, slideover, reveal, none.

---

## 3. Page Attach/Detach (Route Reuse / Caching)

Pages can be cached in the router outlet and reused. The `AppComponent` router outlet override calls Angular lifecycle extensions on the page component:

### `ngOnAttach()` (page re-enters viewport)

1. Restore scroll position saved at detach
2. `unMuteWatchers()` — resume all watchers
3. For every variable with `refreshdataonattach = true`: re-invoke the variable
4. Restore widget state (e.g., expanded panels)
5. Highlight active navigation links
6. Emit `pageAttach` app event

### `ngOnDetach()` (page leaves viewport)

1. Save current scroll position
2. `muteWatchers()` — pause all watchers (prevents background network calls)
3. Notify app of detach
4. Emit `pageDetach` app event

### `CanDeactivatePageGuard`

Called by the router before navigating away from any page:

1. Calls `page.onBeforePageLeave()`
2. If it returns `false`, navigation is blocked
3. Optionally shows a confirmation dialog before allowing navigation

---

## 4. Partial Lifecycle

Partials are reusable content fragments embedded inside pages, other partials, or prefabs.

### 4.1 Embedding a Partial

```html
<div wmPartial name="Header"></div>
```

`PartialDirective` renders the partial shell; `PartialContainerDirective` handles the dynamic loading:

1. `renderPartial(partialName)` (debounced 200ms) calls `ComponentRefProvider.getComponentFactoryRef(name, ComponentType.PARTIAL)`
2. Same compilation pipeline as pages (partial.min.json)
3. Component created in ViewContainerRef and appended to DOM

### 4.2 `BasePartialComponent.init()` Differences from Page

- No page transition animations
- No `CanDeactivateGuard`
- No `App.activePageName` update
- Variables inherit from the page scope (partials do not have their own variable namespace at the route level)
- `registerFragment(this)` called on the **parent page's** fragment monitor immediately after init

### 4.3 Partial Parameters

Parameters are passed into a partial via `wmParam` directives:

```html
<div wmPartial name="ItemDetail">
  <div wmParam name="itemId" [value]="selectedItem.id"></div>
</div>
```

`PartialParamHandlerDirective` creates a `partialParams` object and a `params$` Subject. `PartialParamDirective` registers each param. The partial script accesses params via `Variables.pageParams.dataSet`.

### 4.4 Fragment Resolution

After `viewInit$` completes on a partial:

1. Scripts load
2. Partial calls `resolveFragment(this)` on the parent fragment monitor
3. The parent's `fragmentsLoaded$` tracks all registered fragments
4. When all fragments resolve, the parent (page or outer partial) calls `invokeOnReady()`

---

## 5. Prefab Lifecycle

Prefabs are self-contained, reusable widget bundles with their own properties, events, and methods.

### 5.1 Dynamic Loading

```html
<section wmPrefab prefabname="DateRangePicker"></section>
```

`PrefabDirective` intercepts the `prefabname` attribute and:

1. Calls `PrefabManagerService.loadDependencies(prefabName)`:
   - `getConfig()` — fetches `prefab-config.json` (properties, events, methods definitions)
   - `loadServiceDefs()` — loads prefab's swagger metadata
   - `loadStyles()` — injects prefab CSS into document
   - `loadScripts()` — loads prefab JS dependencies
2. Calls `ComponentRefProvider.getComponentFactoryRef(name, ComponentType.PREFAB)`
   - Loads `prefab.min.json` from `./prefabs/{prefabName}/`
   - Compiles `BasePrefabComponent` subclass
3. Creates component and appends to container element

### 5.2 `BasePrefabComponent.init()` — Property Registration

The unique step vs. page/partial is `registerProps()`:

```
For each property in prefab config:
    Create getter on prefab instance → reads internal value
    Create setter on prefab instance → triggers $appDigest
    If property has bind expression → install watcher

For each event in prefab config:
    Create event handler → invokes registered callback on container widget

For each method in prefab config:
    Expose method on the container widget (accessible to the host page)
```

### 5.3 Property Change Listening

`ngAfterViewChecked()` runs `registerChangeListeners()` once (guarded by flag):

- Iterates prefab properties
- For each bound property on the host, installs a watcher to propagate changes inward

### 5.4 Prefab Load Event

After `viewInit$` completes and `onReady()` fires, the prefab emits a `load` event on the container widget. This allows the host page script to react to the prefab being fully initialized.

---

## 6. Fragment Monitoring

Fragment monitoring ensures that a page's `onReady()` hook is not called until all embedded partials and prefabs have fully initialized.

### 6.1 Contract

- **`registerFragment(fragmentInstance)`** — called by a partial/prefab as soon as its `init()` runs; increments the pending counter in the parent's monitor
- **`resolveFragment(fragmentInstance)`** — called after `viewInit$` and scripts complete; decrements the counter

### 6.2 `fragmentsLoaded$` Observable

The parent (page or containing partial) holds a `fragmentsLoaded$` Subject. It tracks:

- How many fragments have been registered
- How many have resolved

When `registeredCount === resolvedCount && viewInitComplete`, `fragmentsLoaded$` completes, which triggers `invokeOnReady()`.

### 6.3 Nested Partials

A partial can itself contain partials. Each level:

1. Registers itself with its **direct parent**
2. Maintains its own fragment monitor for its children
3. Resolves to its parent only after **its own children** resolve

This creates a bottom-up cascade: deepest partials resolve first, bubbling up until the page resolves last.

---

## 7. Lifecycle Hook Reference

### App-Level Hooks (in `App` service / `app.js`)

| Hook | Trigger | Signature |
|------|---------|-----------|
| `onBeforeAppReady()` | After all APP_INITIALIZERs, before first page load | `() => void` |
| `onAppVariablesReady()` | After app variables have fired for the first time | `() => void` |
| `onPageReady(pageName, pageInstance)` | After any page's `onReady()` fires | `(name: string, page: any) => void` |
| `onBeforeServiceCall(wmRequest)` | Before every outbound HTTP call | `(req) => req \| void` |
| `onServiceSuccess(data, wmResponse)` | After every successful HTTP response | `(data, res) => data \| void` |
| `onServiceError(error, wmResponse)` | After every failed HTTP response | `(err, res) => err \| void` |
| `onSessionTimeout()` | On 401 session timeout | `() => void` |

### Page-Level Hooks (in page script)

| Hook | Trigger | Signature |
|------|---------|-----------|
| `onBeforePageReady()` | `ngAfterContentInit` (before variables fire) | `() => void` |
| `onPageContentReady()` | Template compiled and rendered | `() => void` |
| `onReady()` | All fragments loaded, variables fired | `() => void` |
| `onBeforePageLeave()` | Before navigation away | `() => boolean \| void` |

### App Events (subscribe/notify pattern)

| Event Name | Emitter | Payload |
|-----------|---------|---------|
| `pageReady` | AppManager | `{ pageName }` |
| `pageAttach` | BasePageComponent | `{ pageName }` |
| `pageDetach` | BasePageComponent | `{ pageName }` |
| `userLoggedIn` | LoginActionManager | user info |
| `userLoggedOut` | LogoutActionManager | — |
| `http401` | HttpCallInterceptor | response |
| `toggle-variable-state` | Variable managers | `{ variable, active }` |
| `app-variables-data-loaded` | AppManager | — |
| `page-variables-data-loaded` | AppManager | — |
| `locale-changed` | I18nService | `{ locale }` |
