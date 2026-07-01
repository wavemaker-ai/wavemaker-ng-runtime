# Patterns and Conventions

This document catalogues the recurring architectural patterns, conventions, and idioms used throughout the WaveMaker Angular runtime codebase. Understanding these patterns is essential for spec-driven development and for writing new widgets, variables, or runtime extensions that integrate cleanly with the framework.

---

## 1. Event Callback Pattern

All widgets expose lifecycle and interaction events as `on<EventName>` inputs. Event expressions are string expressions evaluated in the page/partial scope.

### Signature

Every event callback receives a single options object:

```typescript
onSomeEvent(options: { variable?, data?, event?, widget?, ... }) {
  // ...
}
```

Exact shape of `options` is event-specific, but `variable` and `data` are the most common.

### Return Value Semantics

| Callback type | Returning `false` | Returning a value |
|---|---|---|
| `onBefore*` | Cancels the operation | Ignored |
| `onResult` / `onBeforeDatasetReady` | Does not cancel | Overrides the data/dataset |
| `onSuccess` / `onError` | No effect | No effect |
| DOM events (`onClick`, `onChange`) | Prevents default | No effect |

### Compilation

Expressions are compiled once at init time via `$parseEvent(expr)` and stored in `component.eventHandlers`. The compiled function is invoked with page scope and the locals object each time the event fires.

---

## 2. Property Binding Pattern

Widget properties accept two forms of value in templates:

### Static Assignment

```html
<button wmButton caption="Save"></button>
```

The value is set once at component init via `initState`.

### Bind Expression

```html
<button wmButton caption.bind="Widgets.nameInput.datavalue"></button>
```

A `bind:` prefix creates a live `$watch` on the expression. Whenever the expression result changes, the property is updated automatically. The watcher is registered by `processBindAttr()` and uses the property name as the identifier so it can be replaced when the property is set programmatically.

### Variable autoUpdate

When a variable input field has a `bind:` expression, setting `autoUpdate: true` on the variable causes it to automatically invoke when the bound value changes — no explicit event handler needed.

### Watcher Muting

During page initialization, `muteWatchers()` is called so that bound properties are set without triggering side effects. After init completes, `unMuteWatchers()` resumes normal change propagation. The `isMuted` flag on `BaseComponent` reflects whether the component itself is muted.

---

## 3. Dataset Widget Pattern

Widgets that present a list of options (`select`, `checkboxset`, `radioset`, `chips`, `search`, `switch`) all extend `DatasetAwareFormComponent`.

### Inputs

| Input | Description |
|---|---|
| `dataset` | The data source: array, object, or comma-separated string |
| `datafield` | The object property used as the selected **value** |
| `displayfield` | The object property shown as the **label** |
| `displayexpression` | Angular expression for custom label rendering |
| `datavalue` | Two-way bound selected value(s) |

### Value Resolution

- `modelByKey`: resolves `datavalue` by matching `datafield` on dataset items (stores primitive key, resolves to object)
- `modelByValue`: stores the full object reference as `datavalue`
- `multiple: true` on `DatasetAwareFormComponent` enables multi-selection; `datavalue` becomes an array

### Dataset Transformation

`getTransformedData()` normalises the `dataset` input (array, object, or string) into a uniform `datasetItems` array before rendering. Ordering is applied via `getOrderedDataset(dataset, orderBy)`.

---

## 4. CRUD Data Operations Pattern

Any widget or variable that performs data operations uses the `IDataSource` interface:

```typescript
interface IDataSource {
  execute(operation: Operation, options: any): Promise<any>;
}
```

### Operations

```typescript
enum Operation {
  LIST_RECORDS,   UPDATE_RECORD,  INSERT_RECORD,  DELETE_RECORD,
  INVOKE,         NOTIFY,         DOWNLOAD,       UPLOAD,
  SUPPORTS_CRUD,  IS_API_AWARE
}
```

### Utility Functions

| Function | Description |
|---|---|
| `performDataOperation(dataSource, requestData, options)` | Executes insert/update/delete |
| `refreshDataSource(dataSource, options)` | Fetches data with optional `filterFields`, `orderBy`, `page`, `size`, `condition` |

Widgets like Table and Form call these utilities rather than directly invoking variable methods.

---

## 5. Variable Invocation Pattern

The canonical invocation lifecycle for all API-aware variables:

```
variable.invoke(options?, success?, error?)
  → onBefore fires   (return false to abort)
  → onBeforeUpdate fires  (can modify dataFilter / inputData)
  → HTTP/socket call executes
  → onResult fires   (can override response data)
  → onBeforeDatasetReady fires  (final chance to transform)
  → variable.dataSet updated
  → onSuccess fires (on 2xx) / onError fires (on error)
  → onCanUpdate fires
```

### Automatic Triggers

- `startUpdate: true` — variable invokes automatically when the page loads (after app variables are ready)
- `autoUpdate: true` — variable re-invokes whenever a bound input value changes

### Async Control

```typescript
// Wait for invocation
await variable.invoke();

// Or use the promise property
variable.invoke();
variable.promise.then(data => { ... });
```

### Cleanup

On page/partial destroy, `bulkCancel(collection)` is called on all variables in the scope, cancelling any in-flight HTTP requests and freeing resources.

---

## 6. State Persistence Pattern

Widgets that should restore state across navigations declare a `statehandler` property:

```
'url'           — encodes state in the URL query string
'localStorage'  — persists in localStorage
'sessionStorage'— persists in sessionStorage
```

### Mechanics

1. On widget init: `StatePersistenceService.getWidgetState(widget, mode)` reads existing state and applies it
2. On state change: the widget calls `setHistoryHandler('push'|'replace')` and updates state
3. State key: composite of `pageName + widgetName + propertyPath`

### Limitations

State persistence is **not supported** for `On-Demand` or `Scroll` navigation types (pagination that loads more data on demand cannot be meaningfully serialised to URL state).

---

## 7. Memory Management Convention

The codebase strictly prevents memory leaks. All components and directives follow this pattern in `ngOnDestroy`:

```typescript
ngOnDestroy() {
  // 1. Unsubscribe RxJS subscriptions
  this.subscription?.unsubscribe();

  // 2. Complete Subjects (releases all subscribers)
  this.mySubject$.complete();

  // 3. Clear Maps and Arrays
  this.widgetsMap.clear();
  this.itemsArray.length = 0;

  // 4. Null out DOM and object references
  this.nativeElement = null;
  this.$element = null;

  // 5. Clear ViewContainerRef
  this.vcRef?.clear();

  // 6. Cancel debounced functions
  cancelDebounce(this.renderPartial);
}
```

Source files annotate these with comments like `// Memory leak fix:` — search for this string to find all cleanup sites.

---

## 8. Fragment Monitoring Pattern

Pages may embed multiple partials and prefabs. The page's `onReady()` hook must not fire until every embedded fragment has finished loading.

### Protocol

```
Page registers FragmentMonitor
  │
  ├─ Partial A is embedded
  │    → partial.registerFragment(parentMonitor)  // increments pending count
  │    → partial finishes viewInit
  │    → partial.resolveFragment()               // decrements pending count
  │
  ├─ Prefab B is embedded
  │    → (same protocol)
  │
  └─ FragmentMonitor.fragmentsLoaded$ completes when pending count reaches 0
       → page.invokeOnReady() fires
       → page.onReady() user hook executes
```

Any container that embeds dynamic content (e.g. a partial-dialog) must call `registerFragment()` before rendering and `resolveFragment()` after its own `viewInit$` completes.

---

## 9. Page Transition Pattern

Navigation animations are configured on `NavigationAction` and executed by the runtime:

```
NavigationAction.invoke({ transition: 'slide' })
  → NavigationServiceImpl.goToPage(pageName, { transition })
  → router.navigate([`/${pageName}`])
  → runPageTransition(transitionClass)
      → applies CSS animation classes to the page host
      → removes classes after animation completes
```

Transition types are CSS class names defined in the theme stylesheet. The default transition is configured on the `NavigationAction`; it can be overridden per invocation by passing `transition` in the options object.

---

## 10. Custom Pipe / Formatter Pattern

Applications can override how dates, numbers, or other values are formatted in widgets by registering a custom pipe:

```typescript
// In app.js or a page script:
App.registerPipe('toDate', (value, format, timezone) => {
  return myCustomFormatter(value, format);
});
```

Internally, `CustomPipeManager.setCustomPipe(key, fn)` stores the function. `WmPipe` base class checks `hasCustomPipe(key)` before applying the built-in transformation. The custom formatter receives `(data, args, variables)`.

---

## 11. Dynamic Component Compilation Pattern (runtime-dynamic)

In runtime-dynamic mode, pages and partials are compiled on demand rather than being pre-built:

```
ComponentRefProvider.getComponentFactoryRef(name, ComponentType)
  │
  ├─ Check componentFactoryRefCache → return if cached
  │
  ├─ loadResourcesOfFragment(name, type)
  │    → fetch ./pages/{name}/page.min.json  (or prefabs / partials path)
  │    → extract: markup, script, styles, variables JSON, config
  │
  ├─ Transpile markup
  │    → convert WaveMaker template syntax to Angular template syntax
  │    → scope styles to prevent leakage
  │
  ├─ getDynamicComponent(name, type, template, styles, script, variables)
  │    → create class extending BasePageComponent / BasePartialComponent / BasePrefabComponent
  │    → implement evalUserScript(), getVariables(), getExpressions()
  │    → set @Component({ template, styles, selector })
  │
  ├─ getDynamicModule(componentClass)
  │    → create NgModule declaring the component
  │    → import REQUIRED_MODULES_FOR_DYNAMIC_COMPONENTS (all framework widgets/pipes)
  │    → provide all guards, resolves, services
  │
  ├─ compiler.compileModuleAndAllComponentsSync(moduleDef)
  │    → JIT compilation produces ComponentFactory
  │
  └─ Cache and return ComponentFactory
```

`REQUIRED_MODULES_FOR_DYNAMIC_COMPONENTS` is a large pre-declared array of all framework modules, ensuring dynamically compiled components can reference any widget without individual imports.

The compiled app (non-dynamic mode) bypasses this entire flow — each page component is pre-compiled as a standard Angular component.

---

## 12. Prefab Property Exposure Pattern

Prefabs expose a typed API (properties, events, methods) to their host page/partial through config-driven registration:

```typescript
// Inside BasePrefabComponent.registerProps()

// For each property in prefab config:
Object.defineProperty(prefabInstance, propName, {
  get: () => this[propName],
  set: (val) => {
    this[propName] = val;
    // trigger $watch update
  }
});

// For each event in prefab config:
containerWidget[eventName] = (params) => {
  this.invokeEventCallback(eventName, params);
};

// For each method in prefab config:
containerWidget[methodName] = (...args) => {
  this[methodName](...args);
};
```

The `containerWidget` is the widget reference in the host page's `Widgets` map, so host page scripts can call:

```javascript
// In page script:
Page.Widgets.myPrefab.someMethod();
Page.Widgets.myPrefab.someProperty = 'new value';
Page.Widgets.myPrefab.onSomeEvent = function(options) { ... };
```

Prefab i18n uses a separate locale bundle loaded by `PrefabManagerService.loadDependencies()`.

---

## 13. Role-Based Access Pattern

Three layers enforce role-based access control:

### Route Guard (`RoleGuard`)

```typescript
canActivate(route: ActivatedRouteSnapshot) {
  const allowedRoles = route.data['allowedRoles'];
  const userRoles = securityService.getLoggedInUser().roles;
  const hasAccess = intersection(allowedRoles, userRoles).length > 0;
  if (!hasAccess) { appManager.notifyAccessDenied(pageName, message); }
  return hasAccess;
}
```

### Structural Directive (`*appAccessroles`)

```html
<div *appAccessroles="'admin,manager'">Admin content</div>
```

`AccessrolesDirective` calls `validateAccessRoles(specifiedRoles, userRoles)` and either creates or removes the embedded view.

### Variable / Service Guards

`SecurityService.isAuthenticated()` is the gate for `AuthGuard`. On failure, `AppManagerService.handle401()` is called, which either shows the login dialog or redirects to the login page, and queues the failed request for retry after re-authentication via `executeSessionFailureRequests()`.

---

## 14. HTTP Lifecycle Hooks

The `HttpCallInterceptor` provides three application-level hooks that execute on every API call:

```typescript
// In app.js:
App.onBeforeServiceCall = function(operation, options) {
  // Modify the request object
  // Return modified options or undefined
};

App.onServiceSuccess = function(data, operation, options) {
  // Inspect or transform the response
  // Return modified data or undefined
};

App.onServiceError = function(error, operation, options) {
  // Handle or suppress the error
  // Return modified error or undefined
};
```

These hooks run for all HTTP requests including variable invocations, file uploads, and security calls.

---

## 15. AutoLayout Pattern (Prism / Design Mode)

Containers in Prism mode (the WaveMaker Studio canvas) support a visual layout editor via `AutoLayoutUtils`:

```typescript
// Properties on ContainerDirective
direction: 'row' | 'column'   // flex-direction
hasWrap: boolean               // flex-wrap
alignment: string              // e.g. 'middle-center' → justifyContent + alignItems
gap: string                    // row-gap
columngap: string              // column-gap
clipContent: boolean           // overflow: hidden
```

`applyAlignment(key)` maps named positions (`top-left`, `middle-center`, `bottom-right`, etc.) to the appropriate `justifyContent` and `alignItems` CSS values based on the current flex direction.

---

## 16. App Event Bus Pattern

The `App` service acts as a global event bus for cross-cutting notifications:

```typescript
// Subscribe
const unsubscribe = App.subscribe('userLoggedIn', (data) => { ... });

// Publish
App.notify('userLoggedIn', userData);

// Cleanup
unsubscribe();
```

Key system events:

| Event | Fired when |
|---|---|
| `toggle-variable-state` | A variable starts/finishes loading (drives Spinner) |
| `userLoggedIn` | Login action succeeds |
| `userLoggedOut` | Logout action succeeds |
| `http401` | HTTP 401 received (session timeout) |
| `pageReady` | A page finishes loading and fires `onReady` |
| `pageAttach` | A cached page is reattached |
| `pageDetach` | A page is detached to cache |
| `app-variables-data-loaded` | App-scoped variables have all loaded |
| `locale-changed` | App locale is switched |

---

## 17. Watcher System

The `$watch` / `$appDigest` system is a lightweight dirty-checking mechanism layered on top of Angular's change detection.

```typescript
// Create a watch
const unwatchFn = $watch(
  'Variables.myVar.dataSet.0.name', // expression string
  scope,                             // evaluation context
  locals,                            // additional locals
  (newVal, oldVal) => {              // listener
    widget.caption = newVal;
  },
  identifier                         // unique key for deduplication
);

// Remove watch
unwatchFn();
// or
$unwatch(identifier);
```

`$invokeWatchers(force, ignoreMuted)` evaluates all registered watchers and calls listeners for changed values. It is called by `$appDigest()` which also triggers Angular's `ApplicationRef.tick()` to propagate changes through the Angular component tree.

During page init, `muteWatchers()` prevents watchers from firing prematurely. After init, `unMuteWatchers()` allows them to run freely.
