# WaveMaker Angular Runtime — Constraints & Design Decisions

This document captures architectural constraints, deliberate design decisions, and known limitations of the WaveMaker Angular runtime. Understanding these is essential for extending the framework, debugging edge cases, or designing new features.

---

## 1. Dynamic Compilation Requires Full Module Pre-declaration

**Constraint:** `runtime-dynamic` compiles page/partial/prefab components at runtime using the Angular JIT compiler. The compiler requires all referenced directives, components, and pipes to be declared in the dynamically-created `NgModule` at compile time.

**Implication:** `REQUIRED_MODULES_FOR_DYNAMIC_COMPONENTS` (in `runtime-dynamic`) is a hardcoded list of every framework component, directive, pipe, and module that a page template might use. **Every new widget, directive, or pipe added to the framework must also be added to this list**, or it will throw a compilation error at runtime when first used in a page.

**Does not apply to:** The Angular-native (AOT) generated app, which uses standard NgModule declarations or standalone component imports.

---

## 2. Fragment Monitoring Blocks Page Ready

**Constraint:** A page's `onReady()` lifecycle hook fires **only after every nested partial and prefab has fully initialized**. This is enforced by `FragmentMonitor`. Each partial/prefab registers itself as a fragment, loads its resources asynchronously, and calls `resolveFragment()` when done. The page waits on all fragment promises before invoking `onReady`.

**Implication:**
- A slow-loading or erroring partial blocks the entire page's `onReady`
- Partials inside conditionally-rendered containers (`*ngIf`) that start hidden still register as fragments if they are present in the template — this can delay `onReady` for content the user hasn't even seen
- Deep nesting (partial inside a partial) creates a chain of fragment monitors; each level must fully resolve before the parent resolves

---

## 3. Variable Scope is Page-Bounded — No Cross-Page Sharing

**Constraint:** Variables are either **App-scoped** (initialized once at bootstrap) or **Page-scoped** (initialized on each page load and destroyed on navigation away).

**Implication:**
- There is no built-in mechanism to share variable state between two sibling pages (e.g., passing complex objects from Page A to Page B)
- URL query parameters are the only native mechanism for passing data between pages at navigation time (via `NavigationAction.dataSet`)
- App-scoped Model variables can be used as a session state store, but they are single-instance and not isolated per navigation context
- On page re-attach (from Angular's route reuse cache), page variables are **not** re-initialized from scratch; they resume from their last state unless `refreshdataonattach` is set

---

## 4. Watcher-Based Binding Has Synchronous Execution Cost

**Constraint:** All `bind:` expressions create watchers managed by `$watch` in `@wm/core`. These watchers run **synchronously** on every Angular change detection cycle via `$invokeWatchers`.

**Implication:**
- Computationally heavy expressions in `bind:` attributes (deep object traversal, large array operations) degrade rendering performance proportionally to the number of widgets using those expressions
- Every page load mutes all watchers during initialization (`muteWatchers()`) and unmutes them after (`unMuteWatchers()`). Code that triggers change detection during the muted window will not propagate property changes
- Angular's default `ChangeDetectionStrategy.Default` is used throughout; there is no `OnPush` optimization on widget components
- The watcher system tracks the identity of the last value via `JSON.stringify`-like cloning; binding to large, frequently-updated objects generates allocation pressure

---

## 5. CSS Scoping Is Automatic — Global Styles Must Use app.css

**Constraint:** When a page's CSS is loaded from `page.min.json`, it is automatically scoped with a per-page attribute selector to prevent style leakage across pages.

**Implication:**
- Styles defined inside a page's CSS file only affect DOM rendered inside that page's component
- Styles intended to be globally available must be placed in `app.css` (or loaded via a global stylesheet)
- Prefab styles are similarly scoped to their prefab component boundary
- Angular's `ViewEncapsulation` is not used for this; WaveMaker implements its own CSS scoping at the string-transformation level in `ComponentRefProviderService`

---

## 6. All Cleanup Must Happen in ngOnDestroy

**Constraint:** The framework makes no attempt to auto-clean subscriptions, event listeners, or DOM references. Every component, directive, and service is responsible for explicit cleanup in `ngOnDestroy`.

**Established patterns in the codebase:**
- RxJS `Subscription` objects stored and `.unsubscribe()` called in `ngOnDestroy`
- `Subject`s completed (`.complete()`) to release all subscribers
- Map and array references set to `null` or `undefined`
- DOM event listeners removed (especially for resize, orientation change, media query)
- `ViewContainerRef` cleared on directive destroy
- Debounced function cancellation tokens stored and cancelled

**Implication for new code:** Any new directive, component, or service that subscribes to an Observable, adds a DOM event listener, or holds component references **must** implement `OnDestroy` and clean up. Omitting this causes memory leaks in the SPA that compound across page navigations.

---

## 7. No Native Angular Lazy Loading in runtime-dynamic

**Constraint:** `runtime-dynamic` does not use Angular's built-in lazy-loaded route modules (`loadChildren`). All pages are loaded through `ComponentRefProviderService`, which fetches and compiles them on demand.

**Implication:**
- Angular's lazy module splitting at build time does not apply
- The entire framework (`REQUIRED_MODULES_FOR_DYNAMIC_COMPONENTS`) is eagerly loaded at startup
- Component factory caching (`componentFactoryRefCache`) provides the lazy-load performance benefit at runtime, not at build time
- Tree-shaking of unused widget code does not happen in this mode — all widgets are bundled

**In the generated Angular app** (AOT mode), standard Angular route-level lazy loading can be used for pages.

---

## 8. Hash-Based Routing

**Constraint:** `runtime-dynamic` uses `HashLocationStrategy`. All page URLs take the form `/#/PageName?queryParams`.

**Implication:**
- Server-side routing configuration is not required (the server always serves the same `index.html`)
- Deep links work without server changes
- Absolute URL construction for inter-page links must account for the hash prefix
- History API-based navigation (pushState) is not used in dynamic mode

---

## 9. IE11 Support Constraints

**Constraint:** The codebase includes explicit IE11 compatibility accommodations.

**Specific constraints:**
- ES6 `Proxy` is not available natively in IE11. `WidgetProxyProvider` falls back to a property enumeration-based polyfill for IE11, which requires all widget properties to be pre-declared (dynamic property addition via proxy is not supported in the fallback)
- `Date.now()` and `Math.random()` are avoided in certain hot paths where determinism is required (e.g., LRU cache age tracking uses a different mechanism)
- OAuth popup handling has a dedicated IE-specific code path (`handleLoginForIE`) using `window.open` with different message passing
- `localStorage` polling is used in IE for OAuth token detection (cross-window `postMessage` reliability issues)

---

## 10. Watcher Muting During Initialization

**Constraint:** During page component initialization (`init()`), all watchers are globally muted via `muteWatchers()`. They are unmuted only after the initialization sequence completes.

**Implication:**
- Property changes made inside a widget's `onPropertyChange` during initialization are not propagated to dependent expressions
- Variables with `autoUpdate: true` do not fire during the muted window even if their input bindings change
- `$appDigest` called during the muted window is a no-op for watchers
- This is intentional: it prevents circular initialization loops where a variable firing early causes DOM updates before widgets are ready

**Muting scope:** `muteWatchers()` is a global flag — it affects all pages/partials/prefabs currently in the component tree, not just the one being initialized.

---

## 11. Route Reuse and Partial Re-rendering

**Constraint:** Angular's `RouteReuseStrategy` is customized to cache page component instances. When a user navigates away from a page and back, the same component instance may be reattached rather than recreated.

**Implication:**
- Page components receive `ngOnAttach()` (instead of `ngOnInit()`) on reattach
- `ngOnDetach()` is called instead of `ngOnDestroy()` when caching — the component is not destroyed
- Variables in a cached page are **muted** on detach and **unmuted** on attach
- Variables with `refreshdataonattach: true` re-invoke when the page is reattached
- Scroll position is saved on detach and restored on attach
- Partials within a cached page follow the same attach/detach cycle

**Cache invalidation:** `App.clearPageCache(pageName)` can be called to force a full re-initialization on next navigation.

---

## 12. App Variables Fire Once Per Session

**Constraint:** App-scoped variables (in `app.variables.json`) fire their `startUpdate` invocation **once per application session**, not once per page navigation.

**Implication:**
- Use App variables for data that is session-wide (user profile, configuration, reference data)
- Do not rely on App variables re-fetching automatically when the user navigates between pages
- After login/logout, `AppManagerService.reloadAppData()` re-fires App variables to refresh session-sensitive data
- The `isAppVariablesFired` flag in `AppManagerService` tracks whether the initial fire has occurred

---

## 13. Service Metadata Required for API Variables

**Constraint:** `ServiceVariable`, `LiveVariable`, and `CrudVariable` rely on `MetadataService` having loaded `app-servicedefs.json` before any variable invocation. This file contains the OpenAPI/swagger operation definitions used to construct HTTP requests.

**Implication:**
- App initialization via `AppVariablesResolve` ensures metadata is loaded before the first page renders
- Prefab-specific metadata (`{prefab}-prefab-servicedefs.json`) is loaded lazily when the prefab initializes
- If metadata loading fails, all API variables on the page will fail silently or throw `METADATA_MISSING` errors
- Hot-reloading metadata (without full page reload) is not supported

---

## 14. Single Angular Compiler Instance

**Constraint:** `runtime-dynamic` uses a single JIT `@angular/compiler` instance shared across all page compilations.

**Implication:**
- Component compilations are sequential within the compiler, even if page navigations arrive quickly
- `componentFactoryRefCache` prevents re-compilation on subsequent visits to the same page
- The first visit to each page incurs compilation cost proportional to template complexity
- Clearing the cache (`App.clearPageCache`) forces recompilation on next visit
