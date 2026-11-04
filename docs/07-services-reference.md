# Services Reference

All injectable services in the WaveMaker Angular runtime. Organized by package.

---

## Package: `@wm/runtime-base`

### AppRef (`app.service.ts`)

Central application state holder and event bus. Injected everywhere as the `App` token.

**Key Properties**

| Property | Type | Description |
|----------|------|-------------|
| `Variables` | `object` | App-scoped variable instances |
| `Actions` | `object` | App-scoped action instances |
| `activePage` | `BasePageComponent` | Currently active page component |
| `activePageName` | `string` | Name of the active page |
| `lastActivePageName` | `string` | Previously active page name |
| `Widgets` | `object` | Widgets of the current active page (for expressions) |
| `appLocale` | `object` | Current locale message bundle |
| `selectedViewPort` | `object` | Device viewport info |
| `modes` | `object` | Active app modes (dark/light/etc.) |

**Methods**

```typescript
subscribe(eventName: string, callback: Function): Function
// Subscribe to app events. Returns an unsubscribe function.

notify(eventName: string, data?: any): void
// Emit an app event to all subscribers.

getDependency<T>(injectionToken: any): T
// Retrieve an Angular service from the root injector.

registerExpressions(expressions: object): void
// Register compiled bind-expression functions.

setMode(modes: object, shouldPersist?: boolean): void
// Set one or more app modes; optionally persist across sessions.

clearPageCache(pageName: string): void
// Evict a page from the route-reuse cache.

importModule(moduleName: 'moment' | 'moment-tz'): Promise<any>
// Lazy-load moment or moment-tz.

reload(): void
// Hard-reload the page.
```

---

### AppManagerService (`app.manager.service.ts`)

Orchestrates app-level data loading, authentication, and lifecycle events. Bridges between the HTTP interceptor and the App service.

**Methods**

```typescript
loadSecurityConfig(forceFlag?: boolean): Promise<any>
// Load (or force-reload) security configuration from the backend.

loadMetadata(): Promise<any>
// Load service metadata (swagger/OpenAPI definitions).

loadAppVariables(variables?: any): Promise<any>
// Parse and initialize app-scoped variables. If variables JSON is provided,
// skips the network fetch.

isAppVariablesFired(isFired?: boolean): boolean
// Get or set whether app variables have fired for this session.

handle401(page: string, options?: object): void
// Handle a session timeout: show login dialog or redirect to login page.

reloadAppData(): Promise<any>
// Reload security config, metadata, and app variables after re-login.

executeSessionFailureRequests(): void
// Retry all HTTP requests that were queued during session timeout.

noRedirect(value?: boolean): boolean
// Get or set whether post-login redirect should be suppressed.

// App lifecycle callbacks — called around every HTTP request:
appOnBeforeServiceCall(wmRequest: WmHttpRequest): WmHttpRequest | void
appOnServiceSuccess(data: any, wmResponse: WmHttpResponse): any | void
appOnServiceError(error: any, wmResponse: WmHttpResponse): any | void

beforeAppReady(): void
// Invokes the user's onBeforeAppReady() hook in app.js.

appVariablesReady(): void
// Invokes the user's onAppVariablesReady() hook in app.js.
```

**Key Events Handled**

| Event | Action |
|-------|--------|
| `userLoggedIn` | Reloads app data, resumes session failure requests |
| `userLoggedOut` | Clears user state |
| `http401` | Queues requests, triggers login flow |
| `toggle-variable-state` | Shows/hides global spinner |

---

### NavigationServiceImpl (`navigation.service.ts`)

Handles all page and view navigation. Implements `AbstractNavigationService`.

**Methods**

```typescript
goToPage(pageName: string, options?: {
  transition?: string;       // Animation name (slide, fade, pop, flip, etc.)
  urlParams?: object;        // Query params passed to target page
  viewName?: string;         // Named view within the page
}): void

goToPrevious(): void
// Navigate to the previous history entry.

goToView(viewName: string, options?: object, variable?: any): void
// Scroll the viewport to a named element/anchor on the current page.

getPageTransition(): string
// Return the current active transition name.
```

**Notes**
- All navigation is router-based; `goToPage()` calls `router.navigate([/pageName], { queryParams })`
- History is maintained internally for `goToPrevious()` (does not rely solely on browser history)

---

### I18nServiceImpl (`i18n.service.ts`)

Manages locale bundles, moment locale data, and Angular locale initialization. Implements `AbstractI18nService`.

**Methods**

```typescript
loadDefaultLocale(): Promise<void>
// Load the app's default locale bundle and all associated locale data.
// Sequence: bundle → moment locale → Angular locale → ngx-bootstrap config → direction update

setSelectedLocale(locale: string): Promise<void>
// Switch the active locale at runtime. Triggers 'locale-changed' event.

getSelectedLocale(): string
// Return the currently active locale code (e.g., 'en', 'de', 'ar').

getAppLocale(): object
// Return the full message bundle for the current locale.

getLocalizedMessage(message: string, ...args: any[]): string
// Resolve a message key against the locale bundle, with optional interpolation args.

setTimezone(locale: string, compInstance: any): void
// Set the active timezone from locale or moment-tz data.

getTimezone(compInstance: any): string
// Return the active timezone string.

getFormatsByLocale(): { dateFormat: string; timeFormat: string; dateTimeFormat: string }
// Return date/time format strings defined in the locale bundle.

updateLocaleDirection(): void
// Set dir="rtl" or dir="ltr" on the document root based on locale.

getPrefabLocaleBundle(prefabName: string): object
// Return the locale bundle for a specific prefab.

initCalendarLocale(locale: string): void
// Initialize FullCalendar locale data.
```

---

### ToasterServiceImpl (`toaster.service.ts`)

Shows toast notifications. Implements `AbstractToasterService`.

**Methods**

```typescript
success(title: string, desc?: string): void
// Show a success toast. Auto-hides after 5 seconds.

error(title: string, desc?: string): void
// Show an error toast. Does not auto-hide.

info(title: string, desc?: string): void
// Show an info toast. Does not auto-hide.

warn(title: string, desc?: string): void
// Show a warning toast. Does not auto-hide.

show(type: string, title: string, desc?: string, options?: object): void
// Show a toast with explicit options (type, duration, position, etc.).

hide(toasterObj?: any): void
// Hide a specific toast, or all toasts if no argument is given.

showCustom(page: string, options?: object): void
// Show a partial page as custom toast content.

setToasterConfig(options: object): void
// Set global toaster defaults (position, timeout, limit, etc.).
```

---

### SpinnerServiceImpl (`spinner.service.ts`)

Manages loading spinner visibility. Implements `AbstractSpinnerService`.

**Methods**

```typescript
show(message?: string, id?: string, spinnerClass?: string,
     spinnerContext?: string, variableScopeId?: string): void
// Show the app-level spinner, or a context spinner if spinnerContext is provided.
// id is used to group/layer multiple concurrent spinners.

hide(id: string): void
// Hide the spinner matching the given id.

showContextSpinner(ctx: any, message?: string, id?: string): void
// Show a spinner overlaid on a specific DOM element.

hideContextSpinner(ctx: any, id?: string): void
// Hide the spinner from a specific DOM element.

getMessageSource(): Observable<{ message: string; active: boolean }>
// Observable stream of spinner state changes (for the wmSpinner widget).
```

---

### PrefabManagerService (`prefab-manager.service.ts`)

Loads and caches all prefab resources.

**Methods**

```typescript
getConfig(prefabName: string): Promise<object>
// Load (and cache) prefab-config.json: property, event, and method definitions.

loadServiceDefs(prefabName: string): Promise<void>
// Load prefab swagger/metadata for variable API calls.

loadStyles(prefabName: string, config: object): Promise<void>
// Inject prefab CSS stylesheets into the document.

loadScripts(prefabName: string, config: object): Promise<void>
// Load prefab JS script dependencies.

loadDependencies(prefabName: string): Promise<void>
// Convenience: runs all four above in order.
```

---

### PipeService (`pipe.service.ts`)

Provides Angular pipe instances for use inside expression evaluation.

**Provided Pipes**

| Name | Usage |
|------|-------|
| `toDate` | Format a value as a date string |
| `toCurrency` | Format a value as currency |
| `prefix` | Prepend a string prefix |
| `suffix` | Append a string suffix |
| `numberToString` | Convert number → string |
| `stringToNumber` | Parse string → number |
| `timeFromNow` | Relative time (e.g., "3 days ago") |
| `trustAs` | Bypass Angular security (html, url, etc.) |
| `sanitize` | Sanitize content through DomSanitizer |
| `custom` | App-defined custom pipes (via CustomPipeManager) |

---

### AppDefaultsService (`app-defaults.service.ts`)

Stores app-wide format defaults. Values are populated from the locale bundle.

**Properties**

| Property | Type | Default |
|----------|------|---------|
| `dateFormat` | `string` | `'yyyy-MM-dd'` |
| `timeFormat` | `string` | `'HH:mm:ss'` |
| `dateTimeFormat` | `string` | `'yyyy-MM-dd HH:mm:ss'` |
| `currencyCode` | `string` | `'USD'` |

---

### HttpCallInterceptor (`http-interceptor.services.ts`)

Angular HTTP interceptor that processes every outbound request and response.

**Request Pipeline**

1. Convert relative URLs to absolute (prepend API base URL)
2. Call `appManager.appOnBeforeServiceCall(wmRequest)` — allows user to modify request
3. Forward modified request

**Response Pipeline (Success)**

1. Convert Angular response → `WmHttpResponse`
2. Call `appManager.appOnServiceSuccess(data, wmResponse)` — allows user to modify data
3. Return modified response

**Response Pipeline (Error)**

1. Convert Angular error → `WmHttpResponse`
2. Check if status is 401 → if yes, call `appManager.handle401()`
3. Call `appManager.appOnServiceError(error, wmResponse)` — allows user to modify error
4. Return modified error

---

## Package: `@wm/security`

### SecurityService (`security.service.ts`)

Manages authentication state, session handling, and role-based page routing.

**Methods**

```typescript
load(forceFlag?: boolean): Promise<any>
// Load security configuration from the backend. Cached after first call.
// Pass forceFlag=true to bypass the cache.

isLoaded(): boolean
// Check whether security config has been loaded.

get(): object
// Return the raw security configuration object.

isAuthenticated(success?: Function, failure?: Function): Promise<boolean>
// Check whether the current user is authenticated.

getLoggedInUser(): Promise<object>
// Return a promise resolving to the logged-in user's info (name, roles, etc.).

onUserLogin(): Promise<void>
// Promise that resolves the next time a user successfully logs in.

appLogin(params: {
  j_username: string;
  j_password: string;
  j_rememberme?: boolean;
}, success?: Function, failure?: Function): Promise<any>
// Perform form-based login.

appLogout(success?: Function, failure?: Function): Promise<any>
// Log out the current user.

getPageByLoggedInUser(): Promise<string>
// Return the landing page name based on the user's role configuration.

loadPageByUserRole(forcePageLoad?: boolean): void
// Navigate to the appropriate page for the current user's role.

navigateOnLogin(): void
// Navigate to the user's landing page after login.

isXsrfEnabled(): boolean
// Check whether XSRF token protection is enabled.

getCookieByName(name: string): string
// Retrieve a cookie value by name (used for XSRF token).
```

---

## Package: `@wm/http-service`

### HttpServiceImpl (`http.service.ts`)

Wraps Angular `HttpClient` with WaveMaker-specific request/response models. Implements `AbstractHttpService`.

**Methods**

```typescript
send(options: object): Promise<any>
// Generic HTTP request returning a Promise.

sendCallAsObservable(options: object, params?: object): Observable<any>
// Returns an Observable (cancellable) HTTP request.

get(url: string, options?: object): Promise<any>
post(url: string, data?: any, options?: object): Promise<any>
put(url: string, data?: any, options?: object): Promise<any>
patch(url: string, data?: any, options?: object): Promise<any>
delete(url: string, options?: object): Promise<any>
head(url: string, options?: object): Promise<any>
jsonp(url: string, options?: object): Promise<any>

upload(url: string, data: FormData, options?: object): Promise<any>
// File upload with progress tracking.

uploadFile(url: string, data: FormData, variable: any, options?: object): Promise<any>
// Upload with progress emitted back to the variable.

registerOnSessionTimeout(callback: Function): Function
// Register a callback for 401 session timeout. Returns an unsubscribe function.

on401(): void
// Trigger all registered session timeout handlers.

pushToSessionFailureQueue(callback: Function): void
// Queue an HTTP call for retry after re-authentication.

executeSessionFailureRequests(): void
// Flush the session failure queue, retrying all queued requests.

cancel(variable: any, file?: any): void
// Cancel in-flight request associated with the given variable.

setLocale(locale: string): void
getLocale(): string
```

**Request/Response Models**

- `WmHttpRequest` — wraps Angular `HttpRequest`; properties: `method`, `url`, `headers`, `body`, `responseType`, `withCredentials`
- `WmHttpResponse` — extends `WmHttpRequest`; adds `ok`, `status`, `statusText`, `error`, `message`

---

## Package: `@wm/variables`

### MetadataService (`metadata.service.ts`)

Loads and indexes service operation metadata (swagger/OpenAPI) and OAuth provider configuration.

**Methods**

```typescript
load(prefabName?: string): Promise<any>
// Load app-servicedefs.json (or {prefab}-prefab-servicedefs.json).
// Populates internal metadataMap and providerMap.

isLoaded(): boolean
// Check whether metadata has been loaded for the app context.

getByOperationId(operationId: string, context?: string): object
// Return wmServiceOperationInfo for a specific operation ID.

getByProviderId(providerId: string, context?: string): object
// Return the OAuth provider configuration for the given provider ID.

getByCrudId(crudId: string, context?: string): object[]
// Return all operations that share the given CRUD operation ID.
```

**Metadata Shape**

```typescript
{
  [operationId: string]: {
    wmServiceOperationInfo: {
      relativePath: string;
      method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
      parameters: Array<{
        name: string;
        type: string;
        required: boolean;
        parameterType: 'path' | 'query' | 'header' | 'body';
      }>;
      paginationInfo?: {
        type: 'offset' | 'page' | 'cursor';
        input: object;
        output: object;
      };
    };
    crudOperationId?: string;
  }
}
```

### VariablesService (`variables.service.ts`)

Central service for variable/action registration and scope management.

**Methods**

```typescript
register(page: string, variablesJson: any, scope: any): {
  Variables: object;
  Actions: object;
  callback: Function; // call to trigger startUpdate variables
}
// Parse variablesJson, create all Variable/Action instances via VariableFactory,
// attach event handlers, set up data bindings, and separate into Variables/Actions.
// Registers a scope destroy listener to cancel and clean up all variables.

processBinding(variable: any, context: any,
               bindSource?: string, bindTarget?: string): void
// Walk the variable's dataBinding config and set up $watch expressions
// for any "bind:" prefixed values.

bulkCancel(collection: object): void
// Cancel all in-flight requests in a variable collection (called on scope destroy).

triggerStartUpdate(collection: object): void
// Invoke all variables/actions in a collection that have startUpdate = true.
```

---

## Package: `@wm/oAuth`

### OAuthService (`oAuth.service.ts`)

Manages OAuth 2.0 provider configuration and initiates authorization flows.

**Methods**

```typescript
getOAuthProvidersAsObservable(): Observable<object[]>
// Observable stream of registered OAuth provider configs.

addProviderConfig(provider: object): void
// Register a new OAuth provider configuration.

removeProviderConfig(providerId: string): void
// Remove a provider configuration by ID.

performOAuthorization(
  url: string,
  providerId: string,
  onSuccess: Function,
  onError: Function,
  securityObj?: object,
  customUriScheme?: string,
  deployedURL?: string
): void
// Launch the OAuth authorization flow in a popup window.
// Supports Implicit, PKCE, and Authorization Code flows.

getAccessToken(provider: string, checkLocalStorage?: boolean): string | null
// Retrieve a stored OAuth access token from localStorage.

removeAccessToken(provider: string): void
// Clear the stored access token for the given provider.
```

**Supported OAuth Flows**

| Flow | Description |
|------|-------------|
| Implicit | Direct token in redirect URL fragment |
| PKCE | Code + code_verifier; supports `plain` and `S256` challenge methods |
| Authorization Code | Standard code exchange via backend |

---

## Package: `@wm/core`

### ViewportService (`viewport.service.ts`)

Tracks device viewport and orientation.

**Events (`ViewportEvent` enum)**

| Value | Description |
|-------|-------------|
| `RESIZE` | Window resize event |
| `ORIENTATION_CHANGE` | Device orientation changed |

**Properties**

```typescript
orientation: { isPortrait: boolean; isLandscape: boolean }
isMobileType: boolean   // viewport width < 768px
isTabletType: boolean   // viewport width 768–991px
```

**Methods**

```typescript
subscribe(event: ViewportEvent, callback: Function): Function
// Subscribe to viewport events. Returns unsubscribe function.

notify(event: ViewportEvent): void
// Manually trigger a viewport event.

update(): void
// Recalculate viewport properties from current window dimensions.
```

---

### StatePersistenceService (`state-persistence.service.ts`)

Persists and restores widget state across navigation using URL, localStorage, or sessionStorage.

**Persistence Modes**

| Mode | Storage |
|------|---------|
| `url` | URL query parameters |
| `localStorage` | Browser localStorage |
| `sessionStorage` | Browser sessionStorage |

**Methods**

```typescript
setHistoryHandler(val: 'push' | 'replace'): void
// Choose whether to push a new history entry or replace the current one
// when persisting to URL.

getWidgetState(widget: any, mode: string): any
// Retrieve the persisted state for a given widget instance.

getStateInformation(mode: string): any
// Retrieve raw state information from the specified storage mode.

getNestedPath(): string
// Construct a unique hierarchical key for the current widget context
// (page > partial > widget-name).

computeMode(): string
// Validate and return the resolved persistence mode.
```

**Note**: Not supported for `On-Demand` and `Scroll` navigation modes.

---

## Package: `@wm/runtime-base` (Dialog)

### DialogServiceImpl (`dialog.service.ts`)

Manages all dialog instances across pages and prefabs.

**Methods**

```typescript
register(name: string, dialogRef: any, scope: any): void
// Register a dialog instance. Supports multiple instances of the same
// dialog name in different scopes (e.g., inside a repeater).

deRegister(name: string, scope: any): void
// Unregister a dialog instance when its scope is destroyed.

getDialogRef(name: string, scope?: any): any
// Retrieve the dialog reference closest to the given scope.

open(name: string, scope?: any, initState?: object): void
// Open a named dialog. initState populates initial property values.

close(name: string, scope?: any, returnVal?: any): void
// Close a named dialog, optionally passing a return value.

confirm(message: string, scope?: any): Promise<boolean>
// Show the built-in confirm dialog. Resolves true (OK) or false (Cancel).

alert(message: string, scope?: any): Promise<void>
// Show the built-in alert dialog.

getDialogRefsCollection(): Map<string, Map<any, any>>
// Return the full registry of all dialogs.
```
