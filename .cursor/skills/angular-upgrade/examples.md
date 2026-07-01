# Examples

Canonical messages for this skill.

---

## Start Angular upgrade (full — all flags explicit)

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

Agent runs preflight + branch checks, prints the config table with a Status column, and asks for confirmation once. After confirmation, Steps 1–10 run without further interruption.

## Resume Angular upgrade

```text
Resume Angular upgrade.
```

Valid only while a run is **in progress** (Step 10 not `done`, base/target unchanged). If the previous round finished, Step 0 resets state automatically and starts a new upgrade.

## Effective config table (Step 0 output)

Shown once before asking for confirmation. Each row has a Status column — `ok` when resolved cleanly, `⚠` with inline action needed when not.

```
| Field              | Value                                                  | Status          |
|--------------------|--------------------------------------------------------|-----------------|
| Angular            | 20 → 21                                                | ok              |
| Skip preview/tests | no / no / no                                           | ok              |
| ng-runtime branch  | WMS-31488                                              | ok              |
| ng-codegen path    | /Users/.../wavemaker-ng-codegen                        | ok              |
| ng-codegen branch  | WMS-31488                                              | ok              |
| Workspace clean    | yes                                                    | ok              |

Confirm to start, or fix the ⚠ issues above first.
```

## Blocker alert (Step N blocked — genuine exit-code failure)

Used only when a step fails with a non-zero exit code (build, install) and cannot continue. After Step 0 confirmation, informational findings are recorded but do not block — only hard failures do.

```
⛔ BLOCKED — Step 7 — Build ng-runtime

  What:     build.sh exit 1
  Evidence: [last N lines of error output]
  Fix:      [specific action — e.g. "check TS error in wm_dom_renderer.ts line 42"]

  After fixing, say "resume upgrade" to continue from Step 7.
```

## Reference review bullet (Step 2)

```text
- R1: reviewed — https://angular.dev/update-guide?v=21.0&from=20&to=21&level=advanced —
      12 recommendations traced in R1 Update Guide Traceability (8 [N], 4 [Y])
      runtime: tsconfig, app.config.ts, transpiler; codegen: app.config.ts.hbs, gen-tsconfig.js
      Breaking (R3): @HostListener multi-key → [N/A: no multi-key listeners in WaveMaker widgets]
```

## R1 traceability bullets (Step 2 — one per update-guide recommendation)

```text
- [Y] moduleResolution bundler | runtime: tsconfig.json, tsconfig.web-app.json | codegen: src/gen-tsconfig.js | plan: §20a
- [Y] provideZoneChangeDetection with coalescing | runtime: runtime-dynamic/.../app.config.ts | codegen: templates/app.config.ts.hbs | plan: §20g
- [N] Enable zoneless change detection | runtime: n/a | codegen: n/a | plan: [N/A: WM keeps Zone.js per Compatibility Policy]
```

## Dual-repo change plan row (Step 2)

| § / Ref | Repo | Files | Change | Breaking change source |
|---------|------|-------|--------|----------------------|
| §20a / R1 | both | tsconfig.json, tsconfig.web-app.json, gen-tsconfig.js | moduleResolution → bundler | R1: package exports |
| §20b / R8 | codegen | templates/app.config.ts.hbs | Remove ModalModule.forRoot() | ngx-bootstrap 21 removed forRoot on ModalModule |
| §20g / R1 | both | runtime-dynamic/.../app.config.ts, templates/app.config.ts.hbs | Mirror R1 bootstrap APIs (provide*/with*) | R1 update guide + bootstrap-parity.sh |

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
