# Examples

Canonical messages for this skill. Parsing rules: [`inputs.md`](inputs.md).

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

## Start Angular upgrade (minimal)

```text
Start Angular upgrade.
```

Agent shows defaults from `repo.config.sh` + [`inputs.md`](inputs.md) → **stop** until user sends `confirm` or full message above.

## Resume Angular upgrade

```text
Resume Angular upgrade.
```

Only valid while a run is **in progress** (Step 10 not `done`, base/target unchanged). If the previous round finished, reset runs automatically → Step 0 for a new upgrade.

## Step 10 complete (reset state)

After writing `docs/{major}-upgrade.md`:

```bash
sh .cursor/skills/angular-upgrade/scripts/reset-state.sh
```

## Reference review bullet (Step 2)

```text
- R1: reviewed — standalone bootstrap required; drop NgModule forRoot in codegen — runtime: transpiler/imports.ts; codegen: app.config.ts.hbs
```

## Blocker alert (Step N blocked)

```text
⛔ UPGRADE BLOCKED — Step 6: Repo pattern review

What failed: pattern-review.sh exit 1 — codegen branch mismatch.

Evidence: ng-runtime=WMS-31488 ng-codegen=development

Impact: Steps 7–10 paused.

Suggested fix: checkout WMS-31488 on wavemaker-ng-codegen, re-run pattern-review.sh.

To continue: fix and continue / defer step 6 / resume upgrade
```

## Dual-repo change plan row (Step 2)

| § / Ref | Repo | Files | Change |
|---------|------|-------|--------|
| §20a / R2 | both | tsconfig.web-app.json, gen-tsconfig.js | Align moduleResolution bundler |

## Standalone local build (not this skill’s Step 0)

Use `@.cursor/commands/local-angular-build` — see that command’s doc and [`inputs.md`](inputs.md) path formulas.
