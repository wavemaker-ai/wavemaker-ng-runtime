# WaveMaker runtime patterns — ng-runtime §1–§19

Applied to **ng-runtime source** (`projects/`, `tsconfig*.json`, `build-scripts/`) in Step 6. For codegen patterns see [`patterns/codegen.md`](codegen.md). Workflow: [`SKILL.md`](../SKILL.md). References: [`research.md`](../research.md) R12.

> **Pattern currency:** §1–§19 and §12's fix (but not its original version-gate) reflect past Angular upgrade experience (primarily Angular 20/21). §26 is deliberately generic/version-agnostic — see its own note. R1/R3 from official Angular docs take precedence over anything here, and no §N's version-gate should be trusted without independent verification for the current upgrade — see [`checklist.md` → Verification Principle](../checklist.md#verification-principle-pattern-gates-are-hints-not-guarantees).

**Compatibility Policy:** fix removed APIs and compile errors caused by the new Angular version only. Do not add signals, zoneless, `inject()` style changes, or any modernization. "Would this change be needed even if Angular hadn't released a new version?" — if no, skip it.

## Contents

| § | Topic |
|---|-------|
| [§1](#1-legacy-runtime-compiler-should-be-removed) | Legacy compiler — `compileModuleAndAllComponentsSync` removal |
| [§2](#2-standalone-dynamic-component-creation) | Standalone — `createComponent` object syntax |
| [§3](#3-dynamic-view-lifecycle) | View lifecycle — `attachView` / `detachView` |
| [§4](#4-template-parser--transpiler-integration) | Template parser — `HtmlParser`, `Element` arity |
| [§5](#5-generated-control-flow) | Control flow — `@if` / `@for` in generated templates |
| [§6](#6-ngx-bootstrap-patch-and-widgets) | ngx-bootstrap patch — rollup, DestroyRef, dropdown |
| [§7](#7-runtime-bootstrap--providers) | Bootstrap & providers — `APP_INITIALIZER`, Zone.js |
| [§8](#8-rollup-library-bundles) | Rollup bundles — fesm renames, `moduleResolution`, §8b NgModule |
| [§9](#9-jest--widget-specs) | Jest — `jest-preset-angular` version alignment |
| [§10](#10-preview-sensitive-runtime-rendering) | Preview rendering — runtime-only failures; §10a popover+picker, §10b file upload |
| [§11](#11-routeroutlet-attach--detach-monkey-patch-vs-if-timing) | RouterOutlet — outlet timing, §11b/§11c preview-only |
| [§12](#12-ngx-bootstrap-positioningservice--__destroyref-in-wm-libs-bundle) | PositioningService — `__destroyRef` bundle patch |
| [§13](#13-wmdomrendererfactory2--wmdomsharedstyleshostcsp--angular-dom-fork) | WMDomRenderer — CSP fork, upstream sync |
| [§14](#14-template-this-context-references) | Template `this.` — removed from bindings |
| [§15](#15-page-query-params-timing-angular-20) | Page query params — snapshot + subscribe pattern |
| [§16](#16-list--table-embedded-template-context--di) | List/table — `ngTemplateOutletContext`, row DI |
| [§19](#19-wavemaker-expression-parser-astcompiler--parseexpr) | Expression parser — `ParseSourceSpan`, AST renames |
| [§26](#26-inject-based-api-called-across-a-zoneasync-boundary-any-angular-ecosystem-dependency) | **Generic** — `inject()`-based API vs Zone/async boundary, any dependency |

---

## Where to search

| Area | Paths / grep hints |
|------|-------------------|
| Dynamic components | `projects/runtime-base/src/services/dynamic-component-ref-provider.service.ts`, `component-ref-provider.service.ts`, `createComponent`, `environmentInjector`, `attachView` |
| RouterOutlet monkey-patch | `overrideRouterOutlet`, `@ViewChild(RouterOutlet)`, `routerOutlet.attach`, `router-outlet` inside `@if` |
| Runtime bootstrap | `projects/runtime-dynamic/src/app/app.config.ts`, `APP_INITIALIZER`, `HttpCallInterceptor`, `LOCALE_ID` factory, `src/main.ts` |
| Custom DOM renderer | `projects/runtime-base/src/overrides/wm_dom_renderer.ts`, `wm_shared_styles_host.ts`, `WMDomRendererFactory2`, `RendererFactory2`, `ɵSharedStylesHost` |
| Page params timing | `base-page.component.ts`, `base-spa-page.component.ts`, `route.snapshot.queryParams` |
| ngx-bootstrap patch verify | `build-scripts/ngx-bootstrap-patch.mjs`, post-build grep on `wm-libs.js` / `ngx-bootstrap.bundle.js` (see §6 and §12) |
| Transpiler / template AST | `projects/transpiler/src/build.ts` (`createCompilerElement`, `HtmlParser`), `@if`, `@for`, `ng-container` |
| Expression parser | `projects/core/src/utils/expression-parser.ts` (`ASTCompiler`, `$parseExpr`, `$parseEvent`), `watcher.ts`, `registerFnByExpr` |
| ngx-bootstrap | `ngx-bootstrap`, `build-scripts/ngx-bootstrap-patch.mjs`, widget `*.component.ts` under `popover`, `dropdown`, `epoch`, `dialogs` |
| List / table embedded views | `list.component.html`, `table.component.ts`, `createEmbeddedView`, `createCustomInjector`, `ngTemplateOutletContext` |
| Template `this.` refs | `rg 'this\.appLocale|this\._triggeredByUser' projects/components/widgets` |
| Rollup libs | `config/rollup.ng-libs.config.mjs` |
| Generated app / codegen | **`tsconfig.web-app.json`**, `wavemaker-ng-codegen/templates/app.config.ts.hbs` (active), `gen-tsconfig.js`, `projects/transpiler/src/imports.ts` — see §20 |
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

**Current repo:** dynamic path uses standalone `Component({ standalone: true, imports: [...] })` in `dynamic-component-ref-provider.service.ts`. Grep should find **zero** legacy compiler calls. Remove deprecated `wm-view` transpiler registration (`a2062ecf8`).

### 2. Standalone dynamic component creation

- `createComponent(...)` **without** `environmentInjector`
- Positional `createComponent(factory, index, injector)` — removed in Angular 17+; must use object syntax
- Standalone component missing `imports` for directives/components used in runtime-transpiled markup
- `ComponentFactoryResolver` / `resolveComponentFactory` still used for partials, prefabs, custom widgets, dynamic tables

**Risk:** `NG0201`, unknown elements, "directive not initialized" in wizard/tabs/accordion/table row expand.

**Canonical fix (WMS-29275: `d9a05f1be`, `3c1028fe8`, `a2062ecf8`):**

```typescript
// ViewContainerRef paths (partials, prefabs, custom widgets)
this.vcRef.createComponent(ComponentClass, {
  index: 0,
  environmentInjector: this.envInjector,
  injector: this.inj
});

// Root createComponent (dynamic-component-ref-provider)
createComponent(ComponentClass, {
  environmentInjector: this.envInjector,
  elementInjector: options.inj
});
```

Also ensure `imports: [CommonModule, FormsModule, ReactiveFormsModule, ...REQUIRED_MODULES_FOR_DYNAMIC_COMPONENTS]`.

**Where:** `partial-container.directive.ts`, `custom-widget-container.directive.ts`, `prefab.directive.ts`, `form.component.ts`, `table.component.ts`, `page-wrapper.component.ts`, `dynamic-component-ref-provider.service.ts`, `component-ref-provider.service.ts`.

**Step 6 grep:**

```bash
rg 'createComponent\([^,]+,\s*[0-9]' projects/
rg 'ComponentFactoryResolver|resolveComponentFactory' projects/
rg 'compileModuleAndAllComponentsSync|Compiler' projects/runtime-base
```

### 3. Dynamic view lifecycle

- Missing `ApplicationRef.attachView(componentRef.hostView)` after `createComponent`
- Missing `detachView` on destroy

**Risk:** orphaned views, stale UI, leaks.

### 4. Template parser / transpiler integration

**Scope:** markup → Angular template transpilation (`projects/transpiler/`). For **runtime bind/watch expressions**, see §19.

- Internal `@angular/compiler` `Element` / AST construction with wrong arity or `endSourceSpan`
- Duplicated `createElement` helpers in `*.build.ts` with wrong `Element` arity
- `HtmlParser.parse()` shape changes

**Risk:** build-time template parse failures; structural directives (`showindevice`, `accessroles`, `deferload`) not wrapped correctly.

**Angular 20 `Element` constructor (WMS-29275: `46917e48c`):** requires **9 arguments** including `endSourceSpan`. Centralize in `projects/transpiler/src/build.ts` as `createCompilerElement(name)` — use `noSpan` for **all three** span args (not `null` for `endSourceSpan`).

**Search:** `projects/transpiler/src/build.ts`, `projects/components/transpile/src/**/**.build.ts`.

### 5. Generated control flow

- Legacy synthetic `ng-container` + `*ngIf` in fragile compilation paths
- Malformed generated `@if` / `@for` blocks (indentation, missing braces)

**Risk:** template parse errors only in preview/runtime-compiled pages.

### 6. ngx-bootstrap patch and widgets

- `build-scripts/ngx-bootstrap-patch.mjs` — canonical patch (Rollup plugin + ESM pre-build via `build.js`)
- Patched in full build via `config/rollup.ngxBootstrap.config.mjs` (`ngxBootstrapPatchPlugin`); ESM patch also runs on `npm run build`
- Legacy root scripts (`patch-positioning.mjs`, `bootstrap-module-replace.js`) removed in WMS-29275 — do not reintroduce

**Patch targets (WMS-29275: `a6b0848e7`, `bfc670354`, `2fef2d417`, `9fb962af5`):**

| Module | Fix | Symptom if missing |
|--------|-----|-------------------|
| `positioning` | Inject `DestroyRef`; repair `update$$.next` reopen line; BS5 placement fallback (`PlacementForBs5[…] ?? …`); safe `dataPlacement.split` | `__destroyRef is not defined`; picker stuck closed; overlay class crash on `bottom-end` |
| `component-loader` | Track `_onShownSubscription`; call `_unsubscribePositioning()` in `hide()` | Leaked positioning subscriptions; stale overlay after close |
| `dropdown` | **Restore** `"class.show": "isOpen"` on host (BS5) — do **not** strip it | Datetime timepicker menu invisible |
| `modal` | `SHOW: 'show'` → `SHOW: 'in'` where upstream still uses BS4 class | Modal animation / visibility regressions |
| `typeahead` | Remove `:host.dropdown-menu,.dropdown-menu{overflow-y:auto;height:100px}` | Typeahead list clipped / hidden under view encapsulation |

**Patch authoring notes:**

- Rollup replacement strings cannot contain literal `$$` — use `update$$$$` in the patch source so the emitted code is `update$$.next(…)`.
- Re-run strict bundle verify after **any** ngx-bootstrap minor bump; regex drift is common.

**Interaction with §12 (bundle verify):** after extending or modifying `PATCHES` in `ngx-bootstrap-patch.mjs`, verify that the `__destroyRef` injection described in §12 is still intact — regex replacement order in the patch file matters. Run `verify-ngx-bootstrap-bundle.sh` after any patch change, not only after a full `build.sh -f`.

**ngx-bootstrap 20 modal events (WMS-29275: `bfb1f5bb4`):** v20 removed global `BsModalService.onShown` / `onHidden` in some builds — `BaseDialog` must invoke open/close callbacks manually on the modal ref. **Re-verify on ngx-bootstrap 21+** — upstream may restore global emitters; grep `base-dialog.ts` for `onShown.subscribe` vs manual `setTimeout` callbacks.

**ngx-bootstrap 21+:** most modules **removed `forRoot()`** — use bare modules in `importProvidersFrom` / `NgModule.imports` and `ToastNoAnimationModule.forRoot()` only where still supported. Grep `projects/` for `.forRoot()` on ngx-bootstrap imports (including `*.spec.ts` if Step 8 runs).

**Angular 21 `@HostListener`:** one **static** event name per decorator (`keydown.enter`, `keydown.arrowup`); do not combine multiple keys in one decorator. Pass `$event` in the method signature (`['$event']` is fine when the event name is static). See checkbox/menu widgets.

**Dropdown positioning helpers:** `adjustContainerPosition` / `adjustContainerRightEdges` in `projects/core/src/utils/utils.ts` must tolerate ngx-bootstrap refs without `ngZone` (use `runAfterStable` fallback when `onStable` is unavailable).

**Risk:** overlay, focus trap, date/time, popover, typeahead, modal regressions after ngx-bootstrap major bumps.

**After ngx-bootstrap upgrade (required, every step that touches ngx-bootstrap):**

1. Extend `PATCHES` in `build-scripts/ngx-bootstrap-patch.mjs` if upstream fesm shape changed.
2. `sh build.sh -f` — confirm log lines for DestroyRef, reopen, dropdown show, placement fallback (or "already patched").
3. **`verify-ngx-bootstrap-bundle.sh`** (strict by default, runs after `build.sh`) — confirm patches are **inside** `ngx-bootstrap.bundle.js` and `wm-libs.js`. **Do not** mark build/preview done without this.

### 7. Runtime bootstrap & providers

- `provideZoneChangeDetection` vs zoneless experiments
- `importProvidersFrom` for legacy module bridges
- `ApplicationConfig` provider ordering in `app.config.ts`
- Missing `APP_INITIALIZER` / dynamic `LOCALE_ID` after bootstrap refactor
- `HttpCallInterceptor` not registered with `withInterceptorsFromDi()`

**Risk:** subtle DI / change-detection regressions; locale or variables uninitialized on first paint; HTTP calls bypass WM interceptors.

**Zone.js — hard rule:** Keep `provideZoneChangeDetection()` and Zone.js unconditionally. Do **not** switch to zoneless change detection regardless of what the Angular update guide recommends. Zoneless is opt-in modernization; this upgrade is compatibility-only.

**Interaction with §11 (RouterOutlet timing):** The `APP_INITIALIZER` factory controls when `startApp` is set to `true`, which gates `@if (startApp)` wrapping `<router-outlet>`. If the §7 initializer resolves async work out of order, `overrideRouterOutlet()` (§11) can fire before the outlet exists even with the `@ViewChild` setter fix. If §11 symptoms remain after correctly fixing §11, re-check that `InitializeApp` in §7 fully awaits locale and variable resolution before returning.

**WMS-29275 bootstrap fixes (`197e3cec6`, `b39be62c4`, `5442cebf0`):**

```typescript
// app.config.ts — required ordering
{ provide: HTTP_INTERCEPTORS, useClass: HttpCallInterceptor, multi: true },
provideHttpClient(withInterceptorsFromDi(), …),
{
  provide: APP_INITIALIZER,
  useFactory: InitializeApp,
  deps: [AbstractI18nService, AppJSResolve, AppBeforeLoadResolve, AppVariablesResolve, AppExtensionJSResolve, PipeService],
  multi: true
},
{ provide: LOCALE_ID, useFactory: setAngularLocale, deps: [AbstractI18nService] }
```

- Do **not** duplicate-register `HttpServiceImpl` when `AbstractHttpService` is already provided.
- `InitializeApp` must await `AppJSResolve`, `AppVariablesResolve`, `AppExtensionJSResolve`, locale load, then `AppBeforeLoadResolve`.

### 8. Rollup library bundles

- `config/rollup.ng-libs.config.mjs` — peer dependency alignment with `@angular/*`
- Angular 21 fesm renames: `@angular/core/primitives/di` → `primitives-di.mjs`, `signals` → `primitives-signals.mjs`, `event-dispatch` → `primitives-event-dispatch.mjs`
- `tsconfig.json` **`moduleResolution: "bundler"`** — required for ng-packagr to resolve `@angular/common/http` and core primitives
- **`tsconfig.web-app.json` must stay aligned with `tsconfig.json`** on every major bump — codegen renames it to the generated app's `tsconfig.json` (§20a)

**Risk:** broken `dist` packages consumed by generated apps; TS2307 / NG1010 on `ng build` after codegen.

#### 8b. NgModule / `ApplicationConfig` static analysis (Angular 21)

**This is a breaking change in ngx-bootstrap, not a refactor choice.** ngx-bootstrap 21 removed `.forRoot()` from `ModalModule`, `BsDatepickerModule`, and `NgCircleProgressModule`. Angular 21's static analysis then raises **NG1010** on any `ModuleWithProviders` value in `imports`. The fix is forced by the library — use bare modules.

- `ModuleWithProviders` from `SomeModule.forRoot()` in `NgModule.imports` → **NG1010** (not statically analyzable)
- **Fix:** bare modules in `imports`; spread `forRoot().providers` into `providers`, or use `importProvidersFrom` in `app.config.ts` without `.forRoot()` on the affected ngx-bootstrap modules

**Where:** `projects/runtime-dynamic/src/app/app.config.ts` (flat `providers`; primary bootstrap), transpiler-generated imports (`projects/transpiler/src/imports.ts` — bare ngx-bootstrap `ImportDef`s, no `forRoot: true`), **`wavemaker-ng-codegen/templates/app.config.ts.hbs`** (§20b — edit source templates only, not `dist/`). Legacy `app.module.ts` / `WM_MODULES_FOR_ROOT` in runtime preview are not used by codegen output.

#### 8c. Locale bundle before angular-app CLI bundle

**When:** `bundle-angular-app-cli.sh` copies `dist/bundles/wmapp/locales`.

**Symptom:** bundle step fails — locales directory missing.

**Fix:** Run `sh build.sh --locale` before `bundle-angular-app-cli.sh` (local-angular-build Step 2).

#### 8d. Bundle size baseline

After each successful Step 7 build, record output sizes in `current-state.md` → **Bundle Sizes** and in `docs/{major}-upgrade.md`. If a subsequent Step 7 build produces artifacts more than 15% larger than the previous baseline, investigate before deploying.

```bash
# Run after Step 7 to record baseline:
ls -lh dist/tmp/libs/ngx-bootstrap/ngx-bootstrap.bundle.js \
        dist/bundles/wmapp/scripts/wm-libs.js \
        dist/bundles/wmapp/scripts/angular-app-cli.js 2>/dev/null
```

**Accepting a new baseline:** if an increase is legitimate (e.g., Angular ships new polyfills, a new library is intentionally added), update the sizes in `current-state.md` → **Bundle Sizes**, record the reason and old/new sizes in `docs/{major}-upgrade.md` → **Bundle Size Change**, then treat the new sizes as the anchor for the 15% check going forward.

### 9. Jest / widget specs

- `jest-preset-angular` major must match Angular major
- `transformIgnorePatterns` must include `lodash-es`, `ngx-bootstrap`, `@angular`, yalc packages
- Wrapper specs: table, form, list, popover, datetime, chips, search, time

**Risk:** CI false negatives or missed breakages.

**Gate:** Step 8 always runs `scripts/test.sh` (`TEST_CMD` in `repo.config.sh`).

**Jest + ngx-bootstrap (this repo):** `src/setup-jest.js` should call `patchNgxBootstrapFiles()` so tests load patched positioning. Specs: use bare ngx-bootstrap modules (no `forRoot()` where upstream removed it).

**WMS-29275 spec fixes (`d30689ff8`):**

- Inject `EnvironmentInjector` mock in `partial-container.spec.ts` (constructor signature changed).
- Mock `showPopover` in popover wrapper specs when testing `open()` / keyboard handlers — real popover positioning fails under Jest.
- ESM patch path: `build-scripts/ngx-bootstrap-patch.mjs` (invoked from `build-scripts/build.js`).

### 10. Preview-sensitive runtime rendering

- Dynamic partials and runtime-compiled sections
- Table row expand / nested row content / inline edit / filter row / row actions
- List item templates with nested menus (`ngTemplateOutlet` + custom injector)
- Modals, popovers, dropdowns, date/time, typeahead, menu
- Page query params driving variables on first load
- File upload success UI bound to datasource vs direct upload response
- Table bound to modal/script variable without datasource (empty grid / stuck loading)

**Risk:** failures visible only in preview, not in static analysis.

#### 10a. Popover vs date/time picker outside-click (WMS-29275: `80faec7f4`)

**Symptom:** popover closes when interacting with datetime picker opened inside it; or picker clicks bubble to document handler.

**Fixes:**

- Set `[outsideClick]="false"` on popover anchor when picker is nested (`popover.component.html`).
- In document click handler, treat ngx-bootstrap picker hosts as "inside": `bs-datepicker-container`, `bs-daterangepicker-container`, `bs-timepicker` (element **and** class selectors).

**Preview:** popover containing date or time widget — open picker, select value, popover stays open.

#### 10b. File upload template bindings (WMS-29275: `4daf7d759`, `80faec7f4`)

**Symptom:** success icon / delete action never shown after upload when response shape differs from datasource-bound path.

**Fix:** success UI should accept `ft.status === 'success' || ft._response?.success`; remove `this.` from `appLocale` message bindings in `file-upload.component.html`.

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

**Fix direction:** `@ViewChild(RouterOutlet)` **setter** patches when outlet appears (WMS-28429). `base-layout` uses `setTimeout(10)` in `ngAfterViewInit`. Do **not** add `scheduleOverrideRouterOutlet` polling unless preview shows `attach` undefined errors.

**Interaction with §7 (bootstrap providers):** if `@ViewChild(RouterOutlet)` setter still fires before the outlet is created after the §11 fix, check §7 — incorrect `APP_INITIALIZER` async ordering can affect when `startApp` becomes `true`, racing with `setTimeout(10)`. Fix §7 provider ordering first, then re-test §11 symptoms.

#### 11b. `@if`-gated app shell + `setTimeout` bootstrap — needs-review (preview only)

> **Compatibility policy:** do NOT apply pre-emptively. This is not a required upgrade fix — only apply if Step 9 preview reproduces the symptom below.

**Where:** `app.component.ts` — `startApp` toggles `@if` wrapping `<router-outlet>`.

**Symptom (if it occurs):** `startApp === true` but no `<router-outlet>` in DOM until manual change detection.

**Optional fix (only if Step 9 reproduces):** `cdr.detectChanges()` after `startApp = true`.

**Do not enforce by default** — reverted as unnecessary in WMS-31488 (`dae9a74fc`). `@ViewChild` setter handles outlet patching.

#### 11c. Global spinner `@Input` staleness — needs-review (preview only)

> **Compatibility policy:** do NOT apply pre-emptively. This is not a required upgrade fix — only apply if Step 9 preview reproduces the symptom below.

**Where:** `app.component.ts` spinner subscription; `app.component.html` `<app-spinner [show]="spinner.show">`.

**Symptom (if it occurs):** Stuck global spinner overlay despite `spinner.show === false`.

**Optional fix (only if Step 9 reproduces):** `@if (spinner.show)` wrapper or `cdr.detectChanges()` after subscription update.

**Do not enforce by default** — reverted as unnecessary in WMS-31488 (`dae9a74fc`). Keep `[show]="spinner.show"` binding.

### 12. ngx-bootstrap `PositioningService` / `__destroyRef` in wm-libs bundle

**Where:** `build-scripts/ngx-bootstrap-patch.mjs` (positioning patch), `config/rollup.ngxBootstrap.config.mjs` (`ngxBootstrapPatchPlugin` on full `sh build.sh -f`).

**Known preview errors (two distinct symptoms across ngx-bootstrap versions — same root defect class, different upstream implementation):**

```text
ReferenceError: __destroyRef is not defined
  at new PositioningService (wm-libs.js:…)
```

```text
RuntimeError: NG0203 (inject() must be called from an injection context)
  at ... Object.takeUntilDestroyed ... at new PositioningService (wm-libs.js:…)
```

**Confirmed at ngx-bootstrap 20.0.2 (WMS-29275, 18→20 upgrade, 2026-07):** upstream's actual source is `this.triggerEvent$.pipe(takeUntilDestroyed()).subscribe(...)` called **inside** `ngZone.runOutsideAngular(() => {...})`. This is syntactically valid (no `ReferenceError`) — `takeUntilDestroyed()` with no arg relies on an implicit `inject(DestroyRef)`, and Angular's injection-context tracking does not survive the Zone.js task boundary created by `runOutsideAngular`, so it throws **NG0203** instead. Do not assume this bug is 21+-only just because `takeUntilDestroyed()` is called syntactically "in the constructor" — check whether it's nested inside `runOutsideAngular` (or any other Zone/task-scheduling wrapper) before concluding the patch isn't needed.

**Root cause (general):** across the versions checked, ngx-bootstrap's `PositioningService` calls `takeUntilDestroyed()` (bare, or referencing an undeclared `__destroyRef`) in a context where implicit DI resolution is unreliable. The Rollup patch must inject `const __destroyRef = i0.inject(i0.DestroyRef)` **before** the `runOutsideAngular` call (still in a valid injection context) and pass it explicitly: `takeUntilDestroyed(__destroyRef)`. If the patch **regex no longer matches** the upstream constructor (ngx-bootstrap minor bump) or **`sh build.sh -f` was skipped** / preview uses stale `wm-libs.js`, the bundle ships broken positioning — dropdown, popover, modal, datetime fail at runtime.

**Step 6 — source checks:**

```bash
# Patch file must still target DestroyRef
rg '__destroyRef|takeUntilDestroyed' build-scripts/ngx-bootstrap-patch.mjs

# Upstream still needs the patch (if this matches but patch log silent → regex drift)
find node_modules/ngx-bootstrap/positioning -name '*.mjs' | xargs rg 'takeUntilDestroyed\(__destroyRef\)'
```

Compare `PositioningService` constructor in `node_modules/ngx-bootstrap/positioning/fesm2022/ngx-bootstrap-positioning.mjs` to the regex in `PATCHES.positioning` — if shape changed, extend patch → `must-change`.

**Step 7 — post-build gate (when bundle verify enabled):**

```bash
UPGRADE_BUILD_CMD='<BUILD_CMD from repo.config>' UPGRADE_BUNDLE_VERIFY=yes \
sh .claude/skills/angular-upgrade/scripts/build.sh
# or verify alone after build:
sh .claude/skills/angular-upgrade/scripts/verify-ngx-bootstrap-bundle.sh
```

**Step 6 classification:**

| Finding | Label |
|---------|--------|
| `takeUntilDestroyed(__destroyRef)` in node_modules but patch `wasPatched: false` / no "Patched PositioningService" in build log | `must-change` |
| Preview `wm-libs.js` fails post-build grep above | `must-change` |
| Only `npm run build` run (ESM patch) but preview loads rollup `wm-libs.js` | `likely-breakage` — wrong build path |

**Preview exercises:** open any dropdown, popover, or date/time picker (all use `PositioningService` via `ComponentLoaderFactory`).

### 13. `WMDomRendererFactory2` / `WMDomSharedStylesHost` (CSP + Angular DOM fork)

**Where:**

- `projects/runtime-base/src/overrides/wm_dom_renderer.ts` — vendored fork of `@angular/platform-browser` `DomRendererFactory2`
- `projects/runtime-base/src/overrides/wm_shared_styles_host.ts` — CSP nonce on dynamically injected `<style>` tags
- Providers: `runtime-base.module.ts` (`ɵDomRendererFactory2` + `ɵSharedStylesHost`), `app.config.ts` (`RendererFactory2`)

**Origins:** CSP nonce `WMS-22503`; Angular 16 DOM API `WMS-25166`; Angular 18 `removeChild` `WMS-27103`; animation `@` props `WMS-29275` (`26ff7c6ee`, `bd406e2a7`).

#### 13a. CSP pair — NgModule only; do NOT add to `app.config.ts`

`WMDomRendererFactory2` alone is not enough for CSP-compliant dynamic styles. **`WMDomSharedStylesHost`** adds `nonce` from `<meta name="CSP-NONCE">` (fallback `wm-csp-nonce`) when emulated/shadow styles are injected.

```typescript
// runtime-base.module.ts — ONLY place to register ɵSharedStylesHost
{ provide: ɵSharedStylesHost, useClass: WMDomSharedStylesHost },
{ provide: ɵDomRendererFactory2, useClass: WMDomRendererFactory2 },

// app.config.ts (standalone bootstrap) — RendererFactory2 only; NOT ɵSharedStylesHost
{ provide: RendererFactory2, useClass: WMDomRendererFactory2 },
```

**Do NOT add `ɵSharedStylesHost` to `app.config.ts`.** WaveMaker loads `RuntimeBaseModule` in lazy routes — this creates a child injector that also provides `ɵSharedStylesHost`. If the root injector (`app.config.ts`) also provides it, Angular creates two `WMDomSharedStylesHost` instances. The child instance's `ngOnDestroy()` removes all its tracked style nodes on navigation, stripping left-nav and widget styles from the DOM. Confirmed regression: WMS-31488 (2026-06-26).

The NgModule registration in `runtime-base.module.ts` covers all routes that import it. CSP nonce will not apply to styles injected through the standalone bootstrap path only — this is an accepted known gap until the NgModule boundary is removed.

**Step 6 classification:** `ɵSharedStylesHost` absent from `app.config.ts` is expected and correct → `safe`. `pattern-review.sh` §13a WARN for missing `app.config.ts` registration is a known false alarm — dismiss it.

#### 13b. Provider token drift (`RendererFactory2` vs `ɵDomRendererFactory2`)

Angular exposes two tokens for the same factory depending on bootstrap path:

| Bootstrap | Token | Must use |
|-----------|-------|----------|
| `NgModule` (`RuntimeBaseModule`) | `ɵDomRendererFactory2` | `WMDomRendererFactory2` |
| `ApplicationConfig` (`app.config.ts`) | `RendererFactory2` | `WMDomRendererFactory2` |

Grep both tokens after upgrade — registering only one path leaves the other bootstrap route on the default renderer.

#### 13c. Upstream sync on every major bump

`wm_dom_renderer.ts` is a **manual fork** of Angular's platform-browser DOM renderer. On each `@angular/*` major:

1. Diff `node_modules/@angular/platform-browser/.../dom_renderer.mjs` (or equivalent) against `wm_dom_renderer.ts`.
2. Port structural API changes (constructor args, `listen`, `removeChild`, new `Renderer2` methods).
3. Re-apply WaveMaker deltas: `@` animation ignore, null `el` guard, inline `style` attribute path (§13e), CSP nonce stays in `wm_shared_styles_host.ts`.

**Step 6 classification:** upstream `DomRendererFactory2` signature changed but fork untouched → `must-change`.

**After syncing, re-verify §13a:** porting upstream API changes can rename or add constructor parameters in `WMDomRendererFactory2`. If the class name or constructor signature changed, ensure the provider registrations in `runtime-base.module.ts` (`ɵDomRendererFactory2` + `ɵSharedStylesHost` tokens) and `app.config.ts` (`RendererFactory2` token only — see §13a for why `ɵSharedStylesHost` must NOT be in `app.config.ts`) still point to the updated class.

#### 13d. Angular 16+ `listen()` / `DOCUMENT` (WMS-25166)

Do **not** revert to `eventManager.addGlobalEventListener`. Global targets must resolve via injected `DOCUMENT`:

```typescript
if (typeof target === 'string') {
  target = getDOM().getGlobalEventTarget(this.doc, target);
  if (!target) throw new Error(`Unsupported event target ${target} for event ${event}`);
}
return this.eventManager.addEventListener(target, event, decoratePreventDefault(callback));
```

Also watch for private API renames: `ɵDomSharedStylesHost` → `ɵSharedStylesHost` (already in fork).

#### 13e. Angular 18+ `removeChild` (WMS-27103)

Use native `Element.remove()` — Angular 18+ upstream no longer calls `parent.removeChild`:

```typescript
removeChild(_parent: any, oldChild: any): void {
  oldChild.remove();
}
// ShadowDomRenderer: super.removeChild(null, oldChild)
```

**Symptom if reverted:** detached nodes linger; memory leaks; DOM cleanup errors in table/list re-render.

#### 13f. Inline `style` attribute path (CSP)

When `setAttribute(el, 'style', value)` is called, the fork **does not** set the attribute directly — it resets and applies via `el.style[property]`:

```typescript
if (name === 'style') {
  this.resetStyles(el);
  this.applyStyles(el, value);
}
```

Required for table checkbox alignment and any widget relying on inline style bindings under CSP. Do not replace with `el.setAttribute('style', value)`.

#### 13g. Animation `@` properties / events (WMS-29275)

**Root cause:** `WMDomRendererFactory2` replaces the animation renderer factory, so animation properties/events (`@foo`, `@foo.start`) reach the custom DOM renderer. ngx-bootstrap and modals then hit `checkNoSyntheticProp` or null-element crashes.

**Fix (current repo):**

- In `setProperty` / `listen`, **silently ignore** names/events whose first char is `@` (`AT_CHARCODE`).
- Add null guard on `el` in `setProperty`.
- Keep `provideAnimations()` in `app.config.ts` — animations still run via the animation engine; the DOM renderer must not handle `@` bindings.

**Known errors if missing:**

```text
Error: Unexpected synthetic property @… found
TypeError: Cannot set properties of null (setting '…')
```

**Step 6 classification:** missing `@` handling → `likely-breakage`; missing `provideAnimations()` → `must-change`.

#### 13h. `destroyNode` (needs-review each major)

Fork sets `destroyNode = null`. Newer Angular versions may require a real `destroyNode` implementation for comment-node cleanup / hydration paths. Compare upstream `DomRendererFactory2` on each bump — implement if upstream adds non-null default.

**Step 6 grep:**

```bash
rg 'WMDomRendererFactory2|WMDomSharedStylesHost|ɵDomRendererFactory2|ɵSharedStylesHost' projects/runtime-base projects/runtime-dynamic
rg 'addGlobalEventListener|removeChild\(parent' projects/runtime-base/src/overrides/wm_dom_renderer.ts
rg 'AT_CHARCODE|charCodeAt\(0\) === AT' projects/runtime-base/src/overrides/wm_dom_renderer.ts
```

**Cross-section dependency:** §13 and §15 interact — `bd406e2a7` introduced an animation-event fix that broke page-param-driven variables on first load; `56f3b9ce6` reverted it. If §13 animation handling is re-attempted, re-validate §15 in preview before marking done.

### 14. Template `this.` context references

**WMS-29275:** `d9a05f1be`

Angular 20+ template type-checking rejects or mishandles explicit `this.` in bindings:

```html
<!-- Bad -->
[title]="this.appLocale?.LABEL_COLLAPSE"
(keydown)="this._triggeredByUser = true; onDisplayKeydown($event)"

<!-- Good -->
[title]="appLocale?.LABEL_COLLAPSE"
(keydown)="_triggeredByUser = true; onDisplayKeydown($event)"
```

**Search:**

```bash
rg 'this\.(appLocale|_\w+)' projects/components/widgets --glob '*.html'
```

**Step 6 classification:** any match in widget templates → `must-change` before preview.

### 15. Page query params timing (Angular 20)

**Where:** `base-page.component.ts`, `base-spa-page.component.ts` — `registerPageParams()`

**WMS-29275:** `bd406e2a7`

**Symptom:** variables bound to page params fire in `ngAfterViewInit` with `pageParams` / `App.pageParams` undefined; works on second navigation.

**Root cause:** `route.queryParams` observable may emit **after** first variable init on Angular 20.

**Fix:** seed synchronously from snapshot, then subscribe:

```typescript
this.pageParams = (this.App as any).pageParams = extend({}, this.route.snapshot.queryParams);
const subscription = this.route.queryParams.subscribe(params =>
  this.pageParams = (this.App as any).pageParams = extend({}, params));
```

**Step 6 classification:** subscription-only `registerPageParams` → `likely-breakage`.

**Note:** `bd406e2a7` was later reverted by `WMS-25708` (`56f3b9ce6`) — re-validate in preview if page-param-driven variables fail on first load.

**Cross-section dependency:** §15 and §7 were fixed together in `5442cebf0` (bootstrap providers + page query params). If §7 `APP_INITIALIZER` ordering changes, re-validate §15 query param timing in the same preview pass.

### 16. List / table embedded template context & DI

**WMS-29275:** `0c69b8010`, `80faec7f4`, `1aad018d4`, `5442cebf0`

**List menus not rendering:** `ngTemplateOutletContext` and `createCustomInjector` must expose **`row: item`** (not only `item`) so menu widgets inside list templates resolve row scope.

**Table row templates:** row expand / actions contexts should alias row data for legacy templates:

```typescript
{ row, item: row, $implicit: row, rowDef, … }
```

**`createEmbeddedView` + `createCustomInjector`:** required when embedded templates host widgets needing `EXPLICIT_CONTEXT` / row-scoped DI (filter row, row actions). **Do not** blanket-apply to inline-edit / custom-expression cells — WMS-29275 `1aad018d4` reverted that after table validation regressions. Use per-template, with unique `contextKey` when caching injectors.

**Table dataset without datasource:** when `binddatasource` is set but `datasource` is null and dataset arrives (model/script/modal variable), render from dataset or clear loading — avoid infinite "loading" or empty grid (`5442cebf0`, `80faec7f4`).

**Step 6 grep:**

```bash
rg 'ngTemplateOutletContext.*item:' projects/components/widgets/data/list
rg 'createEmbeddedView\(' projects/components/widgets/data/table/src/table.component.ts
```

**Cross-section dependency:** §15 and §16 were fixed together in `80faec7f4` (query param timing + list/table injectors). If either regresses in preview, check the other in the same pass.

### 19. WaveMaker expression parser (`ASTCompiler` / `$parseExpr`)

**Where:** `projects/core/src/utils/expression-parser.ts` — custom compiler over `@angular/compiler` `Parser` + `Lexer`

**Consumers:** `watcher.ts` (watch expressions), `base-page.component.ts` / `base-partial.component.ts` / `base-layout.component.ts` (`registerFnByExpr` from build), widget bind/event handlers via `$parseExpr` / `$parseEvent`

**Not the same as §4:** §4 is template markup transpilation; this section is **runtime JS expression** evaluation for `bind:`, watches, and `on-*` events.

#### 19a. `Parser` API signatures (changes every major)

Angular's internal `Parser` **location/sourceSpan** args are mandatory from Angular 20 (WMS-29275: `b4ecc7218`):

```typescript
const createParseSourceSpan = (content: string): ParseSourceSpan => {
  const sourceFile = new ParseSourceFile(content, '');
  const start = new ParseLocation(sourceFile, 0, 0, 0);
  const end = new ParseLocation(sourceFile, content.length, 0, content.length);
  return new ParseSourceSpan(start, end);
};

parser.parseBinding(expr, createParseSourceSpan(expr), 0);
parser.parseAction(expr, createParseSourceSpan(expr), 0);
```

**Do not revert to** `parseBinding(expr, '', 0)` or `parseAction(expr, false, '', 0)` (Angular 17 dropped the middle `false` — WMS-26038).

**Interaction with §4 (template parser):** both `@angular/compiler` `Parser` (this section) and `HtmlParser` / `Element` constructors (§4) are internal APIs that change every major. If §19a signatures changed, check §4 too — the same Angular compiler bump often affects both. A grep showing `parseBinding(expr, '', 0)` frequently correlates with a stale `Element` constructor arity in `*.build.ts`.

**Step 6 classification:** string placeholder instead of `ParseSourceSpan` → `must-change`.

#### 19b. `ASTCompiler` — AST node renames / removals (track across majors)

`ASTCompiler.build()` must handle current `@angular/compiler` AST classes. Historical renames:

| Angular bump | Change | Commit ref |
|--------------|--------|------------|
| 12 | `KeyedRead.obj` → `KeyedRead.receiver` | WMS-22541 |
| 14 | `MethodCall` → `Call` | WMS-23342 |
| 14+ | Add `Unary` handler | WMS-25048 |
| 20 | `PropertyWrite` removed — assignment AST path commented out | WMS-29275 |
| 20+ | **`ParenthesizedExpression`** is a distinct node — must unwrap | WMS-31316 |

**WMS-31316 symptom:** watch/bind expressions like `(a && b)` or `(row.field \| pipe)` compile to **noop** — widgets never update, no console error.

**Fix:** import `ParenthesizedExpression` and add:

```typescript
} else if (ast instanceof ParenthesizedExpression) {
  return this.build(ast.expression, stmts);
}
```

**Step 6:** after `@angular/compiler` bump, grep upstream AST exports and diff against `ASTCompiler.build()` instanceof chain — any new wrapper node → `likely-breakage` until handled.

#### 19c. Precompiled vs runtime fallback paths

Two evaluation paths (order matters):

1. **Build-time (preferred):** page/partial build emits fn defs; runtime calls `registerFnByExpr(expr, fn, usedPipes)` in `base-page.component.ts` et al.
2. **Runtime fallback:** `$parseExpr` / `$parseEvent` parse + `ASTCompiler.compile()` when precompiled fn missing.

**`setPipeProvider`:** if `pipeProvider` is unset, `$parseExpr` returns **`noop`** — all dynamic bindings silently fail. Ensure `PipeService` initializes pipe provider during app bootstrap (ties to §7 `APP_INITIALIZER` deps).

**CSP path:** when `new Function()` is blocked, bindings fall back to `lodash.get(ctx, expr)` (limited); events use `simpleFunctionEvaluator` (simple `fn(arg)` only). Strict CSP preview may break complex expressions even when dev works.

#### 19d. Pipes in expressions

- `BindingPipe` nodes compiled via `processPipe()`; pure pipes cached with `getPurePipeVal`.
- Precompiled fns carry `usedPipes` — `registerFnByExpr(expr, fn, usedPipes)` must preserve pipe list or pipe transforms fail at runtime.
- **Preview:** bindings using `| date`, `| number`, `| filter`, custom pipes.

#### 19e. Method call context binding

`processMethodCall()` binds implicit-receiver calls with `.bind(_ctx)`; property-receiver calls bind to computed context. Regressions here break `Widgets.foo()` / `Variables.bar.invoke()` in expressions (WMS-23342 fix). Re-test after compiler bump.

**Step 6 grep:**

```bash
rg 'parseBinding|parseAction|ParenthesizedExpression|PropertyWrite|MethodCall|KeyedRead' projects/core/src/utils/expression-parser.ts
rg 'registerFnByExpr|setPipeProvider|\$parseExpr' projects/runtime-base projects/core
```

**Step 6 classification:**

| Finding | Label |
|---------|--------|
| `parseBinding(expr, '',` or missing `createParseSourceSpan` | `must-change` |
| New compiler AST class not in `ASTCompiler.build()` | `likely-breakage` |
| `ParenthesizedExpression` import/handler missing | `likely-breakage` (watch/bind with parentheses) |
| `setPipeProvider` not called before first `$parseExpr` | `likely-breakage` |

**Preview:** page with **watch** on parenthesized expression; bind with **pipe**; **on-click** action calling page method with args.

### 26. `inject()`-based API called across a Zone/async boundary (any Angular-ecosystem dependency)

**This section is intentionally generic — not tied to any specific dependency.** Unlike §1–§19/§12, which document a fix already found in a specific library, this section documents a *category* of bug so it can be recognized in a dependency nobody has patched before. When you find a concrete instance in a new dependency, add its own dedicated §N entry (with dependency name, version, exact call chain, and commit ref) — a future upgrade benefits far more from a named precedent than from re-deriving this general pattern from scratch. §12 (ngx-bootstrap `PositioningService`) is the first confirmed instance; treat it as a worked example of applying this section, not the only place it can occur.

**Applies to:** any third-party Angular library — ngx-bootstrap, ngx-toastr, ng-circle-progress, ngx-color-picker, or a dependency added after this was written — that calls Angular's functional/`inject()`-based APIs: `inject()` itself, `takeUntilDestroyed()`, or any other API documented as "must be called within an injection context."

**The hazard:** Angular's injection-context tracking is tied to the synchronous call stack of component/service construction (or an explicit `runInInjectionContext()` call). It does **not** survive:

- `NgZone.runOutsideAngular(() => {...})` / `NgZone.run(() => {...})`
- `setTimeout(...)` / `setInterval(...)` / `requestAnimationFrame(...)`
- `Promise.then(...)` / `async`/`await` continuations
- An RxJS `subscribe()` callback (the callback body executes later, asynchronously, regardless of where `.subscribe()` was textually written)

A call to an `inject()`-based API **inside** any of the above throws `NG0203` at runtime — even when the enclosing function is textually defined inside a constructor. **This is invisible to `tsc`, ng-packagr, and a fully green `build.sh -f`** — it only manifests when the code path actually executes in a browser, which is exactly why it survives a full build+audit cycle when Step 9 preview is skipped.

**Do not conclude "this call site is fine" just because it reads `constructor() { ... someInjectFn() ... }`.** Trace whether that specific line sits inside any of the four boundary types above before accepting it. This is the check that was skipped for §12 during the Angular 18→20 upgrade (WMS-29275) — `takeUntilDestroyed()` was confirmed present "in the constructor," which was treated as sufficient, without noticing it was nested inside `ngZone.runOutsideAngular(...)`.

```typescript
// WRONG — throws NG0203 at runtime; compiles and builds cleanly
constructor(zone: NgZone) {
  zone.runOutsideAngular(() => {
    this.sub = this.source$.pipe(takeUntilDestroyed()).subscribe(...);
  });
}

// RIGHT — capture the injected value while still in a valid (synchronous) injection context,
// then reference the captured local inside the callback instead of calling inject() there.
constructor(zone: NgZone) {
  const destroyRef = inject(DestroyRef);   // valid here — still synchronous constructor scope
  zone.runOutsideAngular(() => {
    this.sub = this.source$.pipe(takeUntilDestroyed(destroyRef)).subscribe(...);
  });
}
```

**Where to look:** any dependency whose version you bumped by more than a patch/minor — check its main entry-point source (`node_modules/<dep>/**/fesm2022/*.mjs`) for `inject(` or `takeUntilDestroyed(` (or grep for `from '@angular/core/rxjs-interop'`, the module that hosts `takeUntilDestroyed`).

**Step 6 grep (generic — run against every dependency Step 3 bumped, not just ngx-bootstrap):**

```bash
# Find inject()-based calls, then check if any are inside a Zone/async boundary
for f in node_modules/<dep>/**/fesm2022/*.mjs; do
  rg -l 'inject\(|takeUntilDestroyed\(' "$f" 2>/dev/null
done
# For each match, read the surrounding function and check for:
rg -B8 'inject\(|takeUntilDestroyed\(\)' <matched-file> | rg -B6 'runOutsideAngular|\.run\(|setTimeout|setInterval|requestAnimationFrame|\.then\(|subscribe\('
```

**If a patch is needed:** write a build-time source patch (a rollup `transform` hook, applied to that dependency's bundle entry — see `build-scripts/ngx-bootstrap-patch.mjs` for the pattern) rather than editing `node_modules` directly, so the fix survives `npm install`. Verify the patch actually applied by grepping the *built* bundle output, not just the patch script's own logic.

**Step 6 classification:**

| Finding | Label |
|---------|-------|
| `inject()`-based call reachable from inside a Zone/async boundary, no value captured beforehand | `must-change` |
| `inject()`-based call present but only reachable synchronously from the constructor (no boundary in between) | `safe` |
| Dependency version bumped by more than one major/minor and not yet checked for this pattern at all | `needs-review` — check before marking `safe`
