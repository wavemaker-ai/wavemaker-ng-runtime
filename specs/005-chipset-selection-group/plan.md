# Implementation Plan: Chip Selection Group Widget (wm-chipset)

**Branch**: `005-chipset-selection-group` | **Date**: 2026-07-03 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/005-chipset-selection-group/spec.md`

## Summary

Add a new WaveMaker form widget, `wm-chipset`, that renders a dataset as a group of
Material-style selectable chips and supports two selection modes via a `selectionmode`
property: single-select (radiogroup semantics, mirroring `wm-radioset`) and multi-select
(group/checkbox semantics, mirroring `wm-checkboxset`, including zero-selected as valid).
The widget is a new sibling package under `projects/components/widgets/input/chipset/` that
extends the shared `DatasetAwareFormComponent` — inheriting `dataset`/`datafield`/
`displayfield`/`displayexpression`/`datavalue`/`compareby`/`groupby`/`orderby`/`itemsperrow`
wiring for free, exactly like `wm-radioset`/`wm-checkboxset` do today. Unlike those two
widgets (which fix `this.multiple` once in their constructor), `wm-chipset` toggles
`this.multiple` dynamically from `selectionmode` and clears `datavalue` to the new mode's
empty default on switch (per spec clarification). Chips are rendered as custom
`role="radio"`/`role="checkbox"` elements (not native `<input>`) driven by a single shared
roving-tabindex + arrow-key keyboard handler, because native checkboxes cannot provide the
cross-item arrow-key/single-Tab-stop navigation FR-015 requires for both modes uniformly. New
capabilities beyond radioset/checkboxset — per-record `disableitem` (mirroring `wm-list`),
`appearance` (elevated/outlined), an optional per-chip leading icon/avatar (`displayimagesrc`
reusing `wm-chips`' identical property/resolution mechanism for avatar images, plus
`iconclass`/`iconurl` field-name pointers rendered via `<wm-app-icon>` mirroring `wm-switch`,
per research.md Decision 9), and cancelable `onbeforechange`/`onchange`/`onselect`/
`ondeselect` events — are added additively. The existing `wm-chips` widget
(`projects/components/widgets/input/chips/`) is untouched. The feature ships with co-located
Jest unit tests and wrapper/markup behavior tests per Constitution Principle VIII (hard gate
for new widgets).

## Technical Context

**Language/Version**: TypeScript 5.9.x, Angular 20.3.x (per constitution; `compilationMode: partial`, strict OFF, `strictTemplates: false`)

**Primary Dependencies**: Existing only — `@wm/components/input/dataset-aware-form`
(`DatasetAwareFormComponent`, which already declares `displayimagesrc`/`binddisplayimagesrc`
and resolves them into `DataSetItem.imgSrc` via `initDatasetItems()`), `@wm/components/base`
(`register`, `registerFormWidget`, `PROP_*`, `provideAs`, `provideAsWidgetRef`, `styler`,
`TextContentDirective`, `WmAppIconComponent` for the `iconclass`/`iconurl` leading icon),
`@wm/core` (`FormWidgetType`, `setListClass`, `$watch`/`$unwatch`, event/expression utilities).
No new npm dependencies.

**Storage**: N/A (client-side widget; dataset supplied by the hosting page/variable)

**Testing**: Jest (`jest-preset-angular`, repo `npm test` = `jest --no-cache`), co-located
`chipset.component.spec.ts` (unit) and `chipset.wrapper.component.spec.ts` (markup/wrapper
behavior, using the existing `ComponentTestBase` harness from
`projects/components/base/src/test/common-widget.specs`) — both auto-discovered by the root
`jest.config.js` `testMatch` (`**/projects/**/*.spec.ts`), no config changes needed.

**Target Platform**: WaveMaker-generated Angular apps (dynamic JIT + AOT-generated app), plus
design-time Prism (studio) canvas rendering (studio-side markup metadata/property-panel wiring
is a separate `wavemaker-ng-studio` repo change and out of scope for this plan).

**Project Type**: Angular component library (monorepo of `@wm/*` ng-packagr packages).

**Performance Goals**: No special performance target beyond existing dataset-driven form
widgets (radioset/checkboxset already render one DOM node per record synchronously under the
default change-detection strategy); no new perf budget introduced.

**Constraints**: Must not modify `projects/components/widgets/input/chips/` (FR-001); public
contract additive-only per Principle VII; new widget MUST ship with hard-gated tests per
Principle VIII; dynamic-mode registration MUST be added to
`REQUIRED_MODULES_FOR_DYNAMIC_COMPONENTS` per Principle IV or the widget throws a runtime
compilation error the first time a page uses it.

**Scale/Scope**: One new widget package (~8 files: component, props, html, doc, public_api,
ng-package.json, package.json, tsconfig.lib.prod.json) + 2 test files, plus small additive
edits to 6 existing shared registration files (enums, 2 modules, transpiler imports map, plus a
new transpile build-emitter file and its `public_api.ts` export). No changes to `wm-chips`.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Relevance | Status |
|-----------|-----------|--------|
| I. Layered Packages & Dependency Direction | New widget lives in a new `projects/components/widgets/input/chipset/` package (peer of `radioset`/`checkboxset`), depending only on `@wm/components/base` + `@wm/components/input/dataset-aware-form` + `@wm/core` (downward deps only). No new package tier, no upward/circular dependency. | PASS |
| II. Widget Base-Class & Proxy Discipline | `ChipsetComponent extends DatasetAwareFormComponent` (→ `BaseFormCustomComponent` → `StylableComponent` → `BaseComponent`), passes `WIDGET_CONFIG` to `super()`, calls `styler()`, uses `provideAsWidgetRef`/`provideAs(NG_VALUE_ACCESSOR/NG_VALIDATORS)`, and implements `onPropertyChange` for `selectionmode`/`disableitem`/`appearance`. All selection-state mutation goes through the inherited `datavalue`/`modelByKey` proxy setters — no direct DOM/component-field mutation bypassing the proxy. | PASS |
| III. Property/Event/Binding Contracts | Registered via `register('wm-chipset', Map)` + `registerFormWidget(FormWidgetType.CHIPSET, ...)`, using `PROP_STRING`/`PROP_BOOLEAN`/`PROP_ANY`. New events (`onbeforechange`, `onchange`, `onselect`, `ondeselect`) compiled via the standard `$parseEvent`/`invokeEventCallback` pipeline; `onbeforechange` returning `false` cancels, matching the `onBefore*` convention already used by `wm-chips` (`beforeadd`/`beforeremove`). `disableitem.bind` follows the existing `.bind`-attribute + per-item watch convention from `wm-list`. | PASS |
| IV. Dual-Mode Compatibility & Dynamic Registration | `ChipsetComponent` MUST be added to `REQUIRED_MODULES_FOR_DYNAMIC_COMPONENTS` in `projects/runtime-dynamic/src/app/app.module.ts` (mirroring `RadiosetComponent`/`CheckboxsetComponent`) and declared in `projects/runtime-base/src/runtime-base.module.ts`, plus a new AOT build emitter (`chipset.build.ts`) registered in `projects/components/transpile/src/public_api.ts`, mirroring `radioset.build.ts`/`checkboxset.build.ts`. Tracked explicitly as required tasks — see Project Structure. | PASS (planned) |
| V. Deterministic Cleanup & Memory Safety | Keyboard `keydown` listener on the host and any per-chip `disableitem.bind` watches are registered via `this.eventManager`/`registerDestroyListener`/`$watch`+`$unwatch` (the same mechanisms `radioset.ts`/`checkboxset.ts`/`list-item.directive.ts` already use) and torn down in `ngOnDestroy`, following the existing `eventListeners` Map + `deregister()` pattern in radioset/checkboxset. | PASS (planned) |
| VI. Prism-Aware AutoLayout & Styling | Out of scope for this feature — `wm-chipset` is a form/input widget like `wm-radioset`/`wm-checkboxset`, neither of which carries `@AutoLayout()`. No layout decorator is added here; non-layout styling goes through foundation-css token classes (`appearance` → `elevated`/`outlined` host classes) and the runtime `styler()`, consistent with sibling widgets. | PASS (N/A) |
| VII. Runtime Safety & Public Contract Stability | `wm-chipset` is an entirely new markup tag — no existing widget's contract (including `wm-chips`, `wm-radioset`, `wm-checkboxset`) is modified, retyped, or defaulted differently. Exact `appearance` CSS/token values require a coordinated `wavemaker-foundation-css` change (new tokens/styles, not modifying the existing `chips.json`/`chips.less` used by `wm-chips`); studio-side property-panel metadata requires a coordinated `wavemaker-ng-studio` change. Both are flagged as sequenced follow-ups, not part of this ng-runtime plan. | PASS (coordination flagged) |
| **Amendment (2026-07-17)**: the coordination flagged above is complete, and changed the outcome — `wavemaker-foundation-css`'s existing `chipset.json` needed no new tokens (its `appearances.outlined`/`appearances.elevated` already fit the standard variant-resolution shape); `wavemaker-ng-studio` now sets `tokenFileName: "chipset"` so the generic `variant` property handles it. The runtime `appearance` property described throughout this plan/research/data-model/contract was **removed** rather than kept alongside the new studio wiring — see `spec.md`'s 2026-07-17 clarification and `research.md` Decision 5's amendment. | (superseded) |
| VIII. Test-Backed Changes | New widget → HARD GATE. Plan includes co-located `chipset.component.spec.ts` + `chipset.wrapper.component.spec.ts` covering both selection modes and every public property/event (FR-019/SC-007). A green `npm test` including this coverage is required before the feature is considered complete. | PASS (planned, hard gate acknowledged) |

**Result**: No violations. No entries required in Complexity Tracking.

**Post-Design Re-Check (after Phase 1)**: Re-evaluated against `research.md`, `data-model.md`,
and `contracts/chipset-widget-contract.md`. The design remains additive-only: one new widget
package, no modification to `wm-chips`/`wm-radioset`/`wm-checkboxset` source, and the custom
roving-tabindex/ARIA approach (Decision 3 in `research.md`) is fully contained inside the new
package's component/template/host-listener code — it does not touch shared base classes or the
`DatasetAwareFormComponent` contract beyond the already-supported `multiple` flag. All gates
still **PASS**. Cleared to proceed to `/speckit-tasks`.

## Project Structure

### Documentation (this feature)

```text
specs/005-chipset-selection-group/
├── plan.md                          # This file (/speckit-plan command output)
├── research.md                      # Phase 0 output (/speckit-plan command)
├── data-model.md                    # Phase 1 output (/speckit-plan command)
├── quickstart.md                    # Phase 1 output (/speckit-plan command)
├── contracts/                       # Phase 1 output (/speckit-plan command)
│   └── chipset-widget-contract.md
├── checklists/
│   └── requirements.md              # Spec quality checklist (already present)
└── tasks.md                         # Phase 2 output (/speckit-tasks command - NOT created here)
```

### Source Code (repository root)

```text
projects/components/widgets/input/chipset/          # NEW package (peer of radioset/checkboxset)
├── package.json                     # NEW — "@wm/components/input/chipset", mirrors radioset/package.json
├── ng-package.json                  # NEW — dest: ../../../../../libraries/components/input/chipset
├── tsconfig.lib.prod.json           # NEW — copy of radioset's
└── src/
    ├── chipset.component.ts         # NEW — extends DatasetAwareFormComponent
    ├── chipset.props.ts             # NEW — register('wm-chipset', Map) + registerFormWidget(FormWidgetType.CHIPSET, ...)
    ├── chipset.component.html       # NEW — chip list markup (role="radio"/"checkbox", roving tabindex)
    ├── chipset.component.doc.ts     # NEW — Studio-facing property/event doc (mirrors radioset.component.doc.ts)
    ├── public_api.ts                # NEW — export * from './chipset.component'
    ├── chipset.component.spec.ts    # NEW — Jest unit tests (hard gate, Principle VIII)
    └── chipset.wrapper.component.spec.ts  # NEW — markup/wrapper behavior tests (hard gate, Principle VIII)

projects/components/widgets/input/chips/             # UNCHANGED — must not be modified (FR-001)

projects/core/src/enums/enums.ts                      # EDIT — add FormWidgetType.CHIPSET = 'chipset'
projects/components/base/src/utils/widget-utils.ts    # EDIT — add FormWidgetType.CHIPSET to DATASET_WIDGETS
projects/runtime-base/src/runtime-base.module.ts       # EDIT — import + declare ChipsetComponent
projects/runtime-dynamic/src/app/app.module.ts         # EDIT — import + add to REQUIRED_MODULES_FOR_DYNAMIC_COMPONENTS

projects/components/transpile/src/input/default/chipset/
└── chipset.build.ts                 # NEW — AOT markup emitter, mirrors radioset.build.ts (role="radiogroup"/"group" host)
projects/components/transpile/src/public_api.ts        # EDIT — export * as chipsetBuild from './input/default/chipset/chipset.build'
```

**Structure Decision**: Follow the existing monorepo widget-package layout exactly, using
`wm-radioset`/`wm-checkboxset` as the structural reference (same base class, same
package/registration touchpoints) and `wm-list`'s `disableitem`/`ListItemDirective` as the
reference for the one genuinely new per-record capability. No new project, module tier, or
build target is introduced — `wm-chipset` slots into the existing `widgets/input` category.

## Complexity Tracking

> No Constitution Check violations — this section intentionally left empty.
