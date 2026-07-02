# AutoLayout System

Documents the `@AutoLayout()` decorator, `AUTO_LAYOUT_PROPS`, and their usage across container widgets in Prism (design-time preview) mode.

---

## 1. Overview

AutoLayout is implemented as a **TypeScript class decorator** (`@AutoLayout()`). The decorator patches four prototype methods (`onPropertyChange`, `onStyleChange`, `ngAfterViewInit`, `ngOnDestroy`) on the target class to inject Prism-mode flexbox layout behaviour without inheritance.

**All six current adopters:**

| Widget | Decorator usage |
|---|---|
| `ContainerDirective` | `@AutoLayout()` |
| `PageContentComponent` | `@AutoLayout()` |
| `TabPaneComponent` | `@AutoLayout({ targetSelector: '.tab-body' })` |
| `AccordionPaneComponent` | `@AutoLayout({ targetSelector: '.panel-body' })` |
| `ListComponent` | `@AutoLayout({ targetSelector: 'ul' })` |
| `ListItemDirective` | `@AutoLayout({ bindParent: 'listComponent.viewParent' })` |

---

## 2. How the Decorator Works

**File:** `projects/components/base/src/decorators/autolayout.decorator.ts`

```typescript
export function AutoLayout(options: { targetSelector?: string, bindParent?: string } = {}) {
    return function (constructor: Function) {
        const proto = constructor.prototype;
        // save originals
        const _onProp    = proto.onPropertyChange;
        const _onStyle   = proto.onStyleChange;
        const _onDestroy = proto.ngOnDestroy;
        const _afterViewInit = proto.ngAfterViewInit;

        // patch all four ...
    }
}
```

### Internal state store

Each widget instance gets a `__al_store` object (created lazily on first access):

```typescript
inst.__al_store = {
    dir, wrap, align, gap, cg,       // flex layout state
    z, pos, overflow, clip, inset,    // position / overflow state
    padding, width, height,           // size / spacing
    isViewInitialized: false,         // true after ngAfterViewInit
    needsFlex: false,                 // dirty flags — batch DOM writes
    needsOverflow: false,
    needsPosition: false,
    watches: new Set<string>(),       // active bind: watches
    destroySub: new Subject<void>()   // cleanup signal
};
```

### Prism guard

Every patched method checks `app.isPrism` before doing anything:

```typescript
const app = this['app'] || this['injector']?.get(App);
if (app?.isPrism) { /* layout logic */ }
// original method always called regardless
if (_onProp) _onProp.apply(this, [key, nv, ov]);
```

### Deferred DOM sync (`ngAfterViewInit`)

`onPropertyChange` may fire before the view is rendered. Changes are stored in `__al_store` with dirty flags (`needsFlex`, `needsOverflow`, `needsPosition`). `ngAfterViewInit` marks `isViewInitialized = true` and flushes all pending changes:

```typescript
proto.ngAfterViewInit = function () {
    const app = this['app'] || this['injector']?.get(App);
    if (app?.isPrism) {
        setAutolayoutStore(this, { isViewInitialized: true });

        // If targetSelector: stretch inner element to fill host
        if (options.targetSelector) {
            const inner = getTargetElement(this);
            if (inner) inner.css({ width: '100%', height: '100%', 'box-sizing': 'border-box' });
        }

        // Flush pending dirty writes
        if (store.needsFlex)     applyFlexStyles(this);
        if (store.needsOverflow) applyOverflow(this);
        if (store.needsPosition) applyPosition(this);

        // Size is deferred to a microtask so parent display is resolved first
        // (ngAfterViewInit resolves child-first, parent style may not be set yet)
        Promise.resolve().then(() => {
            if (hasValue(store.width))  applySize(this, 'width',  store.width);
            if (hasValue(store.height)) applySize(this, 'height', store.height);
        });
    }
    if (_afterViewInit) _afterViewInit.apply(this);
};
```

---

## 3. Decorator Options

### `targetSelector`

When set, flex/overflow/padding are applied to the **inner element** matched by the selector. `width`/`height` always land on the **host element** (`inst.$element`), and the inner element is stretched to `100%/100%` of the host in `ngAfterViewInit`.

This separates layout responsibility: the host element owns external sizing (how big this widget is), the inner element owns internal layout (how children are arranged inside).

```
Host element  ←─ width / height / position / z-index
Inner element ←─ flex-direction / flex-wrap / alignment / gap / overflow / padding
```

| Widget | Inner element | Reason |
|---|---|---|
| `TabPaneComponent` | `.tab-body` | Tab header sits outside the flex area |
| `AccordionPaneComponent` | `.panel-body` | Accordion header sits outside the flex area |
| `ListComponent` | `ul` (the list group) | Outer div owns pagination/title; `ul` owns item layout |

### `bindParent`

A dot-path string evaluated on the instance to find the scope for resolving `bind:` expressions. Used when the widget's own `viewParent` is not the correct scope.

`ListItemDirective` uses `bindParent: 'listComponent.viewParent'` — the list item lives inside an `*ngFor`, so its own `viewParent` is the list item scope. AutoLayout bind expressions (e.g. `alignment.bind="..."`) need to resolve against the **page scope** (`listComponent.viewParent`) to match how the rest of the page works.

```typescript
const scope = options.bindParent
    ? options.bindParent.split('.').reduce((o, k) => o?.[k], inst)
    : inst.viewParent;
```

---

## 4. `AUTO_LAYOUT_PROPS`

**File:** `projects/components/base/src/decorators/autolayout.props.ts`

A shared `Map` spread into any widget's `registerProps()` to register all AutoLayout properties at once:

```typescript
export const AUTO_LAYOUT_PROPS = new Map<string, any>([
    ['direction',       PROP_STRING],
    ['wrap',            PROP_BOOLEAN],
    ['alignment',       PROP_STRING],
    ['gap',             PROP_STRING],
    ['columngap',       PROP_STRING],
    ['clipcontent',     PROP_STRING],
    ['position',        PROP_STRING],
    ['overflow',        PROP_STRING],
    ['zindex',          PROP_STRING],
    ['padding',         PROP_STRING],
    ['width',           PROP_STRING],
    ['height',          PROP_STRING],
    ['positionvalue',   PROP_STRING],
    ['class',           PROP_STRING],
    ['conditionalclass', PROP_ANY],
    ['conditionalstyle', PROP_ANY],
]);
```

Usage in a widget's `.props.ts`:

```typescript
import { AUTO_LAYOUT_PROPS } from '@wm/components/base';

register('wm-container', new Map([
    ['name',  PROP_STRING],
    ['show',  { value: true, ...PROP_BOOLEAN }],
    // ...widget-specific props...
    ...AUTO_LAYOUT_PROPS
]));
```

---

## 5. Property Handling

### Flex layout (`onPropertyChange`)

| Key | Stored as | Triggers |
|---|---|---|
| `direction` | `store.dir` | `needsFlex = true` |
| `wrap` | `store.wrap` | `needsFlex = true` |
| `alignment` | `store.align` | `needsFlex = true` |
| `gap` | `store.gap` | `needsFlex = true` |
| `columngap` | `store.cg` | `needsFlex = true` |
| `clipcontent` | `store.clip` | `needsOverflow = true` |
| `position` | `store.pos` | `needsPosition = true` |
| `positionvalue` | `store.inset` | `needsPosition = true` |

### Style properties (`onStyleChange`)

| Key | Effect |
|---|---|
| `width` / `height` | Calls `applySize()` on the host element |
| `padding` | Applied to the target element |
| `overflow` | Stored + `needsOverflow = true` |
| `zindex` | Stored; `applyPosition()` called if a position is set |

### Alignment matrix

| Key | `justifyContent` | `alignItems` |
|---|---|---|
| `top-left` | `flex-start` | `flex-start` |
| `top-center` | `center` | `flex-start` |
| `top-right` | `flex-end` | `flex-start` |
| `middle-left` | `flex-start` | `center` |
| `middle-center` | `center` | `center` |
| `middle-right` | `flex-end` | `center` |
| `bottom-left` | `flex-start` | `flex-end` |
| `bottom-center` | `center` | `flex-end` |
| `bottom-right` | `flex-end` | `flex-end` |
| `start` | `space-between` | `flex-start` |
| `center` | `space-between` | `center` |
| `end` | `space-between` | `flex-end` |

When `direction === 'column'`, `justifyContent` and `alignItems` are **swapped** to remain semantically correct along the cross-axis.

### Width / Height special values (`applySize`)

`applySize()` always operates on the **host element** (`inst.$element`). It uses `getComputedStyle(parent)` to detect the parent's flex context at runtime:

| Value | Parent is flex (main axis) | Parent is flex (cross axis) | Not flex |
|---|---|---|---|
| `'fill'` | `flex-grow: 1`, `flex-shrink: ''`, `min-size: 0` | `align-self: stretch` | `width/height: 100%` |
| `'hug'` | `fit-content` | `fit-content` | `fit-content` |
| Fixed | `flex-grow: ''`, `flex-shrink: 0` | `align-self: ''` | `flex-shrink: 0` |

### Overflow / clip modes

Controlled by the combination of `clipcontent` (boolean) and `overflow` (string). Overflow is only applied when `clipcontent` is `true`:

| `overflow` value | CSS result |
|---|---|
| `'vertical'` | `overflow-x: hidden; overflow-y: scroll` |
| `'horizontal'` | `overflow-x: scroll; overflow-y: hidden` |
| `'both directions'` / `'both'` | `overflow: scroll` |
| `'no scrolling'` / `'none'` | `overflow: hidden` |
| *(clipcontent false)* | clears all overflow styles |

### Position / inset

`position: 'sticky'` with optional `positionvalue` (CSS inset shorthand, e.g. `'0px auto auto 0px'`). The value is parsed into `top/right/bottom/left` sides; `'auto'` sides are cleared. If no `positionvalue` is set, sticky defaults to `top: 0, left: 0`.

---

## 6. List and ListItem Details

### `ListComponent` — `@AutoLayout({ targetSelector: 'ul' })`

The list's outer `<div>` hosts pagination, title, and the search bar. The `<ul>` element is the actual item container. `targetSelector: 'ul'` directs all flex/overflow/padding to the `<ul>` while `width`/`height` land on the outer `<div>`.

**`hasAutolayout` flag**

Set in the constructor by inspecting the host element's attributes:

```typescript
const autoLayoutAttrs = ['wrap', 'alignment', 'gap', 'columngap'];
const directionValue = this.nativeElement.getAttribute('direction');
const hasAutoLayoutDirection = directionValue === 'row' || directionValue === 'column';
this.hasAutolayout = hasAutoLayoutDirection || autoLayoutAttrs.some(attr =>
    this.nativeElement.hasAttribute(attr)
);
```

When `true`, the template adds `list-group-autolayout` to the `<ul>` element, which overrides default Bootstrap list-group styles that would otherwise conflict with the decorator's flex layout.

### `ListItemDirective` — `@AutoLayout({ bindParent: 'listComponent.viewParent' })`

Each list item is stamped by `*ngFor`, so its own `viewParent` is the NgFor embedded view, not the page scope. `bindParent: 'listComponent.viewParent'` ensures that `bind:` expressions on the list-template's AutoLayout properties (e.g. `alignment.bind="somePageVar"`) are watched against the **page scope**, consistent with how all other widget bindings in the page work.

The list-item's props consist entirely of `AUTO_LAYOUT_PROPS` — the list template (`wm-listtemplate`) only exposes AutoLayout properties and nothing else.

---

## 7. `AutoLayoutUtils` (Supplementary)

**File:** `projects/components/base/src/utils/autolayout-utils.ts`

An older abstract class that predates the `@AutoLayout()` decorator. `ContainerDirective` still instantiates it via an anonymous inner class pattern alongside the decorator. All other AutoLayout adopters use only the decorator.

The decorator's `applySize()` uses `getComputedStyle(parent)` for parent flex detection. `AutoLayoutUtils.applySize()` uses `parentElement.hasAttribute('wmcontainer') || hasAttribute('wmautolayout')` — an older attribute-based approach.
