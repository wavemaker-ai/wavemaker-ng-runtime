# Angular 21 Upgrade — wavemaker-ng-runtime + wavemaker-ng-codegen

**Date:** 2026-06-30  
**Branches:** `stage-ai` (both repos)  
**Angular:** 20.3.19 → 21.2.17

## Summary

Compatibility-only upgrade to Angular 21. No signals, zoneless, or `inject()` style migrations.

## Package changes (ng-runtime)

| Package | From | To |
|---------|------|-----|
| `@angular/*` | 20.3.19 | 21.2.17 |
| `@angular-builders/custom-webpack` | 20.0.0 | 21.1.0 |
| `@angular-eslint/*` | 20.1.1 | 21.4.0 |
| `ng-packagr` | 20.3.2 | 21.2.5 |
| `jest-preset-angular` | 15.0.0 | 16.2.0 |
| `ngx-bootstrap` | 20.0.2 | 21.2.1 |
| `zone.js` | 0.15.1 | 0.16.2 |
| TypeScript | 5.9.3 | 5.9.3 (unchanged) |
| RxJS | 7.8.2 | 7.8.2 (unchanged) |
| Node (`engines.node`) | 22.18.0 | 22.18.0 (unchanged) |

## Breaking changes fixed

| Area | Fix |
|------|-----|
| §8 / §20a | `moduleResolution: "bundler"` in `tsconfig.json` + `tsconfig.web-app.json` |
| Bootstrap | Removed ngx-bootstrap `.forRoot()` from `app.config.ts`, `app.module.ts`, codegen `app.config.ts.hbs`; added `provideZoneChangeDetection` to codegen template |
| §8 rollup | Angular 21 fesm primitive paths in `rollup.ng-libs.config.mjs` |
| §6 / §12 | ngx-bootstrap patch: skip erroneous `__destroyRef` rewrite for ngx-bootstrap 21 `takeUntilDestroyed()` in constructor |
| Angular 21 `@HostListener` | Split menu/checkbox listeners; removed literal string args |
| ngx-bootstrap 21 signals | `BsDropdownDirective.autoClose` via `_state.autoClose` |
| §6 positioning | `runAfterStable()` fallback when dropdown ref has no `NgZone` |
| Search | `@Inject(App)`; removed duplicate `binddisplaylabel`; `limit` binding for typeahead |
| §20e | `foundation-css` dist path in `update-angular-json.js` |
| Jest specs | Bare ngx-bootstrap modules in wrapper spec imports |

## Validation

| Step | Result |
|------|--------|
| Step 7 build (`sh build.sh -f`) | Pass |
| Bundle verify (`verify-ngx-bootstrap-bundle.sh`) | Pass |
| Step 8 unit tests (`npm test`) | Pass — 126 suites, 4265 tests |
| Step 9 preview (Tomcat) | **Pending** — `~/Desktop/SearchWidgetScenarios` and Tomcat not present on build host |

## Security audit (deferred)

`npm audit` reports 7 high vulnerabilities in transitive dev tooling (`@angular/build` → `vite`/`undici`, `@babel/core`). `npm audit fix` without `--force` does not resolve them; `--force` would downgrade Angular packages. Deferred — not introduced by this upgrade.

## Preview validation

When Tomcat and project export are available, run local-angular-build Steps 1–7 (Step 2b after Step 7) and verify:

- **Preview:** http://localhost:8080/SearchWidgetScenarios/#/LiveForm_Autocomplete
- **Comparison:** https://stage-platform.wavemaker.ai/run-jlqb2h631c/SearchWidgetScenarios_master/#/Main

## Post-merge checklist

- [ ] Merge `wavemaker-ng-runtime` and `wavemaker-ng-codegen` on `stage-ai` (coordinated)
- [ ] Update `repo.config.sh`: `ANGULAR_BASE_VERSION=21`, `ANGULAR_TARGET_VERSION=22`
- [ ] Complete Step 9 preview G1–G7 before release
- [ ] Share this doc in PR description
