# WaveMaker patterns — meta index

Meta file and entry point (`PATTERNS_FILE`). Contains automated blockers, dependency classification, error-message lookup, §21–§25, classification guide, and preview validation.

- **Runtime patterns §1–§19** → [`patterns/runtime.md`](patterns/runtime.md)
- **Codegen patterns §20** → [`patterns/codegen.md`](patterns/codegen.md)

Workflow: [`SKILL.md`](./SKILL.md). References: [`research.md`](./research.md) R12.

## Contents

| Section | Topic |
|---------|-------|
| [Error-message lookup](#error-message-lookup-step-6--7-diagnostics) → [`troubleshoot.md`](troubleshoot.md) | Error code → section map |
| [Section version history](#section-version-history) | When each section first applied |
| [Automated blockers](#automated-blockers-pattern-reviewsh) | What `pattern-review.sh` checks automatically |
| [Dependency classification](#dependency-classification-this-repo) | What to upgrade / check / keep stable |
| **[patterns/runtime.md](patterns/runtime.md)** | §1–§19, §26 — ng-runtime source patterns |
| **[patterns/codegen.md](patterns/codegen.md)** | §20 — ng-codegen template/src patterns |
| [Verification Principle](#verification-principle-pattern-gates-are-hints-not-guarantees) | Pattern version-gates are hints, not guarantees — how to verify before marking N/A |
| [§21 ng-packagr builds](#21-ng-packagr-library-build-failures) | Library build failures |
| [§22 Yalc peer deps](#22-yalc-linked-package-peer-dependency-mismatch) | Peer dep mismatch after bump |
| [§23 angular.json builders](#23-angularjson-builder-audit) | Builder rename / option changes |
| [§24 Deprecation watch list](#24-deprecation-watch-list) | Forward-looking — next major prep |
| [§25 TypeScript strictness](#25-typescript-version-specific-strictness) | TS version ratchet errors after Angular bump |
| [Classification guide](#classification-guide) | Finding severity classification |
| [Preview validation](#preview-validation-step-9) | Visual parity gate G1–G7, E1–E13 |

> For commit history behind each fix, use `git log --all -S <symbol>` — e.g. `git log --all -S takeUntilDestroyed`.

> **Pattern currency:** these patterns reflect the Angular 20→21 upgrade experience. They are a starting point, not a complete list, and their version-gates are hints, not guarantees — see **Verification Principle** below before trusting any of them at face value. R1/R3 from the official Angular docs take precedence — any breaking change found there that is not covered here is still `must-change`.

---

## Compatibility Policy

See [`SKILL.md § Compatibility Policy`](../SKILL.md#compatibility-policy) — applies to every edit in this file.

---

## Verification Principle: Pattern Gates Are Hints, Not Guarantees

Every §N section's version-gate annotation (`First required: Angular N`, `[N/A: Angular N+1 only]`, the Section Version History table) was written from the experience of **one specific upgrade run**. It records when a fix was last confirmed needed — it is not a guarantee about when it will be needed again, for a different version delta, a different dependency version jump, or a codebase that has changed since.

Before marking any pattern item `[N/A: version gate]`, you must:

1. **Independently reproduce the check** — run the exact "Known preview error" / "Step 6 grep" the section describes against the *actual installed source* for the version this upgrade installs. Do not accept "the table says Angular N+1" as a substitute for running the grep yourself.
2. **If the check involves an `inject()`-based/functional-DI API**, trace the real runtime call chain (constructor → the actual call site) and check for a Zone/async boundary in between — see [`patterns/runtime.md` §26](patterns/runtime.md#26-inject-based-api-called-across-a-zoneasync-boundary-any-angular-ecosystem-dependency) and [`research.md`'s general dependency-jump principle](research.md#general-principle-for-any-dependency-jumping-multiple-majors-not-just-ngx-bootstrap). A call being textually "inside the constructor" is not sufficient evidence it runs in a valid injection context.
3. **Record the specific evidence** you used to conclude N/A (grep output, a `.d.ts` signature, a file:line reference) in `current-state.md` — not just a citation of the version-gate table. A bare "table says N/A" with no independent check is not a defensible N/A and will not survive review.
4. **Before overwriting an existing §N row or section text**, append its prior value to `docs/upgrade-log/{base}-to-{target}.md` (create if missing — skeleton in [`templates.md`](templates.md#pattern-diff-log-skeleton-step-26--docsupgrade-logbase-to-targetmd)). This is the only permanent record of what a previous run found — the pattern files and the Section Version History table below hold only the *current* understanding, and the next run's edits will overwrite what's there now.
5. **Update the section's version-gate annotation** (and "Last verified" column) with what you actually found for this upgrade — whether it confirms the existing gate or corrects it. Pattern files only stay accurate if every upgrade run feeds its findings back in, not just its fixes.

**Why this matters (concrete precedent):** during the Angular 18→20 upgrade (WMS-29275), §12 was marked N/A on the strength of its version-gate table alone ("first required Angular 21"), despite `takeUntilDestroyed()` appearing directly in the installed ngx-bootstrap 20.0.2 source. The actual bug — `NG0203`, not the documented `ReferenceError` — was invisible to `pattern-review.sh`, `tsc --noEmit`, and a fully green `build.sh -f`, and only surfaced when the upgraded app actually ran in a browser. §12's gate has since been corrected to reflect that it applies starting at ngx-bootstrap 20.0.2. Treat every other §N's gate with the same skepticism until you've checked it yourself for the version you're actually installing.

**Second precedent — don't trust your own first guess either, not just the gate table:** during the same 19→20 hop, Step 9 preview validation surfaced a real `SyntaxError: Unexpected token ','` at runtime. Because two different `ASTCompiler`-related fixes (§19a `ParseSourceSpan`, §19b `PropertyWrite` removal) had just been made in the same file in the same hop, the initial assumption was that the newly-edited `PropertyWrite` removal caused it — a plausible story, but never independently checked. A cheap diagnostic (temporarily logging the unhandled AST node's constructor name from `ASTCompiler.build()`'s silent fallthrough, instead of guessing) took one rebuild cycle and proved the real cause was `ParenthesizedExpression` (§19b's *other*, unrelated, already-documented WMS-31316 gap) — nothing to do with the edit just made. The lesson generalizes past version-gates: any causal story about "what broke this" needs the same independent check as a version-gate N/A, especially when it's convenient to blame the thing you just touched.

---

Classify findings: `safe` | `needs-review` | `likely-breakage` | `must-change` — block on unresolved `must-change`.

**Dual-repo:** fix each `must-change` in the repo named in its section. §20 spans ng-runtime and/or ng-codegen — never patch `~/Desktop/local-*`. Step 2 → **Dual-repo change plan**; Step 6 → **Cross-repo changes**.

### Automated blockers (`pattern-review.sh`)

When adding a **must-change** grep, update **both** the script and the matching § below.

**FAIL checks** (exit 1 — block Step 6 done):

| Check | Repo | § |
|-------|------|---|
| No ngx-bootstrap `.forRoot()` on ModalModule / BsDatepickerModule / NgCircleProgressModule | runtime | §6 |
| `ngx-bootstrap-patch.mjs` references `__destroyRef` | runtime | §6, §12 |
| Upstream PositioningService needs `__destroyRef` → patch covers it | runtime | §12 |
| No `addGlobalEventListener` in `wm_dom_renderer.ts` | runtime | §13d |
| No `parent.removeChild()` in `wm_dom_renderer.ts` | runtime | §13e |
| `ɵSharedStylesHost` missing from `runtime-base.module.ts` | runtime | §13a |
| `ɵSharedStylesHost` present in `app.config.ts` (double instance → nav regression) | runtime | §13a |
| No `this.` prefixes in widget HTML templates | runtime | §14 |
| No old-style string placeholder in `parseBinding`/`parseAction` | runtime | §19a |
| Branch match runtime ↔ codegen | both | §20 |
| `tsconfig.json` ↔ `tsconfig.web-app.json` (`moduleResolution`, `module`, `lib`) | runtime | §20a |
| `gen-tsconfig.js`, `app.config.ts.hbs`, `update-angular-json.js` present | codegen | §20 |
| No disallowed ngx-bootstrap `.forRoot()` in `app.config.ts.hbs` | codegen | §20b |
| Correct foundation-css dist path in `update-angular-json.js` | codegen | §20e |

**WARN checks** (logged but do not block — review before Step 9):

| Check | § |
|-------|---|
| `compileModuleAndAllComponentsSync` still present in runtime-base | §1 |
| Positional `createComponent(Cls, 0, inj)` still present | §2 |
| `ComponentFactoryResolver` / `resolveComponentFactory` still present | §2 |
| `jest-preset-angular` major != Angular target | §9 |
| RouterOutlet `overrideRouterOutlet` without `@ViewChild` setter | §11 |
| Missing `AT_CHARCODE` animation guard in `wm_dom_renderer.ts` | §13g |
| `ParseSourceSpan` not found in `expression-parser.ts` | §19a |
| `ParenthesizedExpression` not handled in `expression-parser.ts` | §19b |
| `setPipeProvider` not called | §19c |
| Yalc package declares old Angular major peer dep | §22 |
| Deprecated `@angular-devkit/build-angular:browser` builder in `angular.json` | §23 |

**§1/§2 moved FAIL→WARN (19→20 hop):** both were unconditional FAILs before; confirmed via a real 0-error build that they still compile clean, unmodified, at Angular 20.3.31 (`Compiler.compileModuleAndAllComponentsSync` and the positional `createComponent` overload are `@deprecated`, not removed — see [`patterns/runtime.md` §1](patterns/runtime.md#1-legacy-runtime-compiler-should-be-removed)). Real removal version is still unknown — re-verify against the installed `.d.ts` every hop and tighten back to a `fail_or_warn_below` gate once that version is confirmed, rather than leaving this an unconditional WARN forever.

**Manual only (automation cannot cover):** §3, §4, §5, §7, §8, §8b, §10 (including §10a/§10b), §13c, §15, §16, §19b (ASTCompiler node renames only — the ParenthesizedExpression handler check is automated as a WARN), §20c (codegen require paths), §21, §24, §25, **§26 (which dependency and which call site is different every upgrade — cannot be grepped for generically ahead of time; run its Step 6 grep against every dependency Step 3 bumped)**, **§32 (the scan script in `patterns/runtime.md` §32 is a starting point, not a substitute — one of the 7 confirmed instances (the global spinner) was found only via an actual click-through interaction test after both `setTimeout`-only and broadened-regex scans missed it; Step 9 must include real clicks/interactions, not just page-load checks)**.

**Product baseline (WMS-31488, `dae9a74fc`):** Do **not** re-add `ChangeDetectorRef.detectChanges`, `@if (spinner.show)` wrapper, or `scheduleOverrideRouterOutlet` polling unless Step 9 preview proves a defect. Keep `@ViewChild(RouterOutlet)` setter + `[show]="spinner.show"` + `setTimeout(10)` in `base-layout.component.ts`. **Not the same file/bug as §32's `cdr.detectChanges()` additions** — §32 touches `app.component.ts`'s global-spinner `.subscribe()` handler and `base-page`/`base-spa-page`/`base-partial`/`base-prefab`'s content-gating flags, none of which are `base-layout.component.ts`; §32's additions *are* Step-9-defect-proven (blank page, stuck spinner blocking clicks — confirmed live), so they're the kind of exception this baseline note itself carves out, not a violation of it.

**WMS-29275:** Sections with commit refs — re-check every major bump.

## Dependency classification (this repo)

Record decisions in `current-state.md` → **Dependency Decisions**.

| Upgrade with Angular (Step 3) | Check if required | Keep stable unless needed |
|------------------------------|-----------------|---------------------------|
| `@angular/*`, `typescript`, `rxjs`, `zone.js`, `tslib` | `rollup`, `@rollup/*`, webpack | `jquery`, `jquery-ui`, `lodash-es` |
| `ngx-bootstrap`, `ng-packagr`, `@angular/cli`, devkit | `jest`, `@types/jest`, `jest-preset-angular` | `.yalc` file deps (variables, foundation-css, custom-widgets) |
| `@angular-eslint/*`, `@angular-builders/custom-webpack` | `ngx-toastr`, `ngx-color-picker`, `angular-imask` | `moment`, `d3`, `@fullcalendar/*`, `angular2-websocket` |
| `engines.node`, `engines.npm` | | `summernote`, `iscroll`, `@ztree/ztree_v3`, `acorn` |

## Error-message lookup (Step 6 / 7 diagnostics)

See [`troubleshoot.md`](troubleshoot.md) — single source of truth. Add new error entries there only.

---

## Section version history

When each section was first required. **Update "Last verified" when you confirm a section still applies (or no longer applies) after an upgrade** — this tells the next engineer which sections are known-current vs. potentially stale.

**Before editing any row below, append its current value to `docs/upgrade-log/{base}-to-{target}.md` first** (see Verification Principle step 4 above) — this table only ever shows the latest run's findings; the diff log is where prior runs' values survive.

| § | First required | Last verified | Notes |
|---|---------------|---------------|-------|
| §1 | Angular 20 | Angular 21 | Legacy `compileModuleAndAllComponentsSync` incompatible with AOT-first defaults |
| §2 | Angular 20 | Angular 21 | Positional `createComponent(factory, index, inj)` overload still present in `@angular/core@20.3.31`'s `.d.ts` — not actually removed by Angular itself; coupled to §1's mandatory legacy-compiler removal in the same 2 files (see `d9a05f1be`/`a2062ecf8`/`3c1028fe8`, WMS-29275) |
| §3 | Angular 12+ | Angular 21 | `attachView` / `detachView` required after `createComponent` |
| §4 | Angular 20 | Angular 21 | `Element` constructor requires 9 args including `endSourceSpan` |
| §5 | Angular 17 | Angular 21 | `@if` / `@for` block syntax introduced |
| §6 | Angular 20+ | Angular 21 | ngx-bootstrap patch first needed at WMS-29275; re-check every ngx-bootstrap major |
| §7 | Angular 20 | Angular 22 | `bootstrapApplication` + `APP_INITIALIZER` ordering; Zone.js rule applies to all majors; `provideHttpClient` default backend pin added at Angular 22 (§7b) |
| §8 | Angular 21 | Angular 21 | fesm primitive renames; `moduleResolution: "bundler"` required |
| §8b | Angular 21 | Angular 21 | ngx-bootstrap 21 removed `forRoot()` from **every** module (confirmed 10/10 at the 20→21 hop, not just `ModalModule`/`BsDatepickerModule` as this row previously said) — `NgCircleProgressModule.forRoot()` is unaffected (separate package) |
| §9 | Every major | Angular 21 | `jest-preset-angular` major must match Angular major |
| §10 | Every major | Angular 21 | Preview-sensitive failures not caught by static analysis |
| §10a | Angular 20 | Angular 21 | Popover + date/time picker outside-click isolation (subsection of §10) |
| §10b | Angular 20 | Angular 21 | File upload success/delete template binding shape (subsection of §10) |
| §11 | Angular 20+ | Angular 21 | `@ViewChild(RouterOutlet)` setter pattern (WMS-28429) |
| §12 | Angular 20 | Angular 22 | Confirmed at ngx-bootstrap 20.0.2 (not 21 — prior row understated this): bare `takeUntilDestroyed()` nested inside `ngZone.runOutsideAngular(...)` in `PositioningService`, throws NG0203. **Confirmed at ngx-bootstrap 21.2.2 (20→21 hop, corrects a prior wrong claim here about "ships takeUntilDestroyed(__destroyRef) without declaring it"):** actual source is still bare `takeUntilDestroyed()` (no arg, same NG0203 hazard as 20.0.2), but the constructor signature changed (`ngZone` param removed) and the Zone boundary is now `runInZoneRootIfPresent(...)`, not `ngZone.runOutsideAngular(...)` — patch regex needed a full rewrite, not just a version-gate bump. **Confirmed at ngx-bootstrap 22.0.0 (21→22 hop) — and this corrects the previous row's claim that "22.0.0 natively ships all 5 patches": it does not.** The 22.0.0 `PositioningService` source is byte-identical in shape to 21.2.2 (same `constructor(rendererFactory, platformId)`, same `runInZoneRootIfPresent(() => { this.triggerEvent$?.pipe(takeUntilDestroyed())…`), so the existing patch regex still matches and the patch is still **required** — verified two ways: a live `node --input-type=module` regex test against the installed bundle, and `verify-ngx-bootstrap-bundle.sh` confirming the patched bytes are present in both `ngx-bootstrap.bundle.js` and `wm-libs.js`. Note both `pattern-review.sh` and `verify-ngx-bootstrap-bundle.sh` print a stale INFO line claiming the patch may not be needed — that text is wrong and is contradicted by the same script's own OK result |
| §13 | Angular 16+ | Angular 22 | Fork must be synced on every major; last sync at Angular 22 — `removeStyles()` no-op added to `wm_shared_styles_host.ts` (§13i) |
| §14 | Angular 20 | Angular 21 | Template type-checker rejects explicit `this.` in bindings |
| §15 | Angular 20 | Angular 21 | `route.queryParams` may emit after first variable init |
| §16 | Angular 20 | Angular 21 | `ngTemplateOutletContext` row aliasing; `createCustomInjector` per-template |
| §19 | Angular 17 | Angular 21 | Re-check `ASTCompiler.build()` AST node names every major |
| §20 | Angular 21 | Angular 21 | `bootstrapApplication` + flat providers; `WM_MODULES_FOR_ROOT` empty |
| §21 | Every major | Angular 21 | ng-packagr internal API and peer dep handling changes with Angular major |
| §22 | Any major | Angular 21 | Peer dep version declared in `.yalc` package |
| §23 | Check every major | Angular 21 | Builder renames; deprecated option removal |
| §24 | Populated at Step 10 | Angular 21 | Forward-looking deprecations found during R1/R3 review |
| §25 | Every TS major | Angular 22 | TypeScript strictness ratchet; re-check on each Angular/TS bump. TS 6.0 flipped `strict` default to `true` — disabled explicitly (deliberate exception, see §25 body) rather than fixed, since real strict-mode adoption is out of scope for a compatibility-only upgrade |
| §26 | Generic — any dependency major bump | Angular 21 (first instance: ngx-bootstrap 20.0.2, WMS-29275) | Not version-gated to a specific Angular major — check on every dependency Step 3 bumps by more than a patch/minor. `inject()`-based API vs Zone/async boundary; see Verification Principle above |
| §27 | Angular 22 | Angular 22 | Default-behavior changes with no compile error — `changeDetection` (27a, incl. dynamic-component factories per 27c), Router `paramsInheritanceStrategy` (27b) — pinned back to pre-22 behavior. §27c was the actual root cause of a real reported preview failure, confirmed fixed live, not just via a green build — see `docs/22-upgrade.md` |
| §28 | Angular 22 | Angular 22 | Compiler strictness ratchet — NG1054 (duplicate `@Input` alias), NG6008/NG6009 (standalone components in `NgModule.declarations`/`.bootstrap`) |
| §29 | Angular 19 | Angular 19 | Standalone-by-default breaks inline test-harness components/pipes lacking an explicit `standalone` flag — `npm test`-only (Step 8), `build.sh` compiles clean; 80 files/87 classes in this repo's first 18→19 hop |
| §30 | ng-packagr major bump (not strictly an Angular-version gate) | Angular 19 | `config/rollup.build-task.mjs`'s dependency-extraction pipeline breaks when ng-packagr drops per-file `esm2022/<path>.mjs` output for the flattened `fesm2022/index.mjs` barrel — first hit in this repo's 18→19 hop (ng-packagr 17.3.0→19.2.2); re-check on every future ng-packagr major, independent of whether Angular's own major changes that hop |
| §31 | ngx-bootstrap major bump (not strictly an Angular-version gate) | Angular 21 | ngx-bootstrap converted every directive `@Input()` to signal-based `input()` — confirmed on `BsDropdownDirective`/`TypeaheadDirective` at ngx-bootstrap 21.2.2 (20→21 hop); breaks any WM code that imperatively writes to a directive property from TypeScript. Re-check on every future ngx-bootstrap major bump |
| §33 | Angular 22 | Angular 22 | `Compiler.compileModuleAndAllComponentsSync()` **and** the `ComponentFactory`-based `ViewContainerRef.createComponent(factory, index, injector)` overload both removed (`ComponentFactoryResolver` too) — WM's entire dynamic page/partial/prefab/widget pipeline restructured to standalone components created via `createComponent(Type, {index, injector})`, dropping the runtime-NgModule/Compiler step entirely. 8 files. Not in R1/R3 or the other branch's docs — found only by reading the installed `.d.ts` after a build failure |
| §34 | Angular 22 | Angular 22 | OnPush-by-default also hits **inline `*.spec.ts` test-harness components** (§27a only sweeps `*.component.ts`) — 23/126 suites, 60 tests failed with misleading "element is null" / "DOM not updated" assertions. Same 80 files §29 hit. `npm test`-only; `build.sh -f` passes clean |
| §35 | ngx-bootstrap major bump (not an Angular-version gate) | Angular 22 | ngx-bootstrap 22 removed directives' internal `_ngZone` → `Cannot read properties of undefined (reading 'onStable')` in `popover.component.ts` and `core/utils.ts`'s three positioning helpers. Other internals (`_popover`, `_dropdown`, `_container`, `_typeahead`) re-verified present — check each individually, they do not change as a family |
| §32 | Angular 21 | Angular 21 | Blank page / stuck spinner — a property write gating an `@if` block (or, in one case, blocking clicks via a spinner overlay) via bare `setTimeout`/`.then()`/`.subscribe()` stops reliably triggering change detection; invisible to build/test, only found live in Step 9 (and one instance only via actual click-through interaction testing, not load-only checks). **7 confirmed instances** across `app.component.ts` (×2), `base-page.component.ts` (×2), `base-spa-page.component.ts` (×2), `base-partial.component.ts`, `base-prefab.component.ts`. Fixed by `this.cdr.detectChanges()` immediately after each flag write — **not** `ngZone.run(() => appRef.tick())` (an earlier, wrong iteration that reintroduces `NG0100`). Angular 21 zoneless-by-default investigated and ruled out as the cause (app is confirmed zone-based via source read). Re-check scope at the next hop — see `patterns/runtime.md` §32 for the full fix history and scan script |
| §37 | Every major | Angular 22 | `projects/*/package.json` `peerDependencies` (this repo's *published* libs) never bumped by any prior hop — silent, found by manual grep after 18→22. Distinct from §22 (consumed `.yalc` packages). Automated in `pattern-review.sh` |
| §38 | Angular 22 (re-check every major) | Angular 22 | Private `_*-chunk.mjs` imports get inlined into a 2nd UMD entry (`platform-browser/animations`) → duplicate `DomRendererFactory2`/`BrowserModule` → Preview NG0200 `RendererFactory2`; deployment mode unaffected. Fixed by providing `RendererFactory2` → `WMDomRendererFactory2` in `runtime-dynamic/app.config.ts` after `provideAnimations()` (as on `feature/angular-22-upgrade`) |

---

### 21. ng-packagr library build failures

**When:** `build.sh -f` builds multiple libraries via ng-packagr before the rollup bundle step. ng-packagr failures appear **before** rollup runs and are distinct from §8 (rollup bundle renames). The ng-packagr version is locked to the Angular major via `ng-packagr` in `package.json` (bumped in Step 3).

**Files to check when ng-packagr fails:**
- `projects/<lib>/ng-package.json` — `lib.entryFile`, peer dep declaration
- `projects/<lib>/src/public-api.ts` — re-exports of Angular internals renamed/removed in this major
- `projects/<lib>/tsconfig.lib.json` — extends chain, `angularCompilerOptions`

**Common failure patterns:**

| Symptom | Root cause | Fix |
|---------|-----------|-----|
| `Error: Could not resolve entry point 'projects/X/src/public-api.ts'` | `public-api.ts` re-exports a deleted or renamed Angular internal | Remove or replace the re-export |
| `Error: Unexpected value 'X' declared by the module 'Y'` | ng-packagr validation stricter on non-standalone component in `declarations` | Move to `imports` or add `standalone: true` |
| `NG6001: … is not a directive, component, or pipe` | Component moved from `declarations` to `imports` in upstream but consumer not updated | Update `imports` array in affected NgModule |
| `Property 'X' has no initializer` | New TS version raises `strictPropertyInitialization` on library public API | Add `!` assertion or initializer |
| `TS18002: The 'files' list in config file '…' is empty` | `tsconfig.lib.json` inheritance changed in ng-packagr | Check `extends` chain in the failing library |

**Diagnostic steps:**

```bash
# Run full build — ng-packagr error appears before rollup output
sh build.sh -f 2>&1 | head -150

# Library name appears in the error path — inspect that library's public-api.ts
```

**Step 6 classification:**

| Finding | Label |
|---------|--------|
| ng-packagr fails on Angular internal re-exported from `public-api.ts` | `must-change` |
| ng-packagr fails on TS strictness not present in prior version | `must-change` |
| ng-packagr peer dep warning in log only (not an error) | `needs-review` |

**This section has no `pattern-review.sh` automation** — failures surface as non-zero exit from `build.sh -f`. Step 7 gate catches them.

---

### 22. Yalc-linked package peer dependency mismatch

**When:** after Step 4 `npm install`, `.yalc`-linked packages (`@wavemaker/variables`, `foundation-css`, `custom-widgets`) may declare peer deps referencing the **old** Angular major.

**Symptom:**

```text
npm warn WARN  @wavemaker/variables@X.Y.Z requires a peer of @angular/core@^20.0.0 but none is installed.
```

Or silently: two copies of `@angular/core` resolve (pinned 21.x at root, transitive 20.x inside a yalc package), causing DI token mismatches or injection failures in Step 9 preview.

**Check after Step 4:**

```bash
# Peer dep warnings in install output
npm install 2>&1 | grep -i 'peer\|unmet'

# Verify single @angular/core version resolves
cat node_modules/@angular/core/package.json | grep '"version"'

# Check yalc package's declared peer deps
cat .yalc/@wavemaker/variables/package.json | grep -A5 'peerDependencies'
```

**Outcomes and actions:**

| Outcome | Action |
|---------|--------|
| Warning only; single `@angular/core` in root `node_modules` | Record in `current-state.md`; acceptable for upgrade branch |
| Two `@angular/core` versions visible under `.yalc/*/node_modules/` | Add `overrides` in root `package.json`: `"overrides": { "@angular/core": "^21.0.0" }` |
| Yalc package needs its own Angular N build | Coordinate with the package team; upgrade that package separately first |
| `NullInjectorError` from a yalc-provided service in Step 9 | Likely duplicate Angular runtime — apply `overrides` or re-yalc after resolving peer deps |

**Step 6 classification:** peer dep warning in install log → `needs-review`; duplicate Angular runtime confirmed → `must-change`.

**Note:** yalc packages are listed as "Keep stable" in the dependency classification table — this section handles the case where they cannot stay stable because their declared peer deps reference the old Angular major.

---

### 23. `angular.json` builder audit

**When:** check every major — Angular periodically renames or deprecates builders and removes options.

**Files:** `angular.json` in ng-runtime root; `angular.json` in `@wavemaker-ai/angular-app`; any codegen-written `angular.json` via `wavemaker-ng-codegen/src/update-angular-json.js`.

**Known renames:**

| Angular | Old | New | Notes |
|---------|-----|-----|-------|
| Angular 17 | `@angular-devkit/build-angular:browser` | `@angular-devkit/build-angular:application` | `browser` still works in 17–20 but deprecated; removed in a future major |
| Angular 17 | `@angular-devkit/build-angular:browser-esbuild` | merged into `application` | — |
| Each major | — | Check R1 Angular Update Guide for `extractLicenses`, `sourceMap`, `budgets` option schema changes | Options removed → schema validation error |

**Step 6 grep:**

```bash
grep '"builder"' angular.json | sort | uniq
# Compare against Angular N release notes / migration guide for deprecated builder names
```

**Signs of a stale builder:**

```text
Schema validation failed: Data path "/options/…" must NOT have additional properties
Warning: The …:browser builder is deprecated. Use …:application instead.
```

**Step 6 classification:**

| Finding | Label |
|---------|--------|
| Builder deprecated but functional | `needs-review` — plan migration; does not block current upgrade |
| Builder option schema error (unknown/removed property) | `must-change` — remove or rename the invalid option |
| Builder not found (package removed) | `must-change` — update builder reference |

**Do not switch `browser` → `application` as part of a compatibility-only upgrade** unless the build fails — that switch has its own migration implications (output path structure, polyfill config). Record it as a deferred item in `docs/{major}-upgrade.md`.

---

### 24. Deprecation watch list

**Purpose:** capture APIs deprecated in the **target version** that will be removed in the **next major**. Populated at Step 10 using R1/R3 research already done during this run. At the start of the next upgrade's Step 2, read this section first — any item here is already `must-change` for the next major.

**How to populate:** during Step 2 R1/R3 review, note every `@deprecated` annotation or "will be removed in Angular N+1" notice. Add a row here before completing Step 10.

**Template:**

| API / pattern | Deprecated in | Removed in | Affected files | Notes |
|---------------|--------------|-----------|---------------|-------|

---

**Angular 21 → Angular 22 watch items** — **abandoned, historical.** Angular 21→22 shipped (`aab04e7ae` et al.) without going through this skill's Step 2, so no genuine R1/R3 deprecation research exists for this row. Left unfilled rather than fabricated after the fact — see `docs/upgrade-log/21-to-22.md` for what *was* reconstructed from commit messages (actual breaking changes hit, not forward-looking deprecations).

---

**Angular 22 → Angular 23 watch items** *(fill in at Step 10 of the 22→23 upgrade)*

> Add rows here from R1/R3 deprecation notices found during Step 2 research for Angular 22. Leave blank if no deprecation notices were found. The 21→22 upgrade shipped outside this skill's Step 2, so there's no genuine prior research to seed this from — this section starts empty, same as §24's placeholder is designed to.

| API / pattern | Deprecated in | Removed in | Affected files | Notes |
|---------------|--------------|-----------|---------------|-------|
| *(populate from R1 Angular 22 migration guide deprecation section)* | Angular 22 | Angular 23 | | |

---

**Previously resolved** *(move rows here once fixed to preserve history)*

---

### 25. TypeScript version-specific strictness

**When:** every Angular major bundles a new minimum TypeScript version (R2). TypeScript majors can introduce new strictness defaults or remove previously tolerated patterns — these appear as fresh TS errors after the Step 3 bump even though no Angular API changed.

**These are distinct from §19 (expression parser) and §8 (moduleResolution):** §19 covers `@angular/compiler` internal API signature changes; §8 covers package resolution; this section covers TypeScript compiler behavior changes.

**Known patterns to check after a TypeScript major bump:**

| TS version | Strictness change | Symptom | Fix |
|-----------|------------------|---------|-----|
| TS 4.9+ | `satisfies` operator available but not required | No error — optional use | N/A for compatibility upgrades |
| TS 5.0 | `verbatimModuleSyntax` makes type-only imports explicit | `TS1484: 'X' is a type and must be imported using a type-only import` | Add `import type` or use `import { type X }` |
| TS 5.0 | Stricter override checking with `noImplicitOverride` | `TS4114: This member must have an 'override' modifier` if compiler option enabled | Add `override` keyword or disable option if not yet adopted |
| TS 5.2+ | `using` / `Symbol.dispose` reserved | Conflicts if `using` used as a variable name | Rename variable |
| TS 5.4+ | Stricter narrowing with `NoInfer<T>` | Type inference changes can break generic helpers | Explicit type annotation where inference changed |
| TS 5.5+ | Inferred type predicates — stricter filter narrowing | Array `.filter(Boolean)` infers `NonNullable` — downstream type may change | Update downstream type annotation |
| TS 5.6+ | `Iterator` built-in type | Conflicts if custom `Iterator` interface declared | Rename custom interface |
| **TS 6.0** | **`strict` now defaults to `true`** (previously `false` when unset) — confirmed against TypeScript's own 6.0 release notes | A flood of `TS7053`/`TS7006`/`TS2532`/`TS18049` (`noImplicitAny`, `strictNullChecks`, …) across files nobody touched. In this repo it first appeared in `projects/variables/src/service/variables.service.ts` and failed the ng-packagr library build, which then cascaded into misleading `TS2307: Cannot find module '@wm/...'` errors everywhere downstream | Set `"strict": false` **explicitly** in `tsconfig.json` (and any sibling tsconfig that does not extend it, e.g. `tsconfig.web-app.json`). This is the one sanctioned exception to "do not disable the strictness flag" below: TS changed the meaning of *unset*, so pinning `false` preserves the pre-6.0 behavior rather than masking a new bug. Real strict-mode adoption is a separate, deliberate project |
| **TS 6.0** | `baseUrl` / `downlevelIteration` deprecated | `TS5101: Option 'X' is deprecated and will stop functioning in TypeScript 7.0` — an **error that stops `tsc` before type-checking**, not a warning | Add `"ignoreDeprecations": "6.0"` (TypeScript's own documented escape hatch, named in the error text) rather than redesigning module resolution / iteration downleveling mid-upgrade |
| **TS 6.0** | Side-effect-only imports need type declarations | `TS2882: Cannot find module or type declarations for side-effect import of 'X'` — e.g. `import "@fullcalendar/core/index.global.min.js"` | `// @ts-ignore` above the import when the target is a pre-bundled JS global with no shipped `.d.ts`, or add a `declare module` |

**Angular's own template strictness is a separate axis from TS `strict`** — see the `angularCompilerOptions` note below.

| Angular version | Change | Symptom | Fix |
|---|---|---|---|
| **Angular 22** | The legacy `fullTemplateTypeCheck: false` no longer fully suppresses template property-access checking on its own | `TS2339`/`TS2551: Property 'iconwidth' does not exist on type 'ButtonComponent'` from `*.component.html`, for properties this codebase assigns dynamically via `registerProps()`/`PROP_STRING` and never declares as real class members | Add an explicit `"strictTemplates": false` to `angularCompilerOptions` alongside the existing `fullTemplateTypeCheck: false` |

**Step 6 workflow for TS strictness errors:**

1. After Step 4 install, run `npx tsc --noEmit` in ng-runtime. Any new TS errors that did not exist before are candidates for this section.
2. Distinguish: is the error caused by an Angular API change (→ §1–§23) or purely a TypeScript behavior change (→ this section)?
3. Fix by updating source code to match the new strictness requirement. Do **not** disable the strictness flag globally — that masks real bugs. **One narrow exception:** when TypeScript changes the *default* of a flag the repo never set (TS 6.0's `strict`, Angular 22's effective template checking), explicitly pinning the previous default is preserving behavior, not masking a bug — the code was never in scope for that check to begin with. Pin it, record it in the table above, and leave real adoption to a separate project.
4. If the error is in a file that has not otherwise changed (i.e., no Angular API was touched there), it is very likely a TS strictness change.

**Step 6 grep:**

```bash
# Quick tsc check without full Angular compilation
npx tsc --noEmit 2>&1 | grep 'error TS' | grep -v 'node_modules' | head -40
```

**Step 6 classification:**

| Finding | Label |
|---------|--------|
| New TS error in source file not touched by Angular API change | `must-change` |
| New TS error caused by stricter inference on existing code | `must-change` |
| TS option deprecated but not yet removed | `needs-review` |

**Do not add `// @ts-ignore` or `// @ts-expect-error` to suppress new strictness errors** — fix the underlying type. The one exception is a known TypeScript compiler bug with a tracked issue and a planned fix in the next TS minor; document it in `current-state.md` with the issue link.

---

## Classification guide

| Label | Meaning | Action |
|-------|---------|--------|
| `safe` | Pattern present and verified compatible | Record; no change needed |
| `needs-review` | May work; inspect after install/build | Record; verify in Step 9 |
| `likely-breakage` | Strong chance of failure; fix before preview | Fix now or defer with justification |
| `must-change` | Incompatible; **block** upgrade until fixed | Fix before marking Step 6 done |

---

## Preview validation (Step 9)

**Gate G1–G7:** see `steps-6-10.md` Step 9 — all required, source of truth is there. Both this table and the extended checks below apply identically to **every configured validation mode** (`VALIDATION_MODES` in `repo.config.sh` — currently Angular Deployment and WaveMaker Preview) — there is one shared checklist, not a checklist per mode.

URLs from Step 0, per mode. Order: comparison first → note all visible elements → preview → compare element by element (hard refresh both). Repeat for each configured mode. Fix loop: `steps-6-10.md` Step 9 (a fix found via one mode should be re-verified against every other already-passed mode too, since they share the same underlying build).

### Extended checks (run on each mode's preview URL — compare against that mode's comparison URL)

| # | Check |
|---|--------|
| E1 | **Page with query params** — variables see params on first load |
| E1 | **Page with query params** — variables see params on first load |
| E2 | Runtime-compiled page or partial renders |
| E3 | Table **row expand**, row **actions**, **filter row** widgets |
| E4 | **List** with row-level **menu** widget |
| E5 | Modal open/close and focus return (stacked modals z-index) |
| E6 | Popover/dropdown positioning (no `PositioningService` / `__destroyRef` errors) |
| E7 | **Popover + date/time picker** inside — picker usable, popover stays open |
| E8 | Date/time picker open, select, close, **reopen** |
| E9 | Typeahead / search dropdown not clipped |
| E10 | **File upload** success and delete |
| E11 | **Table** bound to modal/script variable shows data |
| E12 | **Watch / bind expressions** — parenthesized expr and piped bind (§19) |
| E13 | Menu / typeahead / overlay widget (ngx-bootstrap bundle patch when Step 7 verify = yes) |

Record pass/fail per gate check (G1–G7), extended items tried, comparison baseline notes, and any regression vs comparison in `current-state.md` → **Preview Validation** → the matching mode's subsection.
