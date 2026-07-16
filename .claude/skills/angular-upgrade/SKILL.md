---
name: angular-upgrade
description: >-
  Resumable WaveMaker Angular major-version upgrade across both
  wavemaker-ng-runtime and wavemaker-ng-codegen repos. Handles the full
  workflow: package bumps, install, security audit, pattern fixes in both
  repos, ng-codegen build, runtime build, unit tests, and Tomcat preview
  validation. Compatible changes only — no signal migrations or modernization.
  Use when the user says "start angular upgrade", "resume angular upgrade",
  "angular version bump", "upgrade to angular", "run the upgrade skill", or
  "begin upgrading to angular".
---

# /angular-upgrade

One Angular major per run. **Both repos** (`wavemaker-ng-runtime` + `wavemaker-ng-codegen`) upgraded together on the same branch. State in `current-state.md` (gitignored). Summary written to `docs/{major}-upgrade.md` at Step 10.

**Sibling repo:** `../wavemaker-ng-codegen` (`NG_CODEGEN_PATH` in `repo.config.sh`). Both repos stay on the same branch throughout.

**DO NOT invoke** for planning or scoping questions ("what would it take to upgrade?", "what breaks in Angular 21?", "should we upgrade?") — answer those inline without starting Step 0.

---

## Compatibility Policy

**The test for every change:** "Would this be needed even if Angular hadn't released a new version?" If no — don't make it.

Fix removed APIs, changed constructor signatures, and compile errors caused by the new Angular version. Leave everything else exactly as it is. The decorator-based component API, Zone.js, and existing patterns are all fine to keep — Angular supports them in every major version so far, and migrating them is its own separate project.

Things like signals, `input()`/`output()`, zoneless change detection, and `inject()` as a style choice are opt-in modernizations that Angular recommends but does not require. Skip them here.

When in doubt: keep the existing code.

---

## Step Overview

| Step | Name | Gate |
|------|------|------|
| 0 | Config & Confirm | Single summary table shown; user confirms once; `Inputs confirmed: yes` written — no further interruptions for the rest of the run |
| 1 | Inventory | Angular version ≈ base version; all inventory paths resolve |
| 2 | Research & Plan | R1–R3, R5, R8–R12 reviewed; R4 dry-run checked; R5 confirms stable release; every breaking change traced to plan or [N/A]; R2 version pins recorded (incl. R9 jest-preset-angular, R10 ng-packagr); change plan printed and Step 3 begun |
| 3 | Bump Packages | `package.json` edited in **both repos**; R9/R10 pins applied; no install yet |
| 4 | Install | `npm install` exit 0 in all applicable repos |
| 5 | Security Audit | No critical/high vulns; Angular/TS packages unchanged by audit fix |
| 6 | Apply Fixes | Plan applied in both repos; `pattern-review.sh` pass; ng-codegen `build.sh` exit 0 |
| 7 | Build ng-runtime | `BUILD_CMD` exit 0; post-build bundle verify pass |
| 8 | Unit Tests | `TEST_CMD` exit 0 (or skipped when disabled) |
| 9 | Preview Validation | Preview URL renders identically to comparison URL |
| 10 | Finalize & Reset | `docs/{major}-upgrade.md` written; `current-state.md` reset |

**Resume:** start from first step not `done`. A `blocked` step stays blocked until the user clears it. A step in `in-progress` state means the previous session crashed mid-step — **treat `in-progress` as `pending` and restart that step from the beginning**; do not assume partial work is safe to build on. Re-read `repo.config.sh` before Step 7 — build flags may have changed mid-session. A completed round (Step 10 done) always resets; the next run starts at Step 0.

**On resume, spot-check claimed-done steps before skipping:**
- Step 3 — both `package.json` files contain the target Angular version
- Step 4 — `node_modules/@angular/core/package.json` shows the target version
- Step 6 — `pattern-review.sh` exits 0
- Step 7 — build artifacts exist: `dist/bundles/wmapp/scripts/wm-libs.js` is present and newer than `package.json`
- Step 8 — test run was not skipped; if skipped, confirm `DEFAULT_RUN_TESTS=no` is still the intent
- Step 9 — `current-state.md` → **Preview Validation** contains explicit user-reported pass for G1–G7 (not AI self-reported)

If a check fails, re-run that step rather than skipping it.

**Step 6 partial-fix resume:** re-read the Dual-repo change plan from `current-state.md`, verify each row against the current source to confirm which fixes are already applied, then re-run `pattern-review.sh`. Apply only the rows not yet done — do not re-apply fixes that are already in place.

---

## Instructions

Create todos `step-0` … `step-10` at start. Mark each done as you complete it. Update `current-state.md` after every step — whether done, blocked, or skipped.

---

### Step 0 — Config & Confirm

Step 0 is the **one and only confirmation point** for the entire run. After the user confirms here, Steps 1–10 run to completion without any further interruptions.

**Do all of the following in a single pass before asking anything:**

1. Run preflight: `sh .claude/skills/angular-upgrade/scripts/preflight.sh`
2. Read `repo.config.sh` and parse the user trigger message (table below)
3. Resolve ng-runtime branch (`git rev-parse --abbrev-ref HEAD`)
4. Resolve ng-codegen path and branch (`cd $NG_CODEGEN_PATH && git rev-parse --abbrev-ref HEAD`)

**Then show ONE summary table** containing all of the following together:

| Field | Value | Status |
|-------|-------|--------|
| Base → Target Angular | e.g. 20 → 21 | ok / ⚠ mismatch |
| Skip preview / tests / verify | yes/no/no | ok |
| ng-runtime branch | WMS-31488 | ok / ⚠ detached HEAD |
| ng-codegen path | /abs/path | ok / ⚠ not found |
| ng-codegen branch | WMS-31488 | ok / ⚠ mismatch |
| Workspace clean | yes | ok / ⚠ dirty: file1, file2 |

Below the table, add a single line for each ⚠ issue with the action needed (e.g. "dirty: commit or stash before confirming"). Then ask **once**: "Confirm to start, or fix the issues above first."

The user's reply — "confirm", "yes", "go", or any affirmative — starts Steps 1–10. Do not interrupt again after this point regardless of what is found during the run. Unexpected findings (new pattern warnings, audit results, build warnings) are recorded in `current-state.md` and reported at the end of each step as informational — never as blocking prompts.

**Parsing rules:**

| Input | Phrases in user message | Default (from `repo.config.sh`) |
|-------|------------------------|----------------------------------|
| Base version | `base version <N>` | `ANGULAR_BASE_VERSION` |
| Target version | `target version <N>` | `ANGULAR_TARGET_VERSION` |
| Preview URL | `preview url <url>` | `PREVIEW_URL` |
| Comparison URL | `comparison url <url>` | `COMPARISON_URL` |
| Skip preview | `skip preview yes`, `skip step 9`, `skip tomcat` | `no` when URLs set |
| Skip tests | `skip tests yes/no` | `DEFAULT_RUN_TESTS` |
| Skip verify | `skip verify yes/no` | `DEFAULT_RUN_BUNDLE_VERIFY` |

`skip preview yes` sets `PREVIEW_URL=skip`. Chat overrides win over `repo.config.sh` defaults.

Reset `current-state.md` (run `scripts/reset-state.sh`) when any of:
- User says **Start Angular upgrade** (not Resume)
- Stored base/target version ≠ effective base/target from message or `repo.config.sh`
- Step 10 is still `done` in the file (prior run not fully reset)

Write `current-state.md` and set `Inputs confirmed: yes` after the user confirms.

**Done when:** `Inputs confirmed: yes` in `current-state.md`; both branch names and paths recorded.

---

### Step 1 — Inventory

Read these files in ng-runtime and record their current state:

- `package.json` — Angular, TypeScript, RxJS, zone.js versions
- `package-lock.json` — lockfile generation number
- `angular.json` — builders, projects
- `tsconfig.json` and `tsconfig.web-app.json` — `moduleResolution`, `module`, `lib`
- `build-scripts/ngx-bootstrap-patch.mjs` — current patch targets
- `jest.config.js` and `src/setup-jest.js` — jest-preset-angular version

Verify Angular version in `package.json` ≈ `ANGULAR_BASE_VERSION`.

**Done when:** all paths resolve; Angular version confirmed; inventory written to `current-state.md`.

---

### Step 2 — Research & Plan

Review references R1–R13 per [`research.md`](research.md). Block if R1, R2, R3, R5, R8, R9, R10, R11, or R12 are not reviewed.

**Traceability (required):** every R1/R3 breaking change must have a plan row or `[N/A: reason]` — see [`research.md`](research.md) for the full traceability rule and N/A guidance. R1/R3 take precedence over pattern files; an uncovered breaking change is `must-change`.

**R2 version pins (required):** record the exact TypeScript, Node, RxJS, and zone.js versions for the target Angular in `current-state.md` → **R2 Version Pins**. Also record the compatible `jest-preset-angular` version (R9) and `ng-packagr` version (R10) in the same section — all five flow directly into Step 3 edits.

**Undocumented target version:** if the pattern files have no §N entries for the target Angular major (i.e., you are upgrading to a version beyond what they cover), treat every plan item from R1/R3 as `must-review` until Step 9 confirms it. Add new §N entries to the appropriate file as you discover and fix issues:

- ng-runtime source pattern → `patterns/runtime.md`
- ng-codegen template/src pattern → `patterns/codegen.md`
- Evergreen or meta check (applies to any Angular major) → `checklist.md` §21+

See [`research.md`](research.md) for the full reference format and dual-repo file map.

**Documented-but-wrong-gate version:** the "Undocumented target version" case above only covers a target Angular major the pattern files have never seen at all. The more common trap is a target major they *do* mention, with a version-gate that turns out to be inaccurate for this specific delta (e.g. a fix the table says is "Angular 21+" that a direct source check shows is actually already needed at the version this run is installing). Do not treat a matching §N entry as settled just because a row exists — see [`checklist.md` → Verification Principle](checklist.md#verification-principle-pattern-gates-are-hints-not-guarantees) and [`research.md`'s R1 retrieval protocol / general dependency-jump principle](research.md#r1-retrieval-protocol-generic-works-for-any-base-to-target-range) before accepting any N/A.

**Plan summary:** after filling the dual-repo change plan, print it compactly and proceed to Step 3 immediately. Only pause if there is a genuine ambiguity — e.g., two valid approaches to the same breaking change where the right choice depends on user preference, or a breaking change in R1/R3 that the pattern files don't cover and you cannot determine the correct fix. In that case, call out the specific item and ask; don't gate the entire step.

**Done when:** all required references reviewed; every R1/R3 breaking change traced; R2 version pins recorded (including R9 jest-preset-angular and R10 ng-packagr); dual-repo change plan filled.

---

### Step 3 — Bump Packages

Edit `package.json` in **both repos** using:
- R2 version pins from Step 2 (TypeScript, Node, RxJS, zone.js)
- R9 pin from Step 2 (`jest-preset-angular` — major must match Angular target)
- R10 pin from Step 2 (`ng-packagr` — must be compatible with Angular target)
- Dual-repo change plan from Step 2
- Dependency classification table in [`checklist.md`](checklist.md)

Hold off on `npm install` — editing first lets you review the full version delta as a unit before anything is locked into `node_modules`.

Record all before/after version changes in `current-state.md` → **Package Changes** (separate tables for ng-runtime and ng-codegen).

**Done when:** `package.json` edits complete in all applicable repos; R9 (`jest-preset-angular`) and R10 (`ng-packagr`) pins applied; no install run yet.

---

### Step 4 — Install

```bash
sh .claude/skills/angular-upgrade/scripts/install.sh
```

If ng-codegen has `package.json` version changes from Step 3, also run `npm install` in that repo.

**If install fails:** common causes and fixes:
- *Peer dependency conflict* — read the `npm error` line for which package conflicts; add an `overrides` entry in `package.json` to force the version, then retry.
- *Lockfile divergence* — delete `package-lock.json` and retry; commit the regenerated lockfile.
- *Version does not exist on registry* — verify the exact version string in `package.json` against `npm info <package> versions`.
- *Registry timeout* — retry; if the registry is persistently down, unblock and resume later.

**Done when:** install exit 0 in all repos; `node_modules` updated.

---

### Step 5 — Security Audit

```bash
sh .claude/skills/angular-upgrade/scripts/audit.sh
```

The script audits, then runs `npm audit fix` (no `--force`), then audits again. Before running fix it checks that none of the Angular/TS packages pinned in Step 3 would change — those pins are intentional and audit fix shouldn't override them.

Block on any remaining critical or high vulnerability that is not a verifiable false positive. If the lockfile changed, re-run `scripts/install.sh` before continuing.

**Done when:** `npm audit` reports no critical/high; Step 3 package versions unchanged.

---

### Step 6 — Apply Fixes

Apply changes to **both repos** — ng-runtime first, then ng-codegen. ng-codegen §20 templates reference ng-runtime APIs, so runtime fixes must be in place before reviewing codegen changes. Two sources drive what to change:

1. **[`research.md`](research.md) findings** — the dual-repo change plan from Step 2. Each row names which repo(s) to edit.
2. **Pattern file checks** — greps against both repos. [`patterns/runtime.md`](patterns/runtime.md) §1–§19 cover ng-runtime source; [`patterns/codegen.md`](patterns/codegen.md) §20 covers ng-codegen templates and src. [`checklist.md`](checklist.md) has the Automated blockers table, §21–§25, and the Classification guide.

**Read pattern sections targeted to your Step 2 findings** — do not load all three files blindly:

| If Step 2 plan includes | Read |
|------------------------|------|
| Always | Automated blockers (`checklist.md`), §20 (`patterns/codegen.md`) |
| ngx-bootstrap version bump (R8) | §6, §8b, §12 (in `patterns/runtime.md`) |
| tsconfig / moduleResolution change | §20a (in `patterns/codegen.md`) |
| TypeScript major bump | §4, §19 (in `patterns/runtime.md`) |
| RouterOutlet / bootstrap providers | §7, §11 (in `patterns/runtime.md`) |
| DOM renderer changes | §13 (in `patterns/runtime.md`) |
| Test failures expected | §9 (in `patterns/runtime.md`) |

See [`checklist.md § Automated blockers`](checklist.md#automated-blockers-pattern-reviewsh) for the full automated vs manual section breakdown. Do not assume `pattern-review.sh` exit 0 means all patterns are clear — manual sections require separate grep.

Compatibility Policy applies to every edit — fix compile errors only, not modernization.

**Editable paths:** ng-runtime: `projects/`, `tsconfig*.json`, `build-scripts/`, `angular-app/dependencies/`. ng-codegen: `templates/` and `src/` only — never `dist/`.

Classify every finding using the Classification guide in [`checklist.md`](checklist.md) — block on any unresolved `must-change`.

After edits, run the automated check:

```bash
sh .claude/skills/angular-upgrade/scripts/pattern-review.sh
```

**Build ng-codegen after fixes** — Step 9's local angular build runs ng-codegen to generate the app, so codegen must compile cleanly before Step 9 can succeed:

```bash
# NG_CODEGEN_PATH from repo.config.sh (default: ../wavemaker-ng-codegen)
cd <NG_CODEGEN_PATH> && sh build.sh
```

Record all edits in `current-state.md` → **Cross-repo Changes**.

**Done when:** `pattern-review.sh` exit 0; every WARN item either fixed or explicitly deferred (record reason in `current-state.md` → **Pattern Findings**); no open `must-change`; ng-codegen `build.sh` exit 0; changes committed in both repos before proceeding to Step 7 (do not leave uncommitted upgrade changes).

---

### Step 7 — Build ng-runtime

The script sources `repo.config.sh` at runtime — `BUILD_CMD` and bundle verify flags are always read fresh, so mid-session config changes take effect automatically.

```bash
sh .claude/skills/angular-upgrade/scripts/build.sh
```

**Done when:** `BUILD_CMD` exit 0; `verify-ngx-bootstrap-bundle.sh` pass (or `POST_BUILD_VERIFY_SCRIPT` not configured).

---

### Step 8 — Unit Tests

Skip if `DEFAULT_RUN_TESTS=no` or `TEST_CMD` is empty — record reason in Step Status table.

```bash
sh .claude/skills/angular-upgrade/scripts/test.sh
```

Test failures mean something broke in the upgrade. Diagnose and fix in source — don't weaken assertions or skip specs. See [`patterns/runtime.md`](patterns/runtime.md) §9 for common jest-preset-angular issues.

**Done when:** `TEST_CMD` exit 0; or skipped (record reason).

---

### Step 9 — Preview Validation

Skip if `PREVIEW_URL` is empty or `skip`.

**This step has two parts: AI deploys, human verifies.** The AI cannot open a browser or compare visual output — do not self-report G6/G7 as passed.

**AI: build and deploy (automated)**

Follow [`local-angular-build.md`](../../commands/local-angular-build.md) — **upgrade mode** (Steps 2b → 3 → 4 → 5 → 6 → 7). When deploy completes, tell the user:

> "Deployed to Tomcat. Please open both URLs, hard-refresh each, and verify G1–G7.
> Preview: `<PREVIEW_URL>` | Comparison: `<COMPARISON_URL>`
> Report back: 'preview pass' or describe what failed."

Then wait for the user's response before recording a result.

**User: visual verification (manual)**

| Check | Pass condition |
|-------|---------------|
| G1 Comparison loads | Stage baseline route renders without errors |
| G2 Preview loads | Preview route shows content — no blank page, no stuck spinner |
| G3 Same widgets visible | Every widget on comparison is also on preview |
| G4 No fatal errors | No `overrideRouterOutlet`, `__destroyRef`, `NG0201`, unresolved module errors |
| G5 No extra errors | Preview has no console errors absent from comparison |
| G6 Interactions match | Autocomplete, dropdowns, pickers, modals all behave the same as comparison |
| G7 Data renders | Same data/UI state as comparison (excluding live-data freshness) |

G4 is the only check the AI can verify from build/deploy logs. G1–G3 and G5–G7 require human eyes. See [`checklist.md`](checklist.md) preview section for extended checks E1–E13.

**Fix loop (after user reports a failure):**

Diagnose which check failed and which repo owns the code causing it. Fix the source there first — do not re-run the build before the source is corrected.

local-angular-build step reference: 1=Maven build, 2b=ng-runtime bundles, 3=build ng-codegen, 4=generate Angular app, 5=install+build generated app, 6=deploy WAR to Tomcat, 7=copy Angular dist.

| Fix needed in | Re-run |
|---------------|--------|
| ng-runtime | Step 7 → local-angular-build: 2b → 3 → 4 → 5 → 7 |
| ng-codegen | `sh build.sh` in codegen → local-angular-build: 3 → 4 → 5 → 7 |
| Both repos | Step 7 → local-angular-build: 2b → 3 → 4 → 5 → 7 |
| Maven/backend only | local-angular-build: 1 → 6 → 7 |
| Locale/bundle only | local-angular-build: 2b → 3 → 4 → 5 → 7 |

Deferrals block Step 10 unless explicitly accepted by the user.

**Done when:** user confirms G1–G7 pass.

---

### Step 10 — Finalize & Reset

Write `docs/{major}-upgrade.md` covering: Angular versions, date, branch names, references reviewed, package changes in both repos, breaking changes fixed, preview validation result, deferred items.

```bash
sh .claude/skills/angular-upgrade/scripts/reset-state.sh
```

Tell the user: _"Angular {target} upgrade complete. Upgrade doc: `docs/{major}-upgrade.md`."_ See [`templates.md`](templates.md) for the canonical completion message.

**Post-merge checklist (share with user):**
- [ ] Merge both `ng-runtime` and `ng-codegen` branches (coordinated — same PR window or back-to-back)
- [ ] Update `repo.config.sh`: set `ANGULAR_BASE_VERSION` to the target just shipped and `ANGULAR_TARGET_VERSION` to the next major — so the next upgrade starts with correct defaults
- [ ] If Node.js version changed: update CI pipeline node version (`.github/workflows/`, `Jenkinsfile`, or equivalent)
- [ ] If Node.js version changed: notify any dependent packages/consumers to align `engines.node`
- [ ] Share `docs/{major}-upgrade.md` with the team (PR description or channel)

**Done when:** upgrade doc written; `current-state.md` reset; todos cleared.

---

## Utility Scripts

```bash
sh .claude/skills/angular-upgrade/scripts/preflight.sh        # Step 0 — clean workspace check
sh .claude/skills/angular-upgrade/scripts/install.sh          # Step 4
sh .claude/skills/angular-upgrade/scripts/audit.sh            # Step 5
sh .claude/skills/angular-upgrade/scripts/pattern-review.sh  # Step 6
sh .claude/skills/angular-upgrade/scripts/build.sh              # Step 7 full (BUILD_CMD from repo.config.sh)
sh .claude/skills/angular-upgrade/scripts/build.sh --incremental  # mid-upgrade check only
sh .claude/skills/angular-upgrade/scripts/test.sh             # Step 8
sh .claude/skills/angular-upgrade/scripts/reset-state.sh     # Step 10 or Step 0 fresh start
sh .claude/skills/angular-upgrade/scripts/rollback.sh        # undo code changes in both repos (run before reset-state.sh when abandoning an upgrade)
# NOTE: rollback.sh resets tracked source files but does NOT reverse node_modules.
# After rollback, delete node_modules and re-run npm install to return to the pre-upgrade package state.
```

Config source: [`repo.config.sh`](repo.config.sh) (sourced by all scripts).

---

## Additional Resources

| File | Read when |
|------|-----------|
| [`templates.md`](templates.md) | Step 0/10 — config table, completion message, upgrade doc skeleton |
| [`research.md`](research.md) | Step 2 — reference checklist + dual-repo file map |
| [`patterns/runtime.md`](patterns/runtime.md) | Step 6 — ng-runtime §1–§19 greps |
| [`patterns/codegen.md`](patterns/codegen.md) | Step 6 — ng-codegen §20 greps |
| [`checklist.md`](checklist.md) | Step 3 — dependency classification table; Step 6 — automated blockers, §21–§25, classification guide; Step 9 — extended checks |
| [`troubleshoot.md`](troubleshoot.md) | Any step — error message → §N quick lookup |
| [`state.md`](state.md) | Template for `current-state.md` |
| [`../../commands/local-angular-build.md`](../../commands/local-angular-build.md) | Step 9 — Tomcat build and deploy |

**Port this skill:** copy `.claude/skills/angular-upgrade/`; edit `repo.config.sh`.

---

## Important Rules

- **One confirmation only.** Step 0 is the sole gate. After the user confirms, Steps 1–10 run to completion — no further prompts for informational findings.
- **Compatibility first.** Fix compile and runtime breaks caused by the Angular version change. Do not modernize (signals, zoneless, `inject()` style, standalone migration) unless it is required for compilation.
- **Both repos together.** ng-runtime and ng-codegen are always upgraded on the same branch name. Never bump one without the other.
- **`ng update --dry-run` before live.** Never run `ng update` without `--dry-run` first — it overwrites `build.sh -f` and other custom pipeline files.
- **Commit before Step 7.** All upgrade edits in both repos must be committed before starting the build. Uncommitted changes make it impossible to bisect a build failure.
- **Never edit generated app source.** No hand-edits under `~/Desktop/local-*/src/` or any codegen `dist/`. Fix source in ng-runtime or ng-codegen, then rebuild and regenerate.
- **Block on `must-change`.** Any finding classified `must-change` in `checklist.md` blocks Step 6 done. Do not defer without explicit user acceptance.
- **R1/R3 take precedence.** A breaking change in the official Angular changelog that is not in the pattern files is still `must-change`. Pattern files are a starting point, not a complete list.
- **User verifies G1–G7.** The AI deploys to Tomcat and waits. Do not self-report preview checks as passed — only accept a user-confirmed result.
