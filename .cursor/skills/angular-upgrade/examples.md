# Examples

Canonical messages for this skill.

---

## Start Angular upgrade (full — implicit confirm)

```text
Start Angular upgrade.

base version 20
target version 21
preview url http://localhost:8080/SearchWidgetScenarios/#/LiveForm_Autocomplete
comparison url https://stage-platform.wavemaker.ai/run-jlqb2h631c/SearchWidgetScenarios_master/#/Main
skip preview no
skip tests no
skip verify no
```

## Start Angular upgrade (minimal — defaults from repo.config.sh)

```text
Start Angular upgrade.
```

Agent prints effective config → waits for `confirm` or the full message above before proceeding.

## Resume Angular upgrade

```text
Resume Angular upgrade.
```

Valid only while a run is **in progress** (Step 10 not `done`, base/target unchanged). If the previous round finished, Step 0 resets state automatically and starts a new upgrade.

## Effective config table (Step 0 output)

```
Angular:      20 → 21
Preview URL:  http://localhost:8080/SearchWidgetScenarios/#/LiveForm_Autocomplete
Compare URL:  https://stage-platform.wavemaker.ai/.../Main
Skip preview: no
Skip tests:   no
Skip verify:  no
Build cmd:    sh build.sh -f
ng-runtime:   WMS-31488
ng-codegen:   ../wavemaker-ng-codegen  (branch: WMS-31488)

Confirm? → type "confirm" or "proceed with defaults"
```

## Blocker alert (Step N blocked)

```
⛔ BLOCKED — Step 6 — Apply Fixes

  What:     pattern-review.sh exit 1 — branch mismatch
  Evidence: ng-runtime=WMS-31488  ng-codegen=development
  Fix:      checkout WMS-31488 on wavemaker-ng-codegen, then re-run pattern-review.sh
  To continue: fix and type "continue" / "defer step 6" / "resume upgrade"
```

## Reference review bullet (Step 2)

```text
- R1: reviewed — standalone bootstrap required; drop NgModule forRoot in codegen —
      runtime: transpiler/imports.ts; codegen: app.config.ts.hbs
      Breaking: ModalModule.forRoot() removed → plan row §20b / R8
      Breaking: @HostListener multi-key → [N/A: no multi-key listeners in WaveMaker widgets]
```

## Dual-repo change plan row (Step 2)

| § / Ref | Repo | Files | Change | Breaking change source |
|---------|------|-------|--------|----------------------|
| §20a / R2 | both | tsconfig.json, tsconfig.web-app.json | moduleResolution → bundler | R2: Angular 21 requires bundler for package exports |
| §20b / R8 | codegen | templates/app.config.ts.hbs | Remove ModalModule.forRoot() | ngx-bootstrap 21 removed forRoot on ModalModule |

## Step 10 — completion message (AI output to user)

```
Angular 21 upgrade complete.

Upgrade doc:   docs/21-upgrade.md
Branch:        WMS-31488  (ng-runtime + ng-codegen)
Preview:       http://localhost:8080/SearchWidgetScenarios/#/LiveForm_Autocomplete — PASSED
Tests:         npm test — PASSED

Reset state:
sh .cursor/skills/angular-upgrade/scripts/reset-state.sh
```

After showing this, run:

```bash
sh .cursor/skills/angular-upgrade/scripts/reset-state.sh
```

## Upgrade doc skeleton (Step 10 — `docs/{major}-upgrade.md`)

```markdown
# Angular {target} Upgrade

Date: YYYY-MM-DD
Branch: <branch> (ng-runtime + ng-codegen)

## Versions

| Package | Before | After |
|---------|--------|-------|
| @angular/core | | |
| typescript | | |
| rxjs | | |
| zone.js | | |
| ngx-bootstrap | | |

## References Reviewed

- R1: Angular Update Guide — <summary of breaking changes found>
- R2: Version Compatibility — TS X.X, Node XX, RxJS X.X, zone.js X.X
- R3: Changelog — <summary>
- R8: ngx-bootstrap — <API changes found or "no breaking changes">
- R12: wavemaker-runtime-patterns.md — <must-change items found>

## Breaking Changes Applied

| Change | Repo | Files | § / Ref |
|--------|------|-------|---------|

## Preview Validation

- Preview URL: <url> — PASSED / FAILED
- Comparison URL: <url>
- G1–G7: all passed
- Extended checks run: <list E1–E13 items verified>

## Deferred Items

<list any needs-review findings deferred with user acceptance, or "none">
```

---

## Standalone local build (not this skill's Step 9)

Use `@.cursor/commands/local-angular-build` — see that command's doc for path formulas.
