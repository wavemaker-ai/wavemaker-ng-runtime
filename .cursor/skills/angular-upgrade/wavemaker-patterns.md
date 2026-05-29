# WaveMaker patterns (wavemaker-ng-runtime)

**Repository-specific pattern catalog** for Step 6 and the Step 8 preview checklist. The generic workflow is in `SKILL.md`; commands are in `repo.config.sh` (`PATTERNS_FILE` points here).

When copying this skill to another repo, add that repo’s own `*-patterns.md` and set `PATTERNS_FILE` in `repo.config.sh` — do not duplicate this file under a second name.

Below: **this repo’s** catalog. Use during **Step 6** (after Step 5). Classify findings into `safe`, `needs-review`, `likely-breakage`, or `must-change`. Stop on unresolved `must-change`.

**WMS-29275 (Angular 18 → 20):** Sections marked with commit refs below come from that upgrade branch. Re-check them on every major bump — ngx-bootstrap modal APIs and patch regexes drift between v20 and v21+.

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
| Dynamic components | `projects/runtime-base/src/services/dynamic-component-ref-provider.service.ts`, `component-ref-provider.service.ts`, `createComponent`, `environmentInjector`, `attachView` |
| RouterOutlet monkey-patch | `overrideRouterOutlet`, `@ViewChild(RouterOutlet)`, `routerOutlet.attach`, `router-outlet` inside `@if` |
| Runtime bootstrap | `projects/runtime-dynamic/src/app/app.config.ts`, `APP_INITIALIZER`, `HttpCallInterceptor`, `LOCALE_ID` factory, `src/main.ts` |
| Custom DOM renderer | `projects/runtime-base/src/overrides/wm_dom_renderer.ts`, `wm_shared_styles_host.ts`, `WMDomRendererFactory2`, `RendererFactory2`, `ɵSharedStylesHost` |
| Page params timing | `base-page.component.ts`, `base-spa-page.component.ts`, `route.snapshot.queryParams` |
| ngx-bootstrap patch verify | `build-scripts/ngx-bootstrap-patch.mjs`, post-build grep on `wm-libs.js` / `ngx-bootstrap.bundle.js` (see §6 and §12) |
| Transpiler / parser | `projects/transpiler/src/build.ts` (`createCompilerElement`), `parseBinding`, `@if`, `@for`, `ng-container` |
| ngx-bootstrap | `ngx-bootstrap`, `build-scripts/ngx-bootstrap-patch.mjs`, widget `*.component.ts` under `popover`, `dropdown`, `epoch`, `dialogs` |
| List / table embedded views | `list.component.html`, `table.component.ts`, `createEmbeddedView`, `createCustomInjector`, `ngTemplateOutletContext` |
| Template `this.` refs | `rg 'this\.appLocale|this\._triggeredByUser' projects/components/widgets` |
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

**Current repo:** dynamic path uses standalone `Component({ standalone: true, imports: [...] })` in `dynamic-component-ref-provider.service.ts`. Grep should find **zero** legacy compiler calls. Remove deprecated `wm-view` transpiler registration (`a2062ecf8`).

### 2. Standalone dynamic component creation

- `createComponent(...)` **without** `environmentInjector`
- Positional `createComponent(factory, index, injector)` — removed in Angular 17+; must use object syntax
- Standalone component missing `imports` for directives/components used in runtime-transpiled markup
- `ComponentFactoryResolver` / `resolveComponentFactory` still used for partials, prefabs, custom widgets, dynamic tables

**Risk:** `NG0201`, unknown elements, “directive not initialized” in wizard/tabs/accordion/table row expand.

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

- `Parser.parseBinding()` with outdated location arguments
- Internal `@angular/compiler` APIs with changed signatures
- Synthetic `Element` / AST construction with old shapes
- Duplicated `createElement` helpers in `*.build.ts` with wrong `Element` arity

**Risk:** parse failures on generated bindings and expressions; build-time AST construction throws.

**Angular 20 `Element` constructor (WMS-29275: `46917e48c`):** requires **9 arguments**. Centralize in `projects/transpiler/src/build.ts` as `createCompilerElement(name)` and remove per-file copies under `projects/components/transpile/src/**/**.build.ts`.

**Search:** `projects/transpiler/src/build.ts`, `projects/transpiler/src/`, `projects/core/src/utils/utils.ts`.

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

**ngx-bootstrap 20 modal events (WMS-29275: `bfb1f5bb4`):** v20 removed global `BsModalService.onShown` / `onHidden` in some builds — `BaseDialog` must invoke open/close callbacks manually on the modal ref. **Re-verify on ngx-bootstrap 21+** — upstream may restore global emitters; grep `base-dialog.ts` for `onShown.subscribe` vs manual `setTimeout` callbacks.

**ngx-bootstrap 21+:** most modules **removed `forRoot()`** — use bare modules in `importProvidersFrom` / `NgModule.imports` and `ToastNoAnimationModule.forRoot()` only where still supported. Grep `projects/` for `.forRoot()` on ngx-bootstrap imports (including `*.spec.ts` if Step 9 runs).

**Angular 21 `@HostListener`:** one **static** event name per decorator (`keydown.enter`, `keydown.arrowup`); do not combine multiple keys in one decorator. Pass `$event` in the method signature (`['$event']` is fine when the event name is static). See checkbox/menu widgets.

**Dropdown positioning helpers:** `adjustContainerPosition` / `adjustContainerRightEdges` in `projects/core/src/utils/utils.ts` must tolerate ngx-bootstrap refs without `ngZone` (use `runAfterStable` fallback when `onStable` is unavailable).

**Risk:** overlay, focus trap, date/time, popover, typeahead, modal regressions after ngx-bootstrap major bumps.

**After ngx-bootstrap upgrade (required, every step that touches ngx-bootstrap):**

1. Extend `PATCHES` in `build-scripts/ngx-bootstrap-patch.mjs` if upstream fesm shape changed.
2. `sh build.sh -f` — confirm log lines for DestroyRef, reopen, dropdown show, placement fallback (or “already patched”).
3. **`verify-ngx-bootstrap-bundle.sh`** (strict by default, runs after `build.sh`) — confirm patches are **inside** `ngx-bootstrap.bundle.js` and `wm-libs.js`. **Do not** mark build/preview done without this.

### 7. Runtime bootstrap & providers

- `provideZoneChangeDetection` vs zoneless experiments
- `importProvidersFrom` for legacy module bridges
- `ApplicationConfig` provider ordering in `app.config.ts`
- Missing `APP_INITIALIZER` / dynamic `LOCALE_ID` after bootstrap refactor
- `HttpCallInterceptor` not registered with `withInterceptorsFromDi()`

**Risk:** subtle DI / change-detection regressions; locale or variables uninitialized on first paint; HTTP calls bypass WM interceptors.

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

### 13. `WMDomRendererFactory2` / `WMDomSharedStylesHost` (CSP + Angular DOM fork)

**Where:**

- `projects/runtime-base/src/overrides/wm_dom_renderer.ts` — vendored fork of `@angular/platform-browser` `DomRendererFactory2`
- `projects/runtime-base/src/overrides/wm_shared_styles_host.ts` — CSP nonce on dynamically injected `<style>` tags
- Providers: `runtime-base.module.ts` (`ɵDomRendererFactory2` + `ɵSharedStylesHost`), `app.config.ts` (`RendererFactory2`)

**Origins:** CSP nonce `WMS-22503`; Angular 16 DOM API `WMS-25166`; Angular 18 `removeChild` `WMS-27103`; animation `@` props `WMS-29275` (`26ff7c6ee`, `bd406e2a7`).

#### 13a. CSP pair — register **both** overrides

`WMDomRendererFactory2` alone is not enough for CSP-compliant dynamic styles. **`WMDomSharedStylesHost`** adds `nonce` from `<meta name="CSP-NONCE">` (fallback `wm-csp-nonce`) when emulated/shadow styles are injected.

```typescript
// runtime-base.module.ts — both required
{ provide: ɵSharedStylesHost, useClass: WMDomSharedStylesHost },
{ provide: ɵDomRendererFactory2, useClass: WMDomRendererFactory2 },

// app.config.ts (standalone bootstrap) — verify BOTH tokens, not just RendererFactory2
{ provide: RendererFactory2, useClass: WMDomRendererFactory2 },
{ provide: ɵSharedStylesHost, useClass: WMDomSharedStylesHost },  // easy to miss
```

**Step 6 classification:** `RendererFactory2` overridden but `ɵSharedStylesHost` still default → `needs-review` (CSP violations / blocked dynamic styles in preview with strict CSP).

**Preview:** pages with emulated encapsulation components, table inline styles, runtime-compiled partials — check console for CSP `style-src` violations.

#### 13b. Provider token drift (`RendererFactory2` vs `ɵDomRendererFactory2`)

Angular exposes two tokens for the same factory depending on bootstrap path:

| Bootstrap | Token | Must use |
|-----------|-------|----------|
| `NgModule` (`RuntimeBaseModule`) | `ɵDomRendererFactory2` | `WMDomRendererFactory2` |
| `ApplicationConfig` (`app.config.ts`) | `RendererFactory2` | `WMDomRendererFactory2` |

Grep both tokens after upgrade — registering only one path leaves the other bootstrap route on the default renderer.

#### 13c. Upstream sync on every major bump

`wm_dom_renderer.ts` is a **manual fork** of Angular’s platform-browser DOM renderer. On each `@angular/*` major:

1. Diff `node_modules/@angular/platform-browser/.../dom_renderer.mjs` (or equivalent) against `wm_dom_renderer.ts`.
2. Port structural API changes (constructor args, `listen`, `removeChild`, new `Renderer2` methods).
3. Re-apply WaveMaker deltas: `@` animation ignore, null `el` guard, inline `style` attribute path (§13e), CSP nonce stays in `wm_shared_styles_host.ts`.

**Step 6 classification:** upstream `DomRendererFactory2` signature changed but fork untouched → `must-change`.

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

**Note:** `bd406e2a7` was later reverted by `WMS-25708` (`56f3b9ce6`) on this branch — re-validate in preview if page-param-driven variables fail on first load.

### 16. List / table embedded template context & DI

**WMS-29275:** `0c69b8010`, `80faec7f4`, `1aad018d4`, `5442cebf0`

**List menus not rendering:** `ngTemplateOutletContext` and `createCustomInjector` must expose **`row: item`** (not only `item`) so menu widgets inside list templates resolve row scope.

**Table row templates:** row expand / actions contexts should alias row data for legacy templates:

```typescript
{ row, item: row, $implicit: row, rowDef, … }
```

**`createEmbeddedView` + `createCustomInjector`:** required when embedded templates host widgets needing `EXPLICIT_CONTEXT` / row-scoped DI (filter row, row actions). **Do not** blanket-apply to inline-edit / custom-expression cells — WMS-29275 `1aad018d4` reverted that after table validation regressions. Use per-template, with unique `contextKey` when caching injectors.

**Table dataset without datasource:** when `binddatasource` is set but `datasource` is null and dataset arrives (model/script/modal variable), render from dataset or clear loading — avoid infinite “loading” or empty grid (`5442cebf0`, `80faec7f4`).

**Step 6 grep:**

```bash
rg 'ngTemplateOutletContext.*item:' projects/components/widgets/data/list
rg 'createEmbeddedView\(' projects/components/widgets/data/table/src/table.component.ts
```

### 17. Popover vs date/time picker outside-click

**WMS-29275:** `80faec7f4`

**Symptom:** popover closes when interacting with datetime picker opened inside it; or picker clicks bubble to document handler.

**Fixes:**

- Set `[outsideClick]="false"` on popover anchor when picker is nested (`popover.component.html`).
- In document click handler, treat ngx-bootstrap picker hosts as “inside”: `bs-datepicker-container`, `bs-daterangepicker-container`, `bs-timepicker` (element **and** class selectors).

**Preview:** popover containing date or time widget — open picker, select value, popover stays open.

### 18. File upload template bindings after upgrade

**WMS-29275:** `4daf7d759`, `80faec7f4`

**Symptom:** success icon / delete action never shown after upload when response shape differs from datasource-bound path.

**Fix:** success UI should accept `ft.status === 'success' || ft._response?.success`; remove `this.` from `appLocale` message bindings in `file-upload.component.html`.

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

1. App shell loads without console errors (no `overrideRouterOutlet` / `reading 'attach'` on first paint; no CSP `style-src` violations from dynamic styles)
2. **Page with query params** — variables see params on first load (not only after re-navigation)
3. Runtime-compiled page or partial renders
4. Table with **row expand** opens nested content; row **actions** and **filter row** widgets render
5. **List** with row-level **menu** widget renders and opens
6. Modal open/close and focus return (stacked modals z-index)
7. Popover and dropdown positioning (no `__destroyRef is not defined` / `PositioningService` in console)
8. **Popover + date/time picker** inside — picker usable without popover closing
9. Date/time picker open, select, close; **reopen** after close (positioning reopen patch)
10. Typeahead / search dropdown list visible (not clipped)
11. **File upload** success state and delete action
12. **Table** bound to modal/script variable shows data (not empty grid / stuck loading)
13. No `NG0201` / injector errors in console
14. Menu / typeahead / any overlay widget (confirms ngx-bootstrap bundle patch in `wm-libs.js`)

Record pass/fail and URLs/paths exercised in `current-state.md`.
