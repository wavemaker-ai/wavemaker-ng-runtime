# WaveMaker runtime patterns — ng-runtime §1–§38

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
| [§27](#27-angular-22-default-behavior-changes-compatibility-pins) | Angular 22 default-behavior changes — `changeDetection`, router `paramsInheritanceStrategy` |
| [§28](#28-angular-22-compiler-strictness-ratchet-ng1054-ng6008-ng6009) | Angular 22 compiler strictness — NG1054, NG6008, NG6009 |
| [§29](#29-standalone-by-default-breaks-inline-test-harness-componentspipes-angular-19) | Standalone-by-default — inline test-harness components/pipes (Angular 19) |
| [§30](#30-ng-packagr-output-shape-changes-break-configrollupbuild-taskmjs-dependency-extraction-pipeline) | ng-packagr output-shape changes — `rollup.build-task.mjs` dependency extraction |
| [§31](#31-ngx-bootstrap-directive-inputs-converted-to-signal-based-input-any-ngx-bootstrap-major-bump-confirmed-at-21) | ngx-bootstrap directive `@Input`s → signal `input()` — imperative writes break |
| [§32](#32-root-appcomponent-renders-nothing-after-bootstrap--bare-settimeout-no-longer-reliably-triggers-change-detection-angular-21-confirmed-live-at-step-9) | Blank page / stuck spinner — bare `setTimeout`/`.then()`/`.subscribe()` property writes stop triggering CD reliably (7 confirmed instances) |
| [§33](#33-angular-22-removed-compilercompilemoduleandallcomponentssync-and-the-componentfactory-based-createcomponent-overload) | Angular 22 removed `compileModuleAndAllComponentsSync` + factory `createComponent` — whole dynamic-component pipeline restructured to standalone |
| [§34](#34-angular-22s-onpush-by-default-also-breaks-inline-test-harness-components-in-spects-27as-blind-spot) | OnPush-by-default also hits inline `*.spec.ts` harness components — 23 suites/60 tests (§27a's blind spot, same files as §29) |
| [§35](#35-ngx-bootstrap-22-removed-the-internal-_ngzone-field-its-directives-exposed) | ngx-bootstrap 22 removed directives' internal `_ngZone` — popover + `utils.ts` positioning helpers |
| [§36](#36-third-party-dependency-ngx-toastr--removed-componentfactoryresolver-usage-and-changed-toasttoastbases-constructor--signal-based-fields-angular-22) | `ngx-toastr` removed `ComponentFactoryResolver` (bump to 20.0.5) + `Toast`/`ToastBase` constructor/fields went signal-based — silent runtime bug, not just a compile error |
| [§37](#37-projectspackagejson-peer-dependencies-still-declare-the-old-angular-major-every-major) | `projects/*/package.json` `peerDependencies` still declare the old Angular major — published libs would ship a stale peer range |
| [§38](#38-angular-private-chunks-inlined-into-a-second-umd-entry--duplicate-di-tokens-ng0200-for-rendererfactory2-preview-only) | Angular private `_*-chunk.mjs` files get inlined into every UMD entry → duplicate DI tokens (NG0200 `RendererFactory2`, Preview only) |

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

**Verified (18→19 hop):** `Compiler.compileModuleAndAllComponentsSync` was still present in `@angular/core@19.2.25`'s `.d.ts` — genuinely NOT required at 19, correctly deferred.

**Verified (19→20 hop) — correction of an earlier same-session error:** `compileModuleAndAllComponentsSync` and `Compiler` are **still present** in `@angular/core@20.3.31`'s real public entrypoint (`node_modules/@angular/core/index.d.ts`, re-exported from `discovery.d.d.ts`) — marked `@deprecated` ("Ivy JIT mode doesn't require accessing this symbol") but not removed; same for the positional `ViewContainerRef.createComponent(factory, index, injector, ...)` overload (`index.d.ts` line ~3701). An earlier note in this same run claimed these were "gone, confirmed via direct grep" — that grep was against the wrong/non-canonical `.d.ts` file (or was simply wrong) and has been retracted here. Per the Compatibility Policy ("would this be needed even if Angular hadn't released a new version?"), a deprecation with a still-working implementation is not a `must-change` for a compatibility-only upgrade. See the empirical build check recorded in `docs/upgrade-log/19-to-20.md` for whether the legacy path actually still compiles/runs at 20.3.31 before deciding to defer again vs. apply the rewrite.

**This repo's own git history has the real reference fix**, even though it's not on `stage-classic` (it's on whatever branch this WMS-29275 work shipped from — reachable as loose commit objects via `git cat-file -t <hash>` even without a branch ref, at least as of 2026-09; if these ever get garbage-collected, this note becomes historical only): commits `d9a05f1be` → `a2062ecf8` (both 2025-11-19) → `3c1028fe8` (2025-12-19), each viewable directly with `git show <hash>:<path>` without needing to check out or merge the branch. Do **not** cherry-pick these directly onto a diverged branch (expect conflicts) — use `git show <hash>:<path>` output as a worked-example reference and adapt manually. Final shape (after all 3): standalone `Component({ standalone: true, ... })` classes created via the `Component()` decorator function, instantiated with the modern `createComponent(componentType, { environmentInjector, elementInjector })` free function from `@angular/core` (not `ViewContainerRef.createComponent`), manual `ApplicationRef.attachView`/`detachView` lifecycle, `inject()`-style DI. `component-ref-provider.service.ts` (the big one — drives all page/partial/prefab/widget dynamic rendering) goes through all 3 commits before reaching its final shape; the other 6 §2 call sites (directives/components that call into these 2 services) get simpler, mostly-mechanical updates once the services' return type changes from `ComponentFactory` to `Type<unknown>`.

**Current repo (pre-fix):** dynamic path still uses the legacy `Compiler`/`compileModuleAndAllComponentsSync`/NgModule-wrapper pattern in both services as of the 19→20 hop. Target end state per the reference commits: dynamic path uses standalone `Component({ standalone: true, imports: [...] })` in `dynamic-component-ref-provider.service.ts`. Grep should find **zero** legacy compiler calls once fixed. Remove deprecated `wm-view` transpiler registration (`a2062ecf8`).

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

**`config/rollup.ngxBootstrap.config.mjs` hardcodes ngx-bootstrap's fesm bundle format per entry (18→19 hop):** every one of its ~22 module entries (`positioning`, `modal`, `dropdown`, `tooltip`, etc.) hardcodes a `fesm20XX` path segment (e.g. `node_modules/ngx-bootstrap/positioning/fesm2020/ngx-bootstrap-positioning.mjs`). ngx-bootstrap bumping its own build output from `fesm2020` to `fesm2022` (independent of which Angular major triggered the ngx-bootstrap bump) breaks every single entry at once with `Could not resolve entry module` errors. Fix is mechanical — replace `fesm2020` → `fesm2022` (or whatever the new format is) across all entries — but confirm the *actual* installed format first (`ls node_modules/ngx-bootstrap/positioning/` — don't assume it's always `fesm2022` going forward; verified unchanged 19.0.2→20.0.2 in this repo's 19→20 hop, but re-check every ngx-bootstrap bump rather than assuming stability).

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

**`setTheme('bs3')` → `setTheme('bs4')` (18→19 hop):** `ngx-bootstrap/utils`' `setTheme()` call in `projects/runtime-base/src/components/app-component/app.component.ts` must match a theme ngx-bootstrap actually still supports — `'bs3'` stopped being valid at the ngx-bootstrap version this repo bumped to. Grep `setTheme(` in that file if datepicker/timepicker/rating render with wrong styling after an ngx-bootstrap bump; check `node_modules/ngx-bootstrap/utils/theme-provider.d.ts` for the currently valid theme strings rather than assuming `'bs4'` is still correct at a future major.

**ngx-bootstrap 20 modal events (WMS-29275: `bfb1f5bb4`):** v20 removed global `BsModalService.onShown` / `onHidden` in some builds — `BaseDialog` must invoke open/close callbacks manually on the modal ref. **Re-verify on ngx-bootstrap 21+** — upstream may restore global emitters; grep `base-dialog.ts` for `onShown.subscribe` vs manual `setTimeout` callbacks.

**Don't confuse the `modal` patch-table row above with a separate, third-repo bug (confirmed live, 18→19 hop):** the patch table's `SHOW: 'show'` → `'in'` fix is inside `ngx-bootstrap-patch.mjs`, patching ngx-bootstrap's own component *class-binding* behavior — it does not touch CSS. The modal/backdrop's actual *opacity* rules (`.fade`, `&.in`/`&.show`) live in **`wavemaker-foundation-css`**, a sibling repo this skill does not otherwise edit or grep (`../wavemaker-foundation-css` relative to ng-runtime; no config var for it in `repo.config.sh`). ngx-bootstrap 19+/20 always emits the BS5 `.show` class (confirmed, never `.in`), but if foundation-css's `src/styles/web/components/modal-dialog.less` still only has an `&.in { opacity: 1; }` rule (no `&.show`), the modal renders with `opacity: 0` — invisible, no console error, easy to misdiagnose as an ngx-bootstrap-patch problem since the symptom (modal doesn't show) is identical. Fix: add `&.show { opacity: 1; }` alongside `&.in` in that file, for both `.modal` and `.modal-backdrop` blocks, then `npm run build` in foundation-css (auto-runs `yalc push`) and rebuild ng-runtime. **Step 9 preview validation is the only way this surfaces** — no static check in this skill's pattern-review.sh reaches outside ng-runtime/ng-codegen into a third sibling repo.

**ngx-bootstrap 21+:** **every** module removed `forRoot()` (confirmed 10/10, not just "most" — see §8b) — use bare modules in `importProvidersFrom` / `NgModule.imports` and `ToastNoAnimationModule.forRoot()` only where still supported (separate package, unaffected). Grep `projects/` for `.forRoot()` on ngx-bootstrap imports (including `*.spec.ts` if Step 8 runs).

**Angular 21 `@HostListener` — stricter host-binding arg-count checking (R1: "hidden type issues in host bindings may surface"):** `@HostListener('event', ['$event', '"someLiteral"'])` on a method declaring only `($event)` (one param) now fails `TS2554: Expected 1 arguments, but got N` — the decorator's args array length must match the method's declared parameter count exactly. **Confirmed fix in `checkbox.component.ts`/`checkboxset.component.ts` (20→21 hop):** the extra literal-string arg was genuinely vestigial/unused in both method bodies — drop it from the array (`['$event', '"ENTER"']` → `['$event']`). **Do not assume every instance is vestigial** — `menu.component.ts`/`menu-dropdown-item.component.ts` stack several `@HostListener`s on one method with a matching 2-param signature (`onKeyDown($event, eventAction)`) specifically to dispatch on which decorator fired; those compile fine as-is (2 array entries, 2 params) and must not be "fixed" to 1 — check the method's actual param count before touching either side of the mismatch. Also: one **static** event name per decorator (`keydown.enter`, `keydown.arrowup`) — do not combine multiple keys in one decorator string.

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

#### 7b. `provideHttpClient` default backend (`withXhr()`) — Angular 22

**First required:** Angular 22 (`aab04e7ae`).

Angular 22 changed `provideHttpClient()`'s default backend behavior. Without `withXhr()` explicitly passed, upload-progress reporting (`reportProgress: true` on a request with a body upload) silently stops working — no compile error, no runtime error, just missing progress events.

**Fix:** `provideHttpClient(withInterceptorsFromDi(), withXhr(), …)` in `app.config.ts`.

**Step 6 grep:**

```bash
rg 'provideHttpClient\(' projects/runtime-dynamic/src/app/app.config.ts
# Confirm withXhr() is present among the args
```

**Step 6 classification:** `must-change` if the app has any file-upload widget using progress reporting (WaveMaker's Upload widget does) — `safe` only if no upload-progress consumer exists, which is not the case here.

### 8. Rollup library bundles

- `config/rollup.ng-libs.config.mjs` — peer dependency alignment with `@angular/*`
- Angular 21 fesm renames: `@angular/core/primitives/di` → `primitives-di.mjs`, `signals` → `primitives-signals.mjs`, `event-dispatch` → `primitives-event-dispatch.mjs` (path change only — the nested `fesm2022/primitives/` subfolder is gone, flat filenames directly in `fesm2022/`)
- `tsconfig.json` **`moduleResolution: "bundler"`** — required for ng-packagr to resolve `@angular/common/http` and core primitives
- **`tsconfig.web-app.json` must stay aligned with `tsconfig.json`** on every major bump — codegen renames it to the generated app's `tsconfig.json` (§20a)

**Confirmed at Angular 21 (20→21 hop):** `core.mjs` gained a **new**, previously-absent top-level `import '@angular/core/primitives/di';` (bare package-subpath, external — same pattern as the pre-existing `signals` import) — not just a path rename, a genuinely new external dependency. Required a **new** `rollup.ng-libs.config.mjs` bundle entry (`fesm2022/primitives-di.mjs` → `core-di.umd.js`, `external: []`, global name `ng.di`), a new `"@angular/core/primitives/di": "ng.di"` entry in the `core` bundle's own `globals`/`external`, **and** a new line in `build.sh`'s `bundleJS()` terser concatenation list (`./node_modules/@angular/core/bundles/core-di.umd.js`, positioned before `core.umd.js`, same as `core-signals.umd.js`) — the rollup config alone is not sufficient, the raw UMD bundle must also be wired into the final concatenated `web-libs` bundle or `di` stays `undefined` at runtime with no build-time signal. **Note the asymmetry:** `event-dispatch` is imported via a *relative* path (`./primitives-event-dispatch.mjs`) and gets inlined directly into `core.umd.js` by rollup — it has never needed its own `bundleJS()` line, unlike `signals`/`di` which are bare package-subpath imports and stay external. Don't assume every primitives import needs the same treatment — check whether the import in `core.mjs` is relative (inlined) or a bare specifier (external, needs its own bundle line) before deciding.

**Risk:** broken `dist` packages consumed by generated apps; TS2307 / NG1010 on `ng build` after codegen; a missing `bundleJS()` line is a **silent runtime failure** (undefined global, no error at build time) — see `patterns/runtime.md` §26's general warning about this exact failure class.

#### 8b. NgModule / `ApplicationConfig` static analysis (Angular 21)

**This is a breaking change in ngx-bootstrap, not a refactor choice.** ngx-bootstrap 21 removed `.forRoot()` from **every** module, not just Modal/Datepicker — confirmed via direct grep of all installed `.d.ts` files (20→21 hop): `modal`, `datepicker`, `timepicker`, `dropdown`, `pagination`, `typeahead`, `progressbar`, `carousel`, `popover`, `tooltip` all lost it. **`NgCircleProgressModule.forRoot()` is a misattribution — do not touch it.** It ships from `ng-circle-progress`, a completely separate package this repo doesn't bump in lockstep with ngx-bootstrap; its `.forRoot()` was confirmed still present at the 20→21 hop and should be left exactly as-is. Angular 21's static analysis raises **NG1010** on any `ModuleWithProviders` value in `imports`. The fix is forced by the library — use bare modules.

- `ModuleWithProviders` from `SomeModule.forRoot()` in `NgModule.imports` → **NG1010** (not statically analyzable)
- **Fix:** bare modules in `imports`; spread `forRoot().providers` into `providers`, or use `importProvidersFrom` in `app.config.ts` without `.forRoot()` on the affected ngx-bootstrap modules

**Where:** `projects/runtime-dynamic/src/app/app.config.ts` (flat `providers`; primary bootstrap), **`wavemaker-ng-codegen/templates/app.config.ts.hbs`** (§20b — edit source templates only, not `dist/`). `projects/transpiler/src/imports.ts`'s `ImportDef.forRoot` flag was checked at the 20→21 hop and confirmed to have **zero actual consumers anywhere in the codebase** — it's inert/dead data, not a real forcing function; don't spend time "fixing" it. `projects/runtime-dynamic/src/app/app.module.ts` (legacy, not used by codegen output, but still part of the TS project and must still compile) also has its own set of 9 `SomeModule.forRoot()`-typed exports (`ModuleWithProviders<X>`) that need the same bare-module treatment — change the type annotation to `typeof X` alongside removing `.forRoot()`.

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

**18→19 hop:** `projects/core/src/utils/utils.spec.ts` — direct property assignment to `window.location` (`window.location = {...}`) started failing under the jsdom/jest-preset-angular version this hop pinned (that property became non-writable via plain assignment). Fix: mock via `(window as any).location = {...}` instead — casting bypasses the stricter type/writability check without changing what the test actually verifies. Watch for the same class of jsdom-environment-object-mocking break (`window.location`, `window.history`, etc.) on any future `jest-preset-angular`/jsdom bump (§9's own R9 pin), not just this exact property.

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

**Confirmed changed shape at ngx-bootstrap 21.2.2 (20→21 hop):** the constructor signature itself changed — `constructor(ngZone, rendererFactory, platformId)` lost its `ngZone` parameter entirely, now `constructor(rendererFactory, platformId)`. The Zone boundary is no longer `ngZone.runOutsideAngular(...)` but `runInZoneRootIfPresent(() => {...})` (new helper in `ngx-bootstrap/utils`, does `zone.root.run(fn)` directly via raw Zone.js — same hazard, since Angular's injection-context tracking doesn't survive *any* Zone.js task boundary regardless of which API creates it, not just `NgZone.runOutsideAngular` specifically). `triggerEvent$` access also gained optional chaining (`this.triggerEvent$?.pipe(...)`). **The 20.0.2 patch regex does not match this shape at all** — verified directly (`RegExp.test()` against the installed source, not assumed) — the old 20.0.2 regex silently fails to match, which `verify-ngx-bootstrap-bundle.sh`'s fallback WARN would have caught, but only if actually run. `ngx-bootstrap-patch.mjs` now targets the 21.2.2 shape specifically (matches from `constructor(rendererFactory, platformId)` through the `merge(...)` call up to `runInZoneRootIfPresent(() => {` using a non-greedy `[\s\S]*?` middle section — a fixed-character-class approach like `[^)]*` breaks on the nested parens inside `merge(fromEvent(...), fromEvent(...), ...)`). **This is now the second confirmed distinct upstream shape for the same underlying bug** — expect a third at a future ngx-bootstrap major; always re-verify the regex against the actual installed source rather than assuming either prior shape still applies.

**Root cause (general):** across the versions checked, ngx-bootstrap's `PositioningService` calls `takeUntilDestroyed()` (bare, or referencing an undeclared `__destroyRef`) in a context where implicit DI resolution is unreliable. The Rollup patch must inject `const __destroyRef = i0.inject(i0.DestroyRef)` **before** the `runOutsideAngular` call (still in a valid injection context) and pass it explicitly: `takeUntilDestroyed(__destroyRef)`. If the patch **regex no longer matches** the upstream constructor (ngx-bootstrap minor bump) or **`sh build.sh -f` was skipped** / preview uses stale `wm-libs.js`, the bundle ships broken positioning — dropdown, popover, modal, datetime fail at runtime.

**Step 6 — source checks:**

```bash
# Patch file must still target DestroyRef
rg '__destroyRef|takeUntilDestroyed' build-scripts/ngx-bootstrap-patch.mjs

# Upstream still needs the patch (if this matches but patch log silent → regex drift)
find node_modules/ngx-bootstrap/positioning -name '*.mjs' | xargs rg 'takeUntilDestroyed\(__destroyRef\)'
```

Compare `PositioningService` constructor in `node_modules/ngx-bootstrap/positioning/fesm2022/ngx-bootstrap-positioning.mjs` to the regex in `PATCHES.positioning` — if shape changed, extend patch → `must-change`.

**21→22 hop: `ngx-bootstrap-patch.mjs` replaced wholesale with a more comprehensive version from `feature/angular-22-upgrade` (a sibling WMS-32451 branch, same ticket, independent implementation) — 4 more patch categories added, and a real rollup-wiring bug found and fixed in the process.**

Before this hop, `ngx-bootstrap-patch.mjs` on `stage-classic` only had the `positioning`/`DestroyRef` patch. The `feature/angular-22-upgrade` branch's copy of the same file additionally carries `componentLoader` (subscription tracking/cleanup), `dropdown` (BS5 `.show` class restoration), `modal` (`SHOW` class value), and `typeahead` (dropdown-menu overflow style) patches — all tracing back to **WMS-29275** (the original 18→20 upgrade), not anything Angular-22-specific. **Before copying, each was independently verified against `stage-classic`'s own installed ngx-bootstrap 22.0.0 source** (grep for the exact broken pattern each patch targets) rather than trusted at face value — 2 of the 8 individual sub-patches correctly no-op on this version (see below), the other 6 target real, currently-unpatched code.

**Copying the patch file alone was not sufficient — found a second, separate bug in `config/rollup.ngxBootstrap.config.mjs`.** That config builds each ngx-bootstrap submodule as its own separate Rollup entry (23 entries; `feature/angular-22-upgrade` instead uses one combined virtual-entry bundle — a bigger structural difference not worth porting). `plugins: [ ngxBootstrapPatchPlugin() ]` was attached to the `positioning` entry only — **`component-loader`, `dropdown`, `modal`, and `typeahead` had no `plugins:` array at all**, so even with the fuller patch file in place, only the positioning patch was ever actually applied; the other 4 categories silently never ran. Confirmed via direct build: after copying the patch file alone, `grep -c "SHOW: 'in'"`/`_onShownSubscription`/etc. against the built `ngx-bootstrap.umd.js` all returned 0. Fixed by adding `plugins: [ ngxBootstrapPatchPlugin() ]` to each of the other 4 entries in the existing 23-entry structure (not restructuring to a virtual entry). **Lesson: verify a patch file's effect in the actual built output, never from its own console log lines alone** — `sh build.sh -f`'s own log for this run showed zero `ngx-bootstrap-patch` lines at all (a separate, cosmetic issue — the emoji-prefixed `console.log` lines this file uses don't propagate through `execCommand`'s output capture in `build.sh`; `rollup -c ./config/rollup.ngxBootstrap.config.mjs` run standalone does show them) — only grepping the actual bundle content is reliable.

**2 sub-patches that correctly no-op on ngx-bootstrap 22.0.0 (verified why, not just observed):**
- `dropdown`'s BS5 `.show` class restoration: `grep -n "class.show" node_modules/ngx-bootstrap/dropdown/fesm2022/ngx-bootstrap-dropdown.mjs` shows `[class.show]="isOpen"` already present in the host bindings at 22.0.0 — this bug is fixed upstream now, the patch's own `if (code.includes(...)) return {wasPatched:false}` guard correctly detects that and skips it.
- `componentLoader`'s "Unsubscribe fix" sub-patch (the third of three `componentLoader` patches): its regex requires a `_zoneSubscription` field in `_unsubscribePositioning()`, but 22.0.0's actual implementation uses `_positioningRafId`/`cancelAnimationFrame` instead — a different, already-refactored cleanup mechanism. The regex correctly fails to match rather than corrupting the file. The first `componentLoader` sub-patch (subscription tracking, adds `this._onShownSubscription = this.onShown.subscribe(...)`) does apply and is harmless on its own even without its unmatched cleanup companion — it only adds a reference, doesn't change existing behavior.

**Step 6 — verify the full patch pipeline, not just the patch file's content:**

```bash
# 1. Confirm the patch file itself has all 5 categories:
rg '^\s+(positioning|componentLoader|dropdown|modal|typeahead):\s*\{' build-scripts/ngx-bootstrap-patch.mjs

# 2. Confirm EVERY entry that should be patched actually has the plugin wired —
#    this is the check that would have caught the rollup-config gap immediately:
rg -B3 "input: 'node_modules/ngx-bootstrap/(component-loader|dropdown|modal|typeahead)" config/rollup.ngxBootstrap.config.mjs | rg -c "plugins:"
# must equal 4 (one per module) — if less, some entries are missing the plugin

# 3. Verify in the actual BUILT bundle, not the patch file or its logs:
grep -c "SHOW: 'in'" dist/tmp/libs/ngx-bootstrap/ngx-bootstrap.umd.js          # modal
grep -c "_onShownSubscription" dist/tmp/libs/ngx-bootstrap/ngx-bootstrap.umd.js  # componentLoader
grep -c 'dropdown-menu{overflow-y:auto;height:100px}' dist/tmp/libs/ngx-bootstrap/ngx-bootstrap.umd.js  # typeahead — should be 0 after patch
```

**Step 7 — post-build gate (when bundle verify enabled):**

```bash
UPGRADE_BUILD_CMD='<BUILD_CMD from repo.config>' UPGRADE_BUNDLE_VERIFY=yes \
sh scripts/build.sh
# or verify alone after build:
sh scripts/verify-ngx-bootstrap-bundle.sh
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

#### 13i. `removeStyles()` no-op (Angular 22)

**First required:** Angular 22 (`aab04e7ae`).

Angular 22's internal `SharedStylesHost` gained a `removeStyles()` method. `WMDomSharedStylesHost` overrides this class but bypasses Angular's real style-node management entirely (§13a), so upstream calling the new method against the fork's instance would hit a missing method rather than a real behavioral gap.

**Fix:** add a no-op `removeStyles(): void {}` override in `wm_shared_styles_host.ts`. Defensive — not a fix for an observed crash, just closing the API-surface gap upstream added.

**Step 6 grep:**

```bash
rg 'removeStyles' projects/runtime-base/src/overrides/wm_shared_styles_host.ts
```

**Step 6 classification:** `needs-review each major` — same as §13h (`destroyNode`): compare upstream `SharedStylesHost`'s method surface on every bump; implement any newly-required override as a no-op unless a real crash proves otherwise.

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

**Confirmed live (19→20 hop, 2026-09):** this was NOT a hypothetical — it produced a real, reproducible `SyntaxError: Unexpected token ','` at `new Function (<anonymous>)` inside `ASTCompiler.compile()`, from `swipey.jquery.plugin.js`'s `compile()` (a `{{...}}` CSS-animation-binding evaluator, `projects/swipey/src/swipey.jquery.plugin.js`) calling `$parseExpr` with a parenthesized expression. Root-caused via a temporary diagnostic in `ASTCompiler.build()`'s fallthrough (log `ast.constructor.name` instead of silently returning `undefined`) — confirmed `ParenthesizedExpression` (and, once handled, cascaded through `Conditional` and `BindingPipe` wrapped in parens too) — NOT related to the same hop's §19b `PropertyWrite` removal, which was the initial (wrong) suspicion given both changes were made in the same file in the same hop. Reproduced identically in both development and production builds. See `docs/upgrade-log/19-to-20.md`.

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

### 27. Angular 22 default-behavior changes (compatibility pins)

**Update:** 27a/27b were originally reconstructed from commit messages (`aab04e7ae`) without a passing Step 9 run — that gap is why §27c below was missed the first time. §27c has since been found and fixed via a live proxy-preview check (not just a green build), which also implicitly re-confirms 27a is correct for the *statically-declared* component case. Still worth an independent Step 9 pass on any future upgrade rather than assuming this section is exhaustive — see the case study below for exactly how a "green build" can hide this class of bug.

All three changes below share a shape: Angular 22 silently changed a default with no compile-time error, so nothing catches a missed pin except a behavioral difference in the browser.

#### 27a. `changeDetection` default (Angular 22)

**First required:** Angular 22 (`aab04e7ae`).

Angular 22 changed the default change-detection strategy applied to any `@Component` with no explicit `changeDetection` value. 76 components in this repo had no explicit strategy and got `changeDetection: ChangeDetectionStrategy.Eager` added to pin the pre-22 default behavior.

**This is forward-looking, not just a one-time fix:** any **new** component added after this upgrade that omits `changeDetection` will silently pick up Angular 22's new default instead of matching the rest of the codebase, unless something enforces the pin going forward (lint rule, base class, or code-review discipline — none currently exist for this).

**Step 6 grep:**

```bash
# Components with no explicit changeDetection (candidates needing the pin)
rg -L '@Component\(\{[^}]*changeDetection' --type ts -g '*.component.ts' projects/ | rg -l '@Component'
```

**Step 6 classification:** `must-change` for any component lacking the pin; `needs-review` for the forward-looking gap (no enforcement mechanism) — flag as a deferred item, not a Step 6 blocker.

#### 27b. Router default `paramsInheritanceStrategy` (Angular 22)

**First required:** Angular 22 (`aab04e7ae`).

Angular 22 changed the router's default child-route param-inheritance behavior. `withRouterConfig({ paramsInheritanceStrategy: 'emptyOnly' })` added to the router providers in `app.config.ts` to preserve pre-22 behavior.

**Step 6 grep:**

```bash
rg 'withRouterConfig' projects/runtime-dynamic/src/app/app.config.ts
```

**Step 6 classification:** `must-change` — any route with child routes reading inherited params is affected without this pin.

#### 27c. `changeDetection` default — dynamic `Component()` factories (Angular 22)

**First required:** Angular 22. Found the hard way: this exact gap caused a real, reported "preview is broken" bug that survived a fully green `build.sh -f`, `pattern-review.sh`, and even a working *local development-build* deployment — see `docs/22-upgrade.md` § Preview bug investigation for the full methodology.

§27a's grep (`rg -L '@Component\(\{[^}]*changeDetection' --type ts -g '*.component.ts' projects/`) only finds *static* `@Component()` class decorators. It cannot find a `@Component()` decorator applied *programmatically at runtime* to a dynamically-created class — the pattern this codebase uses to build every page/partial/prefab/custom-widget component from server-fetched markup:

```typescript
return Component({ template, ... })(DynamicComponent);
```

Two call sites had this exact gap:
- `projects/runtime-dynamic/src/app/services/component-ref-provider.service.ts` — `createComponent()`, used for PAGE/PARTIAL/PREFAB/WIDGET
- `projects/runtime-base/src/services/dynamic-component-ref-provider.service.ts` — `createDynamicComponent()`, a separate generic ad-hoc dynamic-component path

**Why a green build never caught this:** `ViewContainerRef.createComponent(SomeClass, ...)` (or the standalone `createComponent()` function) succeeds and inserts the new component's host element into the DOM regardless of its `changeDetection` strategy — there's no error, no thrown exception, nothing for `pattern-review.sh`/`tsc`/a passing build to catch. Under Angular 22's new default, the host element appears but the component's own template content is simply never checked, so it renders as visually empty. This is functionally invisible to everything except an actual browser render — exactly the class of bug this section's own §26 (`inject()`/Zone-boundary hazards) and the "Verification Principle" section already warn about: patterns validated only by a green build, never by Step 9, can hide bugs like this indefinitely.

**Step 6 grep:**

```bash
# Find dynamic Component({...}) factory files, then flag any missing the pin nearby
for f in $(rg -l "return Component\(\{" --type ts projects/); do
  rg -A15 "return Component\(\{" "$f" | rg -q "changeDetection" || echo "MISSING pin: $f"
done
```

**Step 6 classification:** `must-change` — any dynamic `Component()` factory used to build page/partial/prefab/custom-widget content at runtime needs this pin; treat as equally critical to §27a's static sweep, not a lesser edge case.

### 28. Angular 22 compiler strictness ratchet (NG1054, NG6008, NG6009)

**First required:** Angular 22 (`e00efb3f3`). Same caution as §27 — reconstructed from a build that passed, not a validated preview.

Angular 22's template compiler tightened several checks that previously compiled cleanly:

| Diagnostic | Trigger | Fix |
|-----------|---------|-----|
| `NG1054` | Two class members bound to the same public `@Input` alias (e.g. a `@Input("config")` field plus a differently-named setter aliased to the same `"config"` input) | Remove the redundant one — keep whichever actually does the work (usually the setter, if it has side effects) |
| `NG6009` | `bootstrap: [...]` in an `NgModule` referencing a component that is (or has become) standalone | Remove the `bootstrap` array entry — standalone components can't appear there. If the app already bootstraps via `bootstrapApplication()`, the whole `NgModule` may be dead code (`WMS-TBD`/`aab04e7ae`: `AppModule` — confirm before deleting; this run only removed the offending entries, not the module itself) |
| `NG6008` | A standalone component listed in an `NgModule`'s `declarations` | Move it to that `NgModule`'s `imports` instead |

**Step 6 grep:**

```bash
npx tsc --noEmit 2>&1 | rg 'NG1054|NG6008|NG6009'
```

**Step 6 classification:** `must-change` — these are compile errors, not warnings; `build.sh -f` will not pass with them present.

### 29. Standalone-by-default breaks inline test-harness components/pipes (Angular 19)

**First required:** Angular 19 (official 19.0.0 breaking change: "Angular directives, components and pipes are now standalone by default"). Discovered via `npm test`, not the build — `build.sh -f` compiles clean even when every affected test fails, because this only surfaces at TestBed runtime, not AOT/ng-packagr compile time.

**Symptom:** `npm test` mass-failure (in this repo: 2934/4022 tests, 79/126 suites — one root cause, one error signature repeated):

```text
Unexpected "<ClassName>" found in the "declarations" array of the "TestBed.configureTestingModule" call,
"<ClassName>" is marked as standalone and can't be declared in any NgModule -
did you intend to import it instead (by adding it to the "imports" array)?
```

**Root cause:** inline test-harness "wrapper" components (e.g. `class IconWrapperComponent { @ViewChild(...) ... }`, defined directly inside a `*.spec.ts` file to give a widget-under-test a host template) and inline mock pipes/directives, when their `@Component`/`@Pipe`/`@Directive` decorator omits `standalone` entirely. At Angular 18 the implicit default was `false` (NgModule-based) — fine in a `declarations: [...]` array. At Angular 19 the implicit default flips to `true` — now invalid there.

**Not a production-code issue in this repo:** verified all real `.component.ts` files already declare `standalone` explicitly (grep: 0/74 missing it). This is specifically an inline-test-harness gap — production source was already following explicit-standalone discipline.

**Canonical fix:** add `standalone: false` to the decorator of every locally-defined test-harness class that's referenced in a `declarations: [...]` array in the same file — this restores the exact pre-19 behavior with a one-line, zero-risk addition (do **not** switch these to `imports` + `standalone: true`; that's modernization, not compatibility, and changes how the harness component itself gets compiled).

**Find every instance in one pass** (don't fix file-by-file from individual jest failures — this repo had 80 files / 87 classes, one shared root cause):

```js
// For each *.spec.ts with a declarations:[...] array, find locally-defined
// @Component/@Pipe/@Directive classes referenced there whose decorator body
// doesn't contain "standalone:", then insert "standalone: false," right after
// the decorator's opening brace. See git history around the WMS-32451 skill
// port for the exact script (find-standalone-issue.js / fix-standalone.js
// pattern) if reimplementing.
```

**Separate, look-alike failure — do not confuse with the above:** a *third-party* library component/pipe (not locally defined) can hit a related but different error depending on whether it's placed in `declarations` or `imports`, if the library was compiled against an old Angular version whose partial Ivy declaration omits the `isStandalone` field entirely (Angular 19's `declarations`-check and `imports`-check read that missing field with *opposite* defaults). You can't add `standalone: false` to a compiled third-party class. Fix: use the library's own NgModule export if it has one, matching however your **production** code already consumes that dependency (check the real `.component.ts`, don't guess) — e.g. `ng-circle-progress`'s `CircleProgressComponent` (compiled against Angular 14.2.12, no `isStandalone` field) must be imported via `NgCircleProgressModule`, not the raw component class, exactly as `progress-circle.component.ts` already does in production.

**Step 6/8 grep:**

```bash
# after Step 8 test run, if standalone-related TestBed errors appear:
rg -l "declarations\s*:" projects/ --include="*.spec.ts"
# then check each locally-defined @Component/@Pipe/@Directive referenced there for a missing "standalone:"
```

**Step 6 classification:** `must-change` — but only surfaces via `npm test` (Step 8), not `build.sh` (Step 7); don't assume Step 7 passing means this is clear.

### 30. ng-packagr output-shape changes break `config/rollup.build-task.mjs` (dependency-extraction pipeline)

**Where:** `config/rollup.build-task.mjs` — a custom, hand-rolled rollup pipeline distinct from §8's `rollup.ng-libs.config.mjs`. It extracts specific library exports (expression parser, pipes, pipe provider) into standalone CJS/ES bundles under `dist/transpilation/`, consumed by **ng-codegen** at Node runtime (not by the browser app) to initialize its own copy of the WM expression parser for build-time transpilation. Companion fix on the ng-codegen side: `src/wm-utils.js`'s `initExpressionParser()`.

**First required:** Angular 20 hop (ng-packagr 17.3.0→19.2.2, WMS-29275/18→19 hop in this repo's real history — this repo hit it again fresh going 18→19). **Re-check on every ng-packagr major bump** (R10 pin) — this is an ng-packagr output-shape risk, not an Angular-version risk per se, so it can recur even on an Angular hop where ng-packagr's own major doesn't change, or skip a hop where ng-packagr's internal structure happens not to shift.

**Root cause:** ng-packagr's major bump dropped **per-file** `esm2022/<path>.mjs` output (e.g. `libraries/core/esm2022/utils/expression-parser.mjs`), leaving only the **flattened, whole-library** `fesm2022/index.mjs` bundle per library. `rollup.build-task.mjs`'s entries previously pointed at the narrow per-file paths — those paths no longer exist at all, not just moved.

**Symptom cascade (three distinct, sequential failures — don't assume the first fix is the last one needed):**
1. `Error: Could not resolve entry module './libraries/core/esm2022/utils/expression-parser.mjs'` (or similar) — the old per-file path is simply gone.
2. After repointing at the `fesm2022/index.mjs` barrel: `dist/transpilation/*.cjs.js` builds "successfully" but the output is a near-empty stub (~15 bytes) — caused by `@rollup/plugin-multi-entry` (deprecated, silently produces empty chunks against rollup 4.60.1+) still being used from the old per-file, multi-entry setup. Fix: remove the plugin entirely — a single `fesm2022/index.mjs` entry point needs no multi-entry aggregation.
3. After that: `Cannot find module '@wm/components/dialogs/confirm-dialog'`-style errors from **unanchored string aliases** — `@rollup/plugin-alias`'s plain-string `find` values are **prefix matches**, so `{ find: '@wm/components/dialogs', replacement: ... }` also wrongly matches `@wm/components/dialogs/confirm-dialog`. Fix: anchor as a regex — `{ find: /^@wm\/components\/dialogs$/, replacement: ... }` — and order special-cased entries (`@wm/components/page`, `@wm/components/dialogs` — both have multiple implementations behind a `default` folder, matching `tsconfig.json`'s own path mappings) **before** a generic `{ find: /^@wm\/(.+)$/, replacement: 'libraries/$1/fesm2022/index.mjs' }` catch-all, or the catch-all wins first and resolves to a non-existent `libraries/components/page/fesm2022/` instead of `libraries/components/page/default/fesm2022/`.

**Documented dead-end — do not retry this approach:** narrowing the bundle to just the 1–3 specific exports actually needed (instead of pulling in the whole `fesm2022/index.mjs` barrel, which drags in every sibling class in that library) does **not** reduce bundle scope. Angular decorators (`@Component`, `@Injectable`, etc.) are treated by rollup as side-effecting, so it cannot tree-shake sibling classes out of a decorated barrel file even via a narrow re-export shim. Verified empirically in this repo — go straight to consuming the full barrel and let the generic alias + downstream Node-side global stubs (below) absorb the consequences, rather than re-attempting a shim.

**Unrelated but co-discovered in the same investigation (third-party package bug, not an Angular-version issue):** `@wavemaker/variables` (separate sibling repo, `.yalc`-linked) ships a malformed `package.json` `"exports"` map (`{"." : "./index"}`, missing the `.js` extension) — blocks `nodeResolve`'s strict exports-map resolution (unlike legacy `"main"` resolution, it does not auto-append extensions). Workaround: a targeted alias entry (`{ find: '@wavemaker/variables', replacement: '.yalc/@wavemaker/variables/index.js' }`) in this repo's own rollup config — cannot fix the third-party package itself, and don't spend time trying to.

**Cross-repo companion (ng-codegen `src/wm-utils.js`'s `initExpressionParser()`):** because the rollup output now bundles the *whole* `@wm/runtime/base`/`@wm/core` barrel instead of a narrow extract, it pulls in Angular internals whose constructor `design:paramtypes` metadata references browser-only globals (e.g. `EventManager`'s `Document` parameter) that don't exist in ng-codegen's plain Node process. These values are never actually instantiated there (ng-codegen only calls `new PipeProvider(...)`), so dummy class placeholders for `Document`/`Window`/`Element`/etc. are sufficient to satisfy `emitDecoratorMetadata`'s reference at class-definition time. Same root cause also surfaces `@swipey`'s side-effecting `$.fn.swipeAnimation.expressionEvaluator = $parseExpr` top-level registration line needing a `$.fn.swipeAnimation` stub — **place this stub check outside any `typeof global.$ === 'undefined'` guard**, since `codegen.js`/`pages-util.js` already set `global.$` to real jQuery earlier in the process, so that guard is always false and a stub placed inside it silently never runs (a real bug hit and fixed in this repo — the first attempt nested it wrong).

**Step 6 grep:**

```bash
# Confirm current ng-packagr output shape before assuming per-file esm2022 still exists:
ls libraries/core/esm2022/ 2>/dev/null || echo "per-file esm2022 gone — fesm2022-only, as expected at this ng-packagr version"
ls libraries/core/fesm2022/index.mjs

# After any rollup.build-task.mjs edit, confirm real output size (not a near-empty stub):
ls -la dist/transpilation/*.cjs.js dist/transpilation/*.es.js
```

**Step 6 classification:** `must-change` if `libraries/*/esm2022/<path>.mjs` per-file output is gone and `rollup.build-task.mjs` still references those paths — this is a hard break, not a deprecation. `dist/transpilation/*.cjs.js` under ~1KB after a "successful" rollup run is `must-change` (empty-chunk symptom, #2 above) even though the build exits 0.

### 31. ngx-bootstrap directive `@Input`s converted to signal-based `input()` (any ngx-bootstrap major bump, confirmed at 21)

**This is a real, previously-undocumented class of breaking change** — not covered by R1/R3 (Angular's own changelog doesn't describe third-party library internals) and not caught by any prior pattern-doc entry. ngx-bootstrap 21 converted **every** directive's `@Input()` properties to Angular's signal-based `input()` API throughout the library (confirmed on `BsDropdownDirective` and `TypeaheadDirective`; likely applies to every other directive too — popover, tooltip, datepicker, etc. — check each on first use, don't assume only these two are affected).

**Symptom:** any WM code that imperatively writes to a ngx-bootstrap directive's property from TypeScript (`this.someDirective.someInput = value`, not a template binding) fails to compile:

```text
TS2540: Cannot assign to 'X' because it is a read-only property.
TS2322: Type 'Y' is not assignable to type 'InputSignal<Y>'.
```

**Why:** `input()`-based signal inputs are read-only from outside the directive — there is no public `.set()` on an `InputSignal` (unlike a plain `signal()`'s `WritableSignal`, which does have `.set()`). Angular's compiler writes to them via a private internal mechanism only it can invoke, triggered by template binding evaluation. There is no supported imperative external write path once a directive has switched an `@Input()` to `input()`.

**Two different fix patterns found, depending on what the directive itself exposes — check both before picking one:**

1. **Directive has its own internal "state" service in the same DI scope, and that service still uses a plain writable property (not converted to a signal) as its internal source of truth.** Confirmed for `BsDropdownDirective`: `BsDropdownState.autoClose: boolean` is what the directive's own runtime logic actually reads (the signal is copied into `_state.autoClose` via an internal `effect()` — WM writing there directly achieves the exact same runtime effect). `BsDropdownState` is in `BsDropdownDirective`'s own `providers` array, so it's injectable from a sibling directive/component on the same host element via `@Self() @Optional()`, exactly like the directive itself. Check the directive's own compiled source (`grep 'this\._state\.' node_modules/ngx-bootstrap/<module>/fesm2022/*.mjs`) for this pattern before assuming it doesn't exist.
2. **No such internal state service — but the WM widget's own template already has (or can get) a real `[input]="componentProperty"` binding to that same directive input.** Confirmed for `TypeaheadDirective.typeaheadOptionsLimit`: the widget's `.html` template already had `[typeaheadOptionsLimit]="limit"` — the WM fix is simply to set `this.limit = value` (an ordinary class property) instead of writing to the directive, and let Angular's normal template-binding change detection carry the value into the signal input on the next cycle. Search the widget's own `.html` for an existing `[inputName]="..."` binding before assuming one needs to be added.

**Step 6 grep** (broader than the two confirmed instances — this can recur anywhere a ngx-bootstrap directive is held as a class field and written to):

```bash
# Find candidate imperative writes to any injected/ViewChild'd ngx-bootstrap directive instance:
rg 'this\.(bsDropdown|popover|tooltip|bsDatepicker|typeahead|bsModal|carousel|tabset|accordion|progressbar|rating|bsTimepicker)[A-Za-z]*\.\w+\s*=\s*[^=]' projects/ --include='*.ts' -g '!*.spec.ts'
# For each hit, confirm whether the target property is now `input(...)`-based in the
# installed ngx-bootstrap source before assuming it's still a plain writable property:
grep -n '<propertyName>' node_modules/ngx-bootstrap/<module>/types/*.d.ts
```

**Step 6 classification:** `must-change` — this is a hard compile error, not a deprecation warning; `tsc` will not compile with the assignment left in place.

### 32. Root `AppComponent` renders nothing after bootstrap — bare `setTimeout` no longer reliably triggers change detection (Angular 21, confirmed live at Step 9)

**Severity: build succeeds, app silently renders blank — invisible to every static check (Step 6/7/8), only surfaces in an actual browser (Step 9), and produces zero console errors.** This is exactly the class of bug checklist.md's Verification Principle warns about — do not assume a clean `build.sh -f` means the app works.

**Symptom:** `<app-root>` bootstraps (Angular devtools `ng` global present, `ng-version` attribute set, root component instance exists, `router.navigated: true`, correct URL) but its template renders **nothing** — `document.body.innerHTML` shows only `<app-root><!--container--><!--ng-container--></app-root>`, no actual DOM. No console error, no exception, nothing — the page is just blank.

**Root cause (fully confirmed, RESOLVED — see final verified fix below):** `app.component.ts`'s `start()` method sets `this.startApp = true` (the flag gating the entire template's `@if (startApp) { ... router-outlet ... }` block) inside a bare `setTimeout(() => { this.startApp = true; })` — a pre-existing pattern, deliberately added to dodge a dev-mode-only `ExpressionChangedAfterItHasBeenCheckedError` (comment references an old angular-university.io blog post). This relies on zone.js's patched `setTimeout` automatically triggering Angular's change detection once the callback completes — which has reliably worked across every prior Angular major in this codebase's history. **At Angular 21 it does not fire reliably for this call site.**

**Ruled out: Angular 21 zoneless-by-default.** Angular 21 does make zoneless the default for *new* applications, which made this look like a prime suspect. Directly verified against the installed `@angular/core@21.2.23` source and ruled it out: (1) `projects/runtime-dynamic/src/polyfills.ts` still does `import 'zone.js';`, so zone.js is loaded and patching `setTimeout`; (2) `app.config.ts` calls `provideZoneChangeDetection({eventCoalescing: true, runCoalescing: true})`, and reading `provideZoneChangeDetection`'s implementation in `node_modules/@angular/core/fesm2022/core.mjs` shows it explicitly provides `{provide: ZONELESS_ENABLED, useValue: false}` — WM's app is definitively zone-based, not zoneless, at Angular 21. This was a dead end; don't re-investigate it for this repo.

**Actual mechanism (confirmed by reading `ChangeDetectionSchedulerImpl`/`NgZoneChangeDetectionScheduler` in `node_modules/@angular/core/fesm2022/_debug_node-chunk.mjs` + `core.mjs`, not just inferred):** zone-triggered automatic CD (`zone.onMicrotaskEmpty` → `appRef.dirtyFlags |= 1; appRef._tick()`) does still run a full, non-OnPush-gated top-down refresh (`useGlobalCheck` mode) when it fires. Critically, **`ApplicationRef.tickImpl()`'s dev-mode `checkNoChanges` loop runs *after* `synchronize()` has already applied the real DOM update** — it's a diagnostic-only second pass, not a gate. So an `NG0100` being thrown (and it now is, repeatedly, in dev-mode console — see below) does **not**, by itself, mean the DOM failed to update. The actual failure mode is upstream of that: the automatic zone-triggered tick simply isn't being scheduled at all for these specific flag writes (confirmed by reading `comp.startApp`/`comp.showPageContent`/`comp.compilePageContent` directly off the live component instance — `true`, but DOM unchanged — and confirming an explicit, targeted `ChangeDetectorRef.detectChanges()` fixes it immediately with no dev/prod difference). The precise "why doesn't the automatic tick fire for this call site" was not fully pinned down mechanistically (candidate: these flag writes happen inside Promise chains built on `ScriptLoaderService`/similar service calls that may run outside `NgZone` via `runOutsideAngular`, meaning zone.js's patched Promise machinery never sees the write as inside the zone) — **not worth chasing further; the fix is verified correct and stable in both dev and prod builds (see Step 9 evidence below), regardless of the exact scheduler-internals explanation.**

**Fix — FINAL, verified working (supersedes the two-iteration `tick()`-based history below, which is kept only as a record of what NOT to do):** inject `ChangeDetectorRef` and call `this.cdr.detectChanges()` immediately after the flag write, in the *same* task (no extra `setTimeout` nesting needed) — `detectChanges()` is scoped to just that component's view and does **not** run the dev-mode `checkNoChanges` verification pass, so it renders cleanly with no `NG0100`:
```typescript
setTimeout(() => {
    this.startApp = true;
    this.cdr.detectChanges();
});
```

**Two earlier failed iterations (history — do not repeat):**
1. **First attempt (wrong):** call `this.ngZone.run(() => this._appRef.tick())` immediately after the flag write, inside the same `setTimeout` callback. Throws `NG0100` (`Previous value: '-1'. Current value: '0'`) — this is `@if`'s first-ever branch activation (-1 → 0), which always looks like a change between `synchronize()` and the immediately-following `checkNoChanges` pass when both happen in the same task as the triggering write.
2. **Second attempt (also wrong — worked for `AppComponent` alone, did not fix nested content, superseded):** nest a second `setTimeout` around `ngZone.run(() => appRef.tick())` for task separation. Stopped `AppComponent`'s own blank-render symptom but is a **global, expensive, error-prone tick of the entire app** compared to `detectChanges()` scoped to one component — abandoned once `detectChanges()` was found to work with less blast radius and no `NG0100` at all.

**Step 9 check:** don't trust a fix for this class of bug from source review alone — reproduce the exact symptom in a live browser (`document.body.innerText.length` / `document.body.innerHTML.length` before/after, or the devtools `ng.getRootComponents()` technique) both before *and after* applying a fix, in **both dev and production builds** — this bug affected both identically, so a dev-only check is not sufficient evidence of a full fix.

**Step 6 classification:** `must-change` once confirmed live (was invisible until Step 9) — this exact case, `likely-breakage` generically wherever the same bare-`setTimeout`/Promise-`.then()`-property-write pattern appears elsewhere, pending Step 9 confirmation each time.

**Confirmed systemic — SEVEN independent instances found and fixed this hop, not just one:**
1. `app.component.ts` `start()` — `this.startApp = true` (setTimeout). Fixed with `cdr.detectChanges()`.
2. `base-page.component.ts` `initVariables()` — `this.showPageContent = true` (setTimeout, 100ms). Fixed with `cdr.detectChanges()`.
3. `base-spa-page.component.ts` `initVariables()` — `this.showPageContent = true` (setTimeout, 100ms). Fixed with `cdr.detectChanges()`.
4. **`base-page.component.ts` AND `base-spa-page.component.ts` `ngAfterViewInit()` — `(this as any).compilePageContent = true` inside a `Promise.then()` chain (`this.loadScripts().then(() => this.runPageTransition().then(() => { (this as any).compilePageContent = true; ... })))`), with *no* setTimeout at all.** This is the one that mattered most and took the longest to find: `compilePageContent` gates the **top-level `@if (compilePageContent) { ... }` block that wraps the entire transpiled page template** (see `projects/components/transpile/src/page/page.build.ts:48` and `page-content/page-content.build.ts:18` — every generated page's `.component.html` is wrapped in this). Even after fixes #1–#3 above, the app rendered its full shell (header, left-nav, right-panel — confirmed via `document.querySelector('app-root').innerHTML`, ~5100 chars) but the actual page content div (`<div wmpagecontent ...>`) stayed empty (`<!----><!---->`, two un-activated `@if`/`@for` comment placeholders) in **both dev and production Tomcat deployments** — `document.body.innerText.length` stayed at 7 (whitespace only). Fixed identically: `this.cdr.detectChanges()` right after the `compilePageContent = true` assignment, in both files. **This is why the earlier `setTimeout`-only repo-wide scan (below) missed it — it's a `Promise.then()` chain, not a `setTimeout`, and the scan's regex only matched `setTimeout(...)` blocks.**
5. **`app.component.ts`'s spinner-visibility subscription** (a few lines above `start()`, `this.spinnerService.getMessageSource().asObservable().subscribe((data) => { setTimeout(() => { this.spinner.show = data.show; ... }); })`) — found by an actual interaction test (clicking a table "New" button), not source review: the click landed on `<div.app-spinner.global-spinner>` instead of the button, because the global spinner's `show` flag flipped to `false` internally but the DOM never updated to hide it, silently blocking **all clicks anywhere on the page**. This instance's RHS is `data.show` (a variable), not a literal `true`/`false`, so **neither** scan regex below (original or `.then()`-updated) would have caught it — found only through actual click-testing, not any static/regex scan. Fixed with `cdr.detectChanges()`.
6. **`base-partial.component.ts` `ngAfterViewInit()`** — `this.compileContent = true` inside `this.loadScripts().then(() => { ... })`, no setTimeout. Gates the top-level `@if (compileContent) { ... }` wrapping every partial's template (header/footer/leftnav/topnav/rightpanel — see `projects/components/transpile/src/partial/partial.build.ts:14`). Confirmed live: `<app-partial-header><section wmpartial ...><!----><!----></section></app-partial-header>` — partial shells present, inner content empty. `BasePartialComponent` had no `ChangeDetectorRef` field at all before this fix — added it via the file's existing `this.injector ? this.injector.get(X) : inject(X)` DI pattern in `init()`, same as `cdr` in base-page/base-spa-page.
7. **`base-prefab.component.ts` `ngAfterViewChecked()`** — same pattern, `this.compileContent = true` inside `this.loadScripts().then(() => { ... })`, gates `@if (compileContent)` for prefabs (`projects/components/transpile/src/prefab/prefab-container/prefab-container.build.ts:16`). Same fix: added `cdr` field, call `detectChanges()` right after the flag write.

**Step 9 evidence (both dev and prod, Tomcat, NestedWidgets project, `/Main` page):** before fix #4, `document.body.innerText.length` was `7` in both dev and prod builds (74 DOM elements — shell only). After fixes #1–4 (full pipeline rebuild: ng-runtime → yalc push → ng-codegen build → regenerate app → npm i → re-apply `.yalc/@wavemaker/variables` package.json fix → build dev/prod → deploy to Tomcat): `document.body.innerText.length` = `2674`, `1441` DOM elements, real content visible (pie chart with percentages, line chart, nav labels, header) in **both** dev and prod — confirmed via screenshot. Dev-mode console still showed repeated `NG0100` (confirmed non-blocking, see "actual mechanism" note above); prod build showed zero `NG0100`. **Then, interaction-testing (not just load/render checks) surfaced fix #5**: clicking a Department table's "New" button failed with "Element is covered by `<div.app-spinner.global-spinner>`" — the stuck spinner blocked every click on the page despite the page content itself rendering correctly. After fixes #5–7 and a second full pipeline rebuild: `document.body.innerText.length` = `2806` (dev) / `3331` (prod), spinner correctly hidden (`document.querySelector('.app-spinner.global-spinner')` → `null`), and the "New" button click now correctly opens its modal (`.modal.show` present, screenshot-confirmed) in **both** dev and prod. **Lesson: static/regex scans and load-only checks (`document.body.innerText.length`) are necessary but not sufficient for this bug class — an actual click-through interaction test found a live-blocking instance (#5) that no source-level scan could have caught, since its flag write isn't a boolean literal.**

**Lower-severity instances found via a repo-wide scan, not yet fixed or confirmed broken — treat as `needs-review`, not `must-change`, until Step 9 evidence (including actual click/interaction testing, not just load checks — see fix #5's lesson above) says otherwise:** a Python/regex scan for `setTimeout(() => { ... this.\w+ = true|false ... })` blocks with no `detectChanges`/`tick`/`markForCheck` call anywhere in the block found several more, all controlling narrower widget-level UI state rather than gating an entire template's content — lower blast radius if still broken, and not worth blanket-patching without evidence (risks scattering unnecessary `detectChanges()` calls that could themselves cause performance issues or new dev-mode NG0100s elsewhere):
- `projects/components/base/src/widgets/common/pull-to-refresh/pull-to-refresh.ts:124` — `runAnimation`/`animationInProgress`
- `projects/components/widgets/input/epoch/date/src/date.component.ts:273` — `isOpen`
- `projects/components/widgets/navigation/popover/src/popover.component.ts:172` — `isHandlingClick`
- `projects/components/widgets/containers/tabs/src/tab-pane/tab-pane.component.ts:117` — `_isOnLoadTriggered`
- `projects/components/widgets/containers/accordion/src/accordion-pane/accordion-pane.component.ts:116` — `_isOnLoadTriggered`
- `projects/components/widgets/data/table/src/table.component.ts:658` — `_isInlineEditSave`

**A broadened scan (any `this.foo = ...;` / `this.foo.bar = ...;` assignment, not just boolean literals — run after fix #5 showed the boolean-literal-only regex has a real blind spot) turned up ~30 more hits** across `base-partial.component.ts`, `base-prefab.component.ts` (both now fixed, #6/#7 above), `i18n.service.ts`, `security-config.resolve.ts`, and a long tail of widget-level components (select, chips, date/time pickers, pagination, form-field, table, list, carousel). **Do not blanket-fix these** — the broadened regex has many false positives (properties never bound in any template, e.g. `pageTransitionCompleted` in base-page/base-spa-page, confirmed via `grep` finding zero template references). Each hit needs the same two-step verification used for #5–7: (1) confirm the property is actually referenced in a `.html` template behind an `@if`/interpolation, (2) reproduce the actual symptom live (blank content or, per #5, a blocked interaction) before fixing — don't fix speculatively.

**Scan command used — UPDATED to also catch `Promise.then()`/`.subscribe()` chains and non-literal RHS assignments, not just `setTimeout` + boolean literals (the original version missed both #4, a `.then()` chain, and #5, a non-literal RHS; rerun this expanded version at Step 6 for future hops, then manually verify each hit against its template before fixing):**
```python
import re, glob
# Original setTimeout-only, boolean-literal-only pattern — kept for continuity, insufficient alone:
block_pattern = re.compile(r'setTimeout\(\(\)\s*=>\s*\{(.*?)\}\s*(?:,\s*\d+\s*)?\)', re.DOTALL)
# Added: bare .then(() => { ... }) chains — missed §32's #4 (compilePageContent).
then_pattern = re.compile(r'\.then\(\(\)\s*=>\s*\{(.*?)\}\)', re.DOTALL)
# Added: .subscribe((data) => { ... }) chains — same class of hazard as #5 (spinner).
subscribe_pattern = re.compile(r'\.subscribe\(\([^)]*\)\s*=>\s*\{(.*?)\n\s*\}\);', re.DOTALL)
# Broadened flag_pattern (any assignment, not just `= true|false`) catches #5's `data.show` —
# expect many more matches and more false positives; verify each against its template, don't
# blanket-fix. The literal-only version is kept commented for the narrower, higher-confidence pass.
# flag_pattern = re.compile(r'this\.(\w+)\s*=\s*(true|false)\s*;')
flag_pattern = re.compile(r'this\.[\w.]+\s*=\s*[^=][^;]*;')
cd_pattern = re.compile(r'detectChanges|markForCheck|appRef\.tick|_appRef\.tick|cdr\.')
seen = set()
for f in glob.glob('projects/**/*.ts', recursive=True):
    if 'spec' in f: continue
    content = open(f).read()
    for pattern in (block_pattern, then_pattern, subscribe_pattern):
        for m in pattern.finditer(content):
            body = m.group(1)
            if flag_pattern.search(body) and not cd_pattern.search(body):
                key = (f, content[:m.start()].count(chr(10)) + 1)
                if key not in seen:
                    seen.add(key)
                    print(*key)
```

### 33. Angular 22 removed `Compiler.compileModuleAndAllComponentsSync()` and the `ComponentFactory`-based `createComponent()` overload

**First required:** Angular 22 (21→22 hop on `stage-classic`). **Severity: build-breaking, and it breaks the single most load-bearing path in this runtime** — every page, partial, prefab and custom widget is created through it.

**Not found by R1/R3 research or by the other branch's `docs/22-upgrade.md`** — found only by reading the installed `@angular/core@22.2.0` types directly after a build failure. Treat this as the canonical example of why the Verification Principle exists.

**What was removed (verify both against the installed `.d.ts`, don't assume):**

| Removed | How to confirm |
|---|---|
| `Compiler.compileModuleAndAllComponentsSync()` | `grep -rn "compileModuleAndAllComponentsSync" node_modules/@angular/core/types/` → zero hits at 22.2.0 (still present at 21.2.23) |
| `ViewContainerRef.createComponent(factory, index, injector)` (positional/factory overload) | `grep -n -A15 "class ViewContainerRef" node_modules/@angular/core/types/core.d.ts` → only `createComponent<C>(componentType: Type<C>, options?: {index?, injector?, ngModuleRef?, environmentInjector?, projectableNodes?, directives?, bindings?, onError?})` remains |
| `ComponentFactoryResolver` | `grep -rn "ComponentFactoryResolver" node_modules/@angular/core/types/` → zero hits |

`Compiler` itself is **not** removed — only those methods. An unused `private compiler: Compiler` injection still compiles fine (this repo has one in `pipe-provider.service.ts`); leave it alone unless it actually calls a removed method.

**The old WM pipeline (all of it gone):** `getDynamicComponent()` built a component class via `Component({...})(class X{})` → `getDynamicModule()` wrapped it in a runtime `NgModule({declarations:[X], imports:[...], providers:[...]})` → `compiler.compileModuleAndAllComponentsSync(moduleDef).componentFactories.filter(f => f.componentType === X)[0]` produced a `ComponentFactory` → `vcRef.createComponent(factory, 0, injector)`.

**Fix — make the dynamic components standalone and drop the NgModule/Compiler step entirely:**

1. `getDynamicComponent()` already returned a component **class** (a decorator call returns the class). That class is exactly what the new `createComponent(Type, options)` API wants — the whole NgModule-compilation detour existed only to manufacture a `ComponentFactory`.
2. Move the wrapping NgModule's `imports` / `providers` / `schemas` **directly onto the `Component({...})` call** and add `standalone: true`. A standalone component's own `imports` accepts standalone components/directives **and** legacy `NgModule`s (`CommonModule`, `FormsModule`, `ReactiveFormsModule`, …) — supported since Angular 14, so the existing arrays move across unchanged.
3. Delete `getDynamicModule()` and the `Compiler` injection.
4. Convert every call site: `createComponent(x, 0, inj)` → `createComponent(x, { index: 0, injector: inj })`.

**Files changed in this repo (8):** producers `runtime-base/src/services/dynamic-component-ref-provider.service.ts`, `runtime-dynamic/src/app/services/component-ref-provider.service.ts`; consumers `prefab.directive.ts`, `partial-container.directive.ts`, `custom-widget-container.directive.ts`, `form.component.ts`, `table.component.ts`, `page-wrapper.component.ts`.

**Gotchas:**
- The variable name `componentFactoryRef` now holds a **class**, not a factory. Renaming it touches many files for no functional gain — this run kept the name and documented it at both producer sites. Expect the name to mislead; read the comment.
- In `component-ref-provider.service.ts` the `Component({...})` call spreads `...componentDef`. Check that `componentDef` does not itself set `changeDetection` before relying on a `changeDetection` key placed above the spread (here it does not — verified).
- `@NgModule`/`@Component` built by *calling* the decorator (rather than decorator syntax) is invisible to AOT's static checks — that is why NG6008 ("standalone component in `declarations`") never fired on the old code despite it being exactly that shape.

**Step 6 grep:**

```bash
grep -rn "compileModuleAndAllComponentsSync" projects/
grep -rn "createComponent([a-zA-Z_]*, [0-9]" projects/ --include="*.ts"   # positional overload
grep -rn "ComponentFactoryResolver" projects/ --include="*.ts"
```

Note the second grep must not assume a variable name — this repo used `componentFactory`, `componentFactoryRef` **and** `pageComponentFactoryRef`; a name-specific grep missed the third one until a later sweep.

**Step 6 classification:** `must-change` — hard build failure, and the failure cascades (one library failing to emit produces a flood of misleading `TS2307: Cannot find module '@wm/...'` errors in every downstream project; always find the *first* failing entry point in the build log rather than chasing the cascade).

### 34. Angular 22's OnPush-by-default also breaks inline test-harness components in `*.spec.ts` (§27a's blind spot)

**First required:** Angular 22. **Only surfaces in `npm test` (Step 8)** — `build.sh -f` passes completely clean.

§27a pins `changeDetection: ChangeDetectionStrategy.Eager` on every `@Component()` in **source** (`*.component.ts`). It does not touch the inline "wrapper" harness components declared inside `*.spec.ts` files — which at Angular 22 silently become **OnPush**.

**Symptom:** a large block of widget specs fail with assertions that look unrelated to change detection:

```text
expect(received).toBe(expected)
Expected: "updated aria-label"     ← set imperatively, then fixture.detectChanges()
Received: "Switch button"          ← DOM never re-rendered

TypeError: Cannot read properties of null (reading 'click')
      fixture.nativeElement.querySelector('a[name="..."]').click();   ← element never rendered
```

Both come from the same cause: the host wrapper is OnPush and was never marked dirty, so `fixture.detectChanges()` does not re-render its template — and the widget's bindings live in *that* template.

In this repo: **23 of 126 suites / 60 tests** failed this way; the fix took it to **2 suites / 5 tests**.

**This is the exact same category as [§29](#29-standalone-by-default-breaks-inline-test-harness-componentspipes-angular-19)** — an Angular default flip that affects inline spec-file harness classes which the main source sweep structurally cannot reach. It hit the **same 80 files** §29 did. When a future major flips another `@Component` default, check `*.spec.ts` in the same pass as the source sweep.

**Fix:** apply §27a's pin to inline spec components too — add `ChangeDetectionStrategy` to the file's `@angular/core` import and `changeDetection: ChangeDetectionStrategy.Eager,` to each inline `@Component({`. 80 files / 88 decorators here. Reuse §32's script shape, but glob `*.spec.ts`, and insert into **every** `@Component({` match per file (8 files here declare two harness components).

**Verify you did not break passing specs:** after a mass spec edit, run a sample of suites that were *already* passing, not only the ones that were failing.

**Step 6/8 classification:** `must-change`, but invisible until Step 8 — do not treat a clean Step 7 as evidence this is clear.

### 35. ngx-bootstrap 22 removed the internal `_ngZone` field its directives exposed

**First required:** ngx-bootstrap 22 (not an Angular-version gate). Same hazard family as §12/§26/§31: WM reaching into a third party's private internals.

`grep -c "_ngZone" node_modules/ngx-bootstrap/popover/fesm2022/ngx-bootstrap-popover.mjs` → **0** at 22.0.0. Two places depended on it:

| Location | Old code | Fix |
|---|---|---|
| `popover.component.ts` | `this.bsPopoverDirective._popover._ngZone.onStable.subscribe(...)` | inject `NgZone` in the constructor, use `this.ngZone.onStable` |
| `core/src/utils/utils.ts` — `adjustContainerPosition`, `adjustContainerRightEdges`, `adjustVerticalPosition` | `const zoneRef = ref._ngZone \|\| ref.ngZone;` where `ref` is a library directive's internal scope | fall back to the app-level zone via a new `getNgZone()` accessor (`watcher.ts`, exported from `core/public_api.ts`), and apply the positioning immediately when no zone exists at all |

**Symptom:** `TypeError: Cannot read properties of undefined (reading 'onStable')`, logged during `ngOnDestroy` (`executeOnDestroys` in the stack) — it reads as a teardown bug but is really the positioning helper failing.

**Other ngx-bootstrap internals WM reaches into were re-verified present at 22.0.0** — `_popover`, `_dropdown`, `_container`, `_typeahead` all still exist. Only `_ngZone` went. Check each one individually on every ngx-bootstrap major; do not assume a whole family of internals survived or died together.

**When you change a component to stop using a private internal, update its spec too** — `popover.wrapper.component.spec.ts` mocked `{ _popover: { _ngZone: mockNgZone } }` and had to be repointed at the injected zone.

**Step 6 grep:**

```bash
grep -rn "bsPopoverDirective\._\|bsDropdown\._\|typeahead\._\|\._popover\b\|\._dropdown\b" projects/ --include="*.ts" | grep -v "\.spec\.ts"
# then confirm each internal still exists in the installed bundle:
grep -c "_ngZone" node_modules/ngx-bootstrap/<module>/fesm2022/*.mjs
```

### 36. Third-party dependency `ngx-toastr` — removed `ComponentFactoryResolver` usage AND changed `Toast`/`ToastBase`'s constructor + signal-based fields (Angular 22)

**First required:** Angular 22. **Severity: hard build failure** — a Rollup module-resolution error (`Could not resolve entry module "./libraries/runtime/base/fesm2022/index.mjs"`) that cascades into misleading `TS2307: Cannot find module '@wm/runtime/base'` errors everywhere downstream, exactly like §33's cascade pattern. The real error is upstream of all of that; always find the first failure, not the cascade.

**Part 1 — `ngx-toastr@19.0.0` (the version already pinned in this repo) imports the removed `ComponentFactoryResolver`:**

```text
RollupError: node_modules/ngx-toastr/fesm2022/ngx-toastr.mjs (2:56):
"ComponentFactoryResolver" is not exported by "node_modules/@angular/core/fesm2022/core.mjs"
```

Confirmed **actively used**, not dead code (unlike WM's own 3 instances in §33) — `ngx-toastr.mjs` calls `this._componentFactoryResolver.resolveComponentFactory(portal.component)` to render toast content. Not something to patch out.

**Fix: bump `ngx-toastr` to `20.0.5` (latest).** Confirmed by downloading the tarball (`npm pack ngx-toastr@20.0.5`) and grepping its `fesm2022/ngx-toastr.mjs` — only a stale doc-comment mentions `ComponentFactoryResolver` now, the actual import/usage is gone. **Note ngx-toastr's own declared `peerDependencies` still say `"@angular/core": "^21.0.0"` — one major behind its actual compiled output** — don't trust the declared peer range over the real installed source for this package; verify the actual `.mjs`, same as every other API-removal check in this doc.

**Part 2 — the version bump itself changed `Toast`/`ToastBase`'s public API, breaking WM's own subclass (`custom-toaster.component.ts`):**

1. **Constructor signature:** `ToastBase`'s constructor now takes **zero** arguments (`ctorParameters: () => []`) — `toastPackage`/`toastrService`/`appRef`/`timeoutsService` are now `inject()`-ed as base-class fields, not constructor params. A subclass whose own constructor still does `constructor(protected toastrService: ToastrService, public toastPackage: ToastPackage) { super(toastrService, toastPackage); ... }` gets `TS2554: Expected 0 arguments, but got 2`. **Fix:** drop the params entirely, `super()` with no args — the inherited fields are still accessible via `this.toastPackage`/`this.toastrService`, redeclaring them as constructor params would shadow the base class's own fields, not restore anything.
2. **`message`/`options`/`title` are now Signals**, not plain properties: `message = computed(() => this.toastPackage.message)`, `options = linkedSignal(() => this.toastPackage.config)`. Any subclass code reading `this.message` or `this.options.someProp` now gets the **signal function itself** (always truthy, no `.someProp`), not the underlying value — a silent behavioral bug, not a compile error (TS doesn't flag `if (this.message)` as wrong when `message` is callable). **Fix:** call them — `this.message()`, `this.options().someProp`. **This class of bug does not show up as a build error at all** — grep every subclass for property reads (not calls) on `message`/`title`/`options`/`width`/`state`/`displayStyle`/`toastClasses`/`originalTimeout` after any `ngx-toastr` bump, since the compiler won't catch a stale non-call reference through an `any`-cast the way this file's `(<any>this.options)` cast did.

**`ToastNoAnimationModule.forRoot()` (used in `app.config.ts` and `app.module.ts`) is unaffected** — confirmed present, unchanged, in the 20.0.5 source; don't assume every `.forRoot()` in an upgraded dependency needs the ngx-bootstrap-style removal treatment (§8b) without checking each package individually.

**Step 6 grep:**

```bash
# After any ngx-toastr bump, confirm no other subclass exists (currently just 1):
grep -rn "extends Toast\b" projects/ --include="*.ts"
# For any found, check every this.<field> read against ToastBase's actual current field list
# (inject()-based vs signal-based) in the installed node_modules/ngx-toastr/fesm2022/ngx-toastr.mjs
# — a stale peerDependencies range on the npm registry is not evidence either way.
```

**Step 6 classification:** `must-change` — Part 1 blocks the build entirely; Part 2's constructor mismatch also blocks the build (`TS2554`), but the signal-property-read issue is a **silent runtime bug with zero compile signal** — treat any third-party dependency bump that touches a class WM subclasses as `needs-review` for its base class's *field* shape changing, not just its constructor/method signatures.

---

### 37. `projects/*/package.json` peer dependencies still declare the old Angular major (every major)

**First required:** every Angular major. **Severity: silent** — no build error, no test failure. Found only by a manual manifest grep after four hops (18→19→20→21→22) had all left `"@angular/core": "^18.2.13"` in place.

Distinct from [§22](../checklist.md#22-yalc-linked-package-peer-dependency-mismatch): §22 covers packages this repo **consumes** (`.yalc/*`). This section covers the libraries this repo **publishes** (`projects/*/package.json`) — their `peerDependencies` are what npm consumers see, so a stale range makes consumers on the new Angular major get peer-dependency warnings or install conflicts.

**Symptom:** none locally. Consumers see `ERESOLVE`/unmet-peer warnings for `@angular/core`/`@angular/common`/`@angular/compiler` against a `@wavemaker/*` library.

**Fix:** set every `@angular/*` entry in each `projects/*/package.json` `peerDependencies` to `^<target major>.0.0` (Step 3, alongside the root `package.json` bump).

**Step 6 grep:**

```bash
# Any projects/*/package.json @angular/* peer range not on the target major:
git ls-files 'projects/*/package.json' | xargs grep -n '"@angular/[a-z-]*": "\^[0-9]' | grep -v '"\^<TARGET>\.'
```

**Automated:** `pattern-review.sh` §37 FAILs on any stale range.

**Step 6 classification:** `must-change`.

---

### 38. Angular private chunks inlined into a second UMD entry → duplicate DI tokens (NG0200 for `RendererFactory2`, Preview only)

**First required:** Angular 22 in this repo (private `_*-chunk.mjs` files exist in earlier majors too — re-check every major). **Severity: blocks Preview bootstrap entirely; deployment (Tomcat) mode is unaffected** because generated apps use their own webpack build, not the rollup UMD libs (`wm-libs.js`).

**Symptom (Preview, blank page):**

```text
NG0200: Circular dependency detected for `RendererFactory2`. Source: Environment Injector
```

Prod mode strips the token — in the preview tab run `debugMode(true)` (reloads with `enableProdMode()` skipped) to see the token name.

**Cause:** `config/rollup.ng-libs.config.mjs` builds each Angular entry as its own UMD. Angular 22's `platform-browser/animations.mjs` imports `DomRendererFactory2` from `./_dom_renderer-chunk.mjs` and `BrowserModule` from `./_browser-chunk.mjs` — *relative* private chunks, not the `@angular/platform-browser` package, so the `external` list does not cover them and rollup inlines a second copy. `ng.platformBrowser.animations` then carries its own `DomRendererFactory2`/`BrowserModule`/`BROWSER_MODULE_PROVIDERS`; `provideAnimations()` injects that copy's `DomRendererFactory2`, which `WMDomRendererFactory2` (provided for `ng.platformBrowser`'s token) does not override.

**Diagnosis without rebuilding** (Preview tab console; globals are `ng.*`/`wm.*`): build an injector with the stock platform-browser providers + `ng.platformBrowser.animations.provideAnimations()` and `get(RendererFactory2)` — it fails with `No provider found for DomRendererFactory2` even though the stock providers include it, proving two distinct token classes.

**Fix (as on `feature/angular-22-upgrade`, already reviewed):** in `runtime-dynamic/src/app/app.config.ts`, after `provideAnimations()`, add `{ provide: RendererFactory2, useClass: WMDomRendererFactory2 }` (import `RendererFactory2` from `@angular/core`, `WMDomRendererFactory2` from `@wm/runtime/base`). This binds the WM renderer straight to the shared `RendererFactory2` token, so it no longer matters that the animations UMD carries its own `DomRendererFactory2` copy. Side effect: it replaces the animation renderer that `provideAnimations()` installs, so Angular `@trigger` animations do not run in Preview — acceptable here, matches the reference branch.

**Alternative not used:** a rollup plugin on the `platform-browser/animations` entry that routes its `_dom_renderer-chunk`/`_browser-chunk` imports to the public `ng.platformBrowser` exports removes the duplicate at the source and keeps animations, but is not what the reviewed branch ships.

**Same class of risk, NOT fixed (verify next hop):** other entries import relative chunks too — `animations` + `animations/browser` (`_private_export-chunk`), `core` + `primitives/signals` (`_effect-chunk`, `_weak_ref-chunk`) + `primitives/di` (`_not_found-chunk`), `common` chunks. Any state or token duplicated across two UMDs can misbehave silently.

**Step 6 check:**

```bash
grep -n 'provide: RendererFactory2' projects/runtime-dynamic/src/app/app.config.ts   # must exist, after provideAnimations()
```

**Step 6 classification:** `must-change` (Preview only — deployment mode will not show it; validate Preview).

**Related (same Preview-only UMD family) — `@angular/core/rxjs-interop` needs its own UMD global.** ngx-bootstrap 22's positioning code imports `takeUntilDestroyed` from `@angular/core/rxjs-interop`. With no `ng.core.rxjsInterop` global, rollup guessed `rxjsInterop` (undefined at runtime) → Preview: `TypeError: Cannot read properties of undefined (reading 'takeUntilDestroyed')` in `new PositioningService`. Fix (ported from `feature/angular-22-upgrade`): UMD entry `core-rxjs-interop.umd.js` in `rollup.ng-libs.config.mjs`, `'@angular/core/rxjs-interop': 'ng.core.rxjsInterop'` in `rollupGlobals` + `rollupExternals` (`rollup-utils.mjs`), and the bundle in `build.sh`'s `bundleJS` concat list right after `core.umd.js`. Caveat: that entry inlines Angular's private core chunks (§38's risk class) — fine for `takeUntilDestroyed(destroyRef)` with an explicit `DestroyRef` (only calls `onDestroy`), but do not rely on `toSignal`/`rxResource` from this UMD.
