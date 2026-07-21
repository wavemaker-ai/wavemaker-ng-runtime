# Quickstart: Validating `wm-chipset`

**Feature**: `005-chipset-selection-group` | **Date**: 2026-07-03

This guide validates the feature end-to-end once implemented, per `tasks.md`. It does not
contain implementation code — see `data-model.md` / `contracts/chipset-widget-contract.md` for
the exact contracts being validated, and `tasks.md` (from `/speckit-tasks`) for the build steps.

## Prerequisites

- Node 22.18.x / npm 10.9.x (per constitution pinned toolchain).
- Repo dependencies installed: `npm install` at the `wavemaker-ng-runtime` repo root.
- On branch `005-chipset-selection-group` with the new `projects/components/widgets/input/chipset/`
  package and the registration edits from `plan.md` / `research.md` (Decision 7) in place.

## 1. Automated test validation (primary — hard gate, Principle VIII)

```bash
# Run only the new widget's tests first, for fast iteration
npx jest --no-cache projects/components/widgets/input/chipset

# Then run the full suite before considering the feature complete
npm test
```

**Expected outcome**: both `chipset.component.spec.ts` and `chipset.wrapper.component.spec.ts`
pass, covering:
- Single-select mode: exclusivity, re-tap no-op, pre-set `datavalue`, required-invalid-when-empty (C3, C8).
- Multi-select mode: independent toggles, zero-selected valid, pre-set collection `datavalue`, required-invalid-when-empty (C3, C8).
- `selectionmode` runtime switch clearing `datavalue` (C3).
- `disableitem` static and `.bind` per-record disabling (C4).
- Widget-level `class` reflects whichever appearance class (`chipset-elevated`/`chipset-outlined`) is set on the markup — no runtime `appearance` property exists; set via studio's Variant control (C5, amended 2026-07-17).
- Keyboard: Tab single-stop, Arrow wrap-around skipping disabled chips, Enter/Space activation, ARIA role/state per mode (C6).
- Events: `onbeforechange` (including a cancelling handler), `onchange` (user + programmatic), `onselect`/`ondeselect` diffing (C7).
- Registration: `isDataSetWidget(FormWidgetType.CHIPSET)` is `true` (C9).
- Leading icon/avatar (FR-010): `displayimagesrc` renders a resolved `imgSrc` as a leading
  `<img>`; `iconclass`/`iconurl` field-name pointers render a leading `<wm-app-icon>` when no
  avatar image resolves; a chip with none of the three resolving renders with no leading visual
  and remains fully selectable/keyboard-navigable (C2).
- `npm test` (full suite) exits 0 with no regressions to existing `radioset`/`checkboxset`/`chips` specs.

## 2. Build validation (library compiles in the monorepo pipeline)

```bash
# Confirms ng-packagr builds the new package in dependency order with no type errors
./build.sh
```

**Expected outcome**: `@wm/components/input/chipset` builds successfully alongside the existing
widget libraries; no errors from the new `chipset.build.ts` transpiler registration.

## 3. Manual dynamic-mode (Prism/JIT) smoke test

1. In a scratch app/page in the dynamic runtime, add `<div wmChipset dataset="..."
   displayfield="label" datafield="value" selectionmode="single"></div>` (or the
   Studio-equivalent widget drop, once Studio metadata exists — out of scope here).
2. Confirm the page compiles without a "component not found" console error (validates C9 /
   `REQUIRED_MODULES_FOR_DYNAMIC_COMPONENTS`).
3. Click chips, confirm exclusivity and `datavalue` updates (inspect via browser devtools or a
   bound label).
4. Switch the widget's `selectionmode` to `multiple` at runtime (e.g. via script) and confirm
   `datavalue` resets to `[]` and multiple chips can be selected independently.
5. Tab to the widget once, use Arrow keys to move across chips (including wrapping from last to
   first), press Space/Enter to select, and confirm only one Tab stop is consumed.
6. Resize the container narrower than the total chip width and confirm chips wrap onto
   additional lines rather than clipping or scrolling horizontally (FR-018).
7. Set `displayimagesrc` to a field containing an image URL and confirm each chip renders a
   leading avatar image; alternatively set `iconclass`/`iconurl` to a field name and confirm a
   leading `<wm-app-icon>` renders when no avatar image resolves (FR-010).

## 4. Manual form-integration smoke test

1. Place a `wm-chipset` (single-select) and a second one (multi-select) inside a `wm-form`.
2. Mark both `required`; attempt to submit with nothing selected — confirm the form blocks
   submission (validates C8).
3. Select a value in each, submit, and confirm the form's data model reflects the chipset's
   `datavalue` (scalar for single-select, array for multi-select).
4. Toggle the form to `readonly`, then `disabled`; confirm chip taps have no effect in either
   state and the widget is skipped in Tab order while `disabled`.

## 5. Non-goals for this quickstart

- Visual/pixel validation of `elevated`/`outlined` appearance — the `wavemaker-foundation-css`
  tokens (research.md, Decision 5) needed no changes; the coordinated studio work is done (see
  the 2026-07-17 amendment) and appearance is now set via studio's Variant control rather than a
  runtime property. This guide still only validates that the correct CSS class ends up on the
  widget (covered by automated tests, C5) — pixel-level verification is a studio/foundation-css
  concern, not this runtime quickstart's.
- Studio canvas drag-and-drop / property-panel validation — depends on the separate
  `wavemaker-ng-studio` metadata work (research.md, Decision 8); see `wavemaker-ng-studio`'s own
  `specs/001-chipset-widget-support/quickstart.md` for that widget's canvas-side validation.
