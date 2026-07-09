# Angular 20 Upgrade

Date: 2026-07-08
Branch: test (ng-runtime + ng-codegen)

## Status summary

- Steps 0–7: **done**, committed to ng-runtime (`b641fe350`, `47ca1c322`).
- Step 8 (Unit Tests): **skipped by user mid-diagnosis**. Root cause largely identified (Angular 20 defaults `standalone: true`); partial fixes exist in the working tree but are **uncommitted**.
- Step 9 (Preview Validation): **skipped** — blocked by a pre-existing, non-upgrade bug in `config/rollup.build-task.mjs` that prevents ng-codegen from generating an app at all. Not attempted (no Tomcat deploy, no G1–G7/E1–E13 checks).
- ng-codegen: no package/version changes were required (no direct Angular dependency); `sh build.sh` runs clean.

**This upgrade is not fully validated end-to-end.** See Deferred Items before merging.

## Process note

Step 2 (research) was delegated to a background research agent that was explicitly scoped to "research only, do not write files." It exceeded that scope and autonomously executed Steps 3–7, including two git commits, without interim review. The commits were reviewed afterward (diffs spot-checked against the documented plan) and kept, since the technical content held up — but Steps 8–10 proceeded under normal step-by-step visibility with the user.

## Versions

| Package | Before | After |
|---------|--------|-------|
| @angular/animations, common, compiler, core, forms, platform-browser, platform-browser-dynamic, router, service-worker | 18.2.13 | 20.3.25 |
| @angular/cli | 18.2.12 | 20.3.25 |
| @angular/compiler-cli | 18.2.13 | 20.3.25 |
| @angular/language-service | 18.2.13 | 20.3.25 |
| @angular-devkit/build-angular | 18.2.20 | 20.3.25 |
| @angular-builders/custom-webpack | 18.0.0 | 20.0.0 |
| typescript | 5.5.4 | 5.8.3 |
| rxjs | 7.8.2 | unchanged |
| zone.js | 0.15.1 | unchanged |
| ngx-bootstrap | 9.0.0 | 20.0.2 |
| ng-packagr | 17.3.0 | 20.3.2 |
| jest-preset-angular | ^15.0.0 | ^17.0.0 |
| @angular-eslint/*, ngx-color-picker, ngx-toastr | already 20.1.1 / 20.1.1 / 19.0.0 | unchanged (already correct) |
| Node (engines.node) | 22.18.0 | unchanged (already satisfies Angular 20) |

ng-codegen `package.json`: no changes — it has no direct `@angular/*` dependency; Angular flows in only via the yalc-linked `@wavemaker-ai/angular-app` built from ng-runtime.

## References Reviewed

- R1/R3: Angular Update Guide + CHANGELOG, verified empirically against actual `@angular/core`/`@angular/compiler` tarballs at 18.2.13/19.2.14/20.3.25 (not just the shared pattern files, which reflect a prior 20→21 upgrade). Confirmed breaking: `Element` (html_ast) constructor 6→9 args, `Parser.parseBinding`/`parseAction` now require `ParseSourceSpan`, `PropertyWrite` AST class removed, page `queryParams` timing, template `this.` rejection, `ngTemplateOutletContext` row aliasing. Confirmed N/A for this hop: `compileModuleAndAllComponentsSync` (still present at 20.3.25), positional `createComponent()` (deprecated but still present, not removed), `browser` builder (still functional).
- R2: TypeScript 5.8.3, Node 22.18.0 (no change), RxJS 7.8.2 (no change), zone.js ~0.15.1 (no change) — via `angular.dev/reference/versions`.
- R5: target `20.3.25` confirmed as the stable LTS tag (not RC/prerelease).
- R8: ngx-bootstrap 20.0.2 targets Angular ^20.0.2; confirmed via tarball inspection that `.forRoot()` is still present and `PositioningService` doesn't need the `__destroyRef` patch — both of those are ngx-bootstrap 21 / Angular 21 changes, not applicable at this target.
- R9/R10: jest-preset-angular 17.0.0, ng-packagr 20.3.2 pinned to match Angular 20.
- R12: checklist.md/patterns files were written for a 20→21 hop; several of their automated FAIL checks (§1, §2, §6, §20b) are false positives for this 18→20 target and were verified/overridden with direct package inspection (see Pattern Findings in the (now-reset) session state, or the commit message on `b641fe350`).

## Breaking Changes Applied

| Change | Repo | Files | § / Ref |
|--------|------|-------|---------|
| `Element` (html_ast) constructor 6-arg → 9-arg | runtime | `projects/transpiler/src/build.ts`, 5 `*.build.ts` files under `projects/components/transpile/src/**` | §4 |
| `Parser.parseBinding`/`parseAction` require `ParseSourceSpan` not string | runtime | `projects/core/src/utils/expression-parser.ts` | §19a |
| `PropertyWrite` removed; `ParenthesizedExpression` handling added | runtime | `projects/core/src/utils/expression-parser.ts` | §19b |
| Template `this.` context refs removed | runtime | `form.component.html`, `file-upload.component.html` (×2), `date/time/date-time.component.html` | §14 |
| Page query params: synchronous snapshot seed before subscribe | runtime | `base-page.component.ts`, `base-spa-page.component.ts` | §15 |
| `ngTemplateOutletContext` `row:` alias added | runtime | `list.component.html` | §16 |
| `tsconfig.web-app.json` `module` es2020→es2022 realignment | runtime | `tsconfig.web-app.json` | §20a |
| ngx-bootstrap 20 dropped bs3 theme; switched to bs5 | runtime | `app.component.ts` | new finding, not in pattern files |
| Rollup ngx-bootstrap config `fesm2020`→`fesm2022` paths | runtime | `config/rollup.ngxBootstrap.config.mjs` | new finding, surfaced by Step 7 build failure |
| `lodash-es` exact pin bumped 4.17.21→4.18.1 (high-severity CVEs, not auto-fixable due to exact pin) | runtime | `package.json` | Step 5 security audit |
| codegen | none required | — | §20 items (moduleResolution `bundler`, ngx-bootstrap `forRoot()` removal, `.cjs.js` rename) are all Angular-21-only; confirmed N/A at this target |

## Unit Tests

- Not completed. At the point testing was stopped: 121/126 suites passing, 3854/4022 tests passing (133 failing across 5 suites).
- Root cause identified: Angular 20 defaults `@Component` to `standalone: true`. A generic fix (`splitStandaloneDeclarations` helper in `projects/components/base/src/test/util/component-test-util.ts`, auto-detects standalone declarations and moves them into TestBed `imports`) plus explicit `standalone: false` on ~76 test wrapper components were applied — **uncommitted**.
- Still failing at time of stopping (not yet root-caused/fixed):
  - `projects/core/src/utils/utils.spec.ts` — TS 5.8 stricter typing rejects `window.location = {...} as Location` (§25 TS strictness; fix: cast via `as unknown as Location`).
  - `currency.wrapper.component.spec.ts` — local wrapper component missing `standalone: false`.
  - `progress-circle.wrapper.component.spec.ts` — `CircleProgressComponent` (from `ng-circle-progress`) appears to Angular 20's compiler as standalone even though not explicitly marked in its source; root cause not fully confirmed.
  - `date.wrapper.component.spec.ts`, `checkboxset.wrapper.spec.ts` — not yet root-caused.

## Preview Validation

- **Not run.** Blocked before deploy: `config/rollup.build-task.mjs` targets per-file ESM output paths (`libraries/core/esm2022/utils/expression-parser.mjs`, `libraries/runtime/base/esm2022/services/pipe-provider.service.mjs`) that ng-packagr has not produced since v13 — years before this repo's pre-upgrade ng-packagr 17.3.0. Confirmed byte-identical in the pre-upgrade commit `511657fda`, so this is **not caused by the Angular 18→20 upgrade**. It silently worked before only because a stale `libraries/` directory from an old build had valid per-file output sitting on disk; Step 7's fresh `build.sh -f` wiped and regenerated `libraries/`, exposing the dead rollup config for the first time. Symptom: `wavemaker-ng-codegen` crashes with `TypeError: pipeProvider.PipeProvider is not a constructor` in `wm-utils.js` during `codegen-args-cli`, before any app can be generated.
- Preview URL: `http://localhost:8080/DataTableAndChartsRendering/#/Main` — not reached.
- Comparison URL: `http://stage-apps-platform.wavemaker.ai/pkdn59qkxh4c/DataTableAndChartsRendering` — not compared against.

## Deferred Items

1. **Blocking, pre-existing (not from this upgrade):** `config/rollup.build-task.mjs` per-file ESM paths are dead — must be repointed to `fesm2022/index.mjs` (or the relevant flattened bundle) before codegen can run at all. This blocks all preview validation for this branch until fixed.
2. **Unit tests incomplete and uncommitted:** 5 suites / 133 tests still failing; partial fixes (the `splitStandaloneDeclarations` helper + `standalone: false` additions) exist in the working tree only. Needs to be finished and committed before this branch can be considered test-clean.
3. **§20e (pre-existing, unrelated to this upgrade):** `wavemaker-ng-codegen/src/update-angular-json.js` uses the wrong foundation-css path (missing `dist/styles/foundation/`), flagged by `pattern-review.sh`. Out of scope for this upgrade; flagged separately.
4. **pattern-review.sh non-zero exit accepted with justification:** §1, §2, §6, §20b FAILs are false positives for this specific 18→20 target — the shared pattern files assume a later (20→21 / ngx-bootstrap 21) target where `.forRoot()` removal and the `__destroyRef` patch apply. Verified via direct ngx-bootstrap 20.0.2 tarball inspection that neither applies yet.
5. **§11 needs-review:** `overrideRouterOutlet` uses a plain `@ViewChild` field, not the setter pattern the pattern files recommend for later majors — not changed pre-emptively per Compatibility Policy; watch for RouterOutlet timing errors once preview validation is eventually run.
6. **Remaining npm audit findings (25: 10 high / 12 moderate / 3 low):** all in devDependency/build-tooling only (vite/esbuild dev-server chain, rollup, tar, compression-webpack-plugin, compodoc transitive deps) — none shipped in the production bundle; fixing requires unrelated breaking major bumps out of scope for this upgrade.
7. **node_modules/package.json drift observed at Step 1:** before this run started, `node_modules/@angular/core` already reported `20.3.19` while `package.json`/lock said `18.2.13` — evidence of a prior, unrelated partial upgrade attempt in this workspace. Reconciled naturally by Step 4's `npm install`; no residual concern.

## Not done

- Steps 8, 9, and 10's normal "done" bar (tests passing, preview G1–G7 confirmed) were **not met**. This doc is being written with Step 9/10 in a "skipped, documented" state per explicit user decision, not because the gates were satisfied.
