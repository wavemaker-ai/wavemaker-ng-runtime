# Contract: AutoLayout on `wm-composite` (`wm-form-group`)

**Feature**: `003-composite-autolayout` | **Date**: 2026-07-02

This is the UI/widget contract the runtime exposes after the change. It is additive and
backward-compatible. Studio-side property-panel metadata is coordinated separately via the
`autolayout-studio` skill and is **out of scope** for this contract.

> **Note**: Testing is out of scope for this plan (per user request). The "Verify" lines below are
> observable/manual checks describing expected behavior, not authored test cases.

---

## C1. Public property contract (markup tag `wm-form-group`)

**Given** a `wm-composite` widget in a page,
**Then** the following properties are recognized (not ignored) in addition to the existing
`captionposition`, `name`, `required`, `show`:

```
direction, wrap, alignment, gap, columngap, clipcontent, overflow,
position, positionvalue, zindex, padding, width, height,
class, conditionalclass, conditionalstyle
```

- Types are exactly those in `AUTO_LAYOUT_PROPS` (PROP_STRING / PROP_BOOLEAN / PROP_ANY).
- No existing property is removed, retyped, or given a new default.
- Registration: these keys appear as the **last** entries of the `register('wm-form-group', …)` Map
  (spread `...AUTO_LAYOUT_PROPS`).

**Verify**: the widget registry for `wm-form-group` contains all 16 keys above with the shared
types after `registerProps()` runs. (Maps to SC-001, FR-001, FR-004.)

---

## C2. Decorator contract (host targeting, Prism gating)

**Given** `@AutoLayout()` is applied to `CompositeDirective` with no options,
**Then**:
- The layout target is the widget **host** element `div[wmComposite]` (default; no `targetSelector`).
  (Maps to FR-007.)
- `bind:` expressions on `position`/`positionvalue`/`conditionalclass`/`conditionalstyle`/`zindex`
  resolve against the standard `inst.viewParent` (no `bindParent`).
- Every layout effect executes **only** when `app.isPrism === true`. When `app.isPrism === false`
  (generated-app runtime), `onPropertyChange`/`onStyleChange`/`ngAfterViewInit` do their original
  work only and apply **no** inline layout styles. (Maps to FR-008, SC-004.)

**Verify**: when `app.isPrism === false`, setting `direction`/`width`/etc. produces no inline style
on the host; when `app.isPrism === true`, the corresponding inline styles appear.

---

## C3. Flex-arrangement contract (design-time)

**Given** `app.isPrism === true` and a designer sets `direction` (and optionally
`wrap`/`alignment`/`gap`/`columngap`),
**Then** the host receives inline flex styles (`display:flex`, `flex-direction`, etc.) that arrange
its children (caption + input control). These inline styles **take precedence** over the
`caption-*` class-based layout. (Maps to FR-002, SC-002, clarification Q2 = option B.)

**Given** no flex-arrangement props are set,
**Then** no flex inline styles are applied and `captionposition` (`caption-left`/`caption-right`/
`caption-top`/`caption-floating`) remains authoritative. (Maps to FR-006, SC-005.)

---

## C4. Position/size contract (design-time)

**Given** `app.isPrism === true` and a designer sets `position`/`positionvalue`/`width`/`height`/
`padding`/`overflow`/`zindex`/`clipcontent`,
**Then** the corresponding inline styles are applied to the host (size lands on `$element`; padding
on target), following the shared decorator's `fill`/`hug`/fixed math. (Maps to FR-003, SC-003.)

---

## C5. Preservation contract (no regression)

**Given** the change is applied,
**Then**:
- `captionposition` changes still toggle `caption-left`/`caption-right`/`caption-top`/
  `caption-floating` via `switchClass` (unchanged code path). (Maps to FR-006.)
- `required` still propagates to child input controls (`assignRequiredToSubComponents` in
  `ngAfterViewInit` and on the `required` property change). (Maps to FR-006.)
- Default host classes `form-group app-composite-widget clearfix` are unchanged.
- A composite with no AutoLayout values set renders identically to before. (Maps to SC-004.)

**Verify** (observable behavior, unchanged code paths): default classes present, `required` set +
propagated, `captionposition` class toggling, and `addForIdAttributes` in `ngAfterViewInit` all
behave exactly as before.

---

## C6. Dependency contract

**Then** no new npm/library dependency is introduced. Only existing `@wm/components/base`
(`AutoLayout`, `AUTO_LAYOUT_PROPS`) and `@wm/core` (`App`) symbols are imported. (Maps to plan
constraint "No new dependencies".)
