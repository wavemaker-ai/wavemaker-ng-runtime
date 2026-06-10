# Angular 21 upgrade — wavemaker-ng-runtime

Re-validation run (2026-06-03) via angular-upgrade skill Steps 0–10. Branch `WMS-31488`.

Configuration source: `.cursor/skills/angular-upgrade/repo.config.sh`.

## Libraries upgraded

| Package | Before (base 20) | After (target 21) |
|---------|------------------|-------------------|
| `@angular/core` and platform packages | 20.x | **21.2.14** |
| `@angular/cli` / `@angular-devkit/build-angular` | 20.x | **21.2.13** |
| `@angular-eslint/*` | 20.x | **21.4.0** |
| `@angular-builders/custom-webpack` | 20.x | **21.0.3** |
| `ngx-bootstrap` | 20.x | **21.2.0** |
| `ng-packagr` | 20.x | **21.2.3** |
| `typescript` | ~5.8 | **5.9.3** |
| `rxjs` | 7.8.x | **7.8.2** |
| `zone.js` | 0.15.x | **0.16.2** |
| `jest` / `jest-preset-angular` | 29.x / 14.x | **30.0.5** / **16.1.5** |

*This run: `package.json` already at target versions — no Step 3 edits.*

## Compatibility changes

- `tsconfig.json`: `@wavemaker-ai/variables` path prefers `dist/es2015/index` over yalc source (TS6059 rootDir) — from prior 20→21 build fix
- **`tsconfig.web-app.json`**: aligned with `tsconfig.json` — `moduleResolution: "bundler"`, `module`/`lib` es2022, `esModuleInterop`, `useDefineForClassFields` (codegen renames this file to the generated app’s `tsconfig.json`; legacy `"node"` caused TS2307 on `@angular/common/http` and ngx-bootstrap subpaths)
- **ngx-bootstrap 21**: bare modules in `importProvidersFrom` / page imports — no `.forRoot()` on `ModalModule`, `BsDatepickerModule`, `NgCircleProgressModule` (runtime `app.config.ts`, transpiler `imports.ts`, codegen `app.config.ts.hbs`)
- Expression parser: `ParseSourceSpan` + `ParenthesizedExpression` handler (Angular 20+ compiler AST)
- Dynamic components: object-syntax `createComponent` with `environmentInjector`
- ngx-bootstrap positioning: Rollup patch injects `DestroyRef` for `takeUntilDestroyed(__destroyRef)`

## Patches and build hooks

- `build-scripts/ngx-bootstrap-patch.mjs` — patches positioning ESM before Rollup bundle
- Post-build verify: `scripts/verify-ngx-bootstrap-bundle.sh` checks `ngx-bootstrap.bundle.js` and `wm-libs.js`

## Validation completed

| Gate | Result | Notes |
|------|--------|-------|
| Step 0 — Upgrade gate | pass | repo.config 20→21 |
| Step 1 — Inventory | pass | @angular/core 21.2.14; patterns resolved |
| Step 2 — Plan | pass | re-validation run |
| Step 3 — Package edits | pass | no changes needed |
| Step 4 — Install | pass | npm install |
| Step 5 — Security | pass | 3 moderate (webpack-dev-server); no critical/high |
| Step 6 — Patterns | pass | no must-change |
| Step 7 — Build | pass | `sh build.sh -f` ~340s |
| Step 7 — Bundle verify | pass | DestroyRef patch in both bundles |
| Step 8 — Preview | skipped | PREVIEW_URL empty; set URLs in repo.config for automated compare |
| Step 9 — Unit tests | pass | 126 suites, 4265 tests |

## New platform features intentionally not adopted

- Zoneless change detection — runtime still uses `zone.js`
- Standalone-only bootstrap refactor — hybrid module + standalone dynamic components retained
- Signal-based APIs wholesale migration — deferred; existing binding/watch pipeline unchanged

## Known follow-ups

### This repo (runtime)

- Set `PREVIEW_URL` / `COMPARISON_URL` in `repo.config.sh` for Step 8 URL comparison on next run
- 3 moderate webpack-dev-server advisories (no upstream fix via `npm audit fix`)
- Jest worker teardown warning (`--detectOpenHandles` if investigating leaks)

### Cross-repo — generated Angular apps (`wavemaker-ng-codegen`)

Runtime Step 7 passes in **this repo**; **`ng build` on a codegen output app** needs sibling-repo fixes (patterns §20):

| # | Repo | Action | Status |
|---|------|--------|--------|
| 1 | `wavemaker-ng-runtime` | `tsconfig.web-app.json` aligned with `tsconfig.json`; rebuild/publish `@wavemaker-ai/angular-app` | done (WMS-31488) |
| 2 | `wavemaker-ng-runtime` | `projects/transpiler/src/imports.ts` — bare ngx-bootstrap modules; `sh build.sh -f` refreshes `dependencies/*.cjs.js` | verify on publish |
| 3 | `wavemaker-ng-codegen` | **`templates/app.config.ts.hbs`** — remove ngx-bootstrap `.forRoot()`; `sh build.sh`; publish codegen | pending commit |
| 4 | Generated app | Re-run **codegen** then `npm install` + `ng build` — existing folders are not auto-fixed | user verification |

**Notes:**

- Codegen emits **`app.config.ts`** only — `templates/app.module.ts.hbs` is **legacy/unused** (not registered in `handlebar-helpers.js`).
- If codegen fails with `Cannot find module '../dependencies/...'`, apply §20c path suffix fixes in ng-codegen `src/` (`.cjs` → `.cjs.js`) — conditional, not required for runtime build gate.
- Stale `.yalc/@wavemaker/angular-app` in ng-codegen may still show old `ModalModule.forRoot()` — refresh with `yalc update` after republish.

## Security notes

- `npm audit`: 3 moderate severity (webpack-dev-server transitive via `@angular-devkit/build-angular`)
- No critical or high vulnerabilities
- `npm audit fix` (no `--force`) applied; lockfile unchanged this run

## Manual preview checklist

When `PREVIEW_URL` is set, repeat on comparison then preview URLs. See `wavemaker-runtime-patterns.md` § Preview validation checklist.

1. App shell loads — no `overrideRouterOutlet` / `reading 'attach'` errors
2. Popover opens; date and time pickers visible where applicable
3. Open date/time picker inside popover — popover stays open
4. Reopen picker after close
5. No `__destroyRef is not defined` / `PositioningService` console errors

## References

- Skill: `.cursor/skills/angular-upgrade/SKILL.md`
- Patterns: `.cursor/skills/angular-upgrade/wavemaker-runtime-patterns.md` (§20 = generated-app / codegen)
- Cross-repo: `wavemaker-ng-codegen` — `templates/app.config.ts.hbs`, `src/gen-tsconfig.js`
- State: `.cursor/skills/angular-upgrade/current-state.md`
