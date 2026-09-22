# Angular 22 Upgrade — INCOMPLETE

**Status: package/source changes shipped; preview validation not done. Do not treat as finished.**

**Branch:** WMS-32451 (merged to `stage-ai`)
**Base → Target:** Angular 21 → 22
**Commits:** `aab04e7ae`, `3d5e32079`, `e00efb3f3`, `6ff1ec379` (2026-09-17)

This upgrade happened outside the `angular-upgrade` skill's Step 0–10 process — reconstructed
after the fact from commit messages, not from a `current-state.md` run. `repo.config.sh` is
deliberately still `ANGULAR_BASE_VERSION=21` / `TARGET=22`, not `22→23` — see the comment
there. Full pattern-level diff: `docs/upgrade-log/21-to-22.md`.

## What's confirmed done

| Check | Result |
|-------|--------|
| `package.json` bump (both repos) | done — `@angular/core` 22.1.7 |
| `npm install` | done |
| `build.sh -f` | pass, per `e00efb3f3` |
| `verify-ngx-bootstrap-bundle.sh` | pass, per `e00efb3f3` |
| `pattern-review.sh` | pass, per `e00efb3f3` |
| Unit tests | one flaky spec skipped (`6ff1ec379`, pre-existing root cause, unrelated to Angular 22) — otherwise not confirmed in a commit message |

## What's NOT done

- **Step 9 — Preview validation (G1–G7) never ran to completion.** No commit confirms it. The user has since confirmed **preview is currently broken.**
- No `current-state.md` record exists for this run to audit against.
- §27/§28 in `patterns/runtime.md` (new Angular-22-default-behavior and compiler-strictness patterns, added retroactively from commit messages) are unverified against a passing preview — see the caution note at the top of §27.

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
- `app.config.ts`: `withRouterConfig({ paramsInheritanceStrategy: 'emptyOnly' })` (§27b) and `withXhr()` on `provideHttpClient` (§7b) — both preserve pre-22 defaults
- `tsconfig*.json`: `strict: false`, `noUncheckedSideEffectImports: false`, `ignoreDeprecations: "6.0"` — TS 6.0 flipped `strict` to default `true` (§25)
- `wm_shared_styles_host.ts`: no-op `removeStyles()` override (§13i)
- `date-time-picker.component.ts`: removed duplicate `@Input("config")` (NG1054, §28)
- `app.module.ts`: removed `bootstrap: [AppComponent]` (NG6009) and moved `PageWrapperComponent` to `imports` (NG6008), §28
- `ngx-bootstrap-patch.mjs`: no changes needed — all 5 patches now native in ngx-bootstrap 22.0.0 (§12)
- `src/update-angular-json.js` (ng-codegen): pre-existing wrong foundation-css path fixed (§20e — not Angular-22-specific)

## Known gaps / follow-ups

1. **Preview is broken** — needs investigation before this upgrade can be considered done. Not yet diagnosed.
2. §27a's forward-looking gap: no lint rule/base class enforces the `changeDetection` pin on new components going forward.
3. Carried over from `docs/21-upgrade.md`, still unresolved: §13a `ɵSharedStylesHost` double-instance issue in lazy-route child injectors (deferred pending standalone migration).
4. `checklist.md`'s Angular 21→22 deprecation watch-list item is abandoned/unfilled (no genuine R1/R3 research exists for this jump) — see `checklist.md` § Deprecation watch list.

## Next steps

Resume via the `angular-upgrade` skill (`repo.config.sh` is already set to `21→22`) starting from Step 9 — diagnose why preview is broken, then complete Steps 9–10 properly before considering a 22→23 upgrade.
