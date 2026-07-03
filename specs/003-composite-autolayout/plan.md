# Implementation Plan: AutoLayout Support for Composite Widget

**Branch**: `003-composite-autolayout` | **Date**: 2026-07-02 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/003-composite-autolayout/spec.md`

## Summary

Make the `wm-composite` (a.k.a. `wm-form-group`) widget AutoLayout-aware by reusing the
existing shared `@AutoLayout` decorator and `AUTO_LAYOUT_PROPS` map — exactly the way
`wm-container` already does it. The `CompositeDirective` gets the `@AutoLayout()` decorator
(defaults, no `targetSelector`/`bindParent`), the constructor gains `private app: App`, and
`composite.props.ts` spreads `...AUTO_LAYOUT_PROPS` as the last entries of its registration
Map. All layout effects are gated on `app.isPrism` (design-time/Prism only); runtime rendering
of generated apps is unchanged. `captionposition` class-switching and `required` propagation
are preserved untouched; when a designer explicitly sets flex-arrangement props, the decorator's
inline styles on the host naturally take precedence over the caption-position classes. **No new
dependencies** are introduced.

## Technical Context

**Language/Version**: TypeScript 5.9.x, Angular 20.3.x (per constitution; `compilationMode: partial`, strict OFF)

**Primary Dependencies**: Existing only — `@wm/components/base` (`AutoLayout`, `AUTO_LAYOUT_PROPS`, `StylableComponent`, `styler`, `register`, prop-type constants), `@wm/core` (`App`, `switchClass`, `addForIdAttributes`). No new dependencies.

**Storage**: N/A

**Testing**: Out of scope for this plan (no new tests authored, per user request). The existing `composite.directive.spec.ts` is left unmodified; validation is done manually / in the Prism canvas.

**Target Platform**: WaveMaker-generated Angular apps (dynamic JIT + AOT), design-time Prism (studio) canvas.

**Project Type**: Angular component library (monorepo of `@wm/*` ng-packagr packages).

**Performance Goals**: No runtime cost — decorator hooks early-return when `!app.isPrism`, so the generated-app render path is unaffected.

**Constraints**: Backward-compatible public contract (Principle VII); default prop values must preserve existing rendering (SC-004); Prism-gating mandatory (Principle VI); deterministic cleanup (Principle V) already handled inside the decorator's `ngOnDestroy` override.

**Scale/Scope**: Two edited files in one widget package (`composite.directive.ts`, `composite.props.ts`). No test changes (out of scope for this plan). No cross-package API surface change beyond the additive prop registration.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Relevance | Status |
|-----------|-----------|--------|
| I. Layered Packages & Dependency Direction | Composite lives in `@wm/components/widgets/input`; imports `AutoLayout`/`AUTO_LAYOUT_PROPS` from `@wm/components/base` (allowed downward dependency). No new package, no upward/circular dep. | PASS |
| II. Widget Base-Class & Proxy Discipline | No change to base-class chain; decorator wraps `onPropertyChange`/`onStyleChange` (the proxy pipeline) and delegates to the original. State still flows through the proxy. | PASS |
| III. Property/Event/Binding Contracts | Props registered via `register('wm-form-group', Map)` with `...AUTO_LAYOUT_PROPS` (additive, standard PROP_* types). No event changes. | PASS |
| IV. Dual-Mode Compatibility & Dynamic Registration | No new widget/directive/pipe/module; `CompositeDirective` already declared. `REQUIRED_MODULES_FOR_DYNAMIC_COMPONENTS` needs no change. | PASS |
| V. Deterministic Cleanup & Memory Safety | Decorator adds its own `ngOnDestroy` (completes `destroySub`, unwatches). Existing `ngOnDestroy` (clears `componentRefs`) is preserved via delegation. | PASS |
| VI. Prism-Aware AutoLayout & Styling | All effects gated on `app.isPrism`; defaults chosen so opted-in-but-unset renders identically. Non-layout styling still via foundation-css/`styler()`. | PASS |
| VII. Runtime Safety & Public Contract Stability | Additive props only; defaults preserve rendering. Studio-side metadata coordinated separately (autolayout-studio skill, out of scope here). | PASS (coordination noted) |
| VIII. Test-Backed Changes | Testing is intentionally excluded from this plan per user request. No new tests authored; the existing `composite.directive.spec.ts` is left unmodified. | DEFERRED (by request) |

**Result**: No violations. No entries required in Complexity Tracking.

**Post-Design Re-Check (after Phase 1)**: Re-evaluated against `research.md`, `data-model.md`, and
`contracts/autolayout-composite.md`. Design remains a 2-file additive change reusing the shared
decorator/props with defaults; no new dependency, no base-class/module/contract change, cleanup
delegated through the decorator. All gates still **PASS** — no new violations introduced by the
design. Cleared to proceed to `/speckit-tasks`.

## Project Structure

### Documentation (this feature)

```text
specs/003-composite-autolayout/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md        # Phase 1 output (/speckit-plan command)
├── quickstart.md        # Phase 1 output (/speckit-plan command)
├── contracts/           # Phase 1 output (/speckit-plan command)
│   └── autolayout-composite.md
├── checklists/
│   └── requirements.md  # Spec quality checklist (already present)
└── tasks.md             # Phase 2 output (/speckit-tasks command - NOT created here)
```

### Source Code (repository root)

```text
projects/components/
├── base/src/
│   ├── decorators/
│   │   ├── autolayout.decorator.ts   # REUSED as-is (reference only, not modified)
│   │   └── autolayout.props.ts       # REUSED as-is (AUTO_LAYOUT_PROPS, not modified)
│   └── public_api.ts                 # Already exports AutoLayout + AUTO_LAYOUT_PROPS
├── transpile/src/input/default/composite/
│   └── composite.build.ts            # READ only — confirms host is <div wmComposite …>
└── widgets/input/composite/src/
    ├── composite.directive.ts        # EDIT — add @AutoLayout() + import + `private app: App`
    └── composite.props.ts            # EDIT — spread ...AUTO_LAYOUT_PROPS (last)
    #  composite.directive.spec.ts    # NOT modified — testing out of scope for this plan
```

**Structure Decision**: Existing monorepo layout. Follow the `wm-container` reference exactly
(`projects/components/base/src/widgets/common/container/container.directive.ts` +
`container.props.ts`), adapted for a widget-package file that imports from the `@wm/components/base`
alias instead of relative decorator paths.

## Complexity Tracking

> No Constitution Check violations — this section intentionally left empty.
