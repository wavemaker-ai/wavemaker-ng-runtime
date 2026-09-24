# Angular 19 Upgrade

Date: 2026-09-23
Branch: stage-classic (ng-runtime + ng-codegen)

## Versions

| Package | Before | After |
|---------|--------|-------|
| @angular/core (+ animations, common, compiler, forms, platform-browser(-dynamic), router, service-worker) | 18.2.13 | 19.2.25 |
| @angular/cli | 18.2.12 | 19.2.27 |
| @angular/compiler-cli | 18.2.13 | 19.2.25 |
| @angular/language-service | 18.2.13 | 19.2.25 |
| @angular-devkit/build-angular | 18.2.20 | 19.2.27 |
| @angular-builders/custom-webpack | 18.0.0 | 19.0.1 |
| ng-packagr | 17.3.0 | 19.2.2 |
| typescript | 5.5.4 | 5.8.3 |
| ngx-bootstrap | 9.0.0 | 19.0.2 |
| rxjs | 7.8.2 | unchanged — already satisfied `^7.4.0` |
| zone.js | 0.15.1 | unchanged — already satisfied `~0.15.0` |
| jest-preset-angular | ^15.0.0 | unchanged — 15.0.3's peer already covers Angular 19 |

## References Reviewed

- R1/R3: Angular 19.0.0 CHANGELOG (fetched at the `19.0.0` git tag — angular.dev's update-guide SPA returned only picker UI, no content, on two attempts). 12 breaking changes reviewed; 11 N/A (verified by grep against actual source, not assumed), 1 folds into the standalone-by-default fallout below.
- R2: angular.dev/reference/versions — TS `>=5.5.0 <5.9.0`, Node `^18.19.1 || ^20.11.1 || ^22.0.0`, RxJS `^6.5.3 || ^7.4.0` for Angular 19.
- R5: target `19.2.25` confirmed stable (not RC/beta).
- R8: ngx-bootstrap `19.0.2` — peer `@angular/core ^19.0.1` confirmed via npm registry (19.0.0/19.0.1 still peer to `^18.0.1`; 19.0.2 is the first patch synced to 19).
- R9: jest-preset-angular `^15.0.0` unchanged — peer already covers `@angular/core >=18.0.0 <21.0.0`.
- R10: ng-packagr `19.2.2` — peer `@angular/compiler-cli ^19.0.0`, `typescript >=5.5 <5.9`.
- R11: Node `22.18.0` unchanged — already within Angular 19's `^22.0.0` range.
- R4: skipped — this repo's `@angular/cli@18.2.12` has no `--dry-run` flag at all (confirmed via `ng update --help`); running for real risked overwriting `build.sh -f`. Not blocking per SKILL.md.
- R12: checklist.md's Section version history reviewed — everything tagged "First required: Angular 20/21/22" correctly N/A this hop; §2/§9/§13/§19/§21/§22/§23/§26 (baseline-applicable) re-verified against actual installed sources.

## Breaking Changes Applied

| Change | Repo | Files | § / Ref |
|--------|------|-------|---------|
| `setTheme('bs3')` → `'bs4'` — `AvailableBsVersions` narrowed to `'bs4'｜'bs5'` at ngx-bootstrap 19 | ng-runtime | `projects/runtime-base/src/components/app-component/app.component.ts` | R8 |
| Rollup fesm2020 → fesm2022 entry paths (ngx-bootstrap 19 ships fesm2022 only) | ng-runtime | `config/rollup.ngxBootstrap.config.mjs` | R8 |
| `standalone: false` added to 87 inline test-harness components/pipes (Angular 19 standalone-by-default) | ng-runtime | 80 `*.spec.ts` files | R1 / new §29 |
| `CircleProgressComponent` → `NgCircleProgressModule` import, matching production usage (old third-party lib's ambiguous Ivy metadata under Angular 19) | ng-runtime | `progress-circle.wrapper.component.spec.ts` | R8 general principle |
| `window.location` mock fixed for TS 5.8.3's stricter DOM lib types | ng-runtime | `projects/core/src/utils/utils.spec.ts` | R2 (TS bump) |
| Rewrote transpilation-bundling rollup config: removed deprecated `@rollup/plugin-multi-entry`, repointed entries at surviving `fesm2022/index.mjs` bundles (ng-packagr 19.2.2 dropped per-file `esm2022` output), generic `@wm/(.+)` alias replacing a hand-maintained list, fixed a malformed third-party `exports` map | ng-runtime | `config/rollup.build-task.mjs` | R10 (ng-packagr bump) |
| Stubbed browser globals (DOM types, jQuery `$.fn.swipeAnimation`) for Node-side expression parser init — the widened transpilation bundle now includes Angular DI metadata and jQuery plugin registration that assume a browser | ng-codegen | `src/wm-utils.js` | R10 (ng-packagr bump) fallout |
| **Modal dialogs invisible** — ngx-bootstrap 19 always toggles the `.show` class (Bootstrap 5 convention) when opening a modal, never `.in` (Bootstrap 3/4); WM's CSS only had opacity overrides for `.in`, so `.modal.fade.show`/`.modal-backdrop.fade.show` stayed at `opacity: 0` forever — the dialog opened but was fully invisible. Found via live preview testing (not caught by any static check or unit test), root-caused and fixed live with `agent-browser`. Audited all other 17 ngx-bootstrap components WM uses for the same `.show`/`.in` mechanism — only `dropdown` also uses it, but its directive applies both `.open` and `.show` together for backward compat, so it was never actually affected; every other component uses an unrelated visibility mechanism. **Fix lives in the separate `wavemaker-foundation-css` repo** (`src/styles/web/components/modal-dialog.less`, added `.show` alongside `.in`) — outside this repo's commit, left for the user to commit on their own timeline. | wavemaker-foundation-css (sibling repo, not part of this commit) | `src/styles/web/components/modal-dialog.less` | R8 |

## Preview Validation

### Angular Deployment

- Preview URL: `http://localhost:8080/NestedWidgets/#/Main` — **PASSED**
- Comparison URL(s): none configured — user visually confirmed directly
- G1–G7: all passed (user-confirmed)
- Notes: real build verified against Angular 19.2.25 (generated app's `package.json` checked, not assumed) via `local-angular-build.md` Steps 2b/3/4/5/7; Steps 1/6 skipped since `NestedWidgets.war` was already deployed to this machine's Tomcat with an unchanged backend.
- **Iteration:** initial pass ("yes working fine") was premature — user found a real G6 regression right after (modal dialogs on table "New" buttons not opening). Root-caused to the ngx-bootstrap `.show`/`.in` class mismatch above; fixed and re-verified live via `agent-browser` (screenshot showing a fully visible, functional "New Department" form dialog, `getComputedStyle(modal).opacity === "1"`) before re-confirming the pass. See Breaking Changes Applied for the fix and the full component-by-component audit of whether other ngx-bootstrap widgets shared the same exposure (only `dropdown` also uses this mechanism, but wasn't actually affected).

### WaveMaker Preview

Skipped — no URLs available for this hop (user: "we cant test now the preview").

## Deferred Items

All deferred with justification, tracked as `pattern-review.sh` WARNs (not FAILs — the script was made version-gate-aware this hop, see below), re-verify at the stated threshold:

- **§1** legacy `compileModuleAndAllComponentsSync` (2 files) — deferred to Angular 20 (verified still present in `@angular/core@19.2.25`'s `.d.ts`)
- **§2** positional `createComponent(factory, 0, injector)` (7 call sites) — deferred to Angular 20 (verified the deprecated factory-based overload still exists in `ViewContainerRef.createComponent`'s `.d.ts`); coupled to §1 in the same 2 files
- **§6/§20b** ngx-bootstrap `.forRoot()` on `ModalModule`/`BsDatepickerModule`/`NgCircleProgressModule` — deferred to ngx-bootstrap 21 (verified still present in installed `ngx-bootstrap@19.0.2`'s `.d.ts`)
- **§19a** `expression-parser.ts` string-based `parseBinding`/`parseAction` — deferred to Angular 20 (verified the actual `Parser` class used still has the string `location` param at 19.2.25; the `ParseSourceSpan` signature belongs to an unrelated class)
- **§20a** `tsconfig.json`/`tsconfig.web-app.json` `module` field mismatch — pre-existing, deferred to the Angular 21 `moduleResolution:bundler` transition it's bundled with
- **§20e** ng-codegen `update-angular-json.js` foundation-css path — deferred to Angular 21, same §20 bundle

## Skill Tooling Improvements (this run)

Not upgrade-source changes, but worth noting for future hops:

- `pattern-review.sh`: added a `fail_or_warn_below` helper so §1/§2/§19a (threshold 20) and §6/§20a/§20b/§20e (threshold 21) checks match their own documented version gates instead of failing unconditionally
- `verify-ngx-bootstrap-bundle.sh`: fixed a hardcoded stale bundle filename (`ngx-bootstrap.bundle.js` → the actual `ngx-bootstrap.umd.js` this repo's `build.sh` produces) and made the missing-patch-script check conditional on whether upstream actually needs it
- New pattern doc entry: `patterns/runtime.md` §29 (standalone-by-default test-harness gotcha)
