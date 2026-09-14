# Unresolved Platform Findings

Tracking doc for everything found during this work that touches the **platform** (ng-runtime /
ng-codegen / ui-variables / foundation-css) but was not fixed — for whatever reason — so it isn't
lost once attention moves on to something else. Findings specific to individual client projects
(Cortex, psabackoffice, ArcspeedAM) are reported by the profiler tool itself and aren't repeated
here; this file is platform-code only.

## 0. Housekeeping — nothing below is committed yet

As of writing, every platform fix made this session is an **uncommitted local change** in all
three repos. Until committed/pushed, all of it can be lost to a stash mistake, a hard reset, or
just disk loss.

**wavemaker-ng-runtime** (uncommitted):
- ~~`wm-custom-webpack.config.js` — Terser `parallel: 2` RAM cap~~ — **reverted** (see §1.12):
  disproven by direct measurement, `git diff` on this file is now clean.
- `projects/components/widgets/containers/{tabs,accordion,wizard}/**` — dynamic pane/step
  `componentRef.destroy()` memory-leak fix (6 files)
- `projects/components/widgets/containers/{tabs,accordion,wizard,panel}/**` — dead `$lazyLoad`
  code-comment warnings (see §1.7 below)
- `projects/components/widgets/input/checkboxset/src/{checkboxset.component.ts,checkboxset.component.html,checkboxset.wrapper.spec.ts}`
  — O(N) DOM query fix + groupby template-arg consistency fix + 3 new regression tests (see §1.2)
- `projects/runtime-base/src/overrides/wm_dom_renderer.ts` — removed the buggy `style`-attribute
  special case; `wm_dom_renderer.spec.ts` — new file, 3 regression tests (see §1.15)
- `tools/wm-app-profiler/` — the whole tool (untracked)

**wavemaker-ng-codegen** (uncommitted):
- `src/codegen-args-cli.js`, `bundle-codegen-cli.js`, `codegen-cli-test.js` — yargs v18 fix
- `src/project-meta.js` — fast-xml-parser v5 fix
- `src/wm-utils.js` — decode-uri-component fix
- `src/pages-util.js`, `src/update-angular-json.js` — zTree lazy-loading
- `src/gen-prefabs.js`, `src/codegen.js` — prefab-config eager-registration fix
- `src/update-angular-json.js` — `supportedLanguages || {}` crash guard (also mirrored into
  `dist/codegen/codegen-app/src/update-angular-json.js`, which already had it independently)
- `src/update-angular-json.js` — `cli.cache.environment: 'all'` fix for every generated app
  (see §1.11; also mirrored into the `dist/` compiled copy)

**wavemaker-ui-variables** (uncommitted):
- `package.json` — added a `clean` script (removes `dist/es2015`/`dist/umd` before every build)
  and made `build` run it first — fixes the recursive self-nesting root cause (see §1.13).
- `src/manager/variable/crud-variable.manager.ts`, `src/manager/variable/service-variable.manager.ts`
  — added `$queue.process(variable)` to both files' success/error handlers — fixes the queued
  `.invoke()` hang (see §1.4). Note: `git status` in this repo also shows these same two files
  (plus `live-variable.manager.ts`) as already modified before this session touched them —
  those pre-existing changes are not part of this fix and weren't reviewed here.

**Action**: commit these (as separate, reviewable commits per fix) before doing anything else with
any of the three repos — nothing below is committed yet, this is the one step still outstanding.

**Update**: `npm run build` (the real pipeline — `clean` → `tsc` → `webpack` → `scripts/build.js
post-build` → `yalc publish --push`) was run for real in `wavemaker-ui-variables` and completed
successfully. Verified the push landed correctly in `wavemaker-ng-runtime/.yalc/@wavemaker-ai/variables`:
back to a clean 1.3MB with no recursive nesting, and the `.invoke()` fix confirmed present in the
compiled output (`grep -c "queue.process(variable)"` → 6 matches in `crud-variable.manager.js`,
10 in `service-variable.manager.js`). `wavemaker-ng-codegen` has no yalc link for this package at
all (confirmed again), so there was nothing to refresh there.

---

## 1. Real gaps found, deliberately not patched

### 1.1 Zero `ChangeDetectionStrategy.OnPush` adoption
- **Where**: every widget component under `projects/components/widgets` (68 files, 0 using OnPush).
- **Why not fixed**: every widget uses Angular's default change detection, so every zone tick
  re-checks every widget regardless of whether its inputs changed — likely the single biggest
  systemic contributor to sluggish tab-switching/large-list interactions found this session. Not
  patched because several widgets mutate state imperatively (e.g. checkboxset's
  `item.selected = true` in place) — under OnPush that silently stops re-rendering unless every
  such site adds `markForCheck()`. Needs a per-widget audit (start with leaf/presentational
  widgets with no imperative mutation — `label`, `spinner` are good first candidates) before
  touching anything, not a blanket flip.

### 1.2 `checkboxset` O(N) DOM query per click — **FIXED**
- **Where**: `checkboxset.component.ts`'s `onCheckboxLabelClick`.
- **What it was**: ran `this.nativeElement.querySelectorAll('input:checked')` on every click to
  rebuild the full selection — cost scales with total checkbox count on the page. Confirmed
  `wm-select`'s multi-select mode does **not** have this pattern — the bug was isolated to
  checkboxset specifically.
- **Why it was hard to fix**: touches groupby mode, select-all, and custom templates; no test
  coverage existed to validate a change against; `selectByKey` (in `dataset-aware-form.component.ts`)
  builds `datavalue` by iterating the `keys` array **in the order given**, not re-sorted — so any
  replacement had to reproduce the exact same order as the old DOM query, in every mode, or it
  would silently reorder a bound Variable's array.
- **Fix**: `onCheckboxLabelClick` now derives the checked-keys array from data already held in
  memory instead of querying the DOM — `datasetItems` for the default template, or `groupedData`
  (flattened) when `groupby` is set, since `orderby` can reorder `groupedData` relative to
  `datasetItems` and the template renders from whichever one applies. For the just-clicked item it
  uses the click event's own `checked` value; every other item's `.selected` flag is already
  correct (kept in sync by `selectByKey`'s reset-then-remark pass on every prior change), so no
  other item needs to be re-read from the DOM either. Also fixed a pre-existing inconsistency this
  surfaced: the groupby template passed the whole `item` object as `onCheckboxLabelClick`'s second
  argument instead of `item.key` like the default template — harmless before (the parameter was
  unused), but needed alignment now that the value is actually used.
- **Verified**: ran the widget's real Jest suite (`checkboxset.wrapper.spec.ts`) before and after —
  all 36 pre-existing tests still pass unmodified, plus 3 new regression tests added specifically
  to pin down the one thing this change could plausibly get wrong (output order): checking items
  out of dataset order still produces dataset-ordered `datavalue`, unchecking removes the right
  key, and groupby mode orders by `groupedData` (not raw `datasetItems`) when the two diverge. 39/39
  passing.

### 1.3 Duplicated dynamic-pane cleanup logic (tabs / accordion / wizard)
- **Where**: `tabs.component.ts`, `accordion.directive.ts`, `wizard.component.ts` — the
  `addPane`/`removePane`/`dynamicComponentRefs`-tracking pattern is near-identical across all
  three.
- **Status**: the underlying memory leak (close doesn't call `componentRef.destroy()`) **was**
  fixed independently in all three files. The duplication itself — three near-identical
  implementations of the same lifecycle-tracking logic — was never consolidated into one shared
  helper. Maintainability debt, not a live bug.

### 1.4 CRUD/ServiceVariable `.invoke()` queued-call hang — investigation completed, real bug found and **FIXED**
- **Where**: `wavemaker-ui-variables/src/manager/variable/crud-variable.manager.ts` and
  `service-variable.manager.ts` (NOT `live-variable.manager.ts` — its own `performCUD`/
  `listRecords` were already correct; the earlier open question named the wrong file).
- **Resolved**: `.invoke()` does guard against overlapping concurrent calls, via a per-variable
  queue (`$queue` / `InflightQueue` in `src/util/inflight-queue.ts`), configurable per-variable
  via `inFlightBehavior` (`'executeLast'`, `'executeAll'`, or default). Traced the real,
  production-live code path end to end to confirm: widgets → `@wm/variables`
  (`wavemaker-ng-runtime/projects/variables`) → `@wavemaker-ai/variables` → this exact code —
  not dead code, not an unused parallel implementation.
- **Real bug found in the process**: in the queue's default behavior, a second `invoke()` call
  queued behind a genuinely in-flight one is never resolved OR rejected once the first call
  finishes normally — `InflightQueue.process()`'s default branch only calls
  `$queue.process(variable)` again from a handful of early-exit paths (`BEFORE_UPDATE` returning
  `false`, a metadata error, file upload/download), never from the normal success/error
  completion handlers in `crud-variable.manager.ts`'s and `service-variable.manager.ts`'s
  `_invoke()`. The queued call's promise hangs forever; its `success`/`error` callbacks never
  fire; `await variable.invoke()` in a page script never returns.
- **Status: fixed.** Added `$queue.process(variable)` to both files' success and error handlers,
  matching the exact pattern already used correctly elsewhere in this same codebase
  (`live-variable.manager.ts`'s `performCUD`/`listRecords`, and the early-exit paths in both
  fixed files) — not new logic, just extending an existing, proven pattern to the two spots
  missing it. Verified: `npx tsc --noEmit` clean, and a full `clean → tsc → webpack` build
  succeeds with no errors.

### 1.5 `get-intrinsic`/`decodeURIComponent` `ReferenceError` in `wm-utils.js`
- **Where**: `wavemaker-ng-codegen/src/wm-utils.js`, when required in certain sequences.
- **Status**: extensively bisected (git stash tests, manual require-sequence replication,
  truncation-based binary search) — root cause never identified. Confirmed reproducible on the
  **original, unmodified** code (not introduced by anything this session changed), and confirmed
  it **never** surfaces in an actual `monitor` pipeline run. Genuinely unresolved oddity, not
  blocking anything observed in practice.

### 1.6 `trustAs:'html'` — no Studio-side guardrail against binding untrusted data
- **Where**: `projects/components/base/src/pipes/trust-as.pipe.ts` (`bypassSecurityTrustHtml`),
  used by `label`, `html`, and `panel`'s help-text.
- **Why not "fixed"**: this is Angular's standard, intentional sanitization-bypass escape hatch —
  working as designed, not an ng-runtime bug. The real gap is that Studio has no warning when a
  developer binds `trustAs:'html'` to a data-source-backed (potentially user-controlled) value,
  which would be a stored-XSS vector. That's a Studio UI/lint change, outside this repo set's
  scope — flagged here so it doesn't get lost, not something to patch in ng-runtime.
- **Confirmed absent in Studio source too**: checked `wavemaker-ng-studio` directly (its own
  `trust-as.pipe.ts` is the same `bypassSecurityTrustHtml` escape hatch, used by the same set of
  design-time widgets) — no validation/warning logic anywhere ties a `trustAs:'html'` binding back
  to whether its source expression is data-backed. This is a genuine gap in Studio today, not
  something this session merely lacked visibility into.

### 1.7 `$lazyLoad` is dead code on tab-pane / accordion-pane / wizard-step / panel — `deferload` mostly doesn't work
- **Where**: `TabPaneComponent`, `AccordionPaneComponent`, `WizardStepComponent`, `PanelComponent`
  — all four declare `public $lazyLoad = noop;`, call it at lifecycle points (select/expand/content
  change), but it is **never reassigned anywhere in the codebase** (confirmed via a repo-wide
  search for `.$lazyLoad =` — zero matches). Calling it is always a no-op, regardless of
  `deferload`.
- **What actually defers anything**: the transpiler (`transpilation-web.cjs.js`) has exactly one
  place that ever emits a real deferred-render wrapper (`*lazyLoad`, backed by the genuine
  `LazyLoadDirective` in ng-runtime) — and it only fires when a widget has **both** `deferload="true"`
  **and** a `show.bind`/`show="bind:..."` expression, reusing that expression as the trigger. This
  is generic (applies to any widget, not pane-specific) and completely bypasses each pane's own
  (dead) `$lazyLoad` hook.
- **Why this matters**: tab/wizard/accordion panes are normally driven by `active`/`expanded`
  state, not a developer-authored `show.bind` — so in practice `deferload="true"` on a pane does
  nothing for the large majority of real usage. Confirmed empirically across 3 real projects: of
  313 tab/wizard/accordion pane tags, only 88 (~28%) had `show.bind` at all; the rest would get a
  no-op from `deferload`.
- **RESOLVED (checked against wavemaker-ng-studio source directly)**: Studio does NOT auto-generate
  a companion `show.bind` — it does something stricter and confirms the finding above completely.
  `deferload`'s prop schema in `Base.ts` is `{ "value": false, "show": false }` — hidden from the
  Properties Panel by default, for every widget. `base.component.ts`'s `processBindAttr` only
  reveals it (`deferload.show = true`) once the developer has bound `show` to something in the
  first place; `onPropertyChange` hides it again if the bound value is currently `true`. Studio's
  own i18n label confirms the exact same requirement in the help text a developer sees
  (`en.ts`, `LABEL_PROPERTY_DEFERLOAD`: "Load On Demand" /
  `MESSAGE_HELP_PROPERTY_DEFERLOAD`: *"When this property is set and show property is bound, the
  initialization of the component will be deferred till the component becomes visible... When show
  property is not bound the component will be initialized immediately, irrespective of this
  property setting."*) — word-for-word the same constraint independently reverse-engineered from
  the transpiler this session. Net effect: it's architecturally impossible to enable "Load On
  Demand" in Studio without first binding `show`, so every real Studio-authored `deferload="true"`
  should already have a `show.bind` companion. Tab/wizard/accordion panes rarely have one for a
  structural reason, not an oversight: their visibility is already driven by the container's own
  active/expanded index, so a developer has no ordinary reason to also bind `show` on them —
  confirming why only ~28% of real panes had it. No remaining uncertainty on this point.
- **Why not fixed**: wiring `$lazyLoad` to genuinely defer a pane's *body* content (as opposed to
  the whole-element deferral the generic mechanism does, which would also hide the pane's always-
  visible header/tab-label) is a real architectural change — likely requires `<ng-template>` +
  `ContentChild`/`ngTemplateOutlet`, the same pattern already proven in `dialog.component.html`.
  Not attempted here: no build pipeline was available this session to validate a change like this
  end-to-end, and the intended design (should the tab header still render immediately while only
  the body defers? what should trigger the deferred load — first activation, or something else?)
  is a product decision, not something to invent unilaterally. For now, only documented the dead
  code in place (code comments on all four `$lazyLoad` declarations) so nobody — including a future
  session — mistakes it for working. The audit tool's `INACTIVE_PANE_EAGER_LOAD` check was
  corrected to match: it now only recommends `deferload` for panes that already have `show.bind`,
  and recommends turning off variable auto-load (invoke manually on select/expand instead) for
  every other case, which works regardless of this dead-code issue.

### 1.8 `wm.ServiceVariable`'s `maxResults` silently no-ops when the operation has no `size` param — no Studio warning
- **Where**: `service-variable.manager.ts`'s `getMethodInfo` — it only patches `param.sampleValue`
  for a parameter literally named `size` (from `VARIABLE_CONSTANTS.PAGINATION_PARAMS =
  ['page','size','sort']`) among the operation's OWN declared parameters. If the backend operation
  doesn't expose one — very common for body-driven/SOAP-wrapped integrations that embed pagination
  inside the request body instead of query params — setting "Records per request" in Studio's
  Properties Panel has zero effect on the actual request.
- **Confirmed real**: parsed Cortex's actual service definitions (`prefab-servicedefs/*.json`,
  571 real operations) — **0 had a top-level `size` parameter**. Every one embeds pagination in the
  request body (a `paginationInfo`-shaped field) instead.
- **Why not "fixed" here**: this is `wm.LiveVariable`'s behavior working as designed for
  Studio-generated CRUD backends (which always support page/size) — the gap is specifically that
  Studio gives no indication, when a developer sets `maxResults` on a `wm.ServiceVariable`, whether
  the underlying operation will actually honor it. That's a Studio UI/service-operation-designer
  gap (warn or grey out "Records per request" when the selected operation has no compatible
  parameter), not an ng-runtime/ui-variables code bug — same category as the `trustAs:'html'` gap
  in §1.6. The audit tool itself was corrected to match (see `service-def-scanner.ts` — it now
  reports "confirmed works" / "confirmed won't help" / "unverified" instead of one blanket claim).
- **Confirmed absent in Studio source too**: searched `wavemaker-ng-studio` for any check
  cross-referencing a ServiceVariable's `maxResults` against its operation's declared parameters —
  no matches. The variable/service configuration UI has no such validation today.

### 1.9 `PREFAB_OVERHEAD`'s "separate bundle" claim was wrong — partials get the same lazy component loading
- **What was wrong**: the audit's prefab-vs-partial framing (and this doc's own §-adjacent
  reasoning) implied a prefab's component code ships in its own bundle while a partial's doesn't.
  Re-verified directly against the codegen/runtime source and that's false: `gen-lazy-module-
  routes.js` generates an identical `loadComponent: () => import(...)` entry for **both** partials
  and prefabs, and `lazy-component-ref-provider.service.ts` resolves `ComponentType.PARTIAL` and
  `ComponentType.PREFAB` through the exact same on-demand dynamic-import mechanism. Component-code
  laziness is not the differentiator.
- **What actually IS real overhead a partial avoids** (verified): (1) `initPrefabConfig()` eagerly
  registers config for every *referenced* prefab at app bootstrap (partials have no equivalent
  config-registry step at all); (2) each prefab ships its own duplicated service-def JSON rather
  than sharing the app's existing ones; (3) an extra prefab-specific DI/lifecycle layer
  (`PrefabDirective` + `PrefabContainerDirective`, including a `propsReady` readiness-gate Promise)
  that a plain compiled partial component doesn't have.
- **Status**: corrected the audit tool's finding text (`app-auditor.ts`) to describe these three
  real costs instead of the false "separate bundle" framing. No platform code change needed here —
  this was purely a profiler-accuracy fix — but logged since the wrong claim had been repeated
  across this session's findings/recommendations before being caught.

### 1.11 Angular CLI's persistent build cache is silently disabled in every CI pipeline — real, measured fix — **FIXED**
- **Where**: `angular.json`'s `cli.cache` (or its absence — the default applies either way). Root
  cause traced into `@angular/build/src/utils/normalize-cache.js`: `environment` defaults to
  `'local'`, and under `'local'`, `cacheEnabled = !isCI` where `isCI` checks the standard `CI`
  env var (`CI=1` or `CI=true`, set automatically by virtually every CI system). So the
  `.angular/cache` disk cache — which caches Babel/webpack-transform output per file — is
  **disabled by default the moment a build runs under `CI=true`**, even if the cache directory
  from a previous build is sitting right there on disk.
- **Confirmed by direct measurement** (Cortex, cold `.angular/cache` cleared, then rebuilt with an
  intact warm cache under each condition):

  | Condition | Peak RSS | Duration |
  |---|---|---|
  | Cold, no cache at all | 3360 MB | 117s |
  | `CI=true`, default config (cache exists, ignored) | 2868 MB | 88s |
  | `CI=true`, `cli.cache.environment: "all"` (cache used) | **2491 MB** | **40s** |
  | Local warm cache (no `CI` var) | 2565 MB | 46s |

  Fixing it (`"cli": { "cache": { "environment": "all" } }` in `angular.json`) took a CI build from
  88s/2868MB down to 40s/2491MB — a 54% time reduction and 13% RAM reduction — for one line of
  config, on top of whatever a real repeated CI build already saves over a fully cold one.
- **The other half of the fix, not yet verified**: this only helps if the build server/pipeline
  actually *persists* `.angular/cache/<angular-version>` between runs (e.g. keyed on the
  lockfile hash) — most CI setups wipe the workspace on every run by default, in which case the
  config change alone does nothing. Whether WM's actual CI pipelines do this today wasn't
  checked from this environment.
- **Why this is a platform/template fix, not a `wm-app-profiler` patch**: this is a property of
  ng-codegen's `angular.json.hbs` template (or whatever generates the `cli` block for every
  generated app), not something specific to one project's generated output — every WM app built
  in CI is very likely leaving this on the table today. Belongs in the codegen template, not the
  per-project profiler's auto-patch step.
- **Status: fixed.** Added to `updateAngularJSON` in `wavemaker-ng-codegen/src/update-angular-json.js`
  (mirrored into the compiled `dist/` copy) — merges `{ environment: 'all' }` into whatever
  `angularJson['cli']['cache']` already exists, for every generated app, right before the file is
  written. The CI-persistence half of the fix (actually keeping `.angular/cache` between pipeline
  runs) is still outside this repo's scope and unverified — see above.

### 1.12 Terser `parallel: 2` RAM cap in `wm-custom-webpack.config.js` — disproven, still live and uncommitted — **FIXED (reverted)**
- **Where**: this repo's own root `wm-custom-webpack.config.js` (not a generated app's copy) —
  still carries the uncommitted change flagged in §0: injects a `TerserPlugin` with `parallel: 2`
  and `compress.passes: 1` as `optimization.minimizer`, with a comment claiming it "trades a
  little build time for several GB of peak RAM."
- **That claim is now disproven by direct, repeated measurement** (this session, against Cortex,
  5,049+ widgets): capping Terser's worker count did not reduce peak RSS in any trial — worst
  case it went from 3108MB → 3262MB (worse) once the plugin was made to actually *replace*
  Angular's default minimizer instead of running alongside it. The main `ng build` process's
  peak is dominated by the AOT-compiled module graph itself (~3GB), not by Terser's own worker
  processes (~300MB combined) — worker-count tuning cannot touch what the main process holds.
  Full writeup/numbers: the "Memory Floor" investigation report (published as a Claude artifact
  during this session).
- **Also: this file likely still has the exact bug that made the capped version worse in
  testing** — `@angular-builders/custom-webpack` merges a plain-object config export via
  `webpack-merge`, which concatenates array-valued keys like `optimization.minimizer` unless
  `mergeRules`/`replaceDuplicatePlugins` is explicitly configured. This file's `minimizer` array
  has no such configuration alongside it, so — unverified but likely — the capped `TerserPlugin`
  here may be running *alongside* Angular's own default (uncapped) one, not instead of it, same
  as originally found in the profiler's own copy of this pattern.
- **Recommendation**: revert this change rather than commit it. It doesn't do what its own
  comment claims, and possibly makes things worse while also risking a real correctness bug
  (double-minification) if the merge-duplication issue applies here too.
- **Status: reverted.** `wm-custom-webpack.config.js` is back to its original content — `git diff`
  on this file is clean.

### 1.13 `@wavemaker-ai/variables` recursively nests its own build output — **FIXED (root cause)**
- **Where**: `.yalc/@wavemaker-ai/variables/dist/es2015/dist/es2015/dist/es2015/...` — the
  package's own `dist/es2015` folder nested inside itself 14 levels deep, each level duplicating
  a 6.7 MB sourcemap (~376 MB of pure disk bloat in this one package alone). The exact same
  pattern also existed under `types/dist/es2015/dist/...` and inside an orphaned legacy
  `.yalc/@wavemaker/variables` (the pre-rename package name, itself 185 MB and completely
  unreferenced anywhere in this repo).
- **Confirmed harmless to the actual build**: `tsconfig.json` resolves this package to exactly
  one file, `dist/es2015/index` — the nested copies are never traversed by the compiler or
  bundler. Verified by loading the package (`node --experimental` dynamic import) against both
  the untouched original and the cleaned copy — identical behavior either way, confirming the
  nesting was never load-bearing.
- **Root cause found, in `wavemaker-ui-variables` (the package's own source repo)**: its
  `tsconfig.json` already correctly excludes `./dist/**/*` from `tsc`'s own input, so `tsc` itself
  was never the direct culprit. The actual bug is structural: `dist/es2015` is simultaneously (a)
  `tsc`'s own `outDir` and (b) the exact directory both `yalc-publish` (`cd dist/es2015 && yalc
  publish ...`) and `scripts/build.js`'s `pushToLocalRepo()` (`yalc publish --push` with `cwd:
  dist/es2015`) read from and push into every consuming repo — with **no clean/rimraf step
  anywhere in the build pipeline** (`"build": "tsc && webpack ... && node ./scripts/build.js
  post-build"`). Whatever was already sitting in `dist/es2015` from a prior build/publish cycle
  gets picked up and re-published on every subsequent cycle, compounding indefinitely once a
  stray copy exists — confirmed live in the source repo itself, which had the identical bug
  (190MB, same nesting depth) sitting in its own working tree.
- **Status: fixed, both the symptom and the root cause.**
  - `wavemaker-ui-variables/package.json`: added a `"clean"` script (`fs.rmSync` on `dist/es2015`
    and `dist/umd`, no new dependency needed) and made `"build"` run it first. Verified directly:
    two consecutive `npm run clean && tsc` cycles both produced a clean 1.3MB `dist/es2015` with
    no nested `dist` folder — confirmed the fix actually prevents recurrence, not just describes
    it. This repo's own working-tree copy of the bug (186MB) was cleaned as part of verifying the
    fix.
  - `wavemaker-ng-runtime/.yalc`: cleaned as described above (406MB → 7.0MB for
    `@wavemaker-ai/variables`; orphaned `@wavemaker/variables`, 185MB, removed entirely).
  - **Update**: the real `npm run build` (full `clean` → `tsc` → `webpack` → `yalc publish
    --push` pipeline) was subsequently run for real — see the note in §0. `wavemaker-ng-runtime`'s
    `.yalc` cache is now refreshed from the fixed source and confirmed still clean (1.3MB, no
    nesting). Still not yet done: committing the `wavemaker-ui-variables` fix itself.

### 1.14 Studio's canvas has no widget nesting/placement validation at all
- **Confirmed via exhaustive search of `wavemaker-ng-studio`**: checked every plausible naming
  convention for a placement-restriction system — `allowedParent`/`invalidParent`,
  `canDrop`/`dropPredicate`/`enterPredicate`, `acceptedTypes`/`restrictedWidgets`/`childRestriction`,
  row/list/table-template-specific checks — zero matches anywhere. Read the actual drop-handling
  code in `wm-canvas-dom.component.ts` directly: the one `parent` field that exists on widget
  config is a lookup helper (finds the nearest ancestor of a required type to wire the new widget's
  association, e.g. a table-column locating its table) — it is never used to block a drop when no
  such ancestor exists.
- **What this means**: any widget can be dropped inside any container in Studio today — nothing
  stops a developer from, say, dropping a dialog inside a row template. There is no Studio-side
  safety net for the structural anti-patterns `STRUCTURAL_VALIDITY`'s checks exist to catch
  (unclosed `<wm-page>`, `<wm-dialog>` nested inside a row template) — those patterns are prevented
  by nothing upstream of a static analysis tool actually looking at the exported markup after the
  fact. Not a bug to fix in ng-runtime/ng-codegen; recorded because it directly justifies why this
  class of check needs to live in the profiler rather than being redundant with something Studio
  already prevents — it doesn't.

### 1.15 `WMDefaultDomRenderer2.resetStyles()` silently never cleared stale style properties — **FIXED**
- **Where**: `projects/runtime-base/src/overrides/wm_dom_renderer.ts` — a fork of Angular's own
  `DefaultDomRenderer2`/`DomRendererFactory2` (per the file's own Google LLC license header),
  wired up as the actual `RendererFactory2` for every WM app (`app.config.ts` and
  `runtime-base.module.ts`), not dead/unused code.
- **Why the `style` special case exists at all (this was initially misdiagnosed — corrected here)**:
  `setAttribute` special-cases `name === 'style'` into `resetStyles(el)` + `applyStyles(el, value)`
  (assigning each CSS declaration individually via `element.style[property] = value`) instead of
  the native `el.setAttribute('style', value)` every other attribute uses. **This is deliberate and
  required for CSP compliance, not a bug to remove**: under a strict `style-src` CSP policy without
  `'unsafe-inline'`, setting the `style` HTML *attribute* (via markup, `.setAttribute('style', ...)`,
  or `.cssText`) is blocked/reported, while assigning individual CSSOM properties
  (`element.style.foo = value`) is a separate mechanism CSP's inline-style check does not cover.
  This is the actual reason this renderer exists as a fork at all, rather than using Angular's own
  (unforked) `DefaultDomRenderer2` directly, which has no such special case and would violate a
  strict CSP `style-src` policy. **An earlier pass on this same finding wrongly concluded the whole
  special case was a redundant, buggy reimplementation of the native path and deleted it — that
  would have silently broken CSP `style-src` compliance app-wide.** Caught before being left in
  place; reverted back to the CSSOM-based approach.
- **The actual, narrower bug**: `resetStyles(element)` did `const styleList = [].slice.call(element)`
  on the DOM element **itself**, not `element.style` — `Array.prototype.slice.call()` on a plain
  object with no numeric `.length` always returns `[]` (confirmed directly), so it silently never
  removed anything. Net effect: if a `style` value changed to no longer include a property that was
  previously set, the old property stuck around on the element instead of being cleared. Confirmed
  separately that `element.style` (the live `CSSStyleDeclaration`) genuinely is array-like — a
  numeric `.length` plus indexed access to each currently-set property name — so the fix is a
  one-line change: iterate `element.style`, not `element`.
- **Fix**: `resetStyles` now reads `[].slice.call(element.style)` instead of `element`. The CSSOM-
  based `applyStyles`/`resetStyles` approach itself is otherwise unchanged, preserving CSP
  compliance.
- **Verified**: no test coverage existed for this file at all (renderer factory for the whole app —
  significant blast radius). Added `wm_dom_renderer.spec.ts`, including a regression guard that
  spies on the element's native `setAttribute` and asserts it's never called with `'style'` — this
  catches exactly the kind of regression the earlier wrong pass would have introduced, since that
  would look identical to a computed-style-only check in a CSP-less test environment like this one.
  4/4 passing after the real fix.

---

## 2. Confirmed NOT bugs (recorded so they aren't re-investigated later)

- **`app.module.ts.hbs`** (~50 unconditional widget-module imports) and **`app-prefabs.module.ts.hbs`**
  (eagerly declares every prefab component) — both are **dead code**. `generateCodeGenModule`/
  `generateAppPrefabsModule` are never called from `codegen.js`. The real, live bootstrap
  (`app.config.ts.hbs`) does neither of these things and was verified correct.
- **Per-page widget code-splitting** — already correct. Verified against a real generated app
  (`local-wm-app2`): each page's `.component.ts` imports only the widgets that page's markup
  actually uses.
- **Dialogs' lazy-loading** — already correct and already lazy: `<ng-template #dialogTemplate>`
  (never compiled until instantiated) + `ngx-bootstrap`'s `BsModalService`, which properly
  creates/destroys dynamic views on open/close.
- **CSRF** — correctly implemented via Angular's built-in `withXsrfConfiguration` (double-submit
  cookie). The one non-obvious line (`http.service.ts` deleting the XSRF header before replaying a
  post-401 request) is correct behavior, not a bug.
- **`trackBy`/`track` on large lists** — already correctly used in `table.component.html` /
  `list.component.html`.
- **Duplicate library versions in `package.json`** — jquery/jquery-ui, lodash-es/@types, and the
  moment.js family are companion packages, not competing duplicate versions.

---

## 3. Open questions, not yet investigated at all

- **Web Workers for heavy client-side data processing** (large JSON/CSV transforms, if any exist
  in the runtime) — came up in a general performance checklist but was never actually looked into.
- **Virtual scrolling adoption** on `wm-table`/`wm-list` beyond the `scrollmode="virtual"` opt-in
  attribute already confirmed to exist — never checked what fraction of real projects actually use
  it vs. leave it off by default.
