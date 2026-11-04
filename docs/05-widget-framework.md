# Widget Framework Internals

This document describes the internal architecture of the WaveMaker widget framework — the base classes, property binding system, event system, proxy mechanism, registry, and common directives that every widget builds upon.

**Source packages:**
- `projects/components/base/src/widgets/framework/` — core framework primitives
- `projects/components/base/src/widgets/common/` — shared widget implementations
- `projects/components/base/src/directives/` — cross-cutting directives
- `projects/components/base/src/pipes/` — transform pipes

---

## 1. Widget Base Class Hierarchy

```
BaseComponent
  └── StylableComponent
        └── BaseContainerComponent
        └── BaseFormCustomComponent (NG_VALUE_ACCESSOR)
              └── DatasetAwareFormComponent
        └── DatasetAwareNavComponent
```

### 1.1 BaseComponent

**File:** `widgets/common/base/base.component.ts`

Abstract base for every WaveMaker widget. Provides identity, lifecycle, event handling, and change notification.

#### Key Properties

| Property | Type | Description |
|---|---|---|
| `widgetId` | `string` | Auto-generated unique ID (`widget-id-N`) |
| `nativeElement` | `HTMLElement` | Raw DOM element reference |
| `widget` | `Proxy` | JS Proxy wrapping the component instance (used in user scripts as `Widgets.myWidget`) |
| `$element` | `jQuery` | jQuery wrapper of `nativeElement` |
| `widgetType` | `string` | Identifier string e.g. `"wm-button"` |
| `widgetSubType` | `string` | Specific variant; defaults to `widgetType` |
| `viewParent` | `BaseComponent` | The enclosing Page, Partial, or Prefab component |
| `context` | `any` | Scoped context (populated for repeater items, `ng-for` contexts) |
| `displayType` | `string` | CSS `display` value: `"block"`, `"inline-block"`, or `"inline"` |
| `eventHandlers` | `Map<string, {callback, locals}>` | Registered event callbacks keyed by event name |
| `initState` | `Map` | Initial property state captured before first change detection |
| `widgetProps` | `Map` | Property definitions for this widget type |
| `isMuted` | `boolean` | When `true`, suppresses watcher/change notifications (used during page init) |

#### Key Methods

| Method | Description |
|---|---|
| `setWidgetProperty(key, value)` | Sets a property via the proxy, triggering change detection |
| `notifyStyleChange(key, nv, ov)` | Fires registered style change listeners |
| `notifyPropertyChange(key, nv, ov)` | Fires registered property change listeners |
| `registerStyleChangeListener(fn, ctx)` | Subscribe to style property changes |
| `registerPropertyChangeListener(fn, ctx)` | Subscribe to non-style property changes |
| `registerReadyStateListener(fn, ctx)` | Subscribe to ready state completion |
| `registerDestroyListener(fn, ctx)` | Subscribe to component destruction |
| `processEventAttr(eventName, expr, meta, child)` | Parse and register an event binding expression |
| `processBindAttr(propName, expr, child)` | Create a `$watch` watcher for a `bind:` expression |
| `handleEvent(node, eventName, callback, locals, meta)` | Attach a DOM/Angular event listener |
| `getMappedEventName(eventName)` | Normalize event name (e.g. `"tap"` → `"click"`) |
| `invokeEventCallback(eventName, locals)` | Execute the registered event callback |
| `focus()` | Set DOM focus on the widget |
| `getAppInstance()` | Return the `App` service singleton |
| `createProxy()` | Wrap this instance in a JS Proxy |
| `generateWidgetId()` | Generate a new unique ID |
| `initContext()` | Initialize widget scope context |

#### Protected Change Handlers

`onPropertyChange(key, nv, ov)` handles built-in properties automatically:
- `name` → updates registry entry
- `class` → applies CSS classes
- `show` → sets `display` and triggers child redraws
- `hint` → sets `title` attribute
- `conditionalclass` / `conditionalstyle` → evaluated expressions
- `animation` → applies animate.css classes
- `disabled` / `autofocus` → reflects to DOM attribute

---

### 1.2 StylableComponent

**File:** `widgets/common/base/stylable.component.ts`

Extends `BaseComponent`. Declares all CSS-mappable style properties. Any property set on a `StylableComponent` that maps to a CSS property is applied to the element automatically via the `styler()` utility.

#### Style Property Groups

**Background:** `backgroundattachment`, `backgroundcolor`, `backgroundgradient`, `backgroundimage`, `backgroundposition`, `backgroundrepeat`, `backgroundsize`

**Border:** `bordercolor`, `borderradius`, `borderstyle`, `borderwidth`, `bordertopwidth`, `borderbottomwidth`, `borderleftwidth`, `borderrightwidth`

**Font:** `color`, `fontsize`, `fontfamily`, `fontstyle`, `fontunit`, `fontvariant`, `fontweight`

**Layout:** `display`, `height`, `width`, `margintop`, `marginbottom`, `marginleft`, `marginright`, `paddingtop`, `paddingbottom`, `paddingleft`, `paddingright`, `opacity`, `overflow`

**Text:** `textalign`, `textdecoration`, `verticalalign`, `visibility`, `whitespace`, `wordbreak`, `lineheight`, `horizontalalign`

**Positioning:** `cursor`, `zindex`

**Image:** `picturesource`

---

### 1.3 BaseContainerComponent

**File:** `widgets/common/base/base-container.component.ts`

Extends `StylableComponent`. Used by layout widgets (Panel, Accordion, Tabs, etc.) that contain child widgets.

| Property | Description |
|---|---|
| `content` | Partial/dynamic content reference |
| `Widgets` | `Map` of child widget instances by name |
| `reDrawableComponents` | `ContentChildren` query for `RedrawableDirective`-marked children |

| Method | Description |
|---|---|
| `updateRedrawableComponents(widgets)` | Recursively finds and registers all redrawable descendants |
| `redrawChildren()` | Triggers `redraw()` on all registered children when `show` property changes |

---

### 1.4 DatasetAwareNavComponent

**File:** `widgets/common/base/dataset-aware-nav.component.ts`

Extends `StylableComponent`. Base for navigation widgets (Navbar, Menu, Breadcrumb, etc.) that render from a data tree.

| Property | Description |
|---|---|
| `nodes[]` | Computed array of `NavNode` objects |
| `dataset` | Raw data source input |
| `nodes$` | `Subject` that emits whenever nodes are recalculated |
| `itemicon` | Dataset field mapped to node icon |
| `itemlabel` | Dataset field mapped to node label |
| `itemhint` | Dataset field mapped to tooltip |
| `itemlink` | Dataset field mapped to hyperlink |
| `itemtarget` | Dataset field mapped to link target |
| `itembadge` | Dataset field mapped to badge value |
| `itemchildren` | Dataset field mapped to child nodes array |
| `itemaction` | Dataset field mapped to click action |
| `itemclass` | Dataset field mapped to CSS class |
| `itemid` | Dataset field mapped to unique ID |
| `isactive` | Expression determining active state |
| `userrole` | Comma-separated roles for visibility filtering |
| `orderby` | Sort expression for nodes |

---

## 2. Property Binding System

### 2.1 Change Flow

```
User script / template sets property
  → widget.someProperty = newValue        (via Proxy set trap)
  → globalPropertyChangeHandler(component, key, nv)
      → Remove existing watch if change originated from a watch
      → Parse value by PROP_TYPE
      → Handle dimension properties (append 'px')
      → Handle resource paths (prepend CDN/prefab URL)
      → notifyStyleChange(key) or notifyPropertyChange(key)
      → $appDigest()                      (trigger Angular CD)
```

### 2.2 globalPropertyChangeHandler

Located in `widgets/framework/property-change-handler.ts`. Core responsibilities:

- **PROP_TYPE.BOOLEAN**: Coerces string `"true"`/`"false"` to boolean
- **PROP_TYPE.NUMBER**: Parses string to number
- **PROP_TYPE.STRING**: Passes through
- **Dimension props** (`DIMENSION_PROPS`): appends `"px"` when a bare number is provided
- **Resource paths**: Images under `resources/images/` get CDN prefix or prefab-relative path
- Routes to `notifyStyleChange` for style properties (detected via `isStyle(key)`) and `notifyPropertyChange` for widget properties

### 2.3 Property Registration

Widgets register their properties at module load time:

```typescript
// Register widget-specific properties
register('wm-select', new Map([
  ['dataset', PROP_ANY],
  ['datavalue', PROP_ANY],
  ['placeholder', PROP_STRING],
  ['disabled', PROP_BOOLEAN],
  // ...
]));
```

`getWidgetPropsByType(identifier)` retrieves the property map for a given widget type. `registerFormWidget` is a convenience for form input widgets that merges common form properties.

### 2.4 Bind Expression Processing

When the template contains `[someProperty.bind]="'bind:Variables.myVar.dataSet'"`:

```
processBindAttr(propName, expr, child)
  → $watch(expr, scope, locals, listener, identifier)
      → On expression change: component[propName] = newValue
                             → triggers Proxy set trap
                             → globalPropertyChangeHandler
```

The `identifier` allows unwatching when the property is set directly (non-watch change replaces the watcher).

---

## 3. Widget Proxy System

**File:** `widgets/framework/widget-proxy-provider.ts`

Every widget instance is wrapped in a JavaScript `Proxy`. The `widget` property on `BaseComponent` and the entries in `viewParent.Widgets` are always proxy references, never the raw component.

### 3.1 WidgetProxyProvider.create()

```typescript
WidgetProxyProvider.create(instance, widgetSubType, propsByWidgetSubType)
```

Returns a `Proxy` with:

**Set trap** — intercepts all property assignments on the proxy:
1. Calls `globalPropertyChangeHandler(instance, key, value)`
2. Ensures change detection runs

**Get trap** — intercepts property reads:
1. Returns bound method references with proper `this` context
2. Reads directly from the underlying component instance for data properties
3. Clears any pending `requestAnimationFrame` queue after method calls

### 3.2 IE11 Fallback

When `typeof Proxy === 'undefined'` (IE11), `WidgetProxyProvider.create()` falls back to a non-proxy object that manually defines getters/setters for all known widget properties.

---

## 4. Event System

### 4.1 Event Registration Flow

```
Template attribute: (click.event)="myClickHandler($event)"
  → processEventAttr('onClick', 'myClickHandler($event)', meta, child)
      → $parseEvent('myClickHandler($event)')   → compiled Function
      → stored in component.eventHandlers.set('onClick', { callback, locals })
      → createEventProp('onClick')              → sets component.onClick property
      → queued in toBeSetupEventsQueue (setup after viewInit)
```

The `toBeSetupEventsQueue` defers DOM event listener attachment until after Angular's view initialization completes, ensuring the native element is fully rendered.

### 4.2 Event Attachment

```
handleEvent(node, eventName, callback, locals, meta)
  → Angular EventManager.addEventListener(node, eventName, handler)
  → handler wraps callback, injects $event and locals
  → if meta === 'delayed': setTimeout(handler, 150)
  → if callback returns Promise: handled via promise chain
```

### 4.3 EVENTS_MAP

Located in `widgets/framework/constants.ts`:

```typescript
const EVENTS_MAP = {
  'tap': 'click'
};
```

Allows touch-oriented event names to be normalized to their DOM equivalents. Can be extended.

### 4.4 invokeEventCallback

```typescript
invokeEventCallback(eventName, locals)
// locals: { $event?, variable?, data?, ... }
// Returns: the callback's return value
// Returning false from onBefore* events cancels the operation
// Returning a value from onResult/onBeforeDatasetReady overrides data
```

---

## 5. Widget Registry

**File:** `widgets/framework/widget-registry.ts`

A global store that maps widget IDs and names to component instances.

### 5.1 register()

```typescript
register(widget, viewParent, widgetId, name) → unregisterFn
```

- Stores in `registryById.set(widgetId, widget)`
- If `name` is provided: `viewParent.Widgets[name] = widget`
- Returns a cleanup function that removes both entries
- Uses `delete obj[key]` (not `obj[key] = undefined`) to avoid property enumeration artifacts

### 5.2 getById()

```typescript
getById(widgetId) → widget | undefined
```

### 5.3 renameWidget()

Called when a widget's `name` property changes at runtime:

```typescript
renameWidget(viewParent, widget, newName, oldName)
// Deletes viewParent.Widgets[oldName]
// Sets viewParent.Widgets[newName] = widget
```

---

## 6. Styling System

**File:** `widgets/framework/styler.ts`

### 6.1 propNameCSSKeyMap

Maps widget property names to their CSS property equivalents:

```typescript
{
  'backgroundcolor': 'backgroundColor',
  'fontsize':        'fontSize',
  'borderradius':    'borderRadius',
  'textalign':       'textAlign',
  // ...all style properties
}
```

`isStyle(key)` returns `true` if `key` is in this map.

### 6.2 APPLY_STYLES_TYPE

Controls which CSS properties are applied on a per-widget-type basis:

| Type | Excluded Properties |
|---|---|
| `CONTAINER` | `textalign` |
| `SCROLLABLE_CONTAINER` | `textalign`, `width` |
| `SHELL` | `height`, `overflow`, `padding*` |
| `INNER_SHELL` | Only applies shell-excluded properties |

### 6.3 styler()

```typescript
styler($node, component, type, skipList?)
```

- Registers a style change listener on `component`
- On each style change: looks up CSS key, applies via `setCSS(element, cssKey, value)`
- Respects `skipList` and `type`-specific ignore lists
- Special cases:
  - `fontsize` + `fontunit`: combines into e.g. `"14px"` or `"1.2em"`
  - `backgroundimage`: wraps in `url(...)`
  - `picturesource`: processed through `getImageUrl()`

---

## 7. Common Directives & Components

### 7.1 ContainerDirective (`[wmContainer]`)

**File:** `widgets/common/container/container.directive.ts`

Generic block container. Supports **AutoLayout** in Prism (design-time preview) mode — applies flexbox-based layout properties (`direction`, `alignment`, `gap`, `wrap`) via `AutoLayoutUtils`. See [Section 10](#10-autolayout-architecture) for full details and the extension recipe.

### 7.2 PartialContainerDirective (`[partialContainer]`)

**File:** `widgets/common/base/partial-container.directive.ts`

Responsible for dynamically loading and rendering partial component templates.

- `_renderPartial(name)` — calls `ComponentRefProvider.getComponentFactoryRef(name, PARTIAL)`, creates the component, and appends it to the view container
- `renderPartial` — debounced version (200ms) to prevent rapid re-renders on input changes
- `onLoadSuccess()` — triggers the container's `load` event after successful render
- Detects prefab context and adjusts prefab name accordingly
- `params$` Subject propagates param changes to the instantiated partial

### 7.3 PartialDirective (`[wmPartial]`)

**File:** `widgets/common/partial/partial.directive.ts`

Extends `StylableComponent`. Wraps the partial's host element. Subscribes to:
- `ViewportEvent.RESIZE` → emits `resize` on the partial widget
- `ViewportEvent.ORIENTATION_CHANGE` → emits `orientationchange`

Implements `ngOnAttach` / `ngOnDetach` / `ngOnDestroy` callbacks for page reuse lifecycle.

### 7.4 PartialParamHandlerDirective + PartialParamDirective

**File:** `widgets/common/partial-param/partial-param.directive.ts`

**PartialParamHandlerDirective** (`[partialContainer]`):
- Creates `widget.partialParams` object (aliased as `widget.pageParams`)
- Creates `params$` Subject for reactive param updates
- `registerParams(name, value, bindExpr, type)` — registers each param definition; bind expressions create watchers

**PartialParamDirective** (`[wmParam]`):
- Inputs: `name`, `value`, `@Attribute('value.bind')`, `type`
- Calls `registerParams()` on the parent `PartialParamHandlerDirective`

### 7.5 RepeatTemplateDirective (`[wmRepeatTemplate]`)

**File:** `widgets/common/repeat-template/repeat-template.directive.ts`

Applied to `*ngFor` item elements. Exports itself as `repeatItemRef`. Extends `StylableComponent` so each repeat item can carry individual styling. CSS class `app-repeat-item`.

### 7.6 ItemTemplateDirective (`[wmItemTemplate]`)

**File:** `widgets/common/item-template/item-template.directive.ts`

Used in List and similar widgets for partial-based item templates.

- `wmItemTemplate` input: partial name to render per item
- `userComponentParams` input: the data object for the item (`{ item, index, ... }`)
- `context`: `NgForContext` injected from the repeater
- On `ngOnInit`: assigns `userComponentParams` to `partialParams.item`

### 7.7 LazyLoadDirective (`[lazyLoad]`)

**File:** `widgets/common/lazy-load/lazy-load.directive.ts`

```typescript
@Input() set lazyLoad(expr: string)
```

Creates an embedded view (renders the `ng-template`) when the watched expression becomes truthy. Unsubscribes the watcher after first creation to avoid re-rendering.

### 7.8 ShowInDeviceDirective (`[wmShowInDevice]`)

**File:** `directives/show-in-device.directive.ts`

Controls rendering based on current viewport:

| Value | Breakpoint |
|---|---|
| `xs` | `max-width < 768px` (mobile) |
| `sm` | `768px–991px` (tablet portrait) |
| `md` | `992px–1199px` (tablet landscape / laptop) |
| `lg` | `≥ 1200px` (desktop) |
| `all` | Always render |

Uses `window.matchMedia` with CSS variable thresholds (`--screen-lg`, `--screen-md`, etc.) for consistency with the theme. Responds to resize events. Supports comma-separated device list.

### 7.9 RedrawableDirective (`[redrawable]`)

**File:** `widgets/common/redraw/redrawable.directive.ts`

Implements `IRedrawableComponent`. Marks a widget as redrawable so that parent containers can trigger a `redraw()` call when their visibility changes (e.g. switching tabs). Checks if the widget is inside an inactive accordion/tab pane before deciding whether to redraw or delegate to inner widgets.

---

## 8. Pipes

### 8.1 TrailingZeroDecimalPipe (`trailingZeroDecimalPipe`)

Formats numbers preserving trailing decimal zeros using Angular's `DecimalPipe` with the format `1.N-16` to force trailing zeros.

### 8.2 ToDatePipe (`toDate`)

```typescript
transform(data, format, timezone?, compInstance?)
```

- `'timestamp'`: returns epoch number
- `'UTC'`: converts to UTC
- Custom format strings: formatted via `moment.js`
- Timezone support via `AbstractI18nService`
- Falls back to custom formatter registered in `CustomPipeManager`
- Input string `'null'` returns `''`

### 8.3 ToNumberPipe (`toNumber`)

```typescript
transform(data, fracSize?)
```

Converts input to number with optional fractional digit count. Validates `fracSize` format.

### 8.4 TrustAsPipe (`trustAs`)

```typescript
transform(content, context: 'html'|'style'|'script'|'url'|'resource')
```

Bypasses Angular's DomSanitizer for the given security context. Returns empty string for `null`/`undefined`.

### 8.5 SanitizePipe (`sanitize`)

```typescript
transform(content, context: 'html'|'style'|'script'|'url'|'resource'|'none')
```

Applies `DomSanitizer.sanitize()` for the given security context.

### 8.6 ImagePipe (`image`)

```typescript
transform(url, encode?, defaultImageUrl?)
```

Processes image URLs through `getImageUrl()`: validates web URLs, prepends CDN prefix if needed, handles prefab-relative paths, and optionally URL-encodes.

---

## 9. Base Field Validations

**File:** `widgets/common/base/base-field-validations.ts`

Used by all form input widgets to manage Angular reactive form validators.

| Method | Description |
|---|---|
| `setUpValidators(customValidator?)` | Computes and applies the full validator set |
| `getDefaultValidators()` | Returns built-in validators based on widget properties (`required`, `maxlength`, `pattern`, `min`, `max`) |
| `setAsyncValidators(validators)` | Attach async validators (e.g. server-side validation) |
| `setValidators(validators)` | Replace the full validator set with custom validators |
| `validate()` | Trigger validation immediately |
| `observeOn(fields, context)` | Re-validate when specified sibling fields change |
| `setCustomValidationMessage()` | Update the displayed validation error message |
| `destroy()` | Clean up all validator references (memory leak prevention) |

Handled validators: `required`, `maxlength`, `pattern`, `min`, `max`, `custom`.

---

## 10. AutoLayout Architecture

AutoLayout is implemented as the `@AutoLayout()` TypeScript class decorator (exported from `@wm/components/base`). It patches `onPropertyChange`, `onStyleChange`, `ngAfterViewInit`, and `ngOnDestroy` on the target class prototype to inject Prism-mode flexbox layout behaviour. Current adopters: `ContainerDirective`, `PageContentComponent`, `TabPaneComponent`, `AccordionPaneComponent`, `ListComponent`, `ListItemDirective`.

`AUTO_LAYOUT_PROPS` is a shared props `Map` spread into each adopter's `registerProps()` to register all layout properties at once.

See **[`docs/11-autolayout.md`](./11-autolayout.md)** for the full reference: decorator options (`targetSelector`, `bindParent`), property handling, alignment matrix, `fill`/`hug` size semantics, overflow modes, and List/ListItem-specific details.
