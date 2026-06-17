# Angular 21 Upgrade Summary

**Branch:** WMS-31488  
**Date:** 2026-06-16  
**Base → Target:** Angular 20 → 21

## Libraries upgraded

| Package | Before | After |
|---------|--------|-------|
| `@angular/*` (animations, common, compiler, core, forms, platform-browser, platform-browser-dynamic, router, service-worker) | 21.2.14 | 21.2.17 |
| `@angular/cli` | 21.2.13 | 21.2.15 |
| `@angular-devkit/build-angular` | 21.2.13 | 21.2.15 |
| `@angular/compiler-cli`, `@angular/language-service` | 21.2.14 | 21.2.17 |
| `ngx-bootstrap` | 21.2.0 | 21.2.0 (unchanged; patch verified in bundle) |
| `typescript` | 5.9.3 | 5.9.3 (unchanged) |
| `zone.js` | 0.16.2 | 0.16.2 (unchanged) |

## Compatibility changes

### wavemaker-ng-runtime
- Runtime already on Angular 21; patch bump to 21.2.17 for security advisories.
- Pattern review passed: tsconfig `moduleResolution: bundler`, app shell bootstrap guards, no legacy compiler APIs, ngx-bootstrap bundle patch present.

### wavemaker-ng-codegen
- **`src/update-angular-json.js` (§20e):** Prism `foundation-css` path corrected from `dist/styles/foundation/foundation.css` to `foundation/foundation.css` (yalc package layout).

## Patches and build hooks

- **ngx-bootstrap DestroyRef patch** (`build-scripts/ngx-bootstrap-patch.mjs`) — verified post-build via `verify-ngx-bootstrap-bundle.sh`.
- **yalc publish:** After bumping root `package.json`, run `sh bundle-angular-app-cli.sh` and `npm install` inside `.yalc/@wavemaker-ai/angular-app/` so the linked package does not retain stale nested `@angular/*` versions.

## Validation completed

| Step | Result | Notes |
|------|--------|-------|
| Install | pass | `install.sh` |
| Security audit | pass (script) | 32 vulns reported; Angular runtime at 21.2.17; remaining highs in build toolchain (esbuild, webpack-dev-server) |
| Pattern review | pass | `pattern-review.sh` |
| Build | pass | `sh build.sh -f` (~7 min) |
| Post-build verify | pass | ngx-bootstrap bundle grep |
| Local Tomcat — preview | pass | `#/LiveForm_Autocomplete` renders form, nav, employee list |
| Local Tomcat — comparison | pass | Stage `#/Main` loads (nav, Department Details form, Employees list) — verified 2026-06-16 |
| Unit tests | skipped | Step 0: `skip tests yes` |

## New platform features not adopted

- Angular 22 `animate.enter` / `animate.leave` migration ( `@angular/animations` deprecation warning only).
- Standalone-only bootstrap refactor beyond existing `app.config.ts` pattern.
- Service worker / SSR hydration hardening beyond patch-level bumps.

## Known follow-ups

1. **Tomcat deploy order** — Copy Angular `index.html` + `ng-bundle/` **after** WAR deploy; WAR default index overwrites Angular shell if copied first.
2. **npm audit** — Residual moderate/high in dev/build deps (`@babel/core`, `esbuild`, `webpack-dev-server`, `jest` chain); evaluate on next Angular CLI bump.
3. **Unit tests** — Run `npm test` when test gate is re-enabled.

## Security notes

- `npm audit fix` (no `--force`) applied during Step 5; no lockfile-breaking force fixes.
- Root and yalc `@wavemaker-ai/angular-app` refreshed to `@angular/*@21.2.17`.
- Transitive advisories in `.yalc/@wavemaker-ai/foundation-css` (`ajv`) remain moderate.
