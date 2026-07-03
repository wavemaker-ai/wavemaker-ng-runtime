---
description: "Task list for AutoLayout Support for Composite Widget"
---

# Tasks: AutoLayout Support for Composite Widget

**Input**: Design documents from `/specs/003-composite-autolayout/`

**Prerequisites**: plan.md (required), spec.md (required), research.md, data-model.md, contracts/autolayout-composite.md, quickstart.md

**Tests**: EXCLUDED per user request. No test tasks are generated; the existing
`composite.directive.spec.ts` is left unmodified. Validation is manual / in the Prism canvas.

**Organization**: Tasks are grouped by user story. Because this feature is a two-file edit that
mirrors `wm-container`, the shared enabling edits live in the Foundational phase and the MVP story
(US1); US2 and US3 are delivered by those same edits and are covered by verification/validation
tasks (no additional source changes).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: US1 / US2 / US3 (maps to spec.md user stories)
- Exact file paths are included in each task.

## Path Conventions

- Widget package (edited): `projects/components/widgets/input/composite/src/`
- Reference only (NOT modified): `projects/components/base/src/decorators/`,
  `projects/components/base/src/widgets/common/container/`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Confirm the shared AutoLayout building blocks exist and review the reference pattern.

- [X] T001 [P] Confirm `AutoLayout` and `AUTO_LAYOUT_PROPS` are exported from `@wm/components/base` by checking `projects/components/base/src/public_api.ts` (expected: `export * from './decorators/autolayout.decorator'` and `'./decorators/autolayout.props'`).
- [X] T002 [P] Review the reference implementation `projects/components/base/src/widgets/common/container/container.directive.ts` and `container.props.ts` to mirror the `@AutoLayout()` + `...AUTO_LAYOUT_PROPS` pattern.
- [X] T003 [P] Confirm the composite host from `projects/components/transpile/src/input/default/composite/composite.build.ts` is a single `<div wmComposite …>` (validates the decorator defaults: no `targetSelector`/`bindParent`).

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Wire the `App` dependency the decorator needs to gate on `app.isPrism`. Required before the decorator can be applied.

**⚠️ CRITICAL**: Must complete before the User Story phases.

- [X] T004 Add `App` to the existing `@wm/core` import in `projects/components/widgets/input/composite/src/composite.directive.ts` (currently imports `addForIdAttributes, switchClass` from `@wm/core`).
- [X] T005 Add `private app: App` as a constructor parameter property, immediately after `inj: Injector`, in `projects/components/widgets/input/composite/src/composite.directive.ts` (insertion-only; do not reorder the existing `@Inject('EXPLICIT_CONTEXT') @Optional() explicitContext` parameter).

**Checkpoint**: `this.app` is resolvable → decorator gating will work.

---

## Phase 3: User Story 1 - Composite arranges its content with flex layout props (Priority: P1) 🎯 MVP

**Goal**: The Composite exposes and honors flex-arrangement props (direction, wrap, alignment, gap, columngap) to arrange its caption + input control, in the Prism canvas.

**Independent Test**: In the Prism canvas, set `direction=row`, `gap=8`, `alignment=middle-left` on a Composite and observe the caption + control arrange via flex, overriding the caption-position layout (quickstart Validation 4, step 2).

### Implementation for User Story 1

- [X] T006 [US1] Add `AutoLayout` to the existing `@wm/components/base` import line and apply `@AutoLayout()` (no options) immediately above the `@Directive({...})` decorator on `CompositeDirective` in `projects/components/widgets/input/composite/src/composite.directive.ts` (depends on T004, T005 — same file).
- [X] T007 [P] [US1] Add `AUTO_LAYOUT_PROPS` to the existing `@wm/components/base` import line and spread `...AUTO_LAYOUT_PROPS` as the LAST entry of the `wm-form-group` registration Map in `projects/components/widgets/input/composite/src/composite.props.ts`.
- [ ] T008 [US1] Manually validate flex arrangement in Prism per `quickstart.md` Validation 4 (step 2): flex-arrangement props arrange content and take precedence over `captionposition` (contract C3; FR-002; SC-002).

**Checkpoint**: MVP complete — Composite is AutoLayout-aware and arranges its content via flex in Prism.

---

## Phase 4: User Story 2 - Composite is positioned and sized with layout props (Priority: P2)

**Goal**: The Composite honors position/size props (position, positionvalue, width, height, padding, overflow, zindex, clipcontent) in the Prism canvas.

**Independent Test**: In the Prism canvas, set `width=fill`, `padding=8px`, `position=relative` on a Composite and observe it size/position accordingly (quickstart Validation 4, step 3).

### Implementation for User Story 2

- [X] T009 [US2] No additional source changes required: the position/size props are already registered by the `...AUTO_LAYOUT_PROPS` spread (T007) and applied by the `@AutoLayout()` decorator (T006). Confirm the keys `position, positionvalue, width, height, padding, overflow, zindex, clipcontent` are present in the `wm-form-group` registration in `projects/components/widgets/input/composite/src/composite.props.ts` (contract C1).
- [ ] T010 [US2] Manually validate position/size in Prism per `quickstart.md` Validation 4 (step 3): position/size props apply to the host (contract C4; FR-003; SC-003).

**Checkpoint**: US1 and US2 both functional from the same two edits.

---

## Phase 5: User Story 3 - Existing Composite behavior is preserved (Priority: P1)

**Goal**: Caption positioning, `required` propagation, and default rendering are unchanged after AutoLayout is integrated; runtime (non-Prism) is unaffected.

**Independent Test**: With no AutoLayout props set, the Composite renders identically to before; `captionposition` still toggles caption classes; `required` still propagates to child controls; in a non-Prism app the layout props have no effect (quickstart Validations 2 & 3).

### Implementation for User Story 3

- [X] T011 [US3] Verify (code review, no change) that the decorator delegates to the composite's originals in `projects/components/widgets/input/composite/src/composite.directive.ts`: `onPropertyChange` still handles `captionposition` (`switchClass`) and `required` (`assignRequiredToSubComponents`); the wrapped `ngAfterViewInit` still calls `addForIdAttributes` + `assignRequiredToSubComponents`; the wrapped `ngOnDestroy` still nulls `componentRefs` (contract C5; FR-006).
- [ ] T012 [US3] Manually validate no-regression + runtime no-op per `quickstart.md` Validations 2 & 3: unset props render identically, caption/required behavior intact, non-Prism app unaffected (contract C2/C5; FR-005, FR-008; SC-004, SC-005).

**Checkpoint**: All three stories functional; zero regression to existing behavior.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Verify quality of the two edited files and hand off the studio-side work.

- [X] T013 [P] Run lint/`ReadLints` on `projects/components/widgets/input/composite/src/composite.directive.ts` and `composite.props.ts`; fix any lint errors introduced by the edits (single quotes, semicolons, no stray console — per constitution toolchain rules).
- [ ] T014 Build the composite package (via `build.sh` or targeted ng-packagr) to confirm a clean compile with the additive change (no test run — excluded per request).
- [ ] T015 Run the `quickstart.md` manual validations (1–4 + build gate) end-to-end.
- [ ] T016 Hand-off: run the `autolayout-studio` skill in the `wavemaker-ng-studio` repo on `wm-composite` to wire the properties-panel metadata (out of scope for this runtime feature; noted in spec Assumptions).

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately (all [P]).
- **Foundational (Phase 2)**: Depends on Setup — BLOCKS user stories (adds `App` injection the decorator requires).
- **User Story 1 (Phase 3)**: Depends on Foundational. This is the MVP and contains the two enabling edits.
- **User Story 2 (Phase 4)**: Depends on US1 edits (T006, T007) — no new source changes, verification/validation only.
- **User Story 3 (Phase 5)**: Depends on US1 edits (T006) — verification/validation only.
- **Polish (Phase 6)**: Depends on the source edits (T006, T007) being complete.

### Within Each User Story

- T006 (decorator, `composite.directive.ts`) depends on T004+T005 (same file).
- T007 (props spread, `composite.props.ts`) is independent of T006 → `[P]`.
- Validation tasks (T008, T010, T012) run after the source edits.

### Parallel Opportunities

- Setup: T001, T002, T003 all `[P]`.
- Story edits: T006 (`composite.directive.ts`) and T007 (`composite.props.ts`) touch different files → can run in parallel.
- Polish: T013 `[P]`.

---

## Parallel Example: User Story 1 (the two enabling edits)

```bash
# Different files — run together:
Task: "Apply @AutoLayout() + import in projects/components/widgets/input/composite/src/composite.directive.ts"
Task: "Spread ...AUTO_LAYOUT_PROPS in projects/components/widgets/input/composite/src/composite.props.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Phase 1: Setup (confirm exports + reference).
2. Phase 2: Foundational (add `App` to constructor).
3. Phase 3: User Story 1 — apply `@AutoLayout()` + spread `...AUTO_LAYOUT_PROPS`.
4. **STOP and VALIDATE**: flex arrangement works in Prism; existing behavior intact.
5. This MVP already delivers US1, and (because of the shared decorator/prop set) the mechanics of US2/US3 as well.

### Incremental Delivery

1. Setup + Foundational → dependency ready.
2. US1 edits → validate flex arrangement (MVP).
3. US2 → validate position/size (same edits, no new code).
4. US3 → validate preservation + runtime no-op.
5. Polish → lint, build, studio hand-off.

---

## Notes

- Testing is excluded per user request — no test tasks; existing `composite.directive.spec.ts` untouched.
- Total source edits: 2 files (`composite.directive.ts`, `composite.props.ts`); no new dependencies.
- All AutoLayout effects are Prism-gated (`app.isPrism`) — runtime rendering of generated apps is unchanged.
- The studio-side properties-panel wiring (T016) is a separate repo/skill and out of scope here.
- Commit after each logical group; validate at each checkpoint.
