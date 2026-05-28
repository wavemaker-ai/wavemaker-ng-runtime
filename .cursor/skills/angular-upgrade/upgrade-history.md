# Angular upgrade history

Canonical engineering record for this repository. **Append a new section per completed major bump** (do not overwrite prior sections).

The generic workflow is in [`SKILL.md`](./SKILL.md). Version-specific notes belong in sections below.

After a successful upgrade, Step 10 also writes a repo summary at **`docs/{major}-upgrade.md`** (see `UPGRADE_DOC_PATH` in `repo.config.sh`).

---

## Template (copy for next upgrade)

```md
## FROM → TO (YYYY-MM)

### Target versions
- Angular:
- TypeScript:
- Node (engines):
- Key ecosystem libraries:

### Package changes (summary)

### Code / config changes

### Patches / build hooks

### Security / overrides

### Validation
- Install:
- Security:
- Build:
- Post-build verify (if configured):
- Tests:
- Preview URL / flows:

### Deferred
```

---

## 20 → 21

### Target versions
- Angular: 21.2.14 (cli/devkit 21.2.13)
- TypeScript: 5.9.3 (unchanged)
- Node (engines): 22.18.0 (unchanged)
- ngx-bootstrap: 21.2.0
- jest-preset-angular: 16.1.5
- zone.js: 0.16.2

### Package changes (summary)
- All `@angular/*` 20.3.19 → 21.2.14
- `@angular/cli`, `@angular-devkit/build-angular` → 21.2.13
- `@angular-eslint/*` → 21.4.0
- `@angular-builders/custom-webpack` → 21.0.3
- `ng-packagr` → 21.2.3
- `ngx-bootstrap` → 21.2.0
- `ngx-toastr` → 20.0.5
- `jest-preset-angular` → 16.1.5

### Code / config changes
- `tsconfig.json`: `moduleResolution: "bundler"` for Angular 21 fesm imports
- `config/rollup.ng-libs.config.mjs`: `@angular/core/primitives-*` fesm path renames
- `projects/runtime-dynamic`: `app.module.ts` / `app.config.ts` — ngx-bootstrap bare modules (no `forRoot()`)
- `projects/transpiler/src/imports.ts`: removed `forRoot: true` on ngx-bootstrap ImportDefs
- HostListener: static event name per decorator (checkbox, checkboxset, menu, menu-dropdown-item)
- ngx-bootstrap InputSignal: menu `autoClose`, search `typeaheadOptionsLimit`, custom-toaster (ngx-toastr 20)
- `projects/core/src/utils/utils.ts`: `adjustContainerPosition` / `adjustContainerRightEdges` tolerate missing `NgZone` on dropdown ref
- Jest specs: ngx-bootstrap `Module.forRoot()` → bare module
- `src/setup-jest.js`: `patchNgxBootstrapFiles()` before tests
- `app.component.ts` / `base-layout.component.ts`: `scheduleOverrideRouterOutlet()` waits for `@if (startApp)` router-outlet

### Patches / build hooks
- `build-scripts/ngx-bootstrap-patch.mjs`: DestroyRef injection for `PositioningService`
- `config/rollup.ngxBootstrap.config.mjs`: `ngxBootstrapPatchPlugin`
- Post-build: `verify-ngx-bootstrap-bundle.sh` on `ngx-bootstrap.bundle.js` + `wm-libs.js`

### Security / overrides
- `npm audit fix` applied; 3 moderate remain (webpack-dev-server, no fix available)

### Validation
- Build: `sh build.sh -f` — pass
- Post-build verify: pass
- Tests: `npm test` — run as gate (124/126 suites in one run; yalc + flaky calendar noted)
- Preview URL: https://proxy-studio.wmdev.com/run-jlqb2h631c/SearchWidgetScenarios_master/#/LiveForm_DefaultValue_FormData — user sign-off pending

### Deferred
- Preview checklist confirmation after `scheduleOverrideRouterOutlet` rebuild
- `model-variable.spec.ts` when `@wavemaker-ai/variables` yalc not linked
