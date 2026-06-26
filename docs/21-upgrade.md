# Angular 21 Upgrade Summary

**Branch:** WMS-31488  
**Date:** 2026-06-18 (initial); 2026-06-26 (re-validation)  
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
| Pattern review | pass | `pattern-review.sh` — §9 WARN is false positive (jest-preset-angular 16.x peer deps cover Angular 21); §13a WARN accepted as known gap (see below) |
| Build | pass | `build.sh -f` 412s |
| Post-build verify | pass | ngx-bootstrap bundle grep |
| Local Tomcat — preview | pass | G1–G7 + E6–E9 visual parity checks (2026-06-26) |
| Local Tomcat — comparison | pass | stage `#/Main` |
| Unit tests | skipped | re-validation run |

## New platform features not adopted

- Angular 22 `animate.enter` / `animate.leave` migration
- Zoneless / standalone-only refactor beyond current `app.config.ts` pattern

## Known gaps / follow-ups

1. **npm audit** — Residual high in `piscina`, `undici`, `vite` (devkit chain); evaluate on next CLI bump
2. **§13a ɵSharedStylesHost in app.config.ts** — Adding it to the standalone root causes a second `WMDomSharedStylesHost` instance in lazy-route child injectors (RuntimeBaseModule also provides it). On navigation the child instance calls `ngOnDestroy`, stripping style nodes and breaking left-nav rendering. NgModule registration in `runtime-base.module.ts` is sufficient for now; defer until standalone migration removes the NgModule boundary.

## Security notes

- `npm audit fix` (no `--force`) in Step 5
- Angular runtime at 21.2.17
