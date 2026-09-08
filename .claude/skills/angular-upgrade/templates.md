# Templates

Canonical messages for this skill.

---

## Start Angular upgrade (full — all flags explicit)

```text
Start Angular upgrade.

base version 20
target version 21
preview url http://localhost:8080/SearchWidgetScenarios/#/LiveForm_Autocomplete
comparison url https://stage-platform.wavemaker.ai/run-jlqb2h631c/SearchWidgetScenarios_master/#/Main
wavemaker preview url https://<studio-host>/preview.html?project-id=<id>#/?app_url=<deployedUrl>/%23/
wavemaker preview comparison url https://stage-platform.wavemaker.ai/run-jlqb2h631c/SearchWidgetScenarios_master/#/Main
skip preview no
skip tests no
skip verify no
```

Both `preview url`/`comparison url` (Angular Deployment) and `wavemaker preview url`/`wavemaker preview comparison url` (WaveMaker Preview) are independent — set either pair alone to validate only that mode, or both to validate both (the default once both are configured). Omit a pair entirely (or use `skip <mode name> yes`) to skip just that mode.

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
| Base → Target Angular      | 20 → 21                                         | ok              |
| Angular Deployment URL / Comparison | http://localhost:8080/.../#/Main / https://stage.../#/Main | ok |
| WaveMaker Preview URL / Comparison  | https://.../preview.html?... / https://stage.../#/Main    | ok |
| Skip tests / verify | no / no                                                    | ok              |
| ng-runtime branch  | WMS-31488                                              | ok              |
| ng-codegen path    | /Users/.../wavemaker-ng-codegen                        | ok              |
| ng-codegen branch  | WMS-31488                                              | ok              |
| Workspace clean    | yes                                                    | ok              |

Confirm to start, or fix the ⚠ issues above first.
```

A validation-mode row reads `⚠ not configured (mode skipped)` when its URL is empty/`skip` — informational, not a blocker. The table shows one row per entry in `VALIDATION_MODES` (`repo.config.sh`); adding a third mode there adds a third row here automatically, no template change needed.

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

Upgrade doc:          docs/21-upgrade.md
Branch:               WMS-31488  (ng-runtime + ng-codegen)
Angular Deployment:   http://localhost:8080/SearchWidgetScenarios/#/LiveForm_Autocomplete — PASSED
WaveMaker Preview:    https://<studio-host>/preview.html?... — PASSED
Tests:                npm test — PASSED

Reset state:
sh scripts/reset-state.sh
```

Omit a mode's line entirely if it was skipped (no URL configured) rather than showing it as failed/blank.

After showing this, run:

```bash
sh scripts/reset-state.sh
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
- R12: checklist.md — <must-change items found>

## Breaking Changes Applied

| Change | Repo | Files | § / Ref |
|--------|------|-------|---------|

## Preview Validation

One subsection per configured validation mode (`VALIDATION_MODES` in `repo.config.sh`). Omit a mode's subsection entirely if it was skipped (no URL configured) — do not show it as failed.

### Angular Deployment

- Preview URL: <url> — PASSED / FAILED
- Comparison URL(s): <url>
- G1–G7: all passed
- Extended checks run: <list E1–E13 items verified>

### WaveMaker Preview

- Preview URL: <url> — PASSED / FAILED
- Comparison URL(s): <url>
- G1–G7: all passed
- Extended checks run: <list E1–E13 items verified>

## Deferred Items

<list any needs-review findings deferred with user acceptance, or "none">
```

---

## Standalone local build (not this skill's Step 9)

Use `/local-angular-build` — see that command's doc for path formulas.
