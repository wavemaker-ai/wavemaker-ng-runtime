# Angular 22 Upgrade — COMPLETE

**Status: package/source changes shipped, the reported "preview is broken" bug is
root-caused and fixed, and Step 9 (G1–G7) is user-confirmed passing on both configured
validation modes — Angular Deployment (NestedWidgets, Tomcat) and WaveMaker Preview
(LeaveManagementApp, proxy-studio). This upgrade is done.**

**Branch:** WMS-32451 (merged to `stage-ai`)
**Base → Target:** Angular 21 → 22
**Commits:** `aab04e7ae`, `3d5e32079`, `e00efb3f3`, `6ff1ec379` (2026-09-17)

This upgrade happened outside the `angular-upgrade` skill's Step 0–10 process — reconstructed
after the fact from commit messages, not from a `current-state.md` run. Now confirmed complete
(see below); `repo.config.sh` has been bumped to `ANGULAR_BASE_VERSION=22` / `TARGET=23` per
the skill's Step 10 post-merge checklist. Full pattern-level diff: `docs/upgrade-log/21-to-22.md`.

## What's confirmed done

| Check | Result |
|-------|--------|
| `package.json` bump (both repos) | done — `@angular/core` 22.1.7 |
| `npm install` | done |
| `build.sh -f` | pass, per `e00efb3f3` |
| `verify-ngx-bootstrap-bundle.sh` | pass, per `e00efb3f3` |
| `pattern-review.sh` | pass, per `e00efb3f3` |
| Unit tests | one flaky spec skipped (`6ff1ec379`, pre-existing root cause, unrelated to Angular 22); repo-wide `npm test` config bug found and fixed during verification (see finding #2 below) |
| **Step 9 — Preview validation (G1–G7)** | **user-confirmed passing**, both configured modes: Angular Deployment (NestedWidgets/Tomcat, production build) and WaveMaker Preview (LeaveManagementApp/proxy-studio, production build) |

## What's NOT done

Nothing blocking. Two minor process notes, neither gating:

- No `current-state.md` record exists for this run to audit against (the upgrade shipped and was verified outside the skill's live Step 0–10 flow — this doc is the reconstructed record instead).
- The formal "Post-merge checklist" from the skill's Step 10 (bumping `repo.config.sh` to `22→23`, etc.) is presented below rather than actioned automatically — see "Post-merge checklist."

## Libraries upgraded

| Package | To |
|---------|-----|
| `@angular/*` (core) | 22.1.7 |
| `@angular/cli`, `@angular-devkit/build-angular` | 22.1.8 |
| `@angular-eslint/*` | 22.5.0 |
| `ngx-bootstrap` | 22.0.0 |
| `zone.js` | 0.16.3 |
| `ng-packagr` | 22.1.1 |
| `jest-preset-angular` | 17.0.0 |
| `typescript` | 6.0.3 |
| `engines.node` | 22.22.3 (actually run under Node 24.15.0 — see `3d5e32079`) |

## Compatibility changes applied (source)

- `changeDetection: ChangeDetectionStrategy.Eager` added to 76 components with no explicit strategy (§27a — Angular 22 changed the unset default)
- `changeDetection: ChangeDetectionStrategy.Eager` added to the two dynamic `Component()` factory functions (§27c — `component-ref-provider.service.ts`, `dynamic-component-ref-provider.service.ts`) that build every page/partial/prefab/widget component at runtime — the §27a sweep couldn't find these since they're not static class decorators; this was the actual root cause of the reported preview bug
- `app.config.ts`: `withRouterConfig({ paramsInheritanceStrategy: 'emptyOnly' })` (§27b) and `withXhr()` on `provideHttpClient` (§7b) — both preserve pre-22 defaults
- `tsconfig*.json`: `strict: false`, `noUncheckedSideEffectImports: false`, `ignoreDeprecations: "6.0"` — TS 6.0 flipped `strict` to default `true` (§25)
- `wm_shared_styles_host.ts`: no-op `removeStyles()` override (§13i)
- `date-time-picker.component.ts`: removed duplicate `@Input("config")` (NG1054, §28)
- `app.module.ts`: removed `bootstrap: [AppComponent]` (NG6009) and moved `PageWrapperComponent` to `imports` (NG6008), §28
- `ngx-bootstrap-patch.mjs`: no changes needed — all 5 patches now native in ngx-bootstrap 22.0.0 (§12)
- `src/update-angular-json.js` (ng-codegen): pre-existing wrong foundation-css path fixed (§20e — not Angular-22-specific)

## Post-upgrade verification findings (found while trying to validate the upgrade)

None of these are Angular-22-compatibility patterns in the `patterns/runtime.md` §N sense — they're separate bugs that surfaced while trying to get a working build/test/preview cycle going to actually validate Steps 7–9. Documented here rather than as `§N` entries since they aren't expected to recur specifically *because of* a future Angular version bump.

### 1. Recurring self-dependency in `wavemaker-ng-runtime/package.json`

**Symptom:** `dependencies` kept gaining `"@wavemaker-ai/angular-app": "file:.yalc/@wavemaker-ai/angular-app"` — this repo depending on its own published package. Caused a circular self-referential symlink (`node_modules/@wavemaker-ai/angular-app/node_modules/@wavemaker-ai/angular-app` pointing back to its own parent) that broke `wavemaker-ng-codegen`'s `cp -rf` step (`build.sh` line ~43) with a cryptic `No such file or directory`.

**How this was found:** the symlink loop was the *visible* symptom, chased first — traced `bundle-angular-app-cli.sh`'s `yalc publish --push` step, which syncs the freshly-built package into every registered "installation." Checked `~/.yalc/installations.json` directly and found `wavemaker-ng-runtime` listed as an installation *of its own package* — a self-reference. Fixing `package.json` and running `yalc remove` appeared to work, but the exact same self-dependency line reappeared in the working tree less than an hour later. That recurrence was the real signal: a plain `git diff` against `HEAD` showed the line as an *uncommitted addition*, not something already in history, which meant it wasn't a stale edit being rediscovered — something was actively re-adding it. Re-checked `installations.json` and found the same self-registration back. `git log -S` on the exact dependency string then surfaced that this had already been fixed once before (`eb4694fa9`) and reintroduced by a later commit on a different branch (`4182035ee`) that got merged back in — confirming this is a recurring regression pattern, not a one-off, and that `yalc remove` alone (without also cleaning the global registry) can never make it stick.

**Root cause:** `~/.yalc/installations.json` (yalc's *global*, machine-local registry — not a repo file) listed `wavemaker-ng-runtime` itself as a registered "installation" of `@wavemaker-ai/angular-app`. Every `yalc publish --push` (run by `bundle-angular-app-cli.sh`) therefore re-synced the package into ng-runtime's own `node_modules` and re-added the dependency line to `package.json` — undoing any manual `package.json` edit or plain `yalc remove` within minutes.

**Fix:** removed the stale `wavemaker-ng-runtime` path from `~/.yalc/installations.json` directly (machine-local state, not a repo change) in addition to `yalc remove @wavemaker-ai/angular-app` + `package.json` cleanup. Confirmed holding after a fresh `npm install` + rebuild + re-push cycle.

**If this happens again:** check `~/.yalc/installations.json` for `wavemaker-ng-runtime` under `@wavemaker-ai/angular-app` before assuming it's a new bug — `yalc remove` alone does not clean this global registry entry.

### 2. `npm test` failing repo-wide with "Cannot find name `it`/`describe`/`expect`/`jest`"

**Symptom:** hundreds of spec files across the whole suite failed to compile with `TS2593`/`TS2304` errors, as if Jest's own type definitions weren't installed (they were — `@types/jest@30.0.0` is a real devDependency).

**Root cause:** the root `tsconfig.spec.json` (the one `jest-preset-angular` is hardcoded to use — confirmed via `node_modules/jest-preset-angular/build/presets/create-cjs-preset.js`) had no `types` override, which should auto-include everything under `node_modules/@types`. Explicitly setting `"types": ["jest", "node", "jquery"]` fixed it — the auto-include mechanism was not reliably picking up `@types/jest` on its own (exact underlying TypeScript reason not fully root-caused, but the explicit fix is the standard, well-known-reliable pattern regardless).

**Fix:** `tsconfig.spec.json` (root) — added explicit `"types": ["jest", "node", "jquery"]`.

**Dead end explored first:** two *other* `tsconfig.spec.json` files (`projects/components/base/`, `projects/variables/`) had a stale `"types": ["jasmine", ...]` (leftover from a pre-Jest era; `@types/jasmine` isn't even installed) — these were fixed too, but turned out to be **unused** by the actual `npm test` run (only the root one is), so they didn't explain the repo-wide failures. Worth fixing regardless since they're presumably used by some other IDE/tooling path, but don't assume fixing them alone resolves `npm test`.

### 3. `common-widget.specs.ts` leaking into the production library build

**Symptom:** `projects/components/base`'s `ng-packagr` build failed with the same "Cannot find name `it`/`jest`/`expect`" errors, but only for one specific file.

**Root cause:** `projects/components/base/tsconfig.lib.json`'s `exclude: ["src/test.ts", "**/*.spec.ts"]` doesn't match `common-widget.specs.ts` — **plural** "specs.ts", not the standard singular "spec.ts". A second sweep also found `src/test/util/component-test-util.ts` and `src/test/util/date-test-util.ts` leaking in too — plain `.ts` helper files with no "spec" in the name at all, so no glob pattern would have caught them.

**Fix:** excluded the whole `src/test/**` directory (not just individual filename patterns) plus `**/*.specs.ts` as a general safety net.

### 4. `arialabel` property never actually reflected to the `aria-label` DOM attribute

**Symptom:** a 2021-era accessibility test (`common-widget.specs.ts`, `WMS-20856`) failing identically across 5+ widgets (`wm-anchor`, `wm-search`, `wm-popover`, `wm-menu`, `wm-picture`): setting `arialabel` never updated the DOM.

**How this was found:** traced the failing widget's own `onPropertyChange` override (`AnchorComponent`) — it only handled `hyperlink` and fell through to `super.onPropertyChange()` for everything else. Followed the chain up through `StylableComponent` to `BaseComponent.onPropertyChange()` and read its full if/else chain: `show`, `hint`, `class`, `name`/`tabindex`, `conditionalclass`, `autoplay`, `conditionalstyle`, `animation`, `disabled`, `autofocus` — no `arialabel` branch anywhere. Before concluding this was a genuine gap (rather than something recently broken), ran `git log -S "key === 'arialabel'"` and `git log -S "aria-label"` across the file's entire history — the former found nothing ever, the latter found two *old* (2021) commits that added `aria-label` reflection keyed off the *`hint`* property (a different, narrower mechanism, since removed), confirming a dedicated `arialabel` case never existed at any point.

**Root cause:** genuinely never implemented, in any Angular version. Not an Angular-22 regression; a long-standing gap that a broken test suite (see #2) had been silently hiding for years.

**Fix:** added `else if (key === 'arialabel') { setAttr(this.nativeElement, 'aria-label', nv); }` to `BaseComponent.onPropertyChange()`. Verified low blast-radius before applying: no widget has its own conflicting `arialabel` handler (checked ~23 widgets that register this prop), no CSS depends on `[aria-label]`'s absence.

### 5. `TestBed`-created test host components get Angular 22's new default `changeDetection`

**Symptom:** after fixing #2–#4, one test (`wm-anchor`'s `arialabel` reflection test) still failed — template binding `[attr.aria-label]="wm_anchor1.arialabel || ..."` in the test's own inline markup wasn't re-evaluating after `fixture.detectChanges()`.

**How this was found:** the test asserts `$inputEl.getAttribute('aria-label')`. Checked what `$inputEl` actually resolves to — the host element itself for this widget (no `inputElementSelector` configured), so it should see the same DOM the fix targets. Read the failing spec file's own fixture markup and found `[attr.aria-label]="wm_anchor1.arialabel || wm_anchor1.caption || 'Link'"` — an Angular template expression binding baked into the *test's own* inline markup, completely separate from the production `onPropertyChange` fix. Since `arialabel` was confirmed being set correctly on the component instance by this point (verified via the widget proxy chain), the only remaining explanation was that Angular's change detection simply wasn't re-evaluating this binding — which pointed straight at changeDetection strategy again, this time for the dynamically-declared test host component rather than the widget itself.

**Root cause:** every `*.wrapper.component.spec.ts` file declares its own `@Component({ template: markup })` test-host wrapper class dynamically. The 76 *production* components got `ChangeDetectionStrategy.Eager` pinned during the upgrade (§27a) to preserve pre-22 behavior, but these test-only wrapper components — declared inline in ~50+ spec files — never got the same pin, so they picked up Angular 22's new default.

**Fix, applied once instead of in 50+ files:** `projects/components/base/src/test/util/component-test-util.ts`'s shared `compileTestComponent()` (the single chokepoint every widget spec's `ComponentTestBase` calls through) now does `TestBed.overrideComponent(componentInstance, { set: { changeDetection: ChangeDetectionStrategy.Eager } })` before `configureTestingModule`. Test-only — zero effect on the production bundle.

## Preview bug investigation — methodology and resolution (RESOLVED)

This is the actual "preview is broken" bug the user originally reported, checked against a real proxy-studio preview (`https://proxy-studio.wmdev.com/.../LeaveManagementApp_master/#/Main`) using `agent-browser` for live console/DOM/network inspection.

**Symptom, confirmed via screenshot + DOM inspection:** the page shell renders fine (`ng-version="22.1.7"` present, header/topnav/leftnav/rightnav/footer/content structure all there), but every partial container is empty — `<app-partial-header><section wmpartial ...><!----></section></app-partial-header>`, same for topnav/leftnav/rightnav/the app-level "Common" partial. All `page.min.json` network requests return 200 with real, well-formed content (verified by manually decoding `pages/Common/page.min.json`'s markup — a legitimate 3.5KB login-dialog partial, not corrupt data). **Zero console errors** at any point, which was the single biggest clue steering the whole investigation — every failure path in the relevant code has an explicit `console.error(...)`, so a genuinely silent failure meant something was never being *reached*, not throwing.

**Step 1 — ruled out: local dev build comparison was a false positive.** This exact partial-rendering code already "works" in a local NestedWidgets Tomcat deployment (development build). Initially treated as evidence the runtime code was fine and something else was wrong. Re-examined after the user pushed back — confirmed via git timestamps that both deployments trace back to the *same* source build (no staleness), so "works locally" wasn't proof of anything; it just meant a race condition happened to resolve favorably there.

**Step 2 — found and fixed a real race condition (did not resolve the bug).** Traced `PartialContainerDirective` (`projects/components/base/src/widgets/common/base/partial-container.directive.ts`): it only renders partial content in response to a `content` property-change notification via `registerPropertyChangeListener`, backed by a plain RxJS `Subject` (no replay to late subscribers). If the widget's `content` attribute gets its one-and-only initial notification *before* this directive's constructor subscribes, the notification is silently lost forever and the partial never renders — a real, latent bug, confirmed by comparing against `PrefabDirective` (which instead reads its target name directly and synchronously in its own constructor — never had this problem) and `FormWidgetDirective` (which already has the exact "listener + direct initial-value fallback" pattern this fix applies). Full sweep of every `registerPropertyChangeListener` call site in the codebase confirmed **partials were the only vulnerable container** — prefabs, dialogs, and custom widgets all use different, non-vulnerable mechanisms.

Fix applied: `partial-container.directive.ts` constructor now also reads `componentInstance.content || initialContent` (the latter via `@Attribute('content')`, which was already being captured but never used — underscore-prefixed and ignored) and triggers the same render path directly, in addition to the listener. Protected against double-render by the existing `debounce(this._renderPartial, 200)` wrapper.

**Confirmed deployed correctly** (`grep -c "handleContentChange" dist/bundles/wmapp/scripts/wm-loader.js` → 1) — **but the proxy preview still shows the identical blank-partials symptom.** So this race condition, while real and worth fixing, was not the (sole) cause of the reported bug.

**Step 3 — added temporary debug instrumentation, and it found the real answer.** Added `console.error` debug statements directly in `_renderPartial()` (entry, before/after `getComponentFactoryRef()`, after `createComponent()`) and in the constructor. Rebuilt and reloaded: **every single step succeeded, for every partial** — `gotClass: true` and "after createComponent" fired for Common, header, topnav, leftnav, rightnav, and footer, with zero errors anywhere. So `_renderPartial()` was never the problem at all (the Step 2 fix was real and correct, just not the cause of *this* symptom) — the components were being successfully created and their host elements successfully inserted into the DOM. The failure was one level deeper: **created but never rendered.**

**Root cause, finally found:** `ComponentRefProviderService.createComponent()` (`projects/runtime-dynamic/src/app/services/component-ref-provider.service.ts`) — the single factory function that builds *every* dynamically-created page/partial/prefab/widget component in the entire app from server-fetched markup — calls `Component({...})(DynamicComponent)` **without a `changeDetection` property**. The upgrade's original §27a fix pinned `ChangeDetectionStrategy.Eager` on the 76 *statically*-declared production components (found via `rg -L '@Component\(\{[^}]*changeDetection'` across `.component.ts` files), but this is a `@Component()` decorator applied *programmatically at runtime* inside a service — invisible to that grep, since there's no static class decorator to find. Under Angular 22's new default strategy, the created component's host element gets inserted into the DOM just fine (so `createComponent()` "succeeds", explaining why every debug log showed success and zero errors ever appeared), but its own template content never gets checked/rendered.

A second, identical instance of the exact same gap was found in `projects/runtime-base/src/services/dynamic-component-ref-provider.service.ts`'s `createDynamicComponent()` (used for a different, more generic ad-hoc dynamic-component path) and fixed the same way.

**Fix:** added `changeDetection: ChangeDetectionStrategy.Eager` to both `Component({...})` call sites.

**Confirmed resolved:** reloaded the proxy preview after rebuild — header, top nav, left nav, right nav, and actual page content (a "Vacation List" data table with real rows) all render correctly. Console clean except one unrelated, pre-existing, benign widget warning (`Retain State handling on Widget VacationTable1 is not supported for current pagination type`).

**The `ng-hide`/`hidden` discrepancy noted earlier turned out to be a symptom of this same root cause, not a separate bug** — the app-level "Common" container is now visibly rendering, confirming whatever toggles that class was itself gated behind the same broken change-detection path.

**Debug logging cleanup: done.** All temporary `console.error('DEBUG ...')` statements (constructor + 4 in `_renderPartial`, in `partial-container.directive.ts`) have been removed.

**Note on the Step 2 race-condition fix:** it's real, still worth keeping (confirmed via the same debug logs that it correctly triggers the initial render without needing the listener to catch a same-tick notification), but it was not the fix for the reported bug — the two issues were independent, both real, both fixed.

## Known gaps / follow-ups

1. ~~Preview is broken~~ — **RESOLVED and user-confirmed.** Two independent real bugs found and fixed: a `PartialContainerDirective` race condition, and (the actual root cause) two dynamic `Component()` factory functions missing the `changeDetection: Eager` pin.
2. §27a's forward-looking gap: no lint rule/base class enforces the `changeDetection` pin on new components going forward — **now also applies to §27c** (dynamic `Component()` factories); same underlying gap, no enforcement mechanism for either. Not a blocker for this upgrade, but worth a follow-up ticket.
3. Carried over from `docs/21-upgrade.md`, still unresolved: §13a `ɵSharedStylesHost` double-instance issue in lazy-route child injectors (deferred pending standalone migration).
4. `checklist.md`'s Angular 21→22 deprecation watch-list item is abandoned/unfilled (no genuine R1/R3 research exists for this jump) — see `checklist.md` § Deprecation watch list.

## Related repos touched during this verification pass (outside wavemaker-ng-runtime)

- `wavemaker-ui-variables/package.json` — `@babel/preset-env` `^8.0.5` → `^7.28.6` (fixed a GitLab CI `ERESOLVE` failure; unrelated to Angular 22, a stray major-version bump against a Babel-7 ecosystem)
- `wavemaker-app-runtime-angularjs/package.json` — `engines.node` synced to `24.15.0`/`11.12.1` to match ng-runtime/ng-codegen (was still on `22.18.0`)
- `wavemaker-ng-codegen/src/gen-layouts.js` — explored adding `limit: 1` to an `ncp()` call (suspected concurrency bug), confirmed **not** the actual cause of a codegen crash (root cause was a `pages-config.json` type-mismatch in the test project's own data, not a code bug), and reverted. Documented here so it isn't re-explored as a fresh lead later.

## Post-merge checklist (per the skill's own Step 10 template)

- [x] Merge both `ng-runtime` and `ng-codegen` branches — already done, this upgrade shipped on `stage-ai`
- [x] Update `repo.config.sh`: `ANGULAR_BASE_VERSION`/`ANGULAR_TARGET_VERSION` bumped to `22`/`23`
- [ ] If Node.js version changed: update CI pipeline node version (`.gitlab-ci.yml`/equivalent) — `engines.node` moved to `24.15.0` this upgrade
- [ ] If Node.js version changed: notify any dependent packages/consumers to align `engines.node`
- [ ] Share this doc (`docs/22-upgrade.md`) with the team

## Follow-up (not blocking, worth a separate ticket)

- §27a/§27c's shared gap: no lint rule or shared factory helper prevents a new component (static or dynamic) from silently missing the `changeDetection` pin going forward.
