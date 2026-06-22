# Angular 21 Upgrade Summary

**Branch:** WMS-31488  
**Date:** 2026-06-18 (validation re-run)  
**Base → Target:** Angular 20 → 21

## Libraries upgraded

| Package | Version |
|---------|---------|
| `@angular/*` (core packages) | 21.2.17 |
| `@angular/cli`, `@angular-devkit/build-angular` | 21.2.15 |
| `ngx-bootstrap` | 21.2.0 |
| `typescript` | 5.9.3 |
| `zone.js` | 0.16.2 |

Runtime was already on Angular 21 before this run; no `package.json` version changes required.

## Compatibility changes

### wavemaker-ng-runtime
- tsconfig `moduleResolution: bundler` aligned with `tsconfig.web-app.json`
- App shell §11b/§11c guards; no legacy `compileModuleAndAllComponentsSync`
- ngx-bootstrap bundle patch verified post-build

### wavemaker-ng-codegen
- **`templates/app.config.ts.hbs` (§20b):** `NgCircleProgressModule` — bare module (no `.forRoot()`)
- **`src/update-angular-json.js` (§20e):** Prism `foundation-css` path → `dist/styles/foundation/foundation.css`

## Patches and build hooks

- **ngx-bootstrap DestroyRef patch** — verified via `verify-ngx-bootstrap-bundle.sh`
- **yalc:** refresh `.yalc/@wavemaker-ai/angular-app` after runtime bundle changes

## Validation completed

| Step | Result | Notes |
|------|--------|-------|
| Install | pass | `install.sh` |
| Security audit | pass (script) | 34 vulns; 9 high in build toolchain; no `--force` |
| Pattern review | pass | `pattern-review.sh` after codegen §20b/§20e fixes |
| Build | pass | `build.sh -f` ~315s |
| Post-build verify | pass | ngx-bootstrap bundle grep |
| Local Tomcat — preview | pass | HTTP 200 `#/LiveForm_Autocomplete` after codegen redeploy |
| Local Tomcat — comparison | pass | HTTP 200 stage `#/Main` |
| Unit tests | pass | 126 suites, 4265 tests |

## New platform features not adopted

- Angular 22 `animate.enter` / `animate.leave` migration
- Zoneless / standalone-only refactor beyond current `app.config.ts` pattern

## Known follow-ups

1. **npm audit** — Residual high in `piscina`, `undici`, `vite` (devkit chain); evaluate on next CLI bump
2. **Browser smoke** — HTTP 200 only this run; full preview checklist (G1–G4, E1–E13) on demand

## Security notes

- `npm audit fix` (no `--force`) in Step 5
- Angular runtime at 21.2.17
