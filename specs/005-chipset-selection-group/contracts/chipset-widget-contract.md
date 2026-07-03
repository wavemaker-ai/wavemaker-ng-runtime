# Contract: `wm-chipset` Widget (Chip Selection Group)

**Feature**: `005-chipset-selection-group` | **Date**: 2026-07-03

This is the public runtime contract the new widget exposes. It is entirely additive — no
existing markup tag, property, event, or behavior of `wm-chips`, `wm-radioset`, or
`wm-checkboxset` is modified. Studio-side property-panel metadata is coordinated separately and
is **out of scope** for this contract (research.md, Decision 8).

---

## C1. Markup tag and package contract

**Given** the feature ships, **Then**:
- A new markup tag `wm-chipset` is registered, backed by `ChipsetComponent` in a new package
  `@wm/components/input/chipset` (`projects/components/widgets/input/chipset/`).
- `wm-chips` (`projects/components/widgets/input/chips/`) has zero diffs as a result of this
  feature. (Maps to FR-001.)

**Verify**: `register('wm-chipset', ...)` exists and is distinct from `register('wm-chips',
...)`; no file under `projects/components/widgets/input/chips/` appears in this feature's diff.

---

## C2. Property contract

**Given** a `wm-chipset` widget in a page, **Then** the following properties are recognized:

```
Inherited (unchanged semantics vs. radioset/checkboxset):
dataset, datafield, displayfield, displayexpression, datavalue, compareby, groupby, orderby,
itemsperrow, required, readonly, disabled, name, show, tabindex, usekeys, hint, class

New (this feature):
selectionmode ('single' | 'multiple', default 'single')
disableitem (boolean, default false) + disableitem.bind (expression, per-record)
appearance ('elevated' | 'outlined', default 'outlined')
displayimagesrc (string, per-record field name/expression) + displayimagesrc.bind
iconclass (string, per-record field name) — icon glyph pointer
iconurl (string, per-record field name) — icon/image/SVG URL pointer
```

- `selectionmode` determines both the shape of `datavalue` (scalar vs. array) and the default
  ARIA role/interaction model. (Maps to FR-002.)
- `disableitem`/`disableitem.bind` resolves per dataset record, mirroring `wm-list`'s
  `disableitem`/`binddisableitem`. (Maps to FR-008.)
- `appearance` is a single widget-level value applied uniformly to every chip. (Maps to FR-009.)
- `displayimagesrc`/`iconclass`/`iconurl` each optionally resolve a per-chip leading visual
  (avatar image or icon) from the bound data; none of the three is required for a chip to render
  or function — a chip with none set renders with no leading visual and remains fully
  selectable/keyboard-navigable. `displayimagesrc` reuses `wm-chips`' identically-named property
  and the inherited `DatasetAwareFormComponent` `imgSrc` resolution pipeline; `iconclass`/
  `iconurl` reuse `wm-switch`'s field-name-pointer convention, rendered via `<wm-app-icon>`. When
  more than one would resolve for the same record, `displayimagesrc`'s avatar image takes
  precedence over `iconclass`/`iconurl`'s icon. (Maps to FR-010.)

**Verify**: the widget registry for `wm-chipset` contains all keys above with the documented
types/defaults after `registerProps()` runs; setting `displayimagesrc` on a dataset field renders
a leading `<img>` per chip, setting `iconclass`/`iconurl` renders a leading `<wm-app-icon>` per
chip, and a chip with none of the three set renders with no leading visual and is still fully
tappable/selectable (FR-010).

---

## C3. Selection-mode behavior contract

**Given** `selectionmode = 'single'`, **Then**:
- Selecting a chip deselects any other currently-selected chip in the same widget; at most one
  chip is selected at any time; re-selecting the already-selected chip is a no-op.
  (Maps to FR-003.)
- `datavalue` is a single scalar value (or `undefined` when nothing is selected).

**Given** `selectionmode = 'multiple'`, **Then**:
- Each chip's selected state toggles independently; any number from zero to all chips may be
  selected simultaneously; zero-selected is a valid, non-error state. (Maps to FR-004.)
- `datavalue` is always an array (never a bare scalar), possibly empty.

**Given** `selectionmode` changes at runtime with an existing `datavalue`, **Then**:
- `datavalue` is reset to the new mode's empty default (`undefined` for single, `[]` for
  multiple); no scalar↔array conversion is attempted. (Maps to spec Clarification 2, Edge Cases.)

**Verify**: property-level tests set `selectionmode`, assert `datavalue`'s type/shape after the
switch, and assert selection exclusivity/independence per mode via simulated chip clicks.

---

## C4. Per-chip disable contract

**Given** `disableitem` is `true` (static) or `disableitem.bind` evaluates to a truthy value for
a specific record, **Then**:
- That chip cannot become selected/deselected via click or keyboard, is excluded from the
  roving-tabindex focus order (skipped by Arrow-key navigation), and conveys its disabled state
  to assistive technology via `aria-disabled`. (Maps to FR-008, FR-017.)
- All other chips in the same widget remain fully interactive.

**Given** every chip's `disableitem` resolves `true`, **Then** the widget has no focusable chip
and is skipped entirely in the page's Tab order, without raising a runtime error. (Maps to
spec Edge Case.)

**Verify**: mirrors `list-item.directive.spec.ts`'s `disableItemWatcher` test shape — assert the
resolved per-item disabled flag from both the static property and a `.bind` expression.

---

## C5. Appearance contract

**Given** `appearance = 'elevated'` vs. `'outlined'`, **Then** the host/chip elements carry a
distinguishing CSS class (e.g. `chipset-elevated` / `chipset-outlined`) applied to every chip in
the widget uniformly; selection behavior is identical regardless of `appearance`. (Maps to
FR-009.) Exact visual tokens are a `wavemaker-foundation-css` follow-up (research.md, Decision 5)
— this contract only covers the class-toggle behavior, not the resulting pixels.

**Verify**: assert the expected class is present on the host/chip elements for each `appearance`
value; assert click/keyboard selection behavior is unaffected by the value.

---

## C6. Keyboard & ARIA contract

**Given** `selectionmode = 'single'`, **Then** the host exposes `role="radiogroup"` and each
enabled chip exposes `role="radio"` + accurate `aria-checked`. **Given** `selectionmode =
'multiple'`, **Then** the host exposes `role="group"` and each enabled chip exposes
`role="checkbox"` + accurate `aria-checked`. (Maps to FR-016.)

**Given** keyboard focus outside the widget, **When** the user presses Tab, **Then** focus lands
on exactly one chip (the roving-tabindex target) as a single Tab stop; a further Tab moves focus
out of the entire widget. (Maps to FR-015.)

**Given** focus on one enabled chip, **When** the user presses an Arrow key, **Then** focus (and
the roving `tabindex="0"`) moves to the adjacent *enabled* chip, skipping any `disableitem`
chip, and wraps around at the ends (last→first, first→last). (Maps to FR-015, spec
Clarification 4.)

**Given** focus on a chip, **When** the user presses Enter or Space, **Then** the same
selection/deselection behavior occurs as a pointer click on that chip. (Maps to FR-015.)

**Given** every chip is disabled (widget-level `disabled` or all-records `disableitem`),
**Then** the widget is fully skipped in Tab order. (Maps to FR-017, spec Edge Case.)

**Verify**: simulated `keydown` events for Tab/Arrow*/Enter/Space against a
`chipset.wrapper.component.spec.ts` fixture, asserting `tabindex`/`aria-*` attribute values and
resulting `datavalue` after each interaction.

---

## C7. Event contract

| Event | Signature (locals) | Fires | Cancelable |
|-------|--------------------|-------|------------|
| `onbeforechange` | `$event, newVal, oldVal` | Before a user-driven selection change is committed | Yes — returning `false` cancels the change; no state mutation, no further events fire |
| `onchange` | `$event, widget, newVal, oldVal` | Whenever `datavalue` changes — user tap **or** programmatic assignment | No |
| `onselect` | `$event, $item` | A specific chip transitions unselected → selected (user or programmatic) | No |
| `ondeselect` | `$event, $item` | A specific chip transitions selected → unselected (user or programmatic) | No |

**Given** `onbeforechange` returns `false` for a user tap, **Then** no selection state changes
and none of `onchange`/`onselect`/`ondeselect` fire for that interaction. (Maps to FR-014.)

**Given** the app sets `datavalue` programmatically, **Then** `onchange` fires, and
`onselect`/`ondeselect` fire for each chip whose selected state changed as a result — but
`onbeforechange` does **not** fire (before-hooks gate user interaction only). (Maps to FR-012,
FR-013, spec Clarification 3.)

**Verify**: wire Jest spies to all four events in `chipset.component.spec.ts`; assert call
counts/arguments for user clicks, programmatic `datavalue` sets, and a cancelling
`onbeforechange` handler.

---

## C8. Form-integration contract

**Given** `wm-chipset` is placed inside a `wm-form`, **Then**:
- `required`, `readonly`, and `disabled` behave with the same semantics as an equivalent
  `wm-radioset` (single-select) or `wm-checkboxset` (multi-select): `required` fails validation
  on an empty selection in either mode; `readonly`/`disabled` block interaction while preserving
  the current value. (Maps to FR-011.)
- The widget's `datavalue` participates in the form's overall submitted data value the same way
  radioset/checkboxset's does (via the inherited `NG_VALUE_ACCESSOR`/`NG_VALIDATORS`
  providers — no new form-integration code required beyond what `DatasetAwareFormComponent`
  already provides).

**Verify**: reuses the existing `ComponentTestBase` harness (`verifyStyles`,
`verifyAccessibility`, common-properties checks) plus targeted required/readonly/disabled
assertions, mirroring `checkboxset.wrapper.spec.ts`'s structure.

---

## C9. Dynamic/AOT registration contract

**Given** the feature ships, **Then**:
- `ChipsetComponent` is declared in `runtime-base.module.ts` and added to
  `REQUIRED_MODULES_FOR_DYNAMIC_COMPONENTS` in `runtime-dynamic/src/app/app.module.ts`, so a
  page using `<wm-chipset>` compiles correctly in dynamic (JIT) mode. (Maps to Constitution
  Principle IV.)
- A `chipset.build.ts` AOT emitter is registered in `projects/components/transpile/src/public_api.ts`,
  so AOT-generated apps render the same host markup/roles as the dynamic runtime.
- `FormWidgetType.CHIPSET` exists in `projects/core/src/enums/enums.ts` and is included in
  `DATASET_WIDGETS` in `projects/components/base/src/utils/widget-utils.ts`.

**Verify**: a page containing `<wm-chipset>` compiles and renders without a "component not
found" runtime error in a dynamic-mode smoke test; `isDataSetWidget(FormWidgetType.CHIPSET)`
returns `true`.

---

## C10. Testing contract (Constitution Principle VIII — hard gate)

**Given** this is a new widget, **Then**:
- `chipset.component.spec.ts` and `chipset.wrapper.component.spec.ts` MUST exist under
  `projects/components/widgets/input/chipset/src/` and MUST exercise every property in C2,
  every behavioral contract in C3–C6, and every event in C7.
- `npm test` MUST pass including this new coverage before the feature is considered complete;
  this is a hard, non-waivable merge gate for new widgets per Principle VIII.

**Verify**: `npm test` run locally includes both new spec files (auto-discovered by the root
`jest.config.js` `testMatch` glob, no config changes needed) and exits 0.
