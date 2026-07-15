# Angular 20 Upgrade

Date: 2026-07-13
Branch: stage-20 (ng-runtime + ng-codegen)
Ticket context: WMS-29275 (this exact 18→20 jump previously existed in git history and was reverted 2026-06-09 by `e6d13621a`, bundled with unrelated changes; this upgrade was redone fresh via the skill rather than restoring that revert)

## Versions

| Package | Before | After |
|---------|--------|-------|
| @angular/core (+ animations, common, compiler, forms, platform-browser, platform-browser-dynamic, router, service-worker) | 18.2.13 | 20.3.26 |
| @angular/cli | 18.2.12 | 20.3.26 |
| @angular/compiler-cli, @angular/language-service | 18.2.13 | 20.3.26 |
| @angular-devkit/build-angular | 18.2.20 | 20.3.32 (bumped past initial 20.3.26 pin via security audit — patched esbuild/vite/http-proxy-middleware/piscina) |
| @angular-builders/custom-webpack | 18.0.0 | 20.0.0 |
| typescript | 5.5.4 | 5.9.3 |
| ng-packagr | 17.3.0 | 20.3.2 |
| ngx-bootstrap | 9.0.0 | 20.0.2 |
| rxjs | 7.8.2 | unchanged (already satisfies `^7.4.0`) |
| zone.js | 0.15.1 | unchanged (already satisfies `~0.15.0`) |
| jest-preset-angular | ^15.0.0 | unchanged (already satisfies `>=18.0.0 <21.0.0`) |
| Node (engines.node) | 22.18.0 | unchanged (already satisfies Angular 20's `^22.12.0`) |

Also bumped via the security-audit pass (Step 5): `rollup` → `^4.62.2`, `compression-webpack-plugin` → `^12.0.0` (in active use in `wm-custom-webpack.config.js`, verified working through Step 7 build), `@compodoc/compodoc` → `^2.0.0`, `owasp-dependency-check` → `^1.0.1` (both optional/reporting dev tools, not part of the build path).

## References Reviewed

- R1/R3: Angular Update Guide (SPA, not directly fetchable) + WebSearch summaries of official v19/v20 breaking changes, cross-checked against the installed `@angular/compiler@20.3.26` d.ts directly for anything uncertain (Element constructor arity, PropertyWrite removal, ParenthesizedExpression, Parser.parseBinding/parseAction signature).
- R2: Version Compatibility — TypeScript 5.9.3, Node unchanged (22.18.0), RxJS unchanged (7.8.2), zone.js unchanged (0.15.1).
- R5: target confirmed stable — 20.3.26, Angular 20 is LTS through Nov 2026 (current date 2026-07-13).
- R8: ngx-bootstrap CHANGELOG reviewed 9.0.0→20.0.2. Versioning synced to Angular major starting at ngx-bootstrap v18.0.0. `forRoot()` removal, `__destroyRef`/zoneless changes, and `moduleResolution: bundler` are all Angular 21+ / ngx-bootstrap 21.2.0+ concerns — verified via `grep "static forRoot"` on the actually-installed packages that they do **not** apply to this 18→20 upgrade.
- R9/R10: jest-preset-angular and ng-packagr pins — see Versions table above.
- R12: `checklist.md` + `patterns/runtime.md` (§1–§19) + `patterns/codegen.md` (§20) reviewed in full. These patterns were authored from the *later* Angular 20→21 upgrade (WMS-29275/WMS-31488) experience — used as a starting reference, but every applicable item was independently re-verified against the actually-installed Angular 20.3.26 / ngx-bootstrap 20.0.2 sources rather than assumed, since several of the documented patches (§6 ngx-bootstrap patch, §8b/§12/§20b forRoot/`__destroyRef`, §20a `moduleResolution: bundler`) turned out to be Angular-21-only and not needed here.
- R13: no prior `docs/{major}-upgrade.md` existed; used WMS-29275 git history (reverted) as context only.

## Breaking Changes Applied

| Change | Repo | Files | § / Ref |
|--------|------|-------|---------|
| Removed legacy `compileModuleAndAllComponentsSync`/`Compiler` dynamic-module path; standalone components instead | runtime | `dynamic-component-ref-provider.service.ts`, `component-ref-provider.service.ts` | §1 |
| Positional `createComponent(factory, index, injector)` → object syntax with `environmentInjector`; dropped `ComponentFactoryResolver` | runtime | `prefab.directive.ts`, `partial-container.directive.ts`, `custom-widget-container.directive.ts`, `form.component.ts`, `table.component.ts`, `page-wrapper.component.ts`, + the two services above | §2 |
| `Element(...)` constructor arity 6→9 args (added `children`, `isSelfClosing`, `isVoid`) | runtime | `transpiler/src/build.ts` (3 sites) + 5 `*.build.ts` files | §4 |
| Removed `this.` prefix from template bindings (Angular 20's stricter template type-checker) | runtime | `date-time`, `date`, `time`, `file-upload` component HTML (4 occurrences) | §14 |
| `registerPageParams()` seeds synchronously from `route.snapshot.queryParams` before subscribing | runtime | `base-page.component.ts`, `base-spa-page.component.ts` | §15 |
| `PropertyWrite` removed from `@angular/compiler` at Angular 20 — dropped dispatch branch; added `ParenthesizedExpression` unwrap handler; `parseBinding`/`parseAction` now pass a real `ParseSourceSpan` instead of `''` | runtime | `expression-parser.ts` | §19a, §19b |
| Aligned `tsconfig.web-app.json` to `tsconfig.json` (`module` es2020→es2022, `lib` es2018→es2022, added `esModuleInterop`/`useDefineForClassFields`) | runtime+codegen | `tsconfig.json`, `tsconfig.web-app.json` | §20a |
| `rollup.ngxBootstrap.config.mjs` hardcoded `fesm2020`; ngx-bootstrap 20.0.2 ships `fesm2022` across all 23 sub-modules | runtime | `config/rollup.ngxBootstrap.config.mjs` | build-verified (real break, found only by running Step 7) |
| `setTheme('bs3')` no longer type-checks — `AvailableBsVersions` is now `'bs4' \| 'bs5'` only; changed to `'bs4'` | runtime | `app-component/app.component.ts` | build-verified — root cause of a full TS2307/NG1010 cascade (fixing it resolved the whole chain) |

**Verified as NOT needed for this upgrade** (checked against real installed sources, not assumed from the patterns doc which targets a later Angular 21 upgrade): ngx-bootstrap compatibility patch file (`PositioningService`, dropdown `class.show`, modal states, `ComponentLoader.hide()` — all already native in 20.0.2), `forRoot()` removal, `moduleResolution: bundler`, `.cjs.js` dependency suffix rename.

## Preview Validation

- Skipped — user set "skip preview yes" at Step 0.
- G4 (no fatal console errors) partially covered by the successful full build (`sh build.sh -f` exit 0), but G1–G3/G5–G7 were not visually verified. **This upgrade has not been visually confirmed working in a browser.**

## Unit Tests

- Skipped — user set "skip tests yes" at Step 0.

## Post-commit fixes (found via actual preview, after Step 10 was first drafted)

Preview testing (done manually by the user after this doc was first written, despite "skip preview" at Step 0) immediately surfaced the exact class of risk flagged below under ngx-bootstrap:

- **`Cannot read properties of undefined (reading 'takeUntilDestroyed')` at `new PositioningService`.** ngx-bootstrap 20.0.2's `PositioningService` imports `takeUntilDestroyed` from `@angular/core/rxjs-interop`, a subpath our `rollup-utils.mjs` globals/externals map didn't know about. Rollup silently guessed a global name that nothing populated, so it resolved to `undefined` at runtime. Fixed by bundling `@angular/core/fesm2022/rxjs-interop.mjs` (and its `primitives/di.mjs` dependency) as dedicated UMD bundles, mirroring the existing `primitives/signals`/`primitives/event-dispatch` pattern, and wiring them into the `wm-libs.js` concatenation order. Commit `ce61bdf3c`.
- **`app.config.ts` bootstrap provider ordering / missing `RendererFactory2` registration**, found and fixed directly by the user while investigating the same preview session. `RendererFactory2 → WMDomRendererFactory2` was never registered in the standalone bootstrap path — a gap in this repo's own §13b verification during Step 6 that should have been caught. Commit `75ff6d34e`.

This is a concrete example of why skipping Step 9 preview is risky: both issues were invisible to `pattern-review.sh`, the TypeScript compiler, and the full `build.sh -f` run, and only surfaced when the app actually ran in a browser.

## Deferred Items

- **ngx-bootstrap 9.0.0 → 20.0.2 is an ~11-major jump.** Only the specific symptoms described in the patterns doc were checked against the real installed source (and found already resolved natively); a broader survey of every intermediate ngx-bootstrap breaking change was not performed. Combined with skipped preview/tests, this is the single largest residual risk in this upgrade — recommend a manual smoke test of every ngx-bootstrap-backed widget (modal, dropdown, datepicker, timepicker, popover, tooltip, typeahead, carousel, pagination, progressbar, accordion) before shipping.
- ngx-bootstrap's typeahead container still ships `overflow-y:auto;height:100px` CSS that historically caused dropdown clipping — present natively in 20.0.2, not something we introduced. Needs a visual check.
- §16 list/table `row` context aliasing (menu widgets inside list templates) — reviewed, judged to be a feature gap rather than an Angular-version-forced break, left unchanged.
- §13g DOM renderer fork's animation `@`-property guard — current fork throws on synthetic `@` props/events outside the animation renderer (matches Angular's own stock default); a "silently ignore" patch exists in the later-upgrade pattern doc but was not applied pre-emptively since it's uncertain whether it's needed at Angular 20. Only apply if preview later reproduces `checkNoSyntheticProp` errors from ngx-bootstrap modals/animations.
- `wavemaker-ng-codegen/src/update-angular-json.js` foundation-css path — the automated `pattern-review.sh` check expects `dist/styles/foundation/foundation.css`, but the actually-installed `foundation-css` package ships at `foundation/foundation.css` (verified directly). Did not change; the check itself is stale for the current package layout, not the code.
- 7 moderate-severity npm vulnerabilities remain in ng-runtime's dev-dependency tree (ajv ReDoS, transitive `uuid` bounds check) — no fix available in-range; both are dev/build-tooling only, not shipped in the runtime bundle.

## Post-merge checklist

- [ ] Merge both `ng-runtime` (`c17f09260`, `926a05a` on ng-codegen, `8c4321b30`) and `ng-codegen` branches — coordinated, same window
- [ ] Update `repo.config.sh`: `ANGULAR_BASE_VERSION=20`, `ANGULAR_TARGET_VERSION=21`
- [ ] Node.js version unchanged — no CI/consumer updates needed
- [ ] **Run a manual smoke test of all ngx-bootstrap-backed widgets before shipping** — preview was skipped this run
- [ ] Share this doc with the team
