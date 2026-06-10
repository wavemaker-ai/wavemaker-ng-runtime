# WaveMaker runtime patterns (wavemaker-ng-runtime)

Default entry in `PATTERNS_FILE` for this repo. Workflow and gates: `SKILL.md` + `repo.config.sh`.

Classify findings as `safe`, `needs-review`, `likely-breakage`, or `must-change`. **Block** on unresolved `must-change`.

**WMS-29275 (Angular 18 → 20):** Sections with commit refs come from that upgrade branch. Re-check on every major bump — ngx-bootstrap modal APIs and patch regexes drift between majors.

## Dependency classification (this repo)

Record decisions in `current-state.md` → **Dependency Decisions**.

| Upgrade with Angular (Step 3) | Check if required | Keep stable unless needed |
|------------------------------|-----------------|---------------------------|
| `@angular/*`, `typescript`, `rxjs`, `zone.js`, `tslib` | `rollup`, `@rollup/*`, webpack | `jquery`, `jquery-ui`, `lodash-es` |
| `ngx-bootstrap`, `ng-packagr`, `@angular/cli`, devkit | `jest`, `@types/jest`, `jest-preset-angular` | `.yalc` file deps (variables, foundation-css, custom-widgets) |
| `@angular-eslint/*`, `@angular-builders/custom-webpack` | `ngx-toastr`, `ngx-color-picker`, `angular-imask` | `moment`, `d3`, `@fullcalendar/*`, `angular2-websocket` |
| `engines.node`, `engines.npm` | | `summernote`, `iscroll`, `@ztree/ztree_v3`, `acorn` |

**Step 1 inventory paths:** `package.json`, lockfile, `angular.json`, `tsconfig.json`, **`tsconfig.web-app.json`** (codegen renames to generated `tsconfig.json` — must stay aligned), `build-scripts/ngx-bootstrap-patch.mjs`, `jest.config.js`, `src/setup-jest.js`.

## ngx-bootstrap bundle verification

Post-build script: `scripts/verify-ngx-bootstrap-bundle.sh` (when `POST_BUILD_VERIFY_SCRIPT` is set).

**Artifacts:** `dist/tmp/libs/ngx-bootstrap/ngx-bootstrap.bundle.js`, `dist/bundles/wmapp/scripts/wm-libs.js`.

Patch source: `build-scripts/ngx-bootstrap-patch.mjs`. See §6 and §12 for grep checks; Step 8 item 15 confirms patched `wm-libs.js` in preview.

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
- **`tsconfig.web-app.json` must stay aligned with `tsconfig.json`** on every major bump — codegen renames it to the generated app’s `tsconfig.json` (§20a)

**Risk:** broken `dist` packages consumed by generated apps; TS2307 / NG1010 on `ng build` after codegen.

### 8b. NgModule / `ApplicationConfig` static analysis (Angular 21)

- `ModuleWithProviders` from `SomeModule.forRoot()` in `NgModule.imports` → **NG1010** (not statically analyzable)
- **Fix:** bare modules in `imports`; spread `forRoot().providers` into `providers`, or use `importProvidersFrom` in `app.config.ts` without `.forRoot()` on ngx-bootstrap modules

**Where:** `projects/runtime-dynamic/src/app/app.config.ts` (flat `providers`; primary bootstrap), transpiler-generated imports (`projects/transpiler/src/imports.ts` — bare ngx-bootstrap `ImportDef`s, no `forRoot: true`), **`wavemaker-ng-codegen/templates/app.config.ts.hbs`** (§20b — edit source templates only, not `dist/`). Legacy `app.module.ts` / `WM_MODULES_FOR_ROOT` in runtime preview are not used by codegen output.

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

**Step 7 — post-build gate (when bundle verify enabled):**

```bash
UPGRADE_BUILD_CMD='<BUILD_CMD from repo.config>' UPGRADE_BUNDLE_VERIFY=yes \
sh .cursor/skills/angular-upgrade/scripts/build.sh
# or verify alone after build:
sh .cursor/skills/angular-upgrade/scripts/verify-ngx-bootstrap-bundle.sh
```

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

### 19. WaveMaker expression parser (`ASTCompiler` / `$parseExpr`)

**Where:** `projects/core/src/utils/expression-parser.ts` — custom compiler over `@angular/compiler` `Parser` + `Lexer`

**Consumers:** `watcher.ts` (watch expressions), `base-page.component.ts` / `base-partial.component.ts` / `base-layout.component.ts` (`registerFnByExpr` from build), widget bind/event handlers via `$parseExpr` / `$parseEvent`

**Not the same as §4:** §4 is template markup transpilation; this section is **runtime JS expression** evaluation for `bind:`, watches, and `on-*` events.

#### 19a. `Parser` API signatures (changes every major)

Angular’s internal `Parser` **location/sourceSpan** args are mandatory from Angular 20 (WMS-29275: `b4ecc7218`):

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

### 20. Generated Angular apps (`wavemaker-ng-codegen` + `@wavemaker-ai/angular-app`)

**Scope:** Studio **codegen** output (`ng build` on a generated app), not this repo’s preview shell alone. Fixes span **two repos** — keep them in sync on every Angular major bump.

**Re-check every major:** `tsconfig.web-app.json` ↔ `tsconfig.json`, ngx-bootstrap API (`forRoot` removal on third-party modules), **`templates/app.config.ts.hbs`** (codegen’s only app-bootstrap template), transpiler `imports.ts`, dependency filenames under `angular-app/dependencies/` if codegen fails at require time.

**Bootstrap model (Angular 21+):** Generated apps use **`bootstrapApplication` + `app.config.ts`** — not `AppModule`. WaveMaker app-wide services are registered as **flat `providers`** in `app.config.ts.hbs`. Legacy NgModule `*.forRoot()` helpers (`CoreModule`, `WmComponentsModule`, etc.) are **removed from runtime source**; `WM_MODULES_FOR_ROOT` in `runtime-base.module.ts` is an **empty array**.

#### 20a. `tsconfig.web-app.json` → generated `tsconfig.json` (must-change)

**Mechanism:** `wavemaker-ng-codegen/src/gen-tsconfig.js` **renames** `tsconfig.web-app.json` → `tsconfig.json` during web-app codegen. The shipped file lives in **`@wavemaker-ai/angular-app`** (this repo root).

**Angular 21+ requirement:** `compilerOptions.moduleResolution` must be **`"bundler"`** (not legacy `"node"`). Legacy `"node"` cannot resolve package `"exports"` subpaths such as:

- `@angular/common/http`
- `@angular/core/primitives/di`
- `ngx-bootstrap/datepicker`, `ngx-bootstrap/modal`, etc.

**Symptoms if misaligned:**

```text
TS2307: Cannot find module '@angular/common/http'
TS2307: Cannot find module 'ngx-bootstrap/datepicker'
TS2307: Cannot find module '@angular/core/primitives/di'
NG1010: imports … (not statically analyzable)  // often cascades from unresolved ngx-bootstrap modules
```

**Fix (this repo — `wavemaker-ng-runtime`):**

1. After changing `tsconfig.json` for a major bump, **mirror the same** `moduleResolution`, `module`, `lib`, `esModuleInterop`, `useDefineForClassFields`, and path mappings into **`tsconfig.web-app.json`**.
2. Do **not** assume codegen uses root `tsconfig.json` — only **`tsconfig.web-app.json`** becomes the generated app’s `tsconfig.json`.
3. `src/tsconfig.app.json` extends `../tsconfig.json` in the angular-app package; after rename, that parent **is** the web-app config.

**Step 6 grep (this repo):**

```bash
grep moduleResolution tsconfig.json tsconfig.web-app.json
# Both must show "bundler" on Angular 21+
```

**Step 6 classification:** `tsconfig.json` = `bundler` but `tsconfig.web-app.json` = `node` → **`must-change`**.

#### 20b. Codegen Handlebars — ngx-bootstrap `forRoot()` (must-change)

**Repo:** `wavemaker-ng-codegen/templates/` (**source only** — never hand-edit `dist/`; `build.sh` copies `templates/` → `dist/codegen/codegen-app/`).

**Active template:** `templates/app.config.ts.hbs` only — registered in `handlebar-helpers.js` as `app-config-ts` and written to generated `src/app/app.config.ts`. **`templates/app.module.ts.hbs` is legacy** (not registered, not emitted); optional consistency edit only.

**Angular 21 / ngx-bootstrap 21:** `ModalModule`, `BsDatepickerModule`, `NgCircleProgressModule` **no longer expose** `.forRoot()`. Use **bare modules** inside `importProvidersFrom(...)`.

| File | Priority | Change |
|------|----------|--------|
| `templates/app.config.ts.hbs` | **must-change** | `ModalModule`, `BsDatepickerModule`, `NgCircleProgressModule` — **no** `.forRoot()` inside `importProvidersFrom(...)` |
| `templates/app.module.ts.hbs` | optional / legacy | Same ngx-bootstrap fix if kept for reference; **does not affect codegen output** |

**Keep `.forRoot()` in `app.config.ts.hbs` where still valid:**

- `ToastNoAnimationModule.forRoot({ maxOpened: 1, autoDismiss: true })` (ngx-toastr)

**Do not add WaveMaker `*.forRoot()` in generated bootstrap:** register services directly in `providers` (see canonical `app.config.ts.hbs` in codegen). `RouterModule.forRoot` is not used — routing uses `provideRouter(...)`.

**Symptoms if templates unchanged:**

```text
TS2339: Property 'forRoot' does not exist on type 'typeof ModalModule'
TS2339: Property 'forRoot' does not exist on type 'typeof BsDatepickerModule'
```

**Canonical `app.config.ts.hbs` snippet:**

```typescript
const wmModules = [
    importProvidersFrom(
        ModalModule,
        ToastNoAnimationModule.forRoot({ maxOpened: 1, autoDismiss: true }),
        BsDatepickerModule,
        NgCircleProgressModule,
        // ...
    )
];
```

**Page / partial templates** (`page/page.component.ts.hbs`, `partial/partial.component.ts.hbs`): **no `.hbs` change** for ngx-bootstrap — imports come from transpiler via `{{WMComponentsImportStmts}}` / `{{WMComponentModuleStmts}}`. Fix **`projects/transpiler/src/imports.ts`** in this repo (remove `forRoot: true` on ngx-bootstrap `ImportDef`s) and rebuild the transpilation bundle shipped in `angular-app/dependencies/`.

#### 20c. Codegen dependency paths (likely-breakage — apply when codegen fails)

**When to fix:** Only if running codegen throws `Cannot find module '../dependencies/...'` — not a build-gate item until observed.

When `@wavemaker-ai/angular-app/dependencies/` filenames use a `.cjs.js` suffix, update **`wavemaker-ng-codegen/src/`** (not `dist/`):

| Old require | Angular 21+ shipped name |
|-------------|--------------------------|
| `../dependencies/expression-parser.cjs` | `../dependencies/expression-parser.cjs.js` |
| `../dependencies/pipe-provider.cjs` | `../dependencies/pipe-provider.cjs.js` |
| `../dependencies/transpilation-web.cjs` | `../dependencies/transpilation-web.cjs.js` |

**Files:** `expr-parser-utils.js`, `wm-utils.js`, `pages-util.js`.

**Note:** `@wavemaker-ai/angular-app/dependencies` ships **web** transpilation only — do not require `transpilation-mobile.cjs` unless the package adds it again. Match the suffix already used in `gen-components.js` (`custom-widgets-bundle.cjs.js`).

#### 20d. Cross-repo upgrade checklist (Step 10 → Known follow-ups)

After runtime upgrade gates pass in **this repo**, verify **generated-app** path:

| # | Repo | Action |
|---|------|--------|
| 1 | `wavemaker-ng-runtime` | `tsconfig.web-app.json` aligned with `tsconfig.json`; rebuild/publish `@wavemaker-ai/angular-app` |
| 2 | `wavemaker-ng-runtime` | `projects/transpiler/src/imports.ts` — no `forRoot: true` on ngx-bootstrap; `sh build.sh -f` refreshes `dependencies/*.cjs.js` |
| 3 | `wavemaker-ng-codegen` | Edit **`templates/app.config.ts.hbs`** (required); run `sh build.sh`; yalc/publish codegen package |
| 4 | Generated app | Re-run **codegen** (regenerates `tsconfig.json`, `app.config.ts`, pages) — existing folders are **not** auto-fixed |
| 5 | Generated app | `npm install` + `npm run build` (`build-scripts/build.js` runs ngx-bootstrap ESM patch) |

**Permanent fix** = merged source in both repos + republished packages + fresh codegen. Old generated app folders keep stale `tsconfig.json` / `app.config.ts` until re-codegen or manual edit.

**Step 6 classification (cross-repo):**

| Finding | Label |
|---------|--------|
| `tsconfig.web-app.json` still `moduleResolution: "node"` while target is Angular 21+ | `must-change` |
| `app.config.ts.hbs` still calls ngx-bootstrap `.forRoot()` | `must-change` |
| `app.module.ts.hbs` still calls ngx-bootstrap `.forRoot()` | `needs-review` — legacy template, not emitted |
| Codegen runtime error: `require('../dependencies/*.cjs')` not found | `likely-breakage` — apply §20c |
| Hand-edits under `wavemaker-ng-codegen/dist/` | `needs-review` — revert; fix `templates/` and rebuild |

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

Same flows on **Comparison URL** then **Preview URL** (from `repo.config.sh`). Record in `current-state.md` → **Preview Validation**.

### Checklist (preview URL)

With **Preview URL** loaded (browser MCP or manual):

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
14. **Watch / bind expressions** — parenthesized expr and piped bind update correctly (§19)
15. Menu / typeahead / any overlay widget (confirms ngx-bootstrap bundle patch in `wm-libs.js` when Step 0 verify = yes)

Record pass/fail, comparison URL notes, and regressions vs baseline in `current-state.md`.
