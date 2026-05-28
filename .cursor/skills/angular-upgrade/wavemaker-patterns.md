# WaveMaker patterns (wavemaker-ng-runtime)

**Repository-specific pattern catalog** for Step 6 and the Step 8 preview checklist. The generic workflow is in `SKILL.md`; commands are in `repo.config.sh` (`PATTERNS_FILE` points here).

When copying this skill to another repo, add that repo’s own `*-patterns.md` and set `PATTERNS_FILE` in `repo.config.sh` — do not duplicate this file under a second name.

Below: **this repo’s** catalog. Use during **Step 6** (after Step 5). Classify findings into `safe`, `needs-review`, `likely-breakage`, or `must-change`. Stop on unresolved `must-change`.

## Dependency classification (this repo)

Record decisions in `current-state.md` → **Dependency Decisions**.

| Upgrade with Angular (Step 3) | Check if required | Keep stable unless needed |
|------------------------------|-----------------|---------------------------|
| `@angular/*`, `typescript`, `rxjs`, `zone.js`, `tslib` | `rollup`, `@rollup/*`, webpack | `jquery`, `jquery-ui`, `lodash-es` |
| `ngx-bootstrap`, `ng-packagr`, `@angular/cli`, devkit | `jest`, `@types/jest`, `jest-preset-angular` | `.yalc` file deps (variables, foundation-css, custom-widgets) |
| `@angular-eslint/*`, `@angular-builders/custom-webpack` | `ngx-toastr`, `ngx-color-picker`, `angular-imask` | `moment`, `d3`, `@fullcalendar/*`, `angular2-websocket` |
| `engines.node`, `engines.npm` | | `summernote`, `iscroll`, `@ztree/ztree_v3`, `acorn` |

**Step 1 inventory paths:** `package.json`, lockfile, `angular.json`, `tsconfig*.json`, `build-scripts/ngx-bootstrap-patch.mjs`, `jest.config.js`, `src/setup-jest.js`.

## ngx-bootstrap bundle verification (Steps 4, 6, 7, 8, 10)

Re-running the patch or `build.sh` is **not** sufficient. Always verify **built** artifacts:

| When | Command |
|------|---------|
| Step 4 (after `npm install`, before build) | Diff patch vs upstream fesm; optional `--allow-missing` only |
| Step 6 (pattern review) | Same; strict verify **not** valid until dist exists |
| **Step 7 (gate — required)** | `build.sh` then **strict** `verify-ngx-bootstrap-bundle.sh` (automatic, no flags) |
| Step 8 (preview) | Confirm preview loads `dist/bundles/wmapp/scripts/wm-libs.js` from this build |
| Step 10 (finalize) | Record last strict verify result in `current-state.md` |

**Artifacts:** `dist/tmp/libs/ngx-bootstrap/ngx-bootstrap.bundle.js`, `dist/bundles/wmapp/scripts/wm-libs.js`.

**Block** if `takeUntilDestroyed(__destroyRef)` appears in a bundle **without** `inject(…DestroyRef)`. See §6 and §12.

## Where to search

| Area | Paths / grep hints |
|------|-------------------|
| Dynamic components | `projects/runtime-base/src/services/dynamic-component-ref-provider.service.ts`, `createComponent`, `environmentInjector`, `attachView` |
| RouterOutlet monkey-patch | `overrideRouterOutlet`, `@ViewChild(RouterOutlet)`, `routerOutlet.attach`, `router-outlet` inside `@if` |
| Runtime bootstrap | `projects/runtime-dynamic/src/app/app.config.ts`, `projects/runtime-dynamic/src/app/app.module.ts`, `src/main.ts` |
| ngx-bootstrap patch verify | `build-scripts/ngx-bootstrap-patch.mjs`, post-build grep on `wm-libs.js` / `ngx-bootstrap.bundle.js` (see §6 and §12) |
| Transpiler / parser | `projects/transpiler/`, `parseBinding`, `@if`, `@for`, `ng-container` |
| ngx-bootstrap | `ngx-bootstrap`, `build-scripts/ngx-bootstrap-patch.mjs`, widget `*.component.ts` under `popover`, `dropdown`, `epoch` |
| Rollup libs | `config/rollup.ng-libs.config.mjs` |
| Utils / positioning | `projects/core/src/utils/utils.ts` (`adjustContainerPosition`, `runAfterStable`) |
| Jest | `jest.config.js`, `jest-preset-angular`, `src/setup-jest.js`, `**/projects/**/*.spec.ts` |
| Build (platform gate) | Repo `build.sh` / `build.sh -f`; rollup: `config/rollup.ngxBootstrap.config.mjs`, `config/rollup.ng-libs.config.mjs` |
| Build (CLI app only) | `npm run build` → `build-scripts/build.js`, `post-build.js` |
| Legacy compiler | `Compiler`, `compileModuleAndAllComponentsSync`, `compileModule` — should be **absent**; if found, `must-change` |

---

## High-risk patterns

### 1. Legacy runtime compiler (should be removed)

- `Compiler` injection
- `compileModuleAndAllComponentsSync()`
- Dynamic `NgModule` wrappers for runtime component creation

**Risk:** incompatible with AOT-first / standalone defaults on Angular 20+.

**Current repo:** dynamic path uses standalone `Component({ standalone: true, imports: [...] })` in `dynamic-component-ref-provider.service.ts`. Grep should find **zero** legacy compiler calls.

### 2. Standalone dynamic component creation

- `createComponent(...)` **without** `environmentInjector`
- Standalone component missing `imports` for directives/components used in runtime-transpiled markup

**Risk:** `NG0201`, unknown elements, “directive not initialized” in wizard/tabs/accordion/table row expand.

**Canonical fix (already in repo):**

```typescript
createComponent(ComponentClass, {
  environmentInjector: this.envInjector,
  elementInjector: options.inj
});
```

Also ensure `imports: [CommonModule, FormsModule, ReactiveFormsModule, ...REQUIRED_MODULES_FOR_DYNAMIC_COMPONENTS]`.

### 3. Dynamic view lifecycle

- Missing `ApplicationRef.attachView(componentRef.hostView)` after `createComponent`
- Missing `detachView` on destroy

**Risk:** orphaned views, stale UI, leaks.

### 4. Template parser / transpiler integration

- `Parser.parseBinding()` with outdated location arguments
- Internal `@angular/compiler` APIs with changed signatures
- Synthetic `Element` / AST construction with old shapes

**Risk:** parse failures on generated bindings and expressions.

**Search:** `projects/transpiler/src/`, `projects/core/src/utils/utils.ts`.

### 5. Generated control flow

- Legacy synthetic `ng-container` + `*ngIf` in fragile compilation paths
- Malformed generated `@if` / `@for` blocks (indentation, missing braces)

**Risk:** template parse errors only in preview/runtime-compiled pages.

### 6. ngx-bootstrap patch and widgets

- `build-scripts/ngx-bootstrap-patch.mjs` — patches ESM for modal, dropdown, positioning, `DestroyRef`, subscriptions
- Patched in full build via `config/rollup.ngxBootstrap.config.mjs` (`ngxBootstrapPatchPlugin` from `build-scripts/ngx-bootstrap-patch.mjs`); ESM patch also runs on `npm run build` only

**ngx-bootstrap 21+:** most modules **removed `forRoot()`** — use bare modules in `importProvidersFrom` / `NgModule.imports` and `ToastNoAnimationModule.forRoot()` only where still supported. Grep `projects/` for `.forRoot()` on ngx-bootstrap imports (including `*.spec.ts` if Step 9 runs).

**Angular 21 `@HostListener`:** one **static** event name per decorator (`keydown.enter`, `keydown.arrowup`); do not combine multiple keys in one decorator. Pass `$event` in the method signature (`['$event']` is fine when the event name is static). See checkbox/menu widgets.

**Dropdown positioning helpers:** `adjustContainerPosition` / `adjustContainerRightEdges` in `projects/core/src/utils/utils.ts` must tolerate ngx-bootstrap refs without `ngZone` (use `runAfterStable` fallback when `onStable` is unavailable).

**Risk:** overlay, focus trap, date/time, popover regressions after ngx-bootstrap major bumps.

**After ngx-bootstrap upgrade (required, every step that touches ngx-bootstrap):**

1. Extend `PATCHES` in `build-scripts/ngx-bootstrap-patch.mjs` if upstream fesm shape changed.
2. `sh build.sh -f` — confirm log: `Patched PositioningService: DestroyRef injection` (or already patched).
3. **`verify-ngx-bootstrap-bundle.sh`** (strict by default, runs after `build.sh`) — confirm patches are **inside** `ngx-bootstrap.bundle.js` and `wm-libs.js`. **Do not** mark build/preview done without this.

### 7. Runtime bootstrap & providers

- `provideZoneChangeDetection` vs zoneless experiments
- `importProvidersFrom` for legacy module bridges
- `ApplicationConfig` provider ordering in `app.config.ts`

**Risk:** subtle DI / change-detection regressions.

**Policy:** keep Zone.js / `provideZoneChangeDetection` unless the upgrade **requires** zoneless; treat zoneless as optional modernization.

### 8. Rollup library bundles

- `config/rollup.ng-libs.config.mjs` — peer dependency alignment with `@angular/*`
- Angular 21 fesm renames: `@angular/core/primitives/di` → `primitives-di.mjs`, `signals` → `primitives-signals.mjs`, `event-dispatch` → `primitives-event-dispatch.mjs`
- `tsconfig.json` **`moduleResolution: "bundler"`** — required for ng-packagr to resolve `@angular/common/http` and core primitives

**Risk:** broken `dist` packages consumed by generated apps.

### 8b. NgModule / `ApplicationConfig` static analysis (Angular 21)

- `ModuleWithProviders` from `SomeModule.forRoot()` in `NgModule.imports` → **NG1010** (not statically analyzable)
- **Fix:** bare modules in `imports`; spread `forRoot().providers` into `providers`, or use `importProvidersFrom` in `app.config.ts` without `.forRoot()` on ngx-bootstrap modules

**Where:** `projects/runtime-dynamic/src/app/app.module.ts`, `app.config.ts`, transpiler-generated imports (`projects/transpiler/src/imports.ts` — remove `forRoot: true` on ImportDefs).

### 9. Jest / widget specs

- `jest-preset-angular` major must match Angular major
- `transformIgnorePatterns` must include `lodash-es`, `ngx-bootstrap`, `@angular`, yalc packages
- Wrapper specs: table, form, list, popover, datetime, chips, search, time

**Risk:** CI false negatives or missed breakages.

**Gate:** Step 9 always runs `scripts/test.sh` (`TEST_CMD` in `repo.config.sh`).

**Jest + ngx-bootstrap (this repo):** `src/setup-jest.js` should call `patchNgxBootstrapFiles()` so tests load patched positioning. Specs: use bare ngx-bootstrap modules (no `forRoot()` where upstream removed it).

### 10. Preview-sensitive runtime rendering

- Dynamic partials and runtime-compiled sections
- Table row expand / nested row content
- Modals, popovers, dropdowns, date/time, typeahead, menu

**Risk:** failures visible only in preview, not in static analysis.

### 11. RouterOutlet `attach` / `detach` monkey-patch vs `@if` timing

**Where:** `projects/runtime-base/src/components/app-component/app.component.ts`, `base-layout.component.ts`

**Grep:**

```bash
rg 'overrideRouterOutlet|routerOutlet\.attach|@ViewChild\(RouterOutlet\)' projects/runtime-base
rg 'router-outlet' projects/runtime-base/src/components/app-component/app.component.html
```

**Known preview error:**

```text
TypeError: Cannot read properties of undefined (reading 'attach')
  at AppComponent.overrideRouterOutlet (wm-loader.js:…)
```

**Root cause:** `overrideRouterOutlet()` reads `this.routerOutlet.attach` when `@ViewChild(RouterOutlet)` is still **undefined**. In `app.component.html`, `<router-outlet>` lives inside `@if (startApp)`, while `overrideRouterOutlet()` runs on a fixed `setTimeout(10)` right after `startApp` is set — on newer Angular majors change detection may not have created the outlet yet.

**Step 6 classification:**

| Finding | Label |
|---------|--------|
| `overrideRouterOutlet` without `this.routerOutlet?.attach` guard | `likely-breakage` or `must-change` |
| `<router-outlet>` behind `@if` + `setTimeout` to patch outlet | `needs-review` minimum |
| Monkey-patch of `attach`/`detach` instead of `(attach)` / `(detach)` outputs | `needs-review` (prefer template events on Angular 17+) |

**Fix direction (product code, not skill):** guard before patch; run after outlet exists (`afterNextRender`, poll until `routerOutlet`, or `(attach)` / `(detach)` on `<router-outlet>`).

### 12. ngx-bootstrap `PositioningService` / `__destroyRef` in wm-libs bundle

**Where:** `build-scripts/ngx-bootstrap-patch.mjs` (positioning patch), `config/rollup.ngxBootstrap.config.mjs` (`ngxBootstrapPatchPlugin` on full `sh build.sh -f`).

**Known preview error:**

```text
ReferenceError: __destroyRef is not defined
  at new PositioningService (wm-libs.js:…)
```

**Root cause:** ngx-bootstrap 21+ ships `takeUntilDestroyed(__destroyRef)` in `PositioningService` without declaring `__destroyRef`. The Rollup patch must inject `const __destroyRef = i0.inject(i0.DestroyRef)` in the constructor. If the patch **regex no longer matches** the upstream constructor (ngx-bootstrap minor bump) or **`sh build.sh -f` was skipped** / preview uses stale `wm-libs.js`, the bundle ships broken positioning — dropdown, popover, modal, datetime fail at runtime.

**Step 6 — source checks:**

```bash
# Patch file must still target DestroyRef
rg '__destroyRef|takeUntilDestroyed' build-scripts/ngx-bootstrap-patch.mjs

# Upstream still needs the patch (if this matches but patch log silent → regex drift)
rg 'takeUntilDestroyed\(__destroyRef\)' node_modules/ngx-bootstrap/positioning/fesm2022/
```

Compare `PositioningService` constructor in `node_modules/ngx-bootstrap/positioning/fesm2022/ngx-bootstrap-positioning.mjs` to the regex in `PATCHES.positioning` — if shape changed, extend patch → `must-change`.

**Step 7 — post-build gate (mandatory, strict by default):**

```bash
sh .cursor/skills/angular-upgrade/scripts/verify-ngx-bootstrap-bundle.sh
```

(Also runs automatically at the end of `scripts/build.sh`.)

**Step 6 classification:**

| Finding | Label |
|---------|--------|
| `takeUntilDestroyed(__destroyRef)` in node_modules but patch `wasPatched: false` / no “Patched PositioningService” in build log | `must-change` |
| Preview `wm-libs.js` fails post-build grep above | `must-change` |
| Only `npm run build` run (ESM patch) but preview loads rollup `wm-libs.js` | `likely-breakage` — wrong build path |

**Preview exercises:** open any dropdown, popover, or date/time picker (all use `PositioningService` via `ComponentLoaderFactory`).

---

## Classification guide

| Label | Meaning |
|-------|---------|
| `safe` | Pattern present and verified compatible |
| `needs-review` | May work; inspect after install/build |
| `likely-breakage` | Strong chance of failure; fix before preview |
| `must-change` | Incompatible; **block** upgrade until fixed |

---

## Preview validation checklist (Step 8)

With the user’s **preview URL** loaded (browser MCP or manual):

1. App shell loads without console errors (no `overrideRouterOutlet` / `reading 'attach'` on first paint)
2. Runtime-compiled page or partial renders
3. Table with **row expand** opens nested content
4. Modal open/close and focus return
5. Popover and dropdown positioning (no `__destroyRef is not defined` / `PositioningService` in console)
6. Date/time picker open, select, close
7. No `NG0201` / injector errors in console
8. Menu / typeahead / any overlay widget (confirms ngx-bootstrap bundle patch in `wm-libs.js`)

Record pass/fail and URLs/paths exercised in `current-state.md`.
