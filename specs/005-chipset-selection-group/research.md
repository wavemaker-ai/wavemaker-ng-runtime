# Phase 0 Research: Chip Selection Group Widget (wm-chipset)

**Feature**: `005-chipset-selection-group` | **Date**: 2026-07-03

All clarifications from `spec.md` are resolved (per-chip disable via boolean expression,
mode-switch always clears datavalue, events fire on both user + programmatic changes, arrow-key
wrap-around, widget-level appearance). No `NEEDS CLARIFICATION` markers remain. The user
directive for this plan supplied the core architectural decisions directly; research below
confirms each against the actual `wm-radioset`/`wm-checkboxset`/`wm-list`/`wm-chips` source and
records the exact touchpoints.

---

## Decision 1 — Base class: extend `DatasetAwareFormComponent` directly (mirror radioset/checkboxset)

**Decision**: `ChipsetComponent extends DatasetAwareFormComponent`, registered with
`provideAs(ChipsetComponent, NG_VALUE_ACCESSOR, true)`, `provideAs(ChipsetComponent,
NG_VALIDATORS, true)`, and `provideAsWidgetRef(ChipsetComponent)` — the identical provider set
`RadiosetComponent`/`CheckboxsetComponent` use.

**Rationale**:
- `DatasetAwareFormComponent` (`projects/components/widgets/input/dataset-aware-form/src/dataset-aware-form.component.ts`)
  already implements the entire data-binding contract FR-005 requires: `dataset`, `datafield`,
  `displayfield`, `displayexpression`, `orderby`, `compareby`, `groupby` (via `setGroupData`),
  and the `datavalue`/`modelByKey` proxy getters/setters that convert between selected
  `datasetItems` and the underlying record value(s).
- No duplication of dataset-parsing, ordering, grouping, or value-selection logic is needed —
  this is the single biggest complexity reducer for the feature.

**Alternatives considered**:
- *Extend `BaseFormCustomComponent` directly and hand-roll dataset handling* — rejected:
  duplicates `initDatasetItems`/`selectByValue`/`selectByKey` and diverges from FR-005's
  explicit requirement to reuse the same contract as radioset/checkboxset.

---

## Decision 2 — `selectionmode` dynamically toggles `this.multiple` (new capability vs. radioset/checkboxset)

**Decision**: Add a `selectionmode` property (`PROP_STRING`, values `'single' | 'multiple'`,
default `'single'`). In `ChipsetComponent.onPropertyChange('selectionmode', nv)`: set
`this.multiple = (nv === 'multiple')`, then clear `this.datavalue` to that mode's empty default
(`undefined` for single, `[]` for multiple) **before** re-running `initDatasetItems`/
`selectByValue`, per the spec's Clarification 2 ("always clear, never convert").

**Rationale**:
- `radioset.component.ts`/`checkboxset.component.ts` each set `this.multiple` exactly once in
  their constructor (`this.multiple = false;` / `this.multiple = true;`) and never change it —
  `multiple` is read everywhere in `DatasetAwareFormComponent` (`datavalue` setter,
  `selectByKey`, `selectByValue`, `initDisplayValues`) to decide scalar-vs-array shape. Because
  `wm-chipset` is a single widget with a mode switch (not two widgets like radioset/checkboxset),
  it is the first consumer of `DatasetAwareFormComponent` that needs to flip this flag at
  runtime — confirmed safe because every read site re-derives its shape from `this.multiple`
  live (no cached shape assumption baked in at construction time).
- Clearing before re-selection avoids the base class's `selectByValue`/`selectByKey` trying to
  interpret a scalar as an array (or vice versa), which would otherwise hit the `isArray`
  branches with mismatched shapes and silently misbehave rather than cleanly reset.

**Alternatives considered**:
- *Attempt scalar↔array conversion on mode switch* — rejected per spec Clarification 2.
- *Make `selectionmode` non-reactive (design-time only, requires re-instantiation)* — rejected:
  the spec's edge case explicitly requires switching at design time after chips already exist
  to re-render correctly, which requires a live `onPropertyChange` handler, not a constructor-only flag.

---

## Decision 3 — Custom `role="radio"`/`role="checkbox"` chip elements with shared roving-tabindex (deviates from native-input DOM)

**Decision**: Render each chip as a custom element (e.g. `<li role="radio"|"checkbox"
aria-checked="..." tabindex="0|-1">`), not a native `<input type="radio">`/`<input
type="checkbox">` as radioset/checkboxset do. The host list carries `role="radiogroup"`
(single-select) or `role="group"` (multi-select) plus a single `keydown` listener implementing:
- **Roving tabindex**: exactly one chip has `tabindex="0"` at a time (the selected chip in
  single-select, or the last-focused/first chip otherwise); all others have `tabindex="-1"`.
- **Arrow keys**: move the roving tabindex + DOM focus to the adjacent chip, wrapping at the
  ends (Clarification 4).
- **Enter/Space**: activate the focused chip identically to a click.
A visually-hidden native `<input>` (mirroring the existing `.model-holder` hidden input in
`radioset.component.html`/`checkboxset.component.html`) is retained solely so
`NG_VALUE_ACCESSOR`/Angular Forms plumbing and existing `disabled`/`readonly` conventions keep
working; it is not the interactive/focusable element.

**Rationale** (confirmed against actual template source):
- `radioset.component.html` uses native `<input type="radio" [name]="'radioset_' + widgetId"
  [tabindex]="tabindex">` inside each `<label>`. Because all radios share one `name`, the
  browser natively provides roving-tabindex + arrow-key navigation + `radiogroup`/`radio` ARIA
  — this works *only* because they're natively-grouped radios.
- `checkboxset.component.html` uses native `<input type="checkbox" [tabindex]="tabindex">` with
  **no shared grouping mechanism** — every checkbox gets the same explicit `tabindex` value, so
  today **each checkbox is its own independent Tab stop** with no native arrow-key navigation
  between them. This is a real, confirmed gap relative to FR-015's requirement that *both*
  modes behave as a single roving-tabindex composite control.
- Building `wm-chipset` on native inputs would therefore mean two different keyboard models:
  "free" native roving behavior for single-select, and unsupported-by-native-checkboxes
  behavior for multi-select requiring the exact same custom roving-tabindex/arrow-key code
  anyway. Using one custom ARIA/keyboard implementation for **both** modes avoids maintaining
  two divergent interaction paths and guarantees FR-015/FR-016 hold identically in either mode.

**Alternatives considered**:
- *Native radios for single-select, custom roving tabindex only for multi-select* — rejected:
  two different keyboard/ARIA code paths to test and maintain for one widget; higher regression
  risk when `selectionmode` changes at runtime (Decision 2) since the DOM structure/interaction
  model would need to switch entirely, not just re-toggle a flag.
- *Native checkboxes + a custom `keydown` capture layer bolted on top* — rejected: native
  checkbox focus/activation (Space toggles, click toggles) still fights a custom roving-tabindex
  layer trying to manage `tabindex` on native form controls consistently across browsers; a
  fully custom element sidesteps this.

---

## Decision 4 — `disableitem`/`disableitem.bind`: per-record disable expression (mirrors `wm-list`)

**Decision**: Add `disableitem` (`PROP_BOOLEAN`) plus the standard `.bind` attribute
(`@Attribute('disableitem.bind') binddisableitem`), evaluated per dataset record in the chip's
item scope — the same pattern as `wm-list`.

**Rationale** (confirmed against actual source):
- `projects/components/widgets/data/list/src/list.props.ts` registers `disableitem` as
  `PROP_BOOLEAN`; `list.component.ts` exposes `binddisableitem` via
  `@Attribute('disableitem.bind')`; `list-item.directive.ts`'s `disableItemWatcher()` resolves
  it per-item: `if ($list.binddisableitem) { this.registerWatch($list.binddisableitem, nv =>
  this.disableItem = nv || false) } else { this.disableItem = $list.disableitem || false }`.
- `wm-chipset` needs the exact same "evaluate this expression against each record" semantics
  (spec Clarification 1), so reusing the identical property name and `.bind` convention keeps
  it consistent with an existing, already-shipped pattern app builders and Studio already know,
  rather than inventing new naming.

**Alternatives considered**:
- *A dedicated `disablefield` property naming a boolean dataset column* — rejected by spec
  Clarification 1 in favor of the expression-based approach.
- *No per-chip disabling in v1* — rejected: FR-008 requires it as a MUST, not a nice-to-have,
  after clarification.

---

## Decision 5 — `appearance` (elevated/outlined): new widget-level `PROP_STRING`, styling deferred to foundation-css

> **Amendment (2026-07-17) — superseded**: The coordinated studio/foundation-css follow-up this
> decision anticipated is now done, and it changed the approach: rather than keeping a bespoke
> runtime `appearance` property alongside the new studio wiring, `appearance` was **removed**
> from the runtime widget entirely. `wavemaker-ng-studio` now registers `tokenFileName: "chipset"`
> on the widget config, so the generic `variant` property (already used by every other widget,
> e.g. `wm-button`) resolves its options from `chipset.json`'s existing `appearances` map and
> applies the resulting class via `BaseComponent.syncAppearanceVariantClasses`. The runtime side
> needed no new code for this — it already accepted arbitrary `class` values — only a change to
> `hostClass`/`DEFAULT_CLS` (`'app-chipset chipset-outlined'` → `'app-chipset'`) so the default
> appearance class doesn't permanently coexist with a later variant selection. `chipset.json`
> itself needed **no changes** — its existing `appearances.outlined`/`appearances.elevated`
> blocks (each with a `meta.appearances.<name>.mapping.selector` and per-appearance `mapping`)
> already matched the shape the studio variant-resolution pipeline (`WidgetStylingService.
> getAppearanceVariantSelectors`) expects for a plain (non-`variantGroups`) appearance. The
> original decision below is preserved as historical record of the pre-migration design.

**Decision**: Add `appearance` (`PROP_STRING`, values `'elevated' | 'outlined'`, default
`'outlined'`) that toggles a single host-level class (e.g. `chipset-elevated` /
`chipset-outlined`) applied uniformly to all chips (spec Clarification 5). This plan defines
the property and class-toggle contract only; the actual CSS/design tokens for the two looks are
a `wavemaker-foundation-css` change, coordinated separately (Principle VII) and not part of
this ng-runtime plan's file list.

**Rationale**:
- The existing `wm-chips` foundation-css assets (`src/tokens/web/components/chips/chips.json`,
  `src/styles/web/components/chips.less`) belong to the *other*, unrelated `wm-chips` tag-input
  widget and MUST NOT be reused/edited for `wm-chipset` (FR-001). `wm-chipset` needs its own
  token/style file in that repo, which is out of this repo's scope.
- Keeping the property contract (name, values, default, class-toggle behavior) defined here
  means the ng-runtime widget is fully buildable/testable (assertions can check the class is
  applied) even before the paired foundation-css tokens exist; visual styling is additive on
  top.

**Alternatives considered**:
- *Per-chip appearance driven from bound data* — rejected by spec Clarification 5.
- *Bundle placeholder CSS directly in the widget package instead of foundation-css* — rejected:
  violates Principle VI/existing convention that non-layout styling comes from foundation-css
  token/host classes, not hardcoded per-widget styles.

---

## Decision 6 — Events: `onbeforechange` (new, cancelable), `onchange` (mostly free), `onselect`/`ondeselect` (new, diffed)

**Decision**:
- `onchange`: rely on the inherited `DatasetAwareFormComponent.datavalue` setter, which already
  calls `this.invokeOnChange(val, undefined, true)` on **every** assignment — both user-driven
  (via `modelByKey` setter → `selectByKey` → `invokeOnChange`) and programmatic (direct
  `datavalue =` assignment) — so FR-012's "fires on both sources" requirement needs no new
  code beyond exposing the `onchange` event binding itself.
- `onselect`/`ondeselect`: added in `ChipsetComponent` by diffing the previous vs. new set of
  selected `datasetItems` keys whenever `datavalue`/`modelByKey` is set (both from a chip click
  and from a programmatic `datavalue` assignment, per Clarification 3), firing one `onselect`
  per newly-selected chip and one `ondeselect` per newly-deselected chip.
- `onbeforechange`: a new cancelable hook invoked from the chip click handler (and, per FR-014,
  also gating programmatic changes is out of scope — before-handlers gate *user* interaction
  only, consistent with existing `onBefore*` widgets which never gate programmatic property
  sets) via `this.invokeEventCallback('beforechange', {$event, newVal, oldVal})`; if it returns
  `false` (checked with the same `isDefined(...) && !toBoolean(...)` guard `wm-chips` uses for
  `beforeadd`/`beforeremove`), the click handler returns early before touching `modelByKey`.

**Rationale**:
- Confirmed in `dataset-aware-form.component.ts` lines 74–87: the `datavalue` setter
  unconditionally calls `invokeOnChange`, independent of call site — this is exactly the "fire
  for both programmatic and user changes" behavior the spec's Clarification 3 asks for, at zero
  extra cost.
- `wm-chips`' `beforeadd`/`beforeremove` (`chips.component.ts` `addItem()`/`removeItem()`) are
  the established codebase precedent for a cancelable before-hook returning `false` to abort a
  default action; `onbeforechange` follows the identical `invokeEventCallback('before...')` +
  `isDefined(...) && !toBoolean(...)` guard shape.
- Neither radioset nor checkboxset has `onselect`/`ondeselect`/`onbeforechange` today — these
  are additive, `wm-chipset`-only events; no shared base-class event contract is modified.

**Alternatives considered**:
- *Fire `onchange` only for user interaction* — rejected by spec Clarification 3.
- *Implement `onbeforechange` as a `canDeactivate`-style Observable/Promise gate* — rejected:
  inconsistent with the synchronous boolean-return `onBefore*` convention used everywhere else
  in this codebase (Principle III).

---

## Decision 7 — Widget registration touchpoints (Dynamic + AOT + dataset-widget classification)

**Decision**: Wire `wm-chipset` through every touchpoint `wm-radioset`/`wm-checkboxset` use:

| File | Change |
|------|--------|
| `projects/core/src/enums/enums.ts` | Add `CHIPSET = 'chipset'` to `FormWidgetType` |
| `projects/components/base/src/utils/widget-utils.ts` | Add `FormWidgetType.CHIPSET` to `DATASET_WIDGETS` (so `isDataSetWidget()` recognizes it, matching SELECT/CHECKBOXSET/RADIOSET/etc.) |
| `projects/runtime-base/src/runtime-base.module.ts` | Import `ChipsetComponent` from `@wm/components/input/chipset`; add to the module's declared/exported component list |
| `projects/runtime-dynamic/src/app/app.module.ts` | Import `ChipsetComponent`; add to `REQUIRED_MODULES_FOR_DYNAMIC_COMPONENTS` (Principle IV — otherwise a page using `<wm-chipset>` throws a runtime compilation error in dynamic/JIT mode) |
| `projects/components/transpile/src/input/default/chipset/chipset.build.ts` (new) | AOT build-time markup emitter registered via `register('wm-chipset', ...)`, mirroring `radioset.build.ts`'s `pre`/`post` shape, emitting the correct host `role` (`radiogroup` vs `group`, driven by `selectionmode` if statically known, else default `group` with the runtime component correcting the ARIA role reactively) |
| `projects/components/transpile/src/public_api.ts` | Add `export * as chipsetBuild from './input/default/chipset/chipset.build';` |

**Rationale**: Confirmed by grepping every `RadiosetComponent`/`CheckboxsetComponent`/
`RADIOSET`/`CHECKBOXSET` reference across `projects/` — these six files are the complete,
minimal set required for a new dataset-driven form widget to work in both dynamic (JIT) and
AOT-generated runtime modes, matching Constitution Principle IV exactly.

**Alternatives considered**:
- *Skip the AOT build emitter, rely on a generic fallback* — rejected: no generic fallback
  exists for this transpiler; every input widget with custom host markup registers its own
  `.build.ts`, confirmed by `radioset.build.ts`/`checkboxset.build.ts` both existing.
- *Skip `DATASET_WIDGETS` registration* — considered lower-risk to defer, but included since it
  is a one-line, low-risk addition that keeps `wm-chipset` consistent with every other
  dataset-driven form widget for any code that branches on `isDataSetWidget()`.

---

## Decision 8 — Studio metadata and foundation-css tokens are explicitly out of scope for this plan

**Decision**: This plan covers `wavemaker-ng-runtime` only. Studio markup/property-panel
metadata (`wavemaker-ng-studio`) and the `appearance` CSS tokens (`wavemaker-foundation-css`,
Decision 5) are **not** included in this plan's file list or tasks; they are flagged as
sequenced, coordinated follow-up work per Constitution Principle VII.

**Rationale**: The feature request and spec scope this work to the runtime widget itself; the
repository constitution explicitly calls out that cross-repo contract changes must be
coordinated but does not require them to land in the same change set as this plan.

**Alternatives considered**: *Bundle studio/foundation-css changes into this plan* — rejected:
out of the current repo/branch, and each has its own coordination skill/workflow
(`autolayout-studio`, `autolayout-tokens`-style token propagation) better run as separate,
explicitly sequenced work once the runtime contract here is finalized.

---

## Decision 9 — Optional leading icon/avatar per chip: reuse `displayimagesrc` (avatar) + `iconclass`/`iconurl` field-pointers (icon), no new property-naming convention

**Decision**: Add three optional, per-record `PROP_STRING` properties to `chipset.props.ts`,
all reusing conventions already shipped elsewhere in the codebase rather than inventing new
property names:
- `displayimagesrc` (+ the standard `.bind` attribute `binddisplayimagesrc`) — identical in name
  and behavior to `wm-chips`' property of the same name. **No new resolution code is required**:
  `DatasetAwareFormComponent.initDatasetItems()` already unconditionally reads
  `this.displayimagesrc`/`this.binddisplayimagesrc` and resolves it into `DataSetItem.imgSrc` per
  record via `transformFormData`/`getEvaluatedData` — simply registering the property on
  `ChipsetComponent` is sufficient to get avatar-image support for free, the same complexity-free
  win as Decision 1.
- `iconclass` / `iconurl` — mirror `wm-switch`'s convention exactly: the property **value is a
  dataset field name**, resolved per record as `item.dataObject[iconclass]` /
  `item.dataObject[iconurl]`, and rendered through the shared `<wm-app-icon>` component (which
  itself already branches SVG → image → font-class).
- Render order in `chipset.component.html`: if `item.imgSrc` (from `displayimagesrc`) resolves,
  render a leading `<img>` (mirroring `chips.component.html`'s `button-image-icon`/`chip-picture`
  pattern); else if `item.dataObject[iconclass]` or `item.dataObject[iconurl]` resolves, render a
  leading `<wm-app-icon>` (mirroring `switch.component.html`); else render no leading visual. All
  three properties are independently optional and have no effect on selection behavior,
  `datavalue` shape, or the chip's tappability/keyboard-navigability (FR-010's "not a requirement
  for the chip to render or function").

**Rationale** (confirmed against actual source across the codebase — no `iconfield`,
`avatarfield`, or `avatarsrc` property exists anywhere in `wavemaker-ng-runtime`):
- `displayimagesrc`/`binddisplayimagesrc` are read unconditionally inside the shared
  `DatasetAwareFormComponent.initDatasetItems()` (`dataset-aware-form.component.ts`, the
  `transformFormData(...)` call) regardless of which subclass declares them, and
  `transformFormData`/`getEvaluatedData` (`projects/components/base/src/utils/form-utils.ts`,
  `widget-utils.ts`) already populate `DataSetItem.imgSrc` per record from a field name,
  expression, or `.bind` expression — this is the exact mechanism `wm-chips` uses for its
  circular chip photo, and reusing the identical property name means zero new dataset-resolution
  code, consistent with Decision 1's "biggest complexity reducer" rationale.
- `wm-switch` (`switch.props.ts`, `switch.component.html`) is the only existing dataset-driven
  **form** widget with a per-record glyph/SVG icon today, using `iconclass`/`iconurl` as
  field-name pointers into `opt.dataObject` feeding `<wm-app-icon>`. This is the established
  pattern for "a font/SVG/image icon resolved per dataset record" on a `DatasetAwareFormComponent`
  sibling, as opposed to `itemicon` (reserved for the unrelated `DatasetAwareNavComponent`
  family: `wm-menu`/`wm-nav`/`wm-breadcrumb`) or a brand-new, unprecedented property name.
- Supporting both properties (rather than picking only one) satisfies FR-010's "leading icon **or**
  avatar" wording by giving the app builder a choice: a photo avatar via `displayimagesrc`, or a
  font/SVG glyph via `iconclass`/`iconurl`, on the same chip.

**Alternatives considered**:
- *New `iconfield`/`avatarfield`/`avatarsrc` property names* — rejected: no such names exist
  anywhere in the codebase; would fragment the two already-shipped, already-tested conventions
  (`displayimagesrc` dataset plumbing; `iconclass`/`iconurl` + `<wm-app-icon>`) into a third,
  redundant one.
- *A single fixed, widget-level icon (not per-chip)* — rejected: FR-010 explicitly requires the
  icon/avatar be "driven from the bound data" (per-record), not a single static icon applied to
  every chip in the group.
- *Reuse `itemicon` (the nav-widget convention)* — rejected: `itemicon`'s resolution lives in
  `DatasetAwareNavComponent`, a different base class/resolution path than `ChipsetComponent`'s
  `DatasetAwareFormComponent`; mixing the two conventions on a form widget would be inconsistent
  with every other `@wm/components/input/*` widget.

---

## Summary of resolved unknowns

| Unknown | Resolution |
|---------|------------|
| Base class | `DatasetAwareFormComponent` (reused as-is) |
| `multiple` flag | Set dynamically from `selectionmode` in `onPropertyChange`, not fixed at construction |
| Mode-switch datavalue handling | Always clear to the new mode's empty default (no conversion) |
| Chip DOM/ARIA | Custom `role="radio"`/`role="checkbox"` + roving tabindex, uniform across both modes (not native inputs) |
| Per-chip disable | `disableitem`/`disableitem.bind`, mirroring `wm-list`'s `ListItemDirective` pattern |
| Appearance | ~~New `appearance` (`elevated`/`outlined`) widget-level `PROP_STRING`~~ — superseded 2026-07-17: no runtime property; studio's `variant` + `tokenFileName: "chipset"` resolves classes from the existing `chipset.json` `appearances` map |
| Leading icon/avatar per chip | `displayimagesrc` (free via inherited `DatasetAwareFormComponent` `imgSrc` pipeline, mirrors `wm-chips`) + `iconclass`/`iconurl` field-pointers + `<wm-app-icon>` (mirrors `wm-switch`) |
| `onchange` on programmatic sets | Already free via `DatasetAwareFormComponent.datavalue` setter |
| `onselect`/`ondeselect` | New, diffed against previous selected-keys set on every `datavalue`/`modelByKey` change |
| `onbeforechange` | New, cancelable, follows `wm-chips`' `beforeadd`/`beforeremove` convention |
| Registration touchpoints | 6 files (enums, widget-utils, 2 modules, transpile build file + its public_api export) |
| Studio + foundation-css | Out of scope for this plan; coordinated follow-up |
| New dependencies | None |
