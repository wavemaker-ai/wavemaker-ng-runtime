# Angular 21 Upgrade Summary

**Branch:** `stage-classic`
**Base → Target:** Angular 20 → 21
**Date:** 2026-09-24
**Status: COMPLETE.** Package/source changes shipped, build is clean, and Step 9 (G1–G7) is
user-confirmed passing via live Tomcat deployment (both dev and production builds, checked
independently by the user side by side).

This supersedes the previous `docs/21-upgrade.md` content, which was reference material carried
over from a different branch's (`stage-ai`/WMS-31488) separate, earlier Angular 21 upgrade — not
a real run on `stage-classic`. That branch's work never touched this branch's history (confirmed
via `git merge-base --is-ancestor`); `stage-classic` was still on Angular 20 before this run.
Full pattern-level diff, including what was wrong in earlier drafts of this hop's own patterns/
runtime.md findings: `docs/upgrade-log/20-to-21.md`.

## Libraries upgraded

| Package | From | To |
|---------|------|----|
| `@angular/*` (core, common, compiler, forms, platform-browser(-dynamic), router, service-worker, animations) | 20.3.31 | 21.2.23 |
| `@angular/cli`, `@angular-devkit/build-angular` | 20.3.37 | 21.2.24 |
| `@angular/compiler-cli`, `@angular/language-service` | 20.3.31 | 21.2.23 |
| `@angular-builders/custom-webpack` | 20.0.0 | 21.1.0 |
| `@angular-eslint/*` | 20.1.1 | 21.4.0 |
| `ng-packagr` | 20.3.2 | 21.2.7 |
| `ngx-bootstrap` | 20.0.2 | 21.2.2 |
| `jest-preset-angular` | ^15.0.0 | ^17.0.0 |
| `typescript` | 5.8.3 | 5.9.3 |
| `rxjs`, `zone.js`, Node | unchanged | already in range |

ng-codegen: no direct Angular dependency, no `package.json` change needed.

## Compatibility changes

### wavemaker-ng-runtime
- `tsconfig.json`/`tsconfig.web-app.json`: `moduleResolution: "node"` → `"bundler"`; aligned `module`/`lib`/`esModuleInterop` between the two configs (§20a).
- `config/rollup.ng-libs.config.mjs` / `build.sh`: new `@angular/core/primitives/di` fesm rename requires its own rollup bundle entry + `bundleJS()` concatenation line (§8).
- `app.config.ts`/`app.module.ts`: dropped `.forRoot()` from all 10 affected ngx-bootstrap modules — not just Modal/Datepicker as originally believed (§8b).
- `build-scripts/ngx-bootstrap-patch.mjs`: full rewrite of the `PositioningService` patch for ngx-bootstrap 21.2.2's new constructor shape (`ngZone` param removed, `runInZoneRootIfPresent` boundary) (§12).
- `menu.component.ts`, `search.component.ts`: ngx-bootstrap directive `@Input()`s converted to signal-based `input()` at v21 broke imperative property writes — routed through `BsDropdownState`/an existing template binding instead (§31, new pattern).
- `checkbox.component.ts`, `checkboxset.component.ts`: `@HostListener` arg-count fix (unrelated TS strictness catch, not itself an Angular-version compatibility issue).
- **7 confirmed instances of a change-detection regression (§32, new pattern)** — a property write gating an `@if` block (or, in one case, a spinner overlay blocking all clicks) via bare `setTimeout`/`.then()`/`.subscribe()`, no longer reliably picked up by Angular 21's automatic zone-triggered CD. Fixed with `this.cdr.detectChanges()` immediately after each write, in `app.component.ts` (×2), `base-page.component.ts` (×2), `base-spa-page.component.ts` (×2), `base-partial.component.ts`, `base-prefab.component.ts`. This was invisible to `pattern-review.sh`, the build, and unit tests — only found live in Step 9, and one instance (the spinner) only via an actual click-through interaction test, not page-load checks. Angular 21's zoneless-by-default change was investigated as a possible root cause and ruled out (this app is confirmed zone-based via direct `@angular/core` source read).

### wavemaker-ng-codegen
- `templates/app.config.ts.hbs`: same `.forRoot()` removal as runtime's `app.config.ts` (§20b).
- `src/update-angular-json.js`: foundation-css path corrected to `dist/styles/foundation/foundation.css` — correct for production installs; confirmed this can never resolve via the local yalc-linked dev workflow (`dist/` is gitignored upstream), documented as a known local-only limitation, not a bug (§20e).

## Verification

- `sh build.sh -f`: 0 errors (2 iterations — first hit 85 errors, all traced to 4 root-cause files: `@HostListener` arg mismatch in checkbox/checkboxset, the two new §31 ngx-bootstrap signal-input findings in search/menu).
- `verify-ngx-bootstrap-bundle.sh`: pass — confirms the new §12 patch shape is present in the built `wm-libs.js`.
- `pattern-review.sh`: pass (0 fail, 2 warn — §1/§2 correctly deferred, re-verified against Angular 21.2.23's actual `.d.ts`, not just carried over from the prior hop).
- Unit tests: skipped this hop (explicit user instruction at Step 0).
- **Step 9 — Preview validation:** deployed to two separate local Tomcat webapps (`/NestedWidgets/` = production build, `/NestedWidgets-dev/` = development build) so both could be checked side by side without alternating redeploys. §32's fix (blank page, stuck spinner blocking clicks) verified live in both dev and prod before the user's own check — real content renders (charts, nav, table data), the Department table's "New" button correctly opens its modal. **User explicitly checked both deployments themselves and confirmed "all looking fine."** `WAVEMAKER_DEPLOYMENT_URL`/WaveMaker Preview mode were not configured for this project (`skip`) — no side-by-side visual diff against a separate WaveMaker-hosted comparison was run.

## What's NOT done / left for a future run

- Extended checks E1–E4, E6–E13 were not individually walked through item-by-item — Step 9's sign-off was a holistic manual check by the user across both builds, not an exhaustive checklist pass.
- §32's broadened scan (any property write, not just boolean-literal `setTimeout` blocks) surfaced ~30 more candidate hits across widget-level components, `i18n.service.ts`, and `security-config.resolve.ts` — left as `needs-review`, not fixed speculatively. See `patterns/runtime.md` §32 for the full list and the scan script; verify each against its template + a live symptom before fixing.
- No real comparison URL was ever supplied for this project's Angular Deployment mode (`WAVEMAKER_DEPLOYMENT_URL=skip`) — if a real WMTheme-equivalent comparison becomes available, G1 and the visual-parity diff should be re-run against it.
