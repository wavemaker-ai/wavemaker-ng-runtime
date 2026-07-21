# Tasks: Chip Selection Group Widget (wm-chipset)

**Input**: Design documents from `/specs/005-chipset-selection-group/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/chipset-widget-contract.md, quickstart.md

**Tests**: This feature adds a NEW widget (`wm-chipset`) to the runtime, so per Constitution
Principle VIII (HARD GATE) and the feature's own FR-019/SC-007, co-located Jest unit tests
(`chipset.component.spec.ts`) and markup/wrapper behavior tests
(`chipset.wrapper.component.spec.ts`) covering every public property, event, and behavioral
variant are MANDATORY, not optional.

> **Amendment (2026-07-17)**: Tasks/tests below that reference an `appearance` runtime property are historical — that property was removed and replaced by studio's `variant` + `tokenFileName: "chipset"` mechanism (see spec.md's 2026-07-17 clarification). Any remaining unit/wrapper test coverage for appearance-switching behavior should target the resolved `class` output instead of an `appearance` input.

**Organization**: Tasks are grouped by user story (P1–P5 from spec.md) to enable independent
implementation and testing of each story, following the existing `wm-radioset`/`wm-checkboxset`
package structure as the structural reference (confirmed against
`projects/components/widgets/input/radioset/` and `.../checkboxset/`).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1–US5)
- Include exact file paths in descriptions

## Path Conventions

New widget package: `projects/components/widgets/input/chipset/` (peer of `radioset`/
`checkboxset`). Shared registration edits: `projects/core/src/enums/enums.ts`,
`projects/components/base/src/utils/widget-utils.ts`,
`projects/runtime-base/src/runtime-base.module.ts`,
`projects/runtime-dynamic/src/app/app.module.ts`,
`projects/components/transpile/src/input/default/chipset/chipset.build.ts`,
`projects/components/transpile/src/public_api.ts`. `wm-chips`
(`projects/components/widgets/input/chips/`) MUST NOT be touched (FR-001).

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Scaffold the new `@wm/components/input/chipset` package so it builds and is
recognized by the monorepo tooling, before any behavior is implemented.

- [X] T001 Create the new package skeleton: `projects/components/widgets/input/chipset/package.json`
      (copy `radioset/package.json`, rename to `@wm/components/input/chipset`),
      `projects/components/widgets/input/chipset/ng-package.json` (copy `radioset/ng-package.json`,
      set `dest: ../../../../../libraries/components/input/chipset`), and
      `projects/components/widgets/input/chipset/tsconfig.lib.prod.json` (copy `radioset`'s as-is)
- [X] T002 [P] Create `projects/components/widgets/input/chipset/src/public_api.ts` exporting
      `export * from './chipset.component';`
- [X] T003 Register the new package in `build.sh`'s two `wm-radioset`/`wm-checkboxset` touchpoints:
      add an `ngPackagrBuild components-input-chipset projects/components/widgets/input/chipset
      '@wm/components/input/chipset'` call alongside the existing `components-input-radioset`/
      `components-input-checkboxset` lines, and add
      `./libraries/components/input/chipset/bundles/index.umd.js` to the UMD bundle concatenation
      list alongside the existing `checkboxset`/`radioset` bundle entries, so the new package
      builds and bundles in dependency order alongside its siblings

**Checkpoint**: `@wm/components/input/chipset` is a recognized (empty) package the build tooling
can resolve; no widget behavior exists yet.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core widget class, registration, and cross-repo touchpoints that every user story's
tests and behavior depend on. **No user story can be implemented or tested until this phase is
complete**, because `wm-chipset` doesn't exist as a renderable/registered widget without it.

**⚠️ CRITICAL**: Complete this phase before starting any Phase 3+ user story work.

- [X] T004 Add `CHIPSET = 'chipset'` to `FormWidgetType` in `projects/core/src/enums/enums.ts`
      (mirrors `RADIOSET`/`CHECKBOXSET` entries) — Contract C9
- [X] T005 Add `FormWidgetType.CHIPSET` to `DATASET_WIDGETS` in
      `projects/components/base/src/utils/widget-utils.ts` so `isDataSetWidget()` recognizes it
      — Contract C9
- [X] T006 Create `projects/components/widgets/input/chipset/src/chipset.props.ts`: register
      `wm-chipset` via `register('wm-chipset', Map)` + `registerFormWidget(FormWidgetType.CHIPSET,
      ...)`, declaring inherited properties (`dataset`, `datafield`, `displayfield`,
      `displayexpression`, `datavalue`, `compareby`, `groupby`, `orderby`, `itemsperrow`,
      `required`, `readonly`, `disabled`, `name`, `show`, `tabindex`, `usekeys`, `hint`, `class`)
      plus the three new selection/appearance properties: `selectionmode` (`PROP_STRING`, default
      `'single'`), `disableitem` (`PROP_BOOLEAN`, default `false`), `appearance` (`PROP_STRING`,
      default `'outlined'`) — mirrors `radioset.props.ts`/`checkboxset.props.ts` — data-model.md
      Entity 1, Contract C2
- [X] T007 Create `projects/components/widgets/input/chipset/src/chipset.component.ts`:
      `ChipsetComponent extends DatasetAwareFormComponent`, registered with
      `provideAs(ChipsetComponent, NG_VALUE_ACCESSOR, true)`,
      `provideAs(ChipsetComponent, NG_VALIDATORS, true)`, `provideAsWidgetRef(ChipsetComponent)`;
      pass `WIDGET_CONFIG` to `super()`; call `styler()`; implement `@Attribute('disableitem.bind')
      binddisableitem` per `wm-list`'s pattern — research.md Decision 1, Decision 4
- [X] T008 [US-shared] Implement `onPropertyChange('selectionmode', nv)` in
      `chipset.component.ts`: set `this.multiple = (nv === 'multiple')`, clear `this.datavalue` to
      that mode's empty default (`undefined` for single, `[]` for multiple) **before**
      `initDatasetItems`/`selectByValue` re-runs, per spec Clarification 2 — data-model.md State 1,
      Contract C3, research.md Decision 2 (depends on T007)
- [X] T009 Create `projects/components/widgets/input/chipset/src/chipset.component.html`: render
      one chip per `datasetItems` entry as `<li role="radio"|"checkbox" aria-checked="..."
      tabindex="0|-1">` inside a host with `role="radiogroup"` (single) / `role="group"`
      (multiple); include a visually-hidden native `<input>` mirroring the `.model-holder` pattern
      from `radioset.component.html`/`checkboxset.component.html` solely for
      `NG_VALUE_ACCESSOR`/Forms plumbing — research.md Decision 3, Contract C6 (depends on T007)
- [X] T010 Add `displayimagesrc` (+ `.bind` via `binddisplayimagesrc`), `iconclass`, and
      `iconurl` properties (all `PROP_STRING`) to
      `projects/components/widgets/input/chipset/src/chipset.props.ts`: `displayimagesrc` mirrors
      `wm-chips`' property of the same name and requires **no new resolution code** — the
      inherited `DatasetAwareFormComponent.initDatasetItems()` pipeline already reads
      `this.displayimagesrc`/`this.binddisplayimagesrc` and resolves it into `DataSetItem.imgSrc`
      per record; `iconclass`/`iconurl` mirror `wm-switch`'s field-name-pointer convention
      (property value = a dataset field name, resolved per record as
      `item.dataObject[iconclass]` / `item.dataObject[iconurl]`) — research.md Decision 9,
      data-model.md Entity 1, Contract C2, FR-010 (depends on T006)
- [X] T011 Render the optional per-chip leading visual in
      `projects/components/widgets/input/chipset/src/chipset.component.html`: when
      `item.imgSrc` resolves (via `displayimagesrc`), render a leading `<img [src]="item.imgSrc">`
      mirroring `chips.component.html`'s `button-image-icon`/`chip-picture` pattern; else when
      `item.dataObject[iconclass]` or `item.dataObject[iconurl]` resolves, render a leading
      `<wm-app-icon [iconclass]="item.dataObject[iconclass]"
      [iconurl]="item.dataObject[iconurl]">` mirroring `switch.component.html`; else render no
      leading visual, with no effect on the chip's tappability/keyboard-navigability — research.md
      Decision 9, data-model.md Entity 2, Contract C2, FR-010 (depends on T009, T010)
- [X] T012 Implement the shared roving-tabindex + keyboard `keydown` host listener in
      `chipset.component.ts`: exactly one chip has `tabindex="0"` at a time; Arrow keys move
      focus to the adjacent *enabled* chip (skipping `disableitem` chips) and wrap around at the
      ends (last→first, first→last); Enter/Space activate the focused chip identically to a
      click; register/deregister the listener via `this.eventManager`/`registerDestroyListener`
      and tear down in `ngOnDestroy` per Constitution Principle V — research.md Decision 3,
      data-model.md Entity 2 (`isRovingTabStop`), Contract C6 (depends on T007, T009, T011)
- [X] T013 Implement per-chip disable resolution in `chipset.component.ts`: compute
      `chipDisabled` per record from `disableitem`/`binddisableitem` (static value or per-record
      `.bind` expression via `registerWatch`/`$watch`+`$unwatch`, mirroring
      `list-item.directive.ts`'s `disableItemWatcher()`), excluding disabled chips from the
      roving-tabindex focus order and click/keyboard activation; deregister watches in
      `ngOnDestroy` — research.md Decision 4, data-model.md Entity 2, Contract C4 (depends on
      T007, T012)
- [X] T014 Implement chip click/activation handler in `chipset.component.ts` covering both
      selection-mode state machines (single-select exclusivity + re-tap no-op; multi-select
      independent toggle including reaching zero-selected) by mutating the inherited
      `modelByKey`/`datavalue` proxy setters — never direct DOM/field mutation (Constitution
      Principle II) — data-model.md States 2 & 3, Contract C3 (depends on T008, T013)
- [X] T015 Implement the `onbeforechange` cancelable event in the click/activation handler:
      invoke `this.invokeEventCallback('beforechange', {$event, newVal, oldVal})` before any
      selection mutation; if it returns `false` (via the `isDefined(...) && !toBoolean(...)`
      guard used by `wm-chips`' `beforeadd`/`beforeremove`), return early with no state change and
      no further events — research.md Decision 6, data-model.md Entity 1 events table, Contract
      C7 (depends on T014)
- [X] T016 Implement `onselect`/`ondeselect` diffing in `chipset.component.ts`: on every
      `datavalue`/`modelByKey` change (from a chip click **or** a programmatic `datavalue`
      assignment), diff the previous vs. new selected-keys set and fire one `onselect` per
      newly-selected chip and one `ondeselect` per newly-deselected chip; confirm `onchange`
      fires for both origins via the inherited `DatasetAwareFormComponent.datavalue` setter with
      no additional code — research.md Decision 6, data-model.md State 4, Contract C7 (depends on
      T014, T015)
- [X] T017 Implement the `appearance` property class-toggle in `chipset.component.ts`
      (`onPropertyChange('appearance', nv)` toggling e.g. `chipset-elevated` /
      `chipset-outlined` host classes uniformly on all chips, no effect on selection behavior or
      `datavalue` shape) — research.md Decision 5, data-model.md Entity 1, Contract C5 (depends
      on T007)
- [X] T018 Create `projects/components/widgets/input/chipset/src/chipset.component.doc.ts`
      (Studio-facing property/event documentation, mirroring `radioset.component.doc.ts`'s
      structure) documenting all inherited + new properties (including `displayimagesrc`/
      `iconclass`/`iconurl`) and the four new events (depends on T006, T010)
- [X] T019 Declare and export `ChipsetComponent` in
      `projects/runtime-base/src/runtime-base.module.ts` (import from
      `@wm/components/input/chipset`, add to the module's declared/exported component list,
      mirroring the existing `RadiosetComponent`/`CheckboxsetComponent` entries) — Constitution
      Principle IV, Contract C9 (depends on T007)
- [X] T020 Add `ChipsetComponent` to `REQUIRED_MODULES_FOR_DYNAMIC_COMPONENTS` in
      `projects/runtime-dynamic/src/app/app.module.ts` (import + registration, mirroring
      `RadiosetComponent`/`CheckboxsetComponent`) so dynamic (JIT) mode compiles pages using
      `<wm-chipset>` — Constitution Principle IV (NON-NEGOTIABLE), Contract C9 (depends on T007)
- [X] T021 Create `projects/components/transpile/src/input/default/chipset/chipset.build.ts`: AOT
      build-time markup emitter registered via `register('wm-chipset', ...)`, mirroring
      `radioset.build.ts`'s `pre`/`post` shape, emitting the correct host `role` (`radiogroup` vs
      `group`, driven by `selectionmode` if statically known, else default with the runtime
      component correcting the ARIA role reactively) — research.md Decision 7, Contract C9
      (depends on T007, T009)
- [X] T022 Add `export * as chipsetBuild from './input/default/chipset/chipset.build';` to
      `projects/components/transpile/src/public_api.ts` — research.md Decision 7, Contract C9
      (depends on T021)

**Checkpoint**: `wm-chipset` is a fully registered, renderable widget with both selection modes,
per-chip disable, appearance toggling, optional per-chip leading icon/avatar rendering,
roving-tabindex keyboard support, and all four events implemented, working in both dynamic (JIT)
and AOT-registered modes. All user stories below are now independently testable against this
implementation.

---

## Phase 3: User Story 1 - Pick exactly one option from a set of chips (Priority: P1) 🎯 MVP

**Goal**: A single-select `wm-chipset` bound to a dataset renders one chip per record; tapping a
chip selects it exclusively (deselecting any other), re-tapping the selected chip is a no-op, a
pre-set `datavalue` pre-selects the matching chip, and `required` validation fails when nothing
is selected — behaving as the chip-styled equivalent of `wm-radioset`.

**Independent Test**: Bind a chip group in single-select mode to a dataset of 4+ records, tap
different chips in sequence, and confirm at every point exactly one chip shows the
selected/check affordance and `datavalue` matches that one record.

### Tests for User Story 1 (MANDATORY — Constitution Principle VIII hard gate for new widgets)

> Write these tests FIRST against the Phase 2 implementation; confirm they FAIL/don't exist yet
> before writing US1-specific assertions, then pass once implementation is in place.

- [X] T023 [P] [US1] Create `projects/components/widgets/input/chipset/src/chipset.component.spec.ts`
      unit test scaffold (bootstrap the component per the existing `radioset.component.spec.ts`
      pattern) plus single-select tests: default `selectionmode = 'single'`, one chip renders per
      dataset record, tapping a chip sets `datavalue` to that record's value, tapping a second
      chip deselects the first and selects the second, re-tapping the already-selected chip is a
      no-op — Acceptance Scenarios 1-3, Contract C3
- [X] T024 [P] [US1] Create
      `projects/components/widgets/input/chipset/src/chipset.wrapper.component.spec.ts` using the
      `ComponentTestBase` harness from `projects/components-base/src/test/common-widget.specs`
      (mirroring `checkboxset.wrapper.spec.ts`/`chips.wrapper.component.spec.ts`): assert a
      pre-set `datavalue` renders the matching chip pre-selected on init, and a `required`
      single-select group with no selection reports itself invalid — Acceptance Scenarios 4-5,
      Contract C8

### Implementation for User Story 1

- [X] T025 [US1] Verify/finish single-select exclusivity, re-tap no-op, and pre-set `datavalue`
      initial-selection behavior in `chipset.component.ts`'s click handler and `ngOnInit`
      pathway (built in T008/T014; this task closes any gaps found by T023's tests) — Acceptance
      Scenarios 1-4
- [X] T026 [US1] Verify/finish `required` validation reporting invalid on empty single-select
      `datavalue`, reusing the inherited `NG_VALIDATORS` provider from `DatasetAwareFormComponent`
      (built in T007; this task closes any gaps found by T024's tests) — Acceptance Scenario 5,
      Contract C8

**Checkpoint**: User Story 1 is fully functional and independently testable — a single-select
`wm-chipset` behaves as a complete chip-styled `wm-radioset` replacement.

---

## Phase 4: User Story 2 - Pick any number of options from a set of chips (Priority: P2)

**Goal**: Switching `selectionmode` to `'multiple'` makes each chip toggle independently, any
combination (including zero) may be selected, a pre-set collection `datavalue` pre-selects the
matching chips, and `required` fails validation only at zero-selected — the chip-styled
equivalent of `wm-checkboxset`.

**Independent Test**: Bind a chip group in multi-select mode to a dataset of 4+ records, tap
chips in various combinations (including deselecting all), and confirm the visually-selected
chips always match the reported selected-values collection.

### Tests for User Story 2 (MANDATORY — Constitution Principle VIII hard gate for new widgets)

- [X] T027 [P] [US2] Add multi-select tests to
      `projects/components/widgets/input/chipset/src/chipset.component.spec.ts`: switching
      `selectionmode` to `'multiple'` sets `this.multiple = true` and resets `datavalue` to `[]`;
      tapping a chip adds it to the collection without affecting other selected chips; tapping a
      selected chip removes only it; deselecting all chips reaches a valid empty-array state —
      Acceptance Scenarios 1-4, Contract C3 (depends on T023 existing)
- [X] T028 [P] [US2] Add multi-select tests to
      `projects/components/widgets/input/chipset/src/chipset.wrapper.component.spec.ts`: a
      pre-set collection `datavalue` (2+ values) pre-selects exactly those chips on init; a
      `required` multi-select group reports invalid at zero-selected and valid once at least one
      chip is selected — Acceptance Scenarios 5-6, Contract C3, C8 (depends on T024 existing)

### Implementation for User Story 2

- [X] T029 [US2] Verify/finish multi-select independent-toggle, zero-selected-is-valid, and
      pre-set collection `datavalue` initial-selection behavior in `chipset.component.ts` (built
      in T008/T014; this task closes any gaps found by T027's tests) — Acceptance Scenarios 1-5
- [X] T030 [US2] Verify/finish `required` validation reporting invalid only when the
      multi-select `datavalue` array is empty (built in T007; this task closes any gaps found by
      T028's tests) — Acceptance Scenario 6, Contract C8

**Checkpoint**: User Stories 1 AND 2 both work independently — `wm-chipset` fully replicates
`wm-radioset` (single) and `wm-checkboxset` (multiple) selection semantics via one
`selectionmode` switch.

---

## Phase 5: User Story 3 - Use the chip group as a standard form field (Priority: P3)

**Goal**: `wm-chipset` inside a `wm-form` tracks the form's readonly/disabled/required state,
supports per-record disabling without affecting other chips, and round-trips its value into the
form's data model on submit — with no special-case scripting required.

**Independent Test**: Place a chip group (once single-select, once multi-select) inside a
`wm-form`, toggle readonly/disabled, mark it required, and submit; verify read/disabled/required
states track the form and the value round-trips correctly.

### Tests for User Story 3 (MANDATORY — Constitution Principle VIII hard gate for new widgets)

- [X] T031 [P] [US3] Add form-integration tests to
      `projects/components/widgets/input/chipset/src/chipset.wrapper.component.spec.ts`
      (reusing `verifyStyles`/`verifyAccessibility`/common-properties checks from
      `ComponentTestBase`, mirroring `checkboxset.wrapper.spec.ts`'s structure): `readonly`
      blocks chip taps with no selection change and no event fired; `disabled` blocks taps and
      removes the widget from tab order; the widget's `datavalue` round-trips into a bound form
      data model on submit for both selection modes — Acceptance Scenarios 1, 2, 4, Contract C8
      (depends on T024 existing)
- [X] T032 [P] [US3] Add a per-record `disableitem`/`disableitem.bind` test to
      `projects/components/widgets/input/chipset/src/chipset.component.spec.ts`, mirroring
      `list-item.directive.spec.ts`'s `disableItemWatcher` test shape: a disable expression
      evaluating `true` for one record blocks that chip's tap/keyboard selection and excludes it
      from Arrow-key navigation while every other chip remains fully interactive — Acceptance
      Scenario 3, Contract C4 (depends on T023 existing)

### Implementation for User Story 3

- [X] T033 [US3] Verify/finish readonly/disabled interaction-blocking and tab-order removal in
      `chipset.component.ts`/`chipset.component.html`, reusing the inherited
      `DatasetAwareFormComponent`/`BaseFormCustomComponent` readonly/disabled semantics (built in
      T007/T012; this task closes any gaps found by T031's tests) — Acceptance Scenarios 1-2
- [X] T034 [US3] Verify/finish per-record `disableitem` interaction-blocking and roving-tabindex
      exclusion built in T013 against a live form-hosted scenario (closes any gaps found by
      T032's tests) — Acceptance Scenario 3, Contract C4
- [X] T035 [US3] Verify/finish form data-model round-trip for both selection modes via the
      inherited `NG_VALUE_ACCESSOR` provider (built in T007; this task closes any gaps found by
      T031's tests) — Acceptance Scenario 4, Contract C8

**Checkpoint**: User Stories 1-3 all work independently — `wm-chipset` is a complete,
form-participating widget matching `wm-radioset`/`wm-checkboxset`'s form-integration contract.

---

## Phase 6: User Story 4 - Operate and navigate the chip group using only the keyboard (Priority: P4)

**Goal**: The chip group is a single Tab stop; Arrow keys move focus among (enabled) chips with
wrap-around; Enter/Space activate the focused chip; ARIA roles/states are correct per mode; a
fully-disabled group is skipped in tab order entirely.

**Independent Test**: Tab into the group once, confirm a single Tab stop; use Arrow keys to move
among chips (including wrap-around); press Enter/Space to select; verify ARIA roles/states with
an accessibility inspection tool for both modes.

### Tests for User Story 4 (MANDATORY — Constitution Principle VIII hard gate for new widgets)

- [X] T036 [P] [US4] Add keyboard/ARIA tests to
      `projects/components/widgets/input/chipset/src/chipset.wrapper.component.spec.ts`:
      simulated `keydown` events assert Tab lands on exactly one chip as a single Tab stop (a
      further Tab exits the whole widget); Arrow keys move `tabindex="0"` and DOM focus to the
      adjacent chip and wrap at both ends (last→first, first→last), skipping any `disableitem`
      chip; Enter/Space on a focused chip produces the same `datavalue` result as a click —
      Acceptance Scenarios 1-3, Contract C6 (depends on T024 existing)
- [X] T037 [P] [US4] Add ARIA role/state assertions to
      `projects/components/widgets/input/chipset/src/chipset.wrapper.component.spec.ts`: host
      exposes `role="radiogroup"` + per-chip `role="radio"`/`aria-checked` in single-select mode,
      and `role="group"` + per-chip `role="checkbox"`/`aria-checked` in multi-select mode; a
      group where every chip is disabled is fully skipped in tab order without error —
      Acceptance Scenarios 4-6, Contract C6 (depends on T024 existing)

### Implementation for User Story 4

- [X] T038 [US4] Verify/finish the roving-tabindex Tab-stop behavior, Arrow-key wrap-around
      (skipping disabled chips), and Enter/Space activation built in T012 (closes any gaps found
      by T036's tests) — Acceptance Scenarios 1-3
- [X] T039 [US4] Verify/finish per-mode ARIA role/state rendering
      (`radiogroup`/`radio` vs `group`/`checkbox`, `aria-checked`, `aria-disabled` on
      widget-level and per-chip disabled states per FR-017) built in T007/T009/T013 (closes any
      gaps found by T037's tests), and confirm the fully-disabled-group tab-skip case renders
      with no runtime error — Acceptance Scenarios 4-6, Contract C6

**Checkpoint**: User Stories 1-4 all work independently — `wm-chipset` is fully keyboard- and
screen-reader-operable in both selection modes.

---

## Phase 7: User Story 5 - React to selection changes via events (Priority: P5)

**Goal**: App builders can wire `onchange`/`onselect`/`ondeselect`/`onbeforechange` handlers;
`onchange` fires on every `datavalue` change (user or programmatic); `onselect`/`ondeselect` fire
per affected chip; a cancelling `onbeforechange` blocks the default change entirely.

**Independent Test**: Wire all four event handlers; verify firing/argument behavior for user taps
and programmatic `datavalue` assignments, and that a cancelling `onbeforechange` prevents any
state change or further events.

### Tests for User Story 5 (MANDATORY — Constitution Principle VIII hard gate for new widgets)

- [X] T040 [P] [US5] Add event-contract tests to
      `projects/components/widgets/input/chipset/src/chipset.component.spec.ts`: wire Jest spies
      to `onchange`, `onselect`, `ondeselect`, `onbeforechange`; assert `onchange` fires exactly
      once per user tap with the updated `datavalue`; `onselect`/`ondeselect` fire for the
      specific chip(s) whose selected state changed, in both selection modes — Acceptance
      Scenarios 1-2, Contract C7 (depends on T023 existing)
- [X] T041 [P] [US5] Add cancelable-`onbeforechange` and programmatic-`datavalue` event tests to
      `projects/components/widgets/input/chipset/src/chipset.component.spec.ts`: a handler
      returning `false` leaves selection state unchanged and fires none of
      `onchange`/`onselect`/`ondeselect`; a handler returning `true`/`undefined` proceeds
      normally; setting `datavalue` programmatically fires `onchange` and the corresponding
      `onselect`/`ondeselect` for affected chips without invoking `onbeforechange` — Acceptance
      Scenarios 3-5, Contract C7, data-model.md State 4 (depends on T040)

### Implementation for User Story 5

- [X] T042 [US5] Verify/finish `onchange`/`onselect`/`ondeselect` firing semantics for both user
      taps and programmatic `datavalue` assignments, built in T016 (closes any gaps found by
      T040/T041's tests) — Acceptance Scenarios 1-2, 5
- [X] T043 [US5] Verify/finish the `onbeforechange` cancel path built in T015 — confirming a
      `false` return leaves `datavalue`/chip `selected` state fully unchanged and suppresses all
      three other events for that interaction (closes any gaps found by T041's tests) —
      Acceptance Scenarios 3-4

**Checkpoint**: All five user stories are independently functional — `wm-chipset`'s full public
contract (properties, both selection modes, per-chip disable, appearance, keyboard/ARIA, and all
four events) is implemented and test-covered.

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Final hard-gate validation, overflow/edge-case coverage, and build verification
spanning all user stories.

- [X] T044 [P] Add overflow-wrap test coverage to
      `projects/components/widgets/input/chipset/src/chipset.wrapper.component.spec.ts` / CSS
      class assertions confirming chips wrap onto additional lines when the group's total width
      exceeds its container (FR-018), and edge-case coverage for an empty dataset (no chips, no
      error, no selection in single-select mode) and a pre-set `datavalue` that matches no
      current record (renders unselected, no error) — spec Edge Cases
- [X] T045 [P] Add dataset-refresh edge-case coverage to
      `projects/components/widgets/input/chipset/src/chipset.component.spec.ts`: a dataset
      refresh that drops a previously-selected record's value silently removes it from
      `datavalue` (scalar → unset, array entry removed) without raising an error — data-model.md
      State 5, spec Edge Cases
- [X] T046 [P] Add an empty/missing-label rendering test confirming a chip whose
      `displayfield`/`displayexpression` resolves empty still renders a minimum tappable target
      without breaking neighboring chips' layout — spec Edge Cases
- [X] T047 Add the `appearance` (`elevated`/`outlined`) class-toggle test to
      `projects/components/widgets/input/chipset/src/chipset.wrapper.component.spec.ts`
      confirming the correct host/chip CSS class per value and that selection behavior is
      unaffected by `appearance` — Contract C5 (verifies T017)
- [X] T048 [P] Add leading icon/avatar rendering tests to
      `projects/components/widgets/input/chipset/src/chipset.wrapper.component.spec.ts`: setting
      `displayimagesrc` to a field name renders a leading `<img>` with the resolved per-record
      `imgSrc` on each chip; setting `iconclass`/`iconurl` to field names renders a leading
      `<wm-app-icon>` resolved from each record's `dataObject`; when both an image and an icon
      would resolve for the same record, the avatar image takes precedence per the render order
      implemented in T011 — research.md Decision 9, data-model.md Entity 1/Entity 2, Contract C2,
      FR-010 (verifies T010, T011)
- [X] T049 [P] Add a leading-visual-optional edge case test to
      `projects/components/widgets/input/chipset/src/chipset.wrapper.component.spec.ts`: a chip
      whose record has none of `displayimagesrc`/`iconclass`/`iconurl` resolving renders with no
      leading visual, remains fully tappable/selectable and keyboard-navigable, and does not
      raise an error or break the chip's layout — spec Key Entities ("optional leading
      icon/avatar"), FR-010, Contract C2 (verifies T010, T011)
- [X] T050 Run `npx jest --no-cache projects/components/widgets/input/chipset` and fix any
      failures until both `chipset.component.spec.ts` and `chipset.wrapper.component.spec.ts`
      pass green — Constitution Principle VIII hard gate, quickstart.md §1
- [X] T051 Run the full `npm test` suite and confirm it exits 0 with zero regressions to existing
      `radioset`/`checkboxset`/`chips` specs — Constitution Principle VIII hard gate, FR-019,
      SC-007, quickstart.md §1
- [X] T052 Run `./build.sh` and confirm `@wm/components/input/chipset` builds successfully in
      dependency order with no type errors and no regressions to sibling library builds —
      quickstart.md §2
- [ ] T053 Perform the manual dynamic-mode (Prism/JIT) smoke test from quickstart.md §3: add a
      `<div wmChipset ...>` to a scratch page, confirm no "component not found" console error,
      exercise click/keyboard/selectionmode-switch/overflow-wrap/leading-icon-avatar behavior
      manually
      > **Status**: NOT PERFORMED in this session — requires a running scratch app; the
      > equivalent programmatic behavior is covered by `chipset.wrapper.component.spec.ts`.
- [ ] T054 Perform the manual form-integration smoke test from quickstart.md §4: place
      single-select and multi-select `wm-chipset` instances inside a `wm-form`, verify required
      validation blocks submission, verify readonly/disabled propagation, and verify submitted
      form data reflects each widget's `datavalue`
      > **Status**: NOT PERFORMED in this session — requires a running app with a `wm-form`; the
      > equivalent programmatic behavior is covered by `chipset.wrapper.component.spec.ts` (US3).

**Implementation status note (this session)**: T001-T052 complete — production code, registration,
build-system wiring, and full test suite (62/62 chipset tests, plus full-repo regression suite)
are done and green. `./build.sh` was re-run under Node 22.18.0 (the constitution-pinned toolchain;
the first attempt under Node 18.20.4 failed on an unrelated pre-existing `ng-packagr`/ESM
tooling incompatibility) and confirmed `@wm/components/input/chipset` builds cleanly via
`ng-packagr` with no type errors, with no build errors observed in any sibling package up to the
point the session's build run ended. T053/T054 are manual, live-app smoke tests that require a
running WaveMaker scratch app and were not exercised in this automated session — recommended as a
follow-up manual QA pass before shipping.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately.
- **Foundational (Phase 2)**: Depends on Setup completion — BLOCKS all user stories (T004-T022
  must all complete; the widget must exist, be registered, and support both modes, disabling,
  appearance, optional leading icon/avatar rendering, keyboard nav, and all four events before
  any user story's tests can pass).
- **User Stories (Phase 3-7)**: All depend on Foundational phase completion.
  - US1 (P1) has no dependency on other stories.
  - US2 (P2) depends on the shared `selectionmode` mechanism from Foundational (T008) but is
    independently testable from US1.
  - US3 (P3) exercises form integration and per-record disabling built in Foundational; depends
    conceptually on US1/US2 selection behavior being correct but adds no new production code
    paths of its own beyond verification.
  - US4 (P4) exercises the keyboard/ARIA layer built in Foundational (T009, T011-T013);
    independently testable once Foundational is done.
  - US5 (P5) exercises the event layer built in Foundational (T015-T016); independently testable
    once Foundational is done.
- **Polish (Phase 8)**: Depends on all five user stories being complete.

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational (Phase 2) — No dependencies on other
  stories. **This is the MVP.**
- **User Story 2 (P2)**: Can start after Foundational — independently testable from US1 (shares
  the `selectionmode`/click-handler code from Foundational but exercises the opposite mode).
- **User Story 3 (P3)**: Can start after Foundational — builds on US1/US2 selection behavior
  being correct but is independently verifiable as its own contract (form integration).
- **User Story 4 (P4)**: Can start after Foundational — independently testable (keyboard layer
  is mode-agnostic).
- **User Story 5 (P5)**: Can start after Foundational — independently testable (event layer
  wraps both modes' selection logic).

### Within Each User Story

- Tests (mandatory per Principle VIII) MUST be written before/alongside the corresponding
  "Implementation for User Story N" verification tasks.
- All "Implementation for User Story N" tasks in Phases 3-7 are **verification/gap-closing**
  tasks against the Foundational implementation (T004-T022) — the bulk of the production code is
  built once in Phase 2 and exercised per story in Phases 3-7.
- Story complete before moving to the next priority (or run in parallel per team capacity).

### Parallel Opportunities

- T002 can run in parallel with T001/T003 (different files).
- Within Phase 2: T004 and T005 can run in parallel (different files); most other Phase 2 tasks
  are sequential (same file, `chipset.component.ts`/`chipset.component.html`/`chipset.props.ts`,
  building on each other).
- Once Foundational (Phase 2) completes, all five user stories' **test-writing** tasks
  (T023-T024, T027-T028, T031-T032, T036-T037, T040-T041) can be written in parallel by different
  contributors, since they land in the same two files but cover disjoint scenarios — coordinate
  merges into `chipset.component.spec.ts`/`chipset.wrapper.component.spec.ts` to avoid conflicts.
- All Phase 8 test/edge-case tasks marked [P] (T044-T046, T048-T049) can run in parallel
  (different assertions in the same or different spec sections); T050-T054 are sequential
  validation gates.

---

## Parallel Example: User Story 1

```bash
# Launch both new spec files for User Story 1 together:
Task: "Create chipset.component.spec.ts single-select tests in projects/components/widgets/input/chipset/src/chipset.component.spec.ts"
Task: "Create chipset.wrapper.component.spec.ts single-select tests in projects/components/widgets/input/chipset/src/chipset.wrapper.component.spec.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (T001-T003).
2. Complete Phase 2: Foundational (T004-T022) — CRITICAL, blocks all stories; this is where the
   bulk of `ChipsetComponent`'s production code is written.
3. Complete Phase 3: User Story 1 (T023-T026).
4. **STOP and VALIDATE**: run `npx jest --no-cache projects/components/widgets/input/chipset`
   and confirm single-select behavior independently.
5. Demo a single-select `wm-chipset` as a drop-in chip-styled `wm-radioset` replacement.

### Incremental Delivery

1. Setup + Foundational → widget exists, registered, both modes/events/keyboard/disable/
   appearance/leading-icon-avatar implemented in production code.
2. Add User Story 1 tests/verification → single-select MVP validated.
3. Add User Story 2 → multi-select validated independently.
4. Add User Story 3 → form integration validated independently.
5. Add User Story 4 → keyboard/ARIA validated independently.
6. Add User Story 5 → event contract validated independently.
7. Phase 8 → full-suite green (`npm test`), `build.sh` green, manual smoke tests — feature
   complete per Constitution Principle VIII hard gate.

### Parallel Team Strategy

With multiple developers, after Foundational (Phase 2) is done by one owner (it is largely
sequential, same-file work):

- Developer A: User Story 1 + User Story 2 (share the selection-mode/click-handler surface)
- Developer B: User Story 4 (keyboard/ARIA) + User Story 5 (events)
- Developer C: User Story 3 (form integration) + Phase 8 edge cases

Coordinate merges into the two shared spec files (`chipset.component.spec.ts`,
`chipset.wrapper.component.spec.ts`) to avoid conflicting hunks.

---

## Notes

- [P] tasks = different files, no dependencies (or additive, non-conflicting sections of the
  same spec file — coordinate merges).
- [Story] label maps task to specific user story for traceability.
- Per Constitution Principle VIII (HARD GATE for new widgets), test tasks in every user-story
  phase are MANDATORY, not optional — this deviates from the general template's "tests are
  optional" default.
- Most "Implementation for User Story N" tasks are verification/gap-closing tasks against the
  single Foundational implementation (T004-T022), since `wm-chipset`'s selection modes, events,
  keyboard model, and leading-icon/avatar rendering are built as one cohesive component, not
  incrementally per story.
- `wm-chips` (`projects/components/widgets/input/chips/`) MUST remain untouched — no task above
  modifies any file under that path (FR-001).
- Studio-side property-panel metadata (`wavemaker-ng-studio`) and `appearance` design tokens
  (`wavemaker-foundation-css`) are explicitly OUT OF SCOPE for this tasks.md (research.md
  Decision 8) — they are coordinated follow-up work in their respective repos.
- Verify tests fail (or are absent) before implementing; commit after each task or logical group;
  stop at any checkpoint to validate a story independently.
