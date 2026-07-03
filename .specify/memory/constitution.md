<!--
SYNC IMPACT REPORT
==================
Version change: 3.0.0 → 3.1.0 (MINOR — materially expands a principle)

Modified principles:
- VIII. Test-Backed Changes (unchanged title; scope expanded to add a hard test
  gate for NEW widgets/components while preserving the qualitative stance for
  bug fixes, refactors, and narrowly-scoped/design-time-only changes)

Added sections: none
Removed sections: none

Templates requiring updates:
- ✅ .specify/templates/plan-template.md (Constitution Check gate now cites the
  Principle VIII new-widget test gate)
- ✅ .specify/templates/tasks-template.md (Tests note now marks widget/component
  tests as MANDATORY per Principle VIII rather than always OPTIONAL)
- ✅ .specify/memory/constitution.md (Development Workflow & Quality Gates + CI
  bullet updated to reflect the new-widget hard gate)

Deferred TODOs: none
-->
# WaveMaker Angular Runtime Constitution

`wavemaker-ng-runtime` is the Angular runtime framework and component library that
**every** WaveMaker-generated application depends on. Its widgets, base classes, services,
and variable system are shipped as `@wm/*` library packages and consumed by two runtime
modes (dynamic JIT and AOT-generated app). Because a change here ripples into every
deployed app, stability of public contracts and runtime safety outrank convenience.

Authoritative background lives in `docs/` (overview, architecture, runtime-lifecycle,
widget-framework, patterns-and-conventions, constraints, autolayout). This constitution
distills the non-negotiable rules from those documents; when in doubt, consult `docs/`.

## Core Principles

### I. Layered Packages & Dependency Direction
The workspace is a monorepo of `@wm/*` libraries under `projects/`, each an ng-packagr
package with its own `ng-package.json` and `public_api.ts`. The dependency graph is
strictly layered and MUST NOT be violated (see `docs/02-architecture.md`):

- `@wm/core` is the foundation and has **no** `@wm/*` dependencies.
- `@wm/components/base` depends only on `@wm/core`; widget libraries
  (`@wm/components/widgets/<category>`) depend on `base` + `core`.
- `@wm/runtime-base` aggregates everything; `@wm/runtime-dynamic` extends it and is the
  only package permitted to depend on `@angular/compiler`.

Never introduce an upward or circular dependency (e.g. `@wm/core` importing a widget).
Widgets are organized into per-category libraries (`basic`, `input`, `containers`,
`data`, `dialogs`, `navigation`, `advanced`, `chart`, `page`, `prefab`); place new
widgets in the correct category rather than creating ad-hoc packages.

### II. Widget Base-Class & Proxy Discipline (NON-NEGOTIABLE)
Every widget extends the framework stack and initializes through it (see
`docs/05-widget-framework.md`):
`BaseComponent -> StylableComponent -> {BaseContainerComponent | DatasetAwareFormComponent | DatasetAwareNavComponent}`.
Widgets MUST pass `WIDGET_CONFIG` to `super()`, apply styles via `styler()`, expose the
ref via `provideAsWidgetRef()`, and implement `onPropertyChange` / `onStyleChange` for
behavior. All state mutation flows through the widget `Proxy` and
`globalPropertyChangeHandler` so that `Widgets.<name>.prop = value` triggers change
detection. Never bypass the proxy/property-change pipeline by mutating the DOM or
component fields directly; doing so breaks binding, script access, IE11 fallback, and
Prism mode.

### III. Property, Event & Binding Contracts
- **Properties**: register per markup tag via `register('wm-<tag>', Map)` using the
  `PROP_STRING | PROP_NUMBER | PROP_BOOLEAN | PROP_ANY` types, triggered by
  `static initializeProps = registerProps()`. Form-input widgets use `registerFormWidget`.
- **Events**: expose `on<Event>` inputs compiled once via `$parseEvent`; honor the
  documented return-value semantics (`onBefore*` returning `false` cancels;
  `onResult`/`onBeforeDatasetReady` returning a value overrides data).
- **Binding**: `bind:` expressions create `$watch` watchers keyed by property identifier.
  Respect watcher muting during init (`muteWatchers`/`unMuteWatchers`) and keep bound
  expressions cheap — watchers run synchronously every change-detection cycle
  (`docs/10-constraints.md` §4).

### IV. Dual-Mode Compatibility & Dynamic Registration (NON-NEGOTIABLE)
The base classes, services, guards, resolves, and widget libraries are identical across
both runtime modes. Any new widget, directive, or pipe that a page template can reference
MUST be added to `REQUIRED_MODULES_FOR_DYNAMIC_COMPONENTS` in `@wm/runtime-dynamic`
(`docs/10-constraints.md` §1) — otherwise it throws a runtime compilation error the first
time a page uses it. Do not add anything that hard-requires JIT/`@angular/compiler`
outside `runtime-dynamic`, so the AOT-generated app keeps working.

### V. Deterministic Cleanup & Memory Safety (NON-NEGOTIABLE)
The framework performs no automatic cleanup; the runtime is a long-lived SPA where leaks
compound across navigations (`docs/09-patterns-and-conventions.md` §7,
`docs/10-constraints.md` §6). Any component/directive/service that subscribes to an
Observable, adds a DOM/media listener, holds widget references, or debounces MUST
implement `ngOnDestroy` and: unsubscribe subscriptions, complete Subjects, clear
Maps/arrays, null out DOM/`$element` references, clear `ViewContainerRef`, and cancel
debounced functions. Respect the page attach/detach lifecycle (`ngOnAttach`/`ngOnDetach`)
for cached pages rather than assuming `ngOnInit`/`ngOnDestroy` always run.

### VI. Prism-Aware AutoLayout & Styling
Design-time (Prism) layout behavior is added via the `@AutoLayout()` decorator plus the
shared `AUTO_LAYOUT_PROPS` map, and every layout effect MUST be gated on `app.isPrism`
so runtime rendering is untouched (`docs/11-autolayout.md`). Use `targetSelector` when
inner-element layout must be separated from host sizing, and `bindParent` when bind scope
differs (e.g. inside `*ngFor`). Non-layout styling comes only from foundation-css
token/host classes and the runtime `styler()` (respecting `APPLY_STYLES_TYPE`); do not
hardcode styles that duplicate foundation tokens. Page/prefab CSS is auto-scoped —
genuinely global styles belong in `app.css` (`docs/10-constraints.md` §5).

### VII. Runtime Safety & Public Contract Stability
Markup tags (`wm-<tag>`), widget property names/types/defaults, event names, package
exports (`public_api.ts`), and service interfaces are public contracts consumed by
generated apps and the studio. Changes MUST be backward compatible or carry an explicit
migration path. Default property values MUST preserve existing rendering. Coordinate any
contract change across the coupled repos (wavemaker-ng-studio markup meta,
wavemaker-foundation-css tokens, and the yalc-linked variables/custom-widgets packages)
in the same change set or an explicitly sequenced rollout. Preserve documented
accommodations (e.g. IE11 `Proxy` fallback requires pre-declared props —
`docs/10-constraints.md` §9).

### VIII. Test-Backed Changes
Unit tests use Jest (`jest-preset-angular`), co-located as `*.spec.ts` (widget markup /
wrapper behavior tests as `*.wrapper.component.spec.ts`) under `projects/`. The testing
bar depends on the kind of change:

- **New widgets/components (HARD GATE, NON-NEGOTIABLE):** Any NEW widget or component
  added to the runtime MUST ship with tests in the same change set: Jest unit tests
  co-located as `*.spec.ts`, and markup/wrapper behavior tests as
  `*.wrapper.component.spec.ts` under `projects/`, following the existing patterns
  (e.g. `chips.wrapper.component.spec.ts`). Those tests MUST cover the widget's public
  properties, its events, and each behavioral variant. A green `npm test` including this
  coverage IS a hard merge gate — a new widget MUST NOT merge without it, and this
  requirement cannot be waived by qualitative reviewer judgment.
- **Bug fixes, refactors, and narrowly-scoped/design-time-only changes (SOFT, qualitative):**
  Tests are strongly encouraged — bug fixes SHOULD add a regression test and changed
  behavior SHOULD ship with tests — but a green `npm test` is NOT a hard merge gate here.
  Reviewers MAY approve such a change without full (or any) new test coverage when there
  is a reasonable justification (e.g. design-time-only behavior, narrowly scoped or
  low-risk changes), judging test adequacy qualitatively.

Existing tests SHOULD NOT be knowingly regressed. Coverage is collected but not
threshold-enforced.

## Technology & Toolchain Constraints

- Pinned stack: Angular 20.3.x, TypeScript 5.9.x, Node 22.18.x, npm 10.9.x
  (`engineStrict: true`). Do not introduce dependencies incompatible with these.
- TypeScript strict mode is intentionally OFF and `strictTemplates: false`; libraries
  build with `compilationMode: partial`. Do not flip these globally in a feature change.
- Lint: ESLint governs the app `src/`; legacy TSLint rules remain the de facto code style
  (single quotes, semicolons, spaces, `prefer-const`, no stray `console`).
- Established legacy deps (jQuery/`$element`, `lodash-es`, `moment`, d3) are part of the
  framework; prefer existing `@wm/core` utilities (`utils`, `watcher`, `expression-parser`)
  over adding new libraries.

## Documented Architectural Constraints

These are deliberate design decisions (full detail in `docs/10-constraints.md`) that new
work MUST respect rather than "fix" without an explicit, coordinated decision:

- Dynamic compilation requires full module pre-declaration (Principle IV).
- Fragment monitoring gates page `onReady()` on all nested partials/prefabs resolving.
- Variable scope is App- or Page-bounded; there is no implicit cross-page state sharing.
- Watcher binding runs synchronously each CD cycle; `ChangeDetectionStrategy.Default` is
  used throughout (no `OnPush`).
- runtime-dynamic uses hash-based routing and does not use Angular route-level lazy
  loading; the framework is eagerly loaded.
- API-aware variables require `MetadataService` (`app-servicedefs.json`) loaded first.

## Development Workflow & Quality Gates

- Feature work follows Spec-Driven Development via Spec Kit: `/speckit-specify` ->
  `/speckit-clarify` -> review `spec.md` -> `/speckit-plan` -> `/speckit-tasks` ->
  `/speckit-implement`. Trivial bug fixes may skip the full flow.
- Full builds run through `build.sh` (ng-packagr per library in dependency order -> UMD
  bundle); `bundle-runtime-cli.sh` and `bundle-angular-app-cli.sh` publish
  `@wavemaker-ai/app-ng-runtime` and `@wavemaker-ai/angular-app` (yalc in dev, tarball on
  release).
- CI (GitLab, merge requests) builds sibling repos, yalc-links them, runs `build.sh`,
  `bundle-runtime-cli.sh`, and `npm test`. A green build is the merge bar. For changes
  that add a NEW widget/component, a green `npm test` covering the widget's public
  properties, events, and each behavioral variant (co-located `*.spec.ts` +
  `*.wrapper.component.spec.ts`) is ALSO a hard merge gate. For bug fixes, refactors, and
  narrowly-scoped/design-time-only changes, passing tests are strongly expected but are
  not a hard gate and reviewers judge adequacy qualitatively (see Principle VIII).
- Bundle budgets (5mb prod / 2mb dev initial) are guardrails; regressions that blow the
  budget need justification.

## Governance

This constitution supersedes ad-hoc conventions and is grounded in the `docs/` reference
set; where this file and `docs/` diverge, treat it as a defect and reconcile them. All PRs
and Spec Kit plans MUST verify compliance; deviations from the NON-NEGOTIABLE principles
(II, IV, V) and from Principle VII require explicit justification in the spec or PR
description. Amendments are made via PR editing this file, bumping the version below:

- MAJOR: removing/redefining a principle or a backward-incompatible governance change.
- MINOR: adding a principle or a materially new section.
- PATCH: clarifications and wording.

**Version**: 3.1.0 | **Ratified**: 2026-07-01 | **Last Amended**: 2026-07-03
