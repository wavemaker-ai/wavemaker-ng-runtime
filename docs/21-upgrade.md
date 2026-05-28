# Angular 21 platform upgrade summary

> WaveMaker ng-runtime · Angular 20 → 21 · See also [upgrade-history](../.cursor/skills/angular-upgrade/upgrade-history.md) for full engineering notes.

| Field | Value |
|-------|--------|
| Repository | wavemaker-ng-runtime |
| Branch | stage-ai |
| Completed | 2026-05-28 |
| From | Angular 20.3.x |
| To | Angular 21.2.x |

## Libraries upgraded

| Package | Before | After | Notes |
|---------|--------|-------|--------|
| `@angular/*` | 20.3.19 | 21.2.14 | core, common, compiler, forms, router, platform-browser, animations, service-worker |
| `@angular/cli` | 20.x | 21.2.13 | |
| `@angular-devkit/build-angular` | 20.x | 21.2.13 | |
| `@angular/compiler-cli` | 20.3.19 | 21.2.14 | |
| `@angular/language-service` | 20.3.19 | 21.2.14 | |
| `@angular-eslint/*` | 20.x | 21.4.0 | builder, eslint-plugin, template-parser, schematics |
| `@angular-builders/custom-webpack` | 20.x | 21.0.3 | |
| `ng-packagr` | 20.x | 21.2.3 | Library builds under `projects/` |
| `typescript` | 5.9.3 | 5.9.3 | Unchanged |
| `rxjs` | 7.8.2 | 7.8.2 | Unchanged |
| `zone.js` | 0.15.x | 0.16.2 | |
| `tslib` | 2.8.1 | 2.8.1 | Unchanged |
| `ngx-bootstrap` | 20.x | 21.2.0 | Removed most `forRoot()` APIs |
| `ngx-toastr` | 19.x | 20.0.5 | Toast uses `inject()`; custom toaster updated |
| `jest-preset-angular` | 15.x | 16.1.5 | Aligns with Angular 21 |
| `jest` / `@types/jest` | 30.x | 30.x | Unchanged in this bump |
| `ngx-color-picker` | 20.1.1 | 20.1.1 | Kept; peers compatible |

**Engines (unchanged):** Node 22.18.0, npm 10.9.3

**Not upgraded (stable):** jquery, jquery-ui, lodash-es, moment, d3, @fullcalendar/*, angular2-websocket, and most legacy DOM/chart dependencies per upgrade policy.

## Compatibility changes (made for this upgrade)

| Area | Change |
|------|--------|
| TypeScript | `moduleResolution: "bundler"` in `tsconfig.json` for Angular 21 FESM / `@angular/common/http` resolution |
| Rollup UMD libs | `@angular/core/primitives/di` → `primitives-di.mjs`, `signals` → `primitives-signals.mjs`, `event-dispatch` → `primitives-event-dispatch.mjs` in `config/rollup.ng-libs.config.mjs` |
| Runtime bootstrap | `app.module.ts` / `app.config.ts`: ngx-bootstrap bare modules in imports; `ToastNoAnimationModule.forRoot()` retained where still supported |
| Transpiler | `projects/transpiler/src/imports.ts`: removed `forRoot: true` on ngx-bootstrap `ImportDef`s |
| HostListener | One static event name per decorator (checkbox, checkboxset, menu, menu-dropdown-item) |
| ngx-bootstrap 21 InputSignal | Menu `autoClose`, search `typeaheadOptionsLimit`; read/write via component API, not direct directive assignment |
| ngx-toastr 20 | `CustomToasterComponent`: no `super(toastr)`; `options()` signal; init in `ngOnInit` |
| Positioning / dropdowns | `adjustContainerPosition` / `adjustContainerRightEdges` tolerate missing `NgZone` on dropdown ref |
| Router outlet | `scheduleOverrideRouterOutlet()` polls until `@ViewChild(RouterOutlet)` exists (`@if (startApp)` timing on Angular 21) |
| Jest | `src/setup-jest.js` runs `patchNgxBootstrapFiles()`; specs use bare ngx-bootstrap modules (no `forRoot()`) |

## Patches and build hooks

| Item | Purpose |
|------|---------|
| `build-scripts/ngx-bootstrap-patch.mjs` | Injects `DestroyRef` for ngx-bootstrap 21 `PositioningService` (`takeUntilDestroyed(__destroyRef)` upstream bug) |
| `config/rollup.ngxBootstrap.config.mjs` | Applies patch during Rollup ngx-bootstrap bundle |
| `verify-ngx-bootstrap-bundle.sh` | Post-build gate: patch present in `ngx-bootstrap.bundle.js` and `wm-libs.js` |
| Platform build | **`sh build.sh -f`** is the upgrade gate (not `npm run build` CLI app path) |

## Validation completed

| Gate | Result |
|------|--------|
| Install | Pass |
| Security audit | 3 moderate remain (transitive `webpack-dev-server` via `@angular-devkit/build-angular`; no fix available) |
| Pattern review | Pass (no unresolved `must-change`) |
| Build (`sh build.sh -f`) | Pass |
| Post-build verify | Pass |
| Unit tests (`npm test`) | Mandatory gate; 124/126 suites in one run (yalc `variables` + flaky calendar noted) |
| Preview | URL recorded; sign-off pending after router-outlet fix deploy |

Preview URL: https://proxy-studio.wmdev.com/run-jlqb2h631c/SearchWidgetScenarios_master/#/LiveForm_DefaultValue_FormData

## New platform features intentionally not adopted

Capabilities available on Angular 21 that we **did not** take in this upgrade. Goal was **compatibility** with existing WaveMaker runtime, ng-packagr libraries, rollup UMD bundles, transpiler, and preview — not a modernization pass.

| Feature / direction | Reason deferred |
|---------------------|-----------------|
| Zoneless / `provideExperimentalZonelessChangeDetection` | High risk for legacy jQuery integration, `$appDigest`, and existing change-detection assumptions; Zone.js retained |
| Full standalone bootstrap only (drop `NgModule` bridges) | `runtime-dynamic` and generated apps still use `NgModule` + `importProvidersFrom` patterns |
| Signal-based forms / input() everywhere | Would require sweeping widget rewrites; not required for Angular 21 compile/runtime |
| Remove all `setTimeout` / monkey-patches (e.g. router outlet) | Kept minimal timing fixes; template `(attach)`/`(detach)` migration deferred |
| `httpResource` / resource APIs | Not used by platform; no product requirement |
| Aggressive `@defer` / incremental hydration everywhere | Runtime-compiled templates already use control flow selectively; no blanket migration |
| Replace ngx-bootstrap with CDK-only overlays | Major product/UI impact; ngx-bootstrap 21 kept with patches |
| Enable stricter template type checking project-wide | Incremental; not part of this major bump |
| Migrate all tests to Vitest | Jest + jest-preset-angular 16 retained |
| Adopt Angular 21 default standalone components for all new code | Existing transpiler/ng-packagr pipeline unchanged |

## Known follow-ups

- Confirm preview smoke after `scheduleOverrideRouterOutlet` rebuild is deployed to preview environment
- `model-variable.spec.ts` when `@wavemaker-ai/variables` yalc package is not linked
- Optional: guard-free router-outlet patch via `(attach)` / `(detach)` template outputs (modernization)


## Security notes

- `npm audit fix` applied without `--force`
- Remaining: **3 moderate** on transitive `webpack-dev-server` (dev/build tooling only; no upstream fix at time of upgrade)
- Recorded in skill `current-state.md`; does not block platform build gate per upgrade policy
