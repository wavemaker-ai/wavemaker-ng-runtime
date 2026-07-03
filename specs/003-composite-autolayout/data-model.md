# Phase 1 Data Model: AutoLayout Support for Composite Widget

**Feature**: `003-composite-autolayout` | **Date**: 2026-07-02

This feature adds no new persisted data. The "entities" are the widget property contract and the
decorator's in-memory layout store (both already defined by the shared AutoLayout system and reused
as-is). This document records the shape of the property set the composite opts into and the fields
touched by the change.

---

## Entity 1 — AutoLayout Property Set (`AUTO_LAYOUT_PROPS`)

Shared, reusable `Map<string, propDef>` from `@wm/components/base`
(`projects/components/base/src/decorators/autolayout.props.ts`). Spread into `wm-form-group`'s
registration Map. Reused verbatim — **not modified**.

| Property | Type | Group | Effect (Prism only) | Default |
|----------|------|-------|---------------------|---------|
| `direction` | PROP_STRING | Flex arrangement | `flex-direction` (`row`/`column`) on host | unset → no inline style |
| `wrap` | PROP_BOOLEAN | Flex arrangement | `flex-wrap` on host | unset |
| `alignment` | PROP_STRING | Flex arrangement | `justify-content`/`align-items`/`align-content` | unset |
| `gap` | PROP_STRING | Flex arrangement | `gap`/`row-gap` | unset |
| `columngap` | PROP_STRING | Flex arrangement | `column-gap` | unset |
| `clipcontent` | PROP_STRING | Overflow | drives overflow clipping | unset |
| `overflow` | PROP_STRING | Overflow | `overflow-x`/`overflow-y`/`overflow` | unset |
| `position` | PROP_STRING | Position/size | `position` on host | unset → inline position cleared |
| `positionvalue` | PROP_STRING | Position/size | inset (`top`/`right`/`bottom`/`left`) | unset |
| `zindex` | PROP_STRING | Position/size | `z-index` (with position) | unset |
| `padding` | PROP_STRING | Position/size | `padding` on target | unset |
| `width` | PROP_STRING | Position/size | width incl. `fill`/`hug`/fixed flex math | unset |
| `height` | PROP_STRING | Position/size | height incl. `fill`/`hug`/fixed flex math | unset |
| `class` | PROP_STRING | Styling | CSS class (base styler) | unset |
| `conditionalclass` | PROP_ANY | Styling | conditional class binding | unset |
| `conditionalstyle` | PROP_ANY | Styling | conditional style binding | unset |

**Validation / invariants**:
- Every property's "unset" state produces **no inline style**, so an opted-in composite with no
  values set renders identically to before (SC-004 / FR-005).
- `direction` only accepts `row`/`column` (`hasValidDir`); other values are ignored (edge case:
  invalid value → fall back to default).
- All application of the above is gated on `app.isPrism` (FR-008).

---

## Entity 2 — Composite Widget registration (`wm-form-group`)

`composite.props.ts` `register('wm-form-group', Map)`. The Map is **extended** (additive):

| Key | Source | Notes |
|-----|--------|-------|
| `captionposition` | existing | unchanged |
| `name` | existing | unchanged |
| `required` | existing | unchanged |
| `show` | existing (`{value:true}`) | unchanged |
| `direction … conditionalstyle` | **new**, via `...AUTO_LAYOUT_PROPS` | spread as **last** entries |

**Invariants**:
- No key removed or retyped → backward compatible (Principle VII).
- No overlap between existing keys and the spread keys → no silent override (Decision 6).
- Registered against tag `wm-form-group` (the composite's `widgetType`), matching the existing
  `register('wm-form-group', …)` call.

---

## Entity 3 — Decorator layout store (`inst.__al_store`) — in-memory, reused

Created lazily by the decorator on the `CompositeDirective` instance (Prism only). No schema change
required for this feature; listed for completeness.

| Field | Meaning |
|-------|---------|
| `dir`, `wrap`, `align`, `gap`, `cg` | flex-arrangement working values |
| `pos`, `inset`, `z` | position working values |
| `overflow`, `clip` | overflow working values |
| `padding`, `width`, `height` | size/padding working values |
| `isViewInitialized` | gates DOM application until after view init |
| `needsFlex`/`needsOverflow`/`needsPosition` | dirty flags |
| `watches`, `destroySub` | bind-watch bookkeeping + cleanup Subject |

**Lifecycle**: populated in the decorator's wrapped `onPropertyChange`/`onStyleChange`; flushed to
DOM in `ngAfterViewInit` and on subsequent changes; torn down in the decorator's `ngOnDestroy`
(`destroySub.next()/complete()`), which then delegates to the composite's existing `ngOnDestroy`
(that nulls `componentRefs`).

---

## State transitions (design-time, Prism)

```text
prop change (e.g. direction) ──▶ decorator.onPropertyChange (isPrism?)
      │ yes                                   │ no
      ▼                                       ▼
  store updated + dirty flag           (skip; delegate only)
      │
      ▼ (if isViewInitialized)
  apply inline styles to host $element ──▶ inline styles override caption-* classes
      │
      └▶ delegate to composite.onPropertyChange (captionposition/required unaffected)
```

No transitions occur in the generated-app runtime path (`app.isPrism === false`).
