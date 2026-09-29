# WaveMaker codegen patterns — ng-codegen §20

Applied to **ng-codegen** (`templates/`, `src/`) in Step 6. For ng-runtime source patterns see [`patterns/runtime.md`](runtime.md). Workflow: [`SKILL.md`](../SKILL.md). Never edit `dist/` in ng-codegen.

---

### 20. Generated Angular apps (`wavemaker-ng-codegen` + the `angular-app` package — `@wavemaker/angular-app` on the `stage-classic` lineage, `@wavemaker-ai/angular-app` on `stage-ai`)

**Scope:** Studio **codegen** output (`ng build` on a generated app), not this repo's preview shell alone. Fixes span **two repos** — keep them in sync on every Angular major bump.

**Sibling repo layout:** `wavemaker-ng-codegen` normally sits **beside** `wavemaker-ng-runtime` (default path **`../wavemaker-ng-codegen`**). **`@wavemaker-ai/angular-app`** is built from **this repo**.

**Branch alignment:** Apply §20 edits on the **same branch name** in both repos (e.g. upgrade ticket branch). At Step 2/6, if ng-codegen is missing, on a different branch, or path unknown — **ask the user** to checkout/create matching branches and confirm the codegen repo path; record both branch names in `current-state.md`.

**Re-check every major:** `tsconfig.web-app.json` ↔ `tsconfig.json`, ngx-bootstrap API (`forRoot` removal on third-party modules), **`templates/app.config.ts.hbs`** (codegen's only app-bootstrap template), transpiler `imports.ts`, dependency filenames under `angular-app/dependencies/` if codegen fails at require time.

**Bootstrap model (Angular 21+):** Generated apps use **`bootstrapApplication` + `app.config.ts`** — not `AppModule`. WaveMaker app-wide services are registered as **flat `providers`** in `app.config.ts.hbs`. Legacy NgModule `*.forRoot()` helpers (`CoreModule`, `WmComponentsModule`, etc.) are **removed from runtime source**; `WM_MODULES_FOR_ROOT` in `runtime-base.module.ts` is an **empty array**.

#### 20a. `tsconfig.web-app.json` → generated `tsconfig.json` (must-change)

**This repo (ng-runtime)** maintains two tsconfig files: `tsconfig.json` (used by the ng-runtime build itself) and `tsconfig.web-app.json` (the template for generated apps). They must stay in sync on every major bump.

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
2. Do **not** assume codegen uses root `tsconfig.json` — only **`tsconfig.web-app.json`** becomes the generated app's `tsconfig.json`.
3. `src/tsconfig.app.json` extends `../tsconfig.json` in the angular-app package; after rename, that parent **is** the web-app config.

**Step 6 grep (this repo):**

```bash
grep moduleResolution tsconfig.json tsconfig.web-app.json
# Both must show "bundler" on Angular 21+
```

**Step 6 classification:** `tsconfig.json` = `bundler` but `tsconfig.web-app.json` = `node` → **`must-change`**.

**Second-order effect confirmed at Step 9 (20→21 hop) — `moduleResolution: "bundler"` is strict about package.json `"exports"` maps in a way `"node"` never was.** `.yalc/@wavemaker/variables`'s `package.json` has a malformed `"exports": {".": "./index"}` (missing the `.js`/`.d.ts` extensions — the same bug already documented in `patterns/runtime.md` §30 for the rollup dependency-extraction context). Under legacy `"node"` resolution this was silently tolerated (implicit extension fallback); under `"bundler"` it fails hard: `TS2307: Cannot find module '@wavemaker/variables'` in the generated app's own build (`libraries/http/types/index.d.ts`, `libraries/variables/types/index.d.ts` — anything re-exporting from `@wavemaker/variables`). **The existing `local-angular-build.md` Step 5 workaround (`cp -R "${YALC_VARIABLES}" .../node_modules/@wavemaker/variables`) does NOT fix this** — it copies the exact same broken `package.json`. The actual `@wavemaker/variables` source repo was not available locally to fix at the root; worked around by hand-patching the `exports` field to a proper conditional map (`{"types": "./index.d.ts", "default": "./index.js"}`) in both `.yalc/@wavemaker/variables/package.json` (survives the next `yalc add` in any generated app) and the already-generated app's own `node_modules/@wavemaker/variables/package.json` copy. **This is a `.yalc`-cache-only fix, gitignored, not part of any commit** — if the real `@wavemaker/variables` source repo becomes available in a future hop, fix `exports` there instead and this workaround becomes unnecessary.

#### 20b. Codegen Handlebars — ngx-bootstrap `forRoot()` (must-change)

**This is a breaking change in ngx-bootstrap upstream, not a modernization.** ngx-bootstrap 21 removed `.forRoot()` from `ModalModule` and `BsDatepickerModule`. (`NgCircleProgressModule` is a **separate package** — `ng-circle-progress` — and still has `forRoot()`; see below.) The generated app will not compile until these are removed from the template.

**Repo:** `wavemaker-ng-codegen/templates/` (**source only** — never hand-edit `dist/`; `build.sh` copies `templates/` → `dist/codegen/codegen-app/`).

**Active template:** `templates/app.config.ts.hbs` only — registered in `handlebar-helpers.js` as `app-config-ts` and written to generated `src/app/app.config.ts`. **`templates/app.module.ts.hbs` is legacy** (not registered, not emitted); optional consistency edit only.

| File | Priority | Change |
|------|----------|--------|
| `templates/app.config.ts.hbs` | **must-change** | `ModalModule`, `BsDatepickerModule` — **no** `.forRoot()` inside `importProvidersFrom(...)` |
| `templates/app.module.ts.hbs` | optional / legacy | Same fix if kept for reference; **does not affect codegen output** |

**Keep `.forRoot()` in `app.config.ts.hbs` where still valid:**

- `ToastNoAnimationModule.forRoot({ maxOpened: 1, autoDismiss: true })` (ngx-toastr)
- `NgCircleProgressModule.forRoot()` (ng-circle-progress) — **keep on `stage-classic`-lineage branches**. `CircleProgressComponent` injects `CircleProgressOptions` with no `@Optional`, and the module only provides it via `forRoot()`. The `stage-ai`/`feature/angular-22-upgrade` lineage can drop it *only because* its `progress-circle.component.ts` provides `CircleProgressOptions` itself; classic's does not — removing it there gives `NullInjectorError` when a progress-circle widget renders. Check the widget's own `providers` before ever removing it.

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
        NgCircleProgressModule.forRoot(),
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

#### 20d. Cross-repo flow

| Phase | Action |
|-------|--------|
| Step 2 | Map §20 + R8/R12 → **Dual-repo change plan** |
| Step 6 | Apply in both repos; **Cross-repo changes**; `pattern-review.sh` |
| Step 7 | `BUILD_CMD` (runtime) |
| Step 9 | Codegen `build.sh`; local build; Tomcat; preview checklist below |

Iteration table: [`steps-6-10.md`](../steps-6-10.md) Step 9 only.

#### 20e. Prism `foundation-css` path in `update-angular-json.js` — must-follow

**Repo:** `wavemaker-ng-codegen/src/update-angular-json.js` (and any `angular.json` in any repo).

**Required path — exactly this, nothing added between the package name and `foundation/`:**

```text
./node_modules/${WM_NPM_SCOPE}/foundation-css/foundation/foundation.css
```

**Rule (user, global `CLAUDE.md`):** never put a build-output subfolder segment into the foundation-css path in any `angular.json` or angular.json-updating script, in any repo. If an existing file has one, remove it — do not "correct" it back, and do not re-add it in a later hop because an older note or another branch has it.

**Why:** the installed / yalc-linked `foundation-css` package exposes `foundation/foundation.css` at its root and has no build-output folder (the source repo's build folder is `.gitignore`d and `yalc push` respects that), so a path with an extra segment never resolves and Prism `ng build` fails.

**Unverified caveat:** if a real production install of the published `foundation-css` npm package lays files out differently, check its actual layout before a release — but follow the rule above unless the user says otherwise.

**Step 6:** enforced by `scripts/pattern-review.sh`.

#### 20f. Generated app edit policy — must-follow

**Never hand-edit** codegen output under **`~/Desktop/local-${PROJECT_NAME}/`** (e.g. `local-SearchWidgetScenarios/SearchWidgetScenarios`) — no changes to `src/`, `angular.json`, `app.config.ts`, `libraries/`.

**Allowed on generated app only:** `npm install`, copy `node_modules/@wavemaker/variables` from yalc when needed, `node build-scripts/build.js` / `ng build`, deploy `dist/` to Tomcat.

**All fixes:** `wavemaker-ng-runtime` and/or `wavemaker-ng-codegen` → rebuild → re-run codegen (local-angular-build Steps 2–5).

**Step 9 iteration:** see [`steps-6-10.md`](../steps-6-10.md) Step 9 only.

#### 20g. Angular 22 codegen templates — must-change (reference: `WMS-32451` codegen branch, commit `835a8df`)

**Repo:** `wavemaker-ng-codegen/templates/`. Generated apps do not use `runtime-dynamic`'s `app.config.ts` — these templates are what make deployment-mode apps correct on Angular 22.

| File | Change |
|------|--------|
| `page/page.component.ts.hbs`, `partial/…`, `prefab/…`, `layout/…`, `customwidget/…` | add `changeDetection: ChangeDetectionStrategy.Eager` to `@Component({...})` and import `ChangeDetectionStrategy` — Angular 22 flipped the default to OnPush (§27a); generated components need the pre-22 behavior |
| `app.config.ts.hbs` | `provideZoneChangeDetection({ eventCoalescing: true, runCoalescing: true })`; `withRouterConfig({ paramsInheritanceStrategy: 'emptyOnly' })` (§27b); `withXhr()` in `provideHttpClient(...)` |

**Do NOT blindly copy a whole diff from the sibling codegen branch.** `WMS-32451` in codegen descends from `stage-ai`: it also carries `wavemaker-ai` package names, `WM_NPM_SCOPE`, react/angular block handling in `gen-index-html.js`, a `NavigationVariable`→`NavigationAction` rename, `.gitlab-ci.yml` and a node 24 pin — none of that is Angular-22 work and it breaks a classic branch. Take only the Angular-22 commit's template hunks (find it with `git log --oneline <branch> -- templates/`), then re-check each hunk against the classic lineage (e.g. keep `NgCircleProgressModule.forRoot()`, §20b).

**Codegen engines pin** follows ng-runtime (`package.json` `engines`) — `engineStrict: true` makes any mismatch an `EBADENGINE` install warning.

**Step 6 check:** `grep -c 'ChangeDetectionStrategy.Eager' templates/*/*.component.ts.hbs` — one per template; `grep -n 'withXhr\|provideZoneChangeDetection\|withRouterConfig' templates/app.config.ts.hbs`.

