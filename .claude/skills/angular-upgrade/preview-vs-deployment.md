# Preview vs Deployment — two code paths, both must be changed and tested every upgrade

**There are two separate code paths in this product. An Angular upgrade must change, build and test BOTH — every time.**

| | **Path 1 — Preview** (Studio "Run") | **Path 2 — Deployment** (real app on Tomcat) |
|---|---|---|
| **Source of truth** | ng-runtime: `runtime-dynamic/` (bootstrap + dynamic component creation), `runtime-base/`, `projects/*`, rollup UMD config | ng-codegen: `templates/*.hbs` + `src/*.js` (generates the app), plus the `projects/*` libraries it links |
| **Bootstrap file** | `projects/runtime-dynamic/src/app/app.config.ts` | `wavemaker-ng-codegen/templates/app.config.ts.hbs` → generated `src/app/app.config.ts` |
| **Built by** | `sh build.sh` (`-fl` when UMD config changes) in **ng-runtime** → `dist/bundles/wmapp/scripts/wm-libs.js` + `wm-loader.js` | `sh build.sh` in **ng-codegen**, regenerate the app, `npm i`, `node ./build-scripts/build.js --c=development` **and** `--c=production` |
| **Tested by** | Studio Preview URL, hard refresh (after the runtime rebuild) | Tomcat: `http://localhost:8080/<Project>/` — dev build AND prod build |
| **Stale if you only rebuilt…** | codegen | runtime |

So a fix made on one path does **not** exist on the other until someone makes the equivalent change there. Example (Angular 22 hop): `withXhr()`, `provideZoneChangeDetection`, `withRouterConfig` and the `Eager` change-detection pin had to be applied twice — in `runtime-dynamic/app.config.ts` and in `app.config.ts.hbs` + the five component templates — and the Preview-only NG0200 (§38) and missing `rxjs-interop` UMD global never appeared on Deployment at all.

## Mandatory protocol — every upgrade, every Angular-version-sensitive change

1. **Step 2 (plan):** tag every finding `Preview`, `Deployment` or `Both` using the "Which change affects which mode" table below; each becomes a row in the **parity table** (`current-state.md`).
2. **Step 6 (fix):** after changing a file on one path, open its counterpart (matrix below) and record one of: *same change applied* / *intentionally different (reason)* / *not applicable (reason)*. Never leave a counterpart unexamined. `pattern-review.sh` "PARITY" diffs the two bootstrap files and warns on any symbol difference that is not on the known-intentional list.
3. **Step 7 (build):** rebuild **both** repos — runtime (incl. UMD libs, `-fl`, when rollup/concat changed) and codegen — then regenerate the app. A runtime-only or codegen-only rebuild leaves the other path stale.
4. **Step 9 (test):** test **both** paths and record evidence per path — Deployment: dev build **and** prod build deployed and exercised; Preview: hard-refresh, console clean. If the change touches the DOM renderer/CSP, also state whether a CSP-on Deployment was tested or explicitly **not** tested.
5. **Step 10 (finish):** the upgrade doc must contain the parity table and per-path results. Do not finish with an unexamined counterpart or an untested path.

## Parity matrix — pairs to keep in step (status = Angular 22 hop, classic branch)

| Concern | Preview file | Deployment file | Status |
|---|---|---|---|
| Change-detection default (§27a) | runtime dynamic component factories / `page-wrapper` set `Eager` | codegen 5 component templates (§20g) | both done |
| Router `paramsInheritanceStrategy` (§27b) | `runtime-dynamic/app.config.ts` | `app.config.ts.hbs` | both done |
| `provideZoneChangeDetection` | `runtime-dynamic/app.config.ts` | `app.config.ts.hbs` | both done |
| `withXhr()` | `runtime-dynamic/app.config.ts` | `app.config.ts.hbs` | both done |
| Explicit `XhrFactory` + `HttpXhrBackend` (§39) | yes | **no** — reference branch has it in runtime only | intentional (unverified need on Deployment) |
| ngx-bootstrap `forRoot()` removal (§20b/§6) | `runtime-dynamic/app.config.ts` | `app.config.ts.hbs` | both done |
| `NgCircleProgressModule.forRoot()` | kept | kept | both done (must stay on classic, §20b) |
| ngx-bootstrap patches (§12) | rollup plugin on the UMD | patch in the generated app's `build-scripts/` | both done |
| WM renderer override | always; `RendererFactory2` → `WMDomRendererFactory2` (§38) | CSP only; `ɵDomRendererFactory2` binding | intentional; CSP-mode app tested on NestedWidgets (dev + prod, Angular 22 hop) — **strict `style-src`/`script-src` header not enforced** (Tomcat sent only `frame-ancestors 'self'`) |
| Animation renderer | replaced by the WM renderer (side effect of §38) | normal `provideAnimations()` | intentional difference |
| Removed dynamic-component APIs (§33) | `runtime-dynamic` services | generated components | both done |

**How to test CSP-on Deployment (done once, Angular 22 hop, NestedWidgets):** generate with `node src/codegen-args-cli -s <project> -t <out> --codegenPath . --spa true --csp true` (separate target folder), `npm i`, build dev and prod, deploy to separate Tomcat webapps (backend copied from the normal one), open each. Evidence the override is active: `document.querySelectorAll('style[nonce]').length` is >0 (WM shared-styles host adds a nonce); a non-CSP build gives 0. This does **not** enforce a real CSP — that needs a `Content-Security-Policy` header with `style-src`/`script-src` on the served app.

Add a row here whenever a new concern is found on one path only.

---

## How the two modes differ (detail)

Step 9 validates both modes because **they run the same product through different pipelines**. A green result in one says nothing about the other. Two Angular 22 bugs (§38 NG0200 `RendererFactory2`, and the missing `rxjs-interop` UMD global) showed up **only in Preview** while Deployment was fine.

Everything below was checked against this repo's code (paths given); items marked *(unverified)* were not.

## At a glance

| | **Angular Deployment** (Tomcat / real app) | **WaveMaker Preview** (Studio "Run") |
|---|---|---|
| **What runs** | A real Angular app generated by ng-codegen, compiled ahead of time | The generic runtime shell that builds pages in the browser from page definitions |
| **How it is built** | `local-angular-build.md`: codegen writes `src/app/**` → `npm i` → `node ./build-scripts/build.js --c=development\|production` (Angular CLI build) → `dist/index.html` + `dist/ng-bundle/` copied into the Tomcat webapp next to the backend WAR | `sh build.sh` in ng-runtime produces `dist/bundles/wmapp/scripts/wm-libs.js` + `wm-loader.js` (+ `.min.js`); Studio serves them from `/app-runtime/wmapp/scripts/` |
| **Angular itself** | Normal ESM packages from `node_modules`, bundled by the CLI — one copy of each Angular package | **Rollup-built UMD globals** (`ng.core`, `ng.common`, `ng.platformBrowser`, `ng.platformBrowser.animations`, …) concatenated into `wm-libs.js` — `config/rollup.ng-libs.config.mjs`, `rollup.ngxBootstrap.config.mjs`, `rollup-utils.mjs` (globals/externals), `build.sh` `bundleJS` (concat list) |
| **WaveMaker runtime code** | `libraries/` ng-packagr output (`@wm/*` in the `angular-app` package, from `bundle-angular-app-cli.sh`) | `wm.core`, `wm.runtime.base`, `wm.runtime.dynamic`, … globals in `wm-loader.js` |
| **Bootstrap** | Generated `src/app/app.config.ts` from codegen's `templates/app.config.ts.hbs` | `runtime-dynamic/src/main.ts` → `bootstrapApplication(AppComponent, appConfig)` with `runtime-dynamic/src/app/app.config.ts` |
| **Pages / partials / prefabs** | Real generated Angular components (`templates/page|partial|prefab|layout|customwidget/*.hbs`) | Created dynamically at runtime by `runtime-dynamic` services (`ComponentRefProviderService`, `DynamicComponentRefProviderService`) from fetched definitions |
| **WM DOM renderer override** (`WMDomRendererFactory2`) | Only when CSP is on (`{{#if isCSP}}` in `app.config.ts.hbs`) | **Always** — `RuntimeBaseModule` provides it, and `app.config.ts` binds `RendererFactory2` to it (§38) |
| **Prod vs dev** | Chosen at build time (`--c=production` / `--c=development`); both are separate builds | Runs in **prod mode by default**: `main.ts` calls `enableProdMode()` unless `sessionStorage.debugMode === 'true'` — run `debugMode(true)` in the console to get full Angular error messages |
| **`isPreview` flag** | `false` when a `deployUrl` meta tag is present | `true` when there is no `deployUrl`/`cdnUrl` meta (`initializeProjectDetails()` in `app.config.ts`) |
| **URL** | `http://localhost:8080/<Project>/` (this machine) | Studio proxy, e.g. `…/run-<id>/<Project>_master/#/Main` |
| **Automation in this skill** | Yes — `local-angular-build.md` (AI builds + deploys; human verifies) | No build step — URL is supplied in `repo.config.sh`/chat; human verifies |
| **How to debug** | Angular CLI build errors; browser console on a normal build | `debugMode(true)`; read the unminified `dist/bundles/wmapp/scripts/wm-libs.js`; repro with the `ng.*`/`wm.*` globals in the console (`patterns/runtime.md` §38) |

## Which change affects which mode

| You change… | Deployment | Preview |
|---|---|---|
| `runtime-dynamic/src/app/app.config.ts` (providers, renderer, HTTP) | no | **yes** |
| ng-codegen `templates/*.hbs` (`app.config.ts.hbs`, component templates) | **yes** | no |
| `config/rollup*.mjs`, `rollup-utils.mjs`, `build.sh` UMD concat list | no | **yes** |
| `projects/*` library sources (`runtime-base`, `components/*`, `core`, …) | yes (ng-packagr) | yes (UMD bundles) |
| `build-scripts/ngx-bootstrap-patch.mjs` | yes (patch runs in the generated app's build) | yes (rollup plugin patches the ngx-bootstrap UMD) |
| `projects/*/package.json` peer deps (§37) | consumers of the published libs | consumers of the published libs |
| `wm_dom_renderer.ts` / `wm_shared_styles_host.ts` overrides | only under CSP | **always** |

## Failure patterns that are mode-specific

- **Preview only:** duplicated Angular internals from separate rollup UMD entries (§38 — two `DomRendererFactory2` copies), UMD imports with no global (`@angular/core/rxjs-interop` → `rxjsInterop` undefined), anything touching `wm-libs.js` load order (`build.sh` concat list: `platform-browser` before `platform-browser-animations`, `core` before `core-rxjs-interop`).
- **Deployment only:** generated-code problems — codegen templates, generated `tsconfig`/`angular.json`, `EBADENGINE`/npm resolution, OnPush-vs-Eager on generated components (§20g), missing `forRoot()` providers in `app.config.ts.hbs` (§20b).
- **Both:** library source regressions (§27 change-detection default, removed Angular APIs like `createComponent` factory overload, ngx-bootstrap changes).

## Rules of thumb

1. Never sign off Step 9 from one mode. State per mode: what was checked, by whom.
2. A Preview failure with a token-less prod error → `debugMode(true)` first, then reproduce; do not guess.
3. Before writing a fix, diff the same file on the reviewed sibling branch (`research.md` dual-repo map).
4. After changing UMD config, rebuild with `sh build.sh -fl` and grep the built `wm-libs.js`/`wm-loader.js` for the change.
5. Preview needs the **runtime** rebuilt; Deployment needs **codegen** rebuilt and the app **regenerated** — a runtime-only or codegen-only rebuild leaves the other mode stale.
