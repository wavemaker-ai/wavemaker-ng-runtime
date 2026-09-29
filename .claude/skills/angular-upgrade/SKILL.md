---
name: angular-upgrade
description: >-
  Resumable WaveMaker Angular major-version upgrade across both
  wavemaker-ng-runtime and wavemaker-ng-codegen repos. Handles the full
  workflow: package bumps, install, security audit, pattern fixes in both
  repos, ng-codegen build, runtime build, unit tests, and preview validation
  across both Angular Deployment (Tomcat) and WaveMaker Preview modes.
  Compatible changes only — no signal migrations or modernization.
  Use when the user says "start angular upgrade", "resume angular upgrade",
  "angular version bump", "upgrade to angular", "run the upgrade skill", or
  "begin upgrading to angular".
---

# /angular-upgrade

One Angular major per run. **Both repos** (`wavemaker-ng-runtime` + `wavemaker-ng-codegen`) upgraded together on the same branch. State in `current-state.md` (gitignored). Summary written to `docs/{major}-upgrade.md` at Step 10.

**Sibling repo:** `../wavemaker-ng-codegen` (`NG_CODEGEN_PATH` in `repo.config.sh`). Both repos stay on the same branch throughout.

**Two code paths — Preview and Deployment — must both be changed and tested every upgrade:** [`preview-vs-deployment.md`](preview-vs-deployment.md) (parity matrix and protocol).

**A third sibling repo, `../wavemaker-foundation-css`, sometimes needs its own fix.** It is not tracked by `repo.config.sh`, has no automated checks in this skill, and this skill does not manage its branch — but it holds the WM design-system CSS (via `.yalc`) that ngx-bootstrap-derived components render against. When a Step 9 visual regression looks exactly like a known ngx-bootstrap-patch symptom (e.g. modal/backdrop invisible) but `verify-ngx-bootstrap-bundle.sh` passes and the patch source looks correct, check foundation-css's own CSS before spending more time in ng-runtime — see [`patterns/runtime.md` §6](patterns/runtime.md#6-ngx-bootstrap-patch-and-widgets) for a confirmed real instance (18→19 hop). If a fix is needed there, switch that repo to the same branch, apply the CSS fix, and `npm run build` (auto-runs `yalc push` back into ng-runtime).

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
| 2 | Research & Plan | R1–R3, R5, R8–R12 reviewed (blocking); R4 dry-run run for extra coverage (ref-only — expected practice, but does not itself block Step 2 the way R1–R12 do); R5 confirms stable release; every breaking change traced to plan or [N/A]; R2 version pins recorded (incl. R9 jest-preset-angular, R10 ng-packagr); change plan printed and Step 3 begun |
| 3 | Bump Packages | `package.json` edited in **both repos**; R9/R10 pins applied; no install yet |
| 4 | Install | `npm install` exit 0 in all applicable repos |
| 5 | Security Audit | No critical/high vulns; Angular/TS packages unchanged by audit fix |
| 6 | Apply Fixes | Plan applied in both repos; `pattern-review.sh` pass; ng-codegen `build.sh` exit 0 |
| 7 | Build ng-runtime | `BUILD_CMD` exit 0; post-build bundle verify pass |
| 8 | Unit Tests | `TEST_CMD` exit 0 (or skipped when disabled) |
| 9 | Preview Validation | Every configured validation mode's preview URL renders identically to its comparison URL(s) |
| 10 | Finalize & Reset | `docs/{major}-upgrade.md` written; `current-state.md` reset |

**Resume:** first re-check the reset conditions below — they apply to every "Resume Angular upgrade" invocation, not only a fresh "Start" — then start from the first step not `done`. If a reset condition fires (most commonly: `repo.config.sh`'s current `ANGULAR_BASE_VERSION`/`ANGULAR_TARGET_VERSION` no longer match what's stored in `current-state.md`), do not silently resume — surface the mismatch to the user and ask whether the in-progress run's stored version is still correct (continue as-is) or `repo.config.sh` was updated for *this* run (reset and restart at Step 0). A `blocked` step stays blocked until the user clears it. A step in `in-progress` state means the previous session crashed mid-step — **treat `in-progress` as `pending` and restart that step from the beginning**; do not assume partial work is safe to build on. Re-read `repo.config.sh` before Step 7 — build flags may have changed mid-session. A completed round (Step 10 done) always resets; the next run starts at Step 0.

**On resume, spot-check claimed-done steps before skipping:**
- Step 0 — `Inputs confirmed: yes`, and the recorded ng-runtime/ng-codegen branches match the actual current `git rev-parse --abbrev-ref HEAD` in both repos (a branch may have changed since Step 0 ran)
- Step 1 — the Angular version recorded in current-state.md's inventory still matches `package.json`'s actual current version (re-run Step 1's own check)
- Step 2 — the Dual-Repo Change Plan has at least one row (or explicit `[N/A: reason]` entries covering every R1/R3 breaking change) and R2 Version Pins are filled in, not blank
- Step 3 — both `package.json` files contain the target Angular version
- Step 4 — `node_modules/@angular/core/package.json` shows the target version
- Step 6 — `pattern-review.sh` exits 0
- Step 7 — build artifacts exist: `dist/bundles/wmapp/scripts/wm-libs.js` is present and newer than `package.json`
- Step 8 — test run was not skipped; if skipped, confirm `DEFAULT_RUN_TESTS=no` is still the intent
- Step 9 — `current-state.md` → **Preview Validation** contains an explicit user-reported pass for G1–G7 (not AI self-reported) for **every configured, non-skipped mode** — a pass recorded for one mode does not cover an unchecked other mode

If a check fails, re-run that step rather than skipping it.

**Step 6 partial-fix resume:** re-read the Dual-repo change plan from `current-state.md`, verify each row against the current source to confirm which fixes are already applied, then re-run `pattern-review.sh`. Apply only the rows not yet done — do not re-apply fixes that are already in place.

---

## Instructions

Create todos `step-0` … `step-10` at start. Mark each done as you complete it. Update `current-state.md` after every step — whether done, blocked, or skipped.

Steps are split across two files, in order:

- **[`steps-0-5.md`](steps-0-5.md)** — Step 0 (Config & Confirm), Step 1 (Inventory), Step 2 (Research & Plan), Step 3 (Bump Packages), Step 4 (Install), Step 5 (Security Audit)
- **[`steps-6-10.md`](steps-6-10.md)** — Step 6 (Apply Fixes), Step 7 (Build ng-runtime), Step 8 (Unit Tests), Step 9 (Preview Validation), Step 10 (Finalize & Reset)

Both files assume this page's Compatibility Policy, Step Overview, and resume rules above — read those first, then follow the two step files in order.

---

## Utility Scripts

```bash
sh scripts/preflight.sh        # Step 0 — clean workspace check
sh scripts/install.sh          # Step 4
sh scripts/audit.sh            # Step 5
sh scripts/pattern-review.sh  # Step 6
sh scripts/build.sh              # Step 7 full (BUILD_CMD from repo.config.sh)
sh scripts/build.sh --incremental  # mid-upgrade check only
sh scripts/test.sh             # Step 8
sh scripts/reset-state.sh     # Step 10 or Step 0 fresh start
sh scripts/rollback.sh        # undo code changes in both repos (run before reset-state.sh when abandoning an upgrade)
# NOTE: rollback.sh resets tracked source files but does NOT reverse node_modules.
# After rollback, delete node_modules and re-run npm install to return to the pre-upgrade package state.
```

Config source: [`repo.config.sh`](repo.config.sh) (sourced by all scripts).

---

## Additional Resources

| File | Read when |
|------|-----------|
| [`steps-0-5.md`](steps-0-5.md) | Steps 0–5 — full instructions |
| [`steps-6-10.md`](steps-6-10.md) | Steps 6–10 — full instructions |
| [`templates.md`](templates.md) | Step 0/10 — config table, completion message, upgrade doc skeleton |
| [`research.md`](research.md) | Step 2 — reference checklist + dual-repo file map |
| [`patterns/runtime.md`](patterns/runtime.md) | Step 6 — ng-runtime §1–§19 greps |
| [`patterns/codegen.md`](patterns/codegen.md) | Step 6 — ng-codegen §20 greps |
| [`checklist.md`](checklist.md) | Step 3 — dependency classification table; Step 6 — automated blockers, §21–§25, classification guide; Step 9 — extended checks |
| [`troubleshoot.md`](troubleshoot.md) | Any step — error message → §N quick lookup |
| [`preview-vs-deployment.md`](preview-vs-deployment.md) | Steps 6/9/10 — Preview vs Deployment parity protocol |
| [`state.md`](state.md) | Template for `current-state.md` |
| `docs/upgrade-log/{base}-to-{target}.md` | Step 2/6 — before editing an existing §N row/section; Step 10 — verify it's complete. Skeleton in [`templates.md`](templates.md#pattern-diff-log-skeleton-step-26--docsupgrade-logbase-to-targetmd) |
| [`../../commands/local-angular-build.md`](../../commands/local-angular-build.md) | Step 9 — Tomcat build and deploy |

**Port this skill:** copy this skill's directory as-is to another tool's skills root, keeping the same relative layout (`<tool-dir>/skills/angular-upgrade/`), plus `commands/local-angular-build.md` to that root's `commands/` sibling (`<tool-dir>/commands/`); edit `repo.config.sh`.

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
- **Diff-log before overwrite.** Before editing an existing §N row or section in `checklist.md`/`patterns/*.md`, append its prior value to `docs/upgrade-log/{base}-to-{target}.md`. New §N entries don't need this — only edits to something that already existed.
- **One build at a time, per repo.** Full builds (Step 7, `RUNTIME_BUNDLE_CMD`, ng-codegen `build.sh`) take minutes and are not safe to run concurrently against the same working directory — a second run racing the first corrupts `node_modules`/`dist`/`libraries` (real incident, hop 2: two overlapping `build.sh -f` runs left `libraries/core` and `libraries/components/base` missing even though both processes reported success). `ps aux | grep -E "build.sh|ng-packagr|rollup"` before starting a new one. If invoking a long build via a tool that already backgrounds the whole command, do not also append a trailing `&` inside the command string — that detaches an untracked orphan process that keeps writing to the log after the tracked job "completes," which is exactly how the hop-2 incident happened.
- **User verifies G1–G7, for every configured validation mode.** The AI builds/deploys Angular Deployment (the only mode with automation) and waits; WaveMaker Preview has no build step at all. Do not self-report preview checks as passed for any mode — only accept a user-confirmed result. Both modes are first-class; do not treat Angular Deployment as the "real" check and WaveMaker Preview as optional, or vice versa.
