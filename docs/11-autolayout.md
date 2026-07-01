# AutoLayout System

Documents the `AutoLayoutUtils` flexbox layout engine and its current implementation inside `ContainerDirective` for Prism (design-time preview) mode.

---

## 1. Overview

`AutoLayoutUtils` is an abstract utility class that encapsulates CSS flexbox layout mutations. It is not an Angular directive — it has no selector, no DI, no lifecycle hooks. It operates by mutating the host element's styles via the `$element` jQuery-like wrapper.

**Current adopter: `ContainerDirective` only.** `LinearLayoutDirective` and `ListComponent` each have their own independent layout mechanisms that predate this system (see [Section 5](#5-non-adopters)).

---

## 2. Prism Mode Guard

AutoLayout activates only when the WaveMaker app template is `"PRISM"`:

```typescript
// app.service.ts
this.isPrism = wmProjectProperties.template === "PRISM";
```

`ContainerDirective` checks this in its constructor and skips `AutoLayoutUtils` entirely in normal runtime mode:

```typescript
this.isPrism = this.app.isPrism;
if (this.isPrism) {
    this.initializeAutoLayout();
}
```

---

## 3. `AutoLayoutUtils` Class

**File:** `projects/components/base/src/utils/autolayout-utils.ts`

### 3.1 DOM References (provided by subclass)

| Protected property | Type | Description |
|---|---|---|
| `nativeElement` | `HTMLElement` | Widget's host DOM element |
| `$element` | `any` | jQuery-wrapped host element |
| `parentElement` | `HTMLElement \| null` | Immediate DOM parent |

### 3.2 State Fields

| Field | Default | Description |
|---|---|---|
| `direction` | `'row'` | Current flex-direction |
| `hasWrap` | `false` | Whether flex-wrap is enabled |
| `alignment` | `'top-left'` | Current named alignment key |
| `gap` | — | Row-gap / uniform gap value |
| `columngap` | — | Column-gap value |
| `clipContent` | — | Whether to clip overflowing content |
| `position` | — | `'sticky'` or unset |
| `overflowtype` | — | One of four overflow mode strings |
| `zIndex` | — | z-index for positioned elements |

### 3.3 Public API

| Method | Routed by | Description |
|---|---|---|
| `onPropertyChange(key, nv, ov?)` | Widget's `onPropertyChange` | Dispatcher for layout property changes |
| `applyStyleChange(key, nv)` | Widget's `onStyleChange` | Handles style-category changes: `width`, `height`, `padding`, `overflow`, `zindex` |
| `applyDirection(direction)` | `onPropertyChange` | Sets `flex-direction`; forces `hasWrap = false` in column mode |
| `applyWrap(wrap)` | `onPropertyChange` | Sets `flex-wrap` |
| `applyAlignment(key)` | `onPropertyChange` | Maps named key to `justifyContent`/`alignItems` |
| `applySpacing(key, nv)` | `onPropertyChange` | Sets `gap`/`column-gap` with wrap-aware logic |

---

## 4. Alignment Matrix

`applyAlignment()` maps 12 named keys to flexbox values. When `direction === 'column'`, the `justifyContent` and `alignItems` values are **swapped** so that the semantics remain correct along the cross-axis.

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

---

## 5. Width / Height Special Values

Handled by `applySize()` (private, called from `applyStyleChange`):

| Value | Applied CSS |
|---|---|
| `'fill'` on width | `width: 100%` |
| `'fill'` on height — inside AutoLayout parent | `align-self: stretch; flex-grow: 1` |
| `'fill'` on height — outside AutoLayout parent | `height: 100%` |
| `'hug'` | `width/height: fit-content` |
| Fixed number | `flex-shrink: 0` (prevents shrinking below set size) |

**AutoLayout parent detection** (`autolayout-utils.ts` line 210):

```typescript
if (this.parentElement?.hasAttribute('wmcontainer') || this.parentElement.hasAttribute('wmautolayout')) {
    this.$element.css({ 'align-self': 'stretch', 'flex-grow': '1' });
} else {
    this.$element.css('height', '100%');
}
```

A child element with `height: fill` uses flex-stretch only when its immediate parent carries either:
- `wmcontainer` — set automatically by the `[wmContainer]` selector
- `wmautolayout` — a reserved attribute for future widgets that want to participate in the same parent-detection contract

---

## 6. Overflow / Clip Modes

Handled by `handleClipBehaviour()` (triggered by `applyStyleChange('overflow', ...)`):

| `overflow` value | CSS result |
|---|---|
| `'vertical'` | `overflow-x: hidden; overflow-y: scroll` |
| `'horizontal'` | `overflow-x: scroll; overflow-y: hidden` |
| `'both directions'` | `overflow: scroll` |
| `'no scrolling'` | `overflow: hidden` if `clipcontent` is set, else clears overflow |

---

## 7. Reference Implementation: `ContainerDirective`

**File:** `projects/components/base/src/widgets/common/container/container.directive.ts`

`ContainerDirective` is the sole current user of `AutoLayoutUtils`. The anonymous inner class pattern is used to supply DOM references without multiple inheritance:

```typescript
private initializeAutoLayout() {
    const self = this;
    this.autoLayoutUtils = new class extends AutoLayoutUtils {
        protected nativeElement  = self.nativeElement;
        protected $element       = self.$element;
        protected parentElement  = self.nativeElement.parentElement ?? null;
    }();
}
```

Both property and style change hooks delegate to `autoLayoutUtils` before calling `super`, so AutoLayout CSS is applied first and the base class handles everything else after:

```typescript
onPropertyChange(key: string, nv: any, ov?: any) {
    if (this.isPrism && this.autoLayoutUtils) {
        this.autoLayoutUtils.onPropertyChange(key, nv, ov);
    }
    super.onPropertyChange(key, nv, ov);
}

protected onStyleChange(key: string, nv: any, ov?: any) {
    if (this.isPrism && this.autoLayoutUtils) {
        this.autoLayoutUtils.applyStyleChange(key, nv);
    }
    super.onStyleChange(key, nv, ov);
}
```

---

## 8. Non-Adopters

Two layout widgets have their own independent flexbox implementations that predate `AutoLayoutUtils`:

**`LinearLayoutDirective` (`[wmLinearLayout]`)**

Uses CSS classes (`app-linear-layout-direction-row`) and direct `$element.css()` calls. Props: `direction` (`row|column|row-reverse|column-reverse`), `horizontalalign`, `verticalalign`, `spacing`. Does not check `App.isPrism`, has no `AutoLayoutUtils` integration.

**`ListComponent` (`[wmList]`) — `direction` property**

The list's `direction: 'vertical' | 'horizontal'` prop controls CSS classes for item flow orientation. It is unrelated to the flexbox AutoLayout system.
