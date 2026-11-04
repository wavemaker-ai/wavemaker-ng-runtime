# WaveMaker Angular Runtime — Overview

## What Is WaveMaker?

WaveMaker is a low-code platform for building enterprise web applications. Developers design pages visually in WaveMaker Studio, write JavaScript callbacks, and configure variables that connect UI to backend APIs. The platform generates an Angular application from those artifacts.

## What Is This Repo?

`wavemaker-ng-runtime` is the **Angular runtime framework and component library** that every WaveMaker-generated web application depends on. It provides:

- The bootstrapping layer that starts the Angular app
- Base classes for pages, partials, and prefabs
- All UI components and directives available in WaveMaker Studio
- The variable system that connects UI to data sources
- Infrastructure services: navigation, i18n, security, HTTP, OAuth, toaster, spinner

This repo ships as a set of Angular library packages (`@wm/*`). A WaveMaker application imports these packages and uses them to render the pages/partials/variables designed in the Studio.

---

## Typical WaveMaker App Structure

A WaveMaker web application is composed of the following artifacts, each mapped to files on disk:

```
src/
  app/                         # App-level script, variables, CSS
    app.js
    app.variables.json
    app.css
  pages/
    HomePage/
      HomePage.html            # Page UI template (Angular-like markup)
      HomePage.script.js       # JavaScript callbacks (lifecycle, event handlers)
      HomePage.css             # Page-scoped CSS
      HomePage.variables.json  # Variable/Action definitions for this page
    ...
  partials/
    HeaderPartial/
      HeaderPartial.html
      HeaderPartial.script.js
      HeaderPartial.variables.json
  prefabs/
    MyPrefab/
      prefab.min.json          # Compiled prefab bundle
```

### Pages

The primary unit of navigation. A page corresponds to a route (`/#/PageName`). Each page has:

| File | Purpose |
|------|---------|
| `PageName.html` | Declarative UI template using WaveMaker widget markup |
| `PageName.script.js` | JavaScript: lifecycle hooks (`onReady`, `onBeforePageLeave`), event callbacks, variable event handlers |
| `PageName.css` | CSS scoped to this page |
| `PageName.variables.json` | Definitions for all Variables and Actions used on this page |

### Partials

Reusable UI fragments embedded within pages (or other partials). They have the same file structure as pages but are not independently navigable. A partial is rendered via the `<wm-partial>` directive and can receive parameters through `<wm-param>` bindings.

### Prefabs

Self-contained, packaged widget bundles that encapsulate UI, script, CSS, variables, and an explicit API (properties, events, methods). Prefabs are consumed by embedding `<div wmPrefab prefabname="MyPrefab">` in a page template. They load their own resources lazily.

### App Scope

Variables and scripts defined at the app level (`app.variables.json`, `app.js`) are initialized once at startup and are available across all pages. App-level variables outlive individual page navigations.

---

## Variables — The Data Layer

Variables are the primary mechanism connecting UI components to data and actions. They are defined in JSON and managed by the runtime.

### Variable Categories

| Category | Class | Purpose |
|----------|-------|---------|
| `wm.Variable` | ModelVariable | In-memory data container; no network call |
| `wm.LiveVariable` | LiveVariable | Query a database entity via generated ORM API |
| `wm.ServiceVariable` | ServiceVariable | Invoke any REST/SOAP/Java/Feed service operation |
| `wm.CrudVariable` | CrudVariable | CRUD wrapper over a DataService entity |
| `wm.WebSocketVariable` | WebSocketVariable | Bidirectional WebSocket communication |

### Action Categories (UI Actions)

| Category | Class | Purpose |
|----------|-------|---------|
| `wm.NavigationVariable` | NavigationAction | Navigate to page, view, tab, accordion, or segment |
| `wm.NotificationVariable` | NotificationAction | Show toast or dialog alert |
| `wm.TimerVariable` | TimerAction | Timed/interval execution |
| `wm.LoginVariable` | LoginAction | Authenticate user with credentials |
| `wm.LogoutVariable` | LogoutAction | Terminate user session |

### Variable Lifecycle Events

All variables fire a standard set of events at lifecycle points. Developers attach handlers in the page script:

```
onBefore            → Before invocation
onBeforeUpdate      → Before data update / HTTP call
onResult            → Result received (success or failure)
onBeforeDatasetReady → Transform data before it updates the UI
onSuccess           → Successful completion
onError             → Error during execution
onCanUpdate         → State update notification
```

Additional events for specific types: `onBeforeOpen`, `onOpen`, `onMessageReceive`, `onBeforeMessageSend`, `onClose` (WebSocket); `onOk`, `onCancel`, `onClick`, `onHide` (Notification); `onTimerFire` (Timer).

### Variable Scope

- **App scope** (`owner: 'App'`): initialized at bootstrap, live for the entire session
- **Page scope** (`owner: 'Page'`): initialized when the page loads, destroyed when the user navigates away

---

## Runtime Modes

### runtime-dynamic (Current / Interim)

`runtime-dynamic` bootstraps the Angular application and **compiles page components at runtime** using the Angular compiler. When a user navigates to a page:

1. The runtime fetches `page.min.json` (markup + script + styles + variables)
2. The transpiler converts WaveMaker markup to valid Angular templates
3. `@angular/compiler` compiles the component on the fly and caches the factory
4. The compiled component is instantiated in a `ViewContainerRef`

This mode enables Studio-in-browser editing without a build step, but it requires the Angular JIT compiler and a large `REQUIRED_MODULES_FOR_DYNAMIC_COMPONENTS` pre-declaration list.

### Angular-Native App (Generated / Production)

The production deployment target. A separate Studio build step generates a standard Angular application (`AppModule` with precompiled page components). This app imports `@wm/runtime-base` but **does not use** `runtime-dynamic`'s dynamic compilation. Pages are compiled at build time via the Angular AOT compiler, yielding smaller bundles and faster load times.

The runtime-base layer (services, base component classes, guards, resolves) is shared by both modes.

---

## Key Concepts

### Widget Framework

Every UI component is a directive or component that extends `BaseComponent` → `StylableComponent`. Widgets are wrapped in a JavaScript `Proxy` so that property assignments (e.g., `Widgets.myButton.caption = 'Click me'`) trigger Angular change detection and `onPropertyChange` hooks automatically.

### Property Binding

Template attributes prefixed with `.bind` (e.g., `caption.bind="Variables.userVar.dataSet.name"`) register `$watch` expressions. The watcher system evaluates expressions in every Angular change detection cycle and pushes new values to the widget via the proxy.

### Event Callbacks

Widget events (e.g., `on-click`, `on-select`) and variable lifecycle events reference JavaScript functions defined in the page script. The runtime compiles these expressions once via `$parseEvent()` and invokes them with a standardized `{ widget, $event, variable, data }` locals object.

### Fragment Monitoring

A page's `onReady()` lifecycle hook does **not** fire until every nested partial and prefab has fully initialized. This is managed by `FragmentMonitor`: each embedded partial/prefab registers itself, loads its resources, and calls `resolveFragment()` when done. Only when all fragments resolve does the page surface as ready.

---

## Repository Layout at a Glance

| Package path | NPM name | Purpose |
|---|---|---|
| `projects/core` | `@wm/core` | Enums, types, constants, watcher, expression parser, utilities, viewport/state/script services |
| `projects/components/base` | `@wm/components/base` | BaseComponent, StylableComponent, common directives (container, partial, repeat-template, lazy-load), pipes, utilities |
| `projects/components/transpile` | `@wm/components/transpile` | Build-time transpiler utilities used by runtime-dynamic |
| `projects/components/widgets/basic` | `@wm/components/widgets/basic` | Anchor, Label, Icon, Picture, Audio, Video, Tree, Search, Spinner, Rich Text Editor, etc. |
| `projects/components/widgets/input` | `@wm/components/widgets/input` | Text, Number, Currency, Textarea, Checkbox, Select, Switch, Slider, Rating, Calendar, Chips, File Upload, Button, etc. |
| `projects/components/widgets/containers` | `@wm/components/widgets/containers` | Accordion, Tabs, Panel, Layout Grid, Linear Layout, Tile, Wizard |
| `projects/components/widgets/data` | `@wm/components/widgets/data` | Table, Form, List, Live Table, Card, Pagination |
| `projects/components/widgets/dialogs` | `@wm/components/widgets/dialogs` | Alert, Confirm, Design, Iframe, Login, Partial dialogs |
| `projects/components/widgets/navigation` | `@wm/components/widgets/navigation` | Breadcrumb, Menu, Navbar, Popover |
| `projects/components/widgets/advanced` | `@wm/components/widgets/advanced` | Carousel, Login, Marquee, Custom widget |
| `projects/components/widgets/chart` | `@wm/components/widgets/chart` | Chart types (bar, line, pie, etc.) |
| `projects/components/widgets/page` | `@wm/components/widgets/page` | Page layout widgets: Header, Footer, Left/Right Panel, Top Nav |
| `projects/components/widgets/prefab` | `@wm/components/widgets/prefab` | Prefab host widget |
| `projects/variables` | `@wm/variables` | Variable factory, managers, service, model classes, utilities |
| `projects/runtime-base` | `@wm/runtime-base` | App/Page/Partial/Prefab base components, services (navigation, i18n, toaster, spinner, prefab manager), guards, resolves |
| `projects/runtime-dynamic` | `@wm/runtime-dynamic` | Dynamic compilation runtime: AppConfig, PageWrapperComponent, ComponentRefProvider |
| `projects/security` | `@wm/security` | SecurityService: authentication, RBAC, session management |
| `projects/http-service` | `@wm/http-service` | HttpServiceImpl: HTTP client wrapping Angular HttpClient |
| `projects/oAuth` | `@wm/oAuth` | OAuth 2.0: Implicit, PKCE, Authorization Code flows |
