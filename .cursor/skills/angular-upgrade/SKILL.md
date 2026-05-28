---
name: angular-upgrade
description: >-
  Resumable Angular major-upgrade workflow for any repository. Configure commands
  in repo.config.sh and patterns in PATTERNS_FILE. Runs install, security audit,
  repo pattern review, build, preview validation, and mandatory unit tests.
  Resumes from current-state.md.
---

# Angular upgrade (generic)

Conservative, **resumable** workflow for upgrading the Angular platform in **any** repository. State: `current-state.md`. History: `upgrade-history.md` (append one section per completed major bump).

## Port to another repository

1. Copy the entire `.cursor/skills/angular-upgrade/` folder.
2. Edit **`repo.config.sh`** (commands, optional post-build verify script name, `PATTERNS_FILE`).
3. Add or replace the patterns file named by **`PATTERNS_FILE`** (this repo: `wavemaker-patterns.md`).
4. Reset **`current-state.md`** from the template in this file.
5. Append **`upgrade-history.md`** when an upgrade completes.

**Only `repo.config.sh` and the `PATTERNS_FILE` patterns doc should differ between repos.** Scripts under `scripts/` are shared.

## Accepted prompt forms

| User says | Meaning |
|-----------|---------|
| “Upgrade Angular to …” / “Angular N+1” | Full workflow from Step 0 |
| “Resume Angular upgrade” | Read `current-state.md`, continue first non-`done` step |
| “Run security / build / tests” | That step’s scripts if prior steps allow or user overrides |
| “Validate preview at …” | Step 8; store URL in `current-state.md` |
| “Rerun build gate” | Step 7 (+ post-build verify if configured) |

## Files

| File | Purpose |
|------|---------|
| `repo.config.sh` | **Per-repo** install, build, test commands; optional verify script |
| `repo.config.example.sh` | Template for new repos |
| `PATTERNS_FILE` (e.g. `wavemaker-patterns.md`) | **Per-repo** Step 6 greps + Step 8 preview checklist |
| `SKILL.md` | Generic workflow (this file) |
| `README.md` | Human index |
| `current-state.md` | Resumable status |
| `upgrade-history.md` | Per-upgrade engineering record (skill folder) |
| `upgrade-summary-template.md` | Template for Step 10 `docs/{major}-upgrade.md` |
| `references.md` | External links (Step 2) |
| `scripts/install.sh` | `INSTALL_CMD` |
| `scripts/audit.sh` | Security gate: audit → fix → audit |
| `scripts/build.sh` | `BUILD_CMD` / `BUILD_CMD_FULL`; runs optional post-build verify |
| `scripts/test.sh` | `TEST_CMD` (**mandatory** Step 9) |
| `scripts/verify-*.sh` | Optional; referenced by `POST_BUILD_VERIFY_SCRIPT` |

Script paths are relative to the skill: `.cursor/skills/angular-upgrade/scripts/`.

## Post-build verification (optional)

If `repo.config.sh` sets `POST_BUILD_VERIFY_SCRIPT` (e.g. `verify-ngx-bootstrap-bundle.sh`), `scripts/build.sh` runs it after the build. **Block Step 7** on non-zero exit. Record results under **Post-build verify** in `current-state.md`.

If empty, skip — no bundle verify section required.

Before `dist` exists: optional `--allow-missing` on verify scripts that support it (Steps 4–6 only, not Step 7/8).

## Unit tests (Step 9) — mandatory

**Always run** `scripts/test.sh` after Step 8 is `done` (or Step 8 skipped by user for build-only). Do not skip unless the user explicitly aborts the whole upgrade.

On failure: list failing spec paths, set Step 9 `blocked`, stop.

## Preview scope (Step 8)

Validate only the preview URL from Step 0. Skip if user chose build-only. Do not expand scope unless asked.

## Status values

| Status | Meaning |
|--------|---------|
| `pending` | Not started |
| `in_progress` | Running |
| `done` | Success |
| `blocked` | Failed or waiting on user |

Resume at the first step not `done`. Update `current-state.md` after every step.

---

## Step 0 — Upgrade gate

**HARD STOP** before editing `package.json`. Do not assume target version or preview URL.

Ask (or use values from the user message):

1. **Target Angular major** (one major at a time unless user insists otherwise)
2. **Preview URL** for Step 8, or **build-only** (skip preview after Step 7)
3. **Branch** (optional)

Record in `current-state.md` → **Project**. Set Step 0 `done`.

---

## Step 1 — Detect and inventory

Read `package.json`, lockfile, `angular.json`, `tsconfig*.json`, test config, and any paths listed in the file named by **`PATTERNS_FILE`** in `repo.config.sh`.

Record current vs target versions, engines, and key ecosystem packages in `current-state.md`. Set Step 1 `done`.

## Step 2 — Plan upgrade path

1. Read `references.md` and [Angular Update Guide](https://angular.dev/update-guide) for the target major.
2. Use the **`PATTERNS_FILE`** doc for repo-specific dependency and patch risks.
3. Plan version bumps, deferred packages, and post-build verify (if any).
4. Stub a new section in `upgrade-history.md` (`NN → NN+1`, date).

Set Step 2 `done`.

## Step 3 — Apply package upgrades (edit only)

Edit `package.json` / `overrides` per Step 2. **Do not install yet.** Record changes in `current-state.md`. Set Step 3 `done`.

## Step 4 — Install

```bash
sh .cursor/skills/angular-upgrade/scripts/install.sh
```

Uses `INSTALL_CMD` from `repo.config.sh`. Optional pre-build verify with `--allow-missing` if configured. Set Step 4 `done` or `blocked`.

## Step 5 — Security gate

```bash
sh .cursor/skills/angular-upgrade/scripts/audit.sh
```

- Allowed: `npm audit fix` only (no `--force` without user approval).
- **Block** on remaining **critical** or **high** (without approved exception).
- **Moderate/low** with no fix: record and continue unless user stops.
- Scripts treat audit exit code **1** as “vulns listed”, not script failure.

If `audit.sh` (fix pass) changes lockfile, re-run `install.sh`. Set Step 5 `done` or `blocked`.

## Step 6 — Repo pattern review

1. Read the patterns file named by **`PATTERNS_FILE`** in `repo.config.sh`.
2. Run greps and checks listed there on the **final** dependency tree.
3. Record under **Pattern findings** in `current-state.md`.
4. **Block** on unresolved `must-change`.

Set Step 6 `done` or `blocked`.

## Step 7 — Build gate

```bash
sh .cursor/skills/angular-upgrade/scripts/build.sh -f
```

Uses `BUILD_CMD_FULL` from `repo.config.sh`. Incremental: `build.sh` without `-f`.

- **Block** on build failure or optional post-build verify failure.
- Record under **Build** and **Post-build verify** in `current-state.md`.

Set Step 7 `done` or `blocked`.

## Step 8 — Preview validation

When Step 7 is `done` and a preview URL was recorded in Step 0:

1. Confirm post-build verify passed if configured.
2. Load preview URL; follow checklist in the **`PATTERNS_FILE`** doc.
3. Use browser tools when available; otherwise provide manual checklist.

Skip if build-only. Set Step 8 `done` or `blocked`.

## Step 9 — Unit test gate (mandatory)

When Step 8 is `done` (or skipped build-only):

```bash
sh .cursor/skills/angular-upgrade/scripts/test.sh
```

Uses `TEST_CMD` from `repo.config.sh`. **Block** on failure. Set Step 9 `done` or `blocked`.

## Step 10 — Finalize

When Steps 0–9 are `done`:

1. Summarize upgrade in chat.
2. Complete the matching section in **`upgrade-history.md`** (engineering record inside the skill folder).
3. **Write the upgrade summary doc** at repo root (required):
   - Path from `UPGRADE_DOC_PATH` in `repo.config.sh`, with `{major}` replaced by the **target Angular major** from Step 0 (e.g. `docs/21-upgrade.md`).
   - Use [`upgrade-summary-template.md`](./upgrade-summary-template.md) for structure.
   - Populate from `current-state.md`, `package.json`, and the new `upgrade-history.md` section — do not leave placeholders.

### Required sections in `docs/{major}-upgrade.md`

| Section | Content |
|---------|---------|
| **Libraries upgraded** | Table: package, version before → after (`@angular/*`, CLI, TypeScript, RxJS, zone.js, ngx-bootstrap, jest-preset-angular, and other bumped ecosystem libs) |
| **Compatibility changes** | Code/config/build/test fixes made so the app works on the target major (NgModule/bootstrap, HostListener, rollup paths, patches, etc.) |
| **Patches and build hooks** | Repo-specific patches (e.g. ngx-bootstrap) and verify gates |
| **Validation completed** | Install, security, patterns, build, post-build verify, tests, preview — pass/fail/skip |
| **New platform features intentionally not adopted** | Angular/ecosystem features available on the target major that were **skipped** because they are optional modernization or likely to break runtime, studio preview, or generated apps (e.g. full zoneless migration, signal-only rewrite, removing all NgModules, experimental APIs). One row per item with reason. |
| **Known follow-ups** | Preview gaps, test env issues, security exceptions, studio follow-up |
| **Security notes** | Audit outcome (e.g. remaining moderate transitive issues) |

4. Record the doc path under **Upgrade summary doc** in `current-state.md`.
5. Note follow-ups outside this repo if any.

**Block** Step 10 if the summary doc is missing or still has unfilled template placeholders.

Set Step 10 `done`.

---

## Decision rules

- One Angular major per upgrade unless user approves otherwise.
- Official Angular docs over blog posts.
- Separate compatibility fixes from optional modernization.
- Stop on unresolved `must-change` patterns or failed mandatory gates (build, tests, configured verify).
- Never repeat completed steps — use `current-state.md`.

---

## Output expectations

1. Completed step(s)  
2. Next step  
3. Blockers  
4. Package changes  
5. Security result  
6. Pattern findings summary  
7. Build result (+ post-build verify if any)  
8. Preview result  
9. **Test result (mandatory)**  
10. Finalize notes + path to `docs/{major}-upgrade.md`  

---

## What to commit

| Path | Commit? |
|------|---------|
| Skill folder (`SKILL.md`, `repo.config.sh`, `PATTERNS_FILE`, `scripts/*`, `README.md`) | Yes — customize `repo.config` + patterns file per repo |
| `upgrade-history.md` | Yes — per-major engineering record in skill folder |
| `docs/{major}-upgrade.md` | Yes — Step 10 summary (commit with upgrade or immediately after) |
| `current-state.md` | Optional working snapshot |
| Application code / lockfile | Separate commit(s) |

---

## `current-state.md` template

```md
# Current State

## Project
- Branch:
- Started:
- Preview URL:
- Current Angular:
- Target Angular:
- Node (engines):
- npm (engines):

## Step Status
| Step | Name | Status | Notes |
|---|---|---|---|
| 0 | Upgrade gate | pending | |
| 1 | Detect and inventory | pending | |
| 2 | Plan upgrade path | pending | |
| 3 | Apply package upgrades (edit only) | pending | |
| 4 | Install | pending | |
| 5 | Security gate | pending | |
| 6 | Repo pattern review | pending | |
| 7 | Build gate | pending | |
| 8 | Preview validation | pending | |
| 9 | Unit test gate | pending | mandatory |
| 10 | Finalize | pending | |

## Dependency Decisions
- Upgrade with Angular:
- Tooling:
- Deferred:
- overrides:

## Package changes

## Pattern findings
- safe:
- needs-review:
- likely-breakage:
- must-change:

## Security
- First audit:
- Audit fix:
- Final audit:

## Build

## Post-build verify

## Unit tests
- Result:
- Failing specs:

## Preview Validation
- Result:
- Issues:

## Upgrade summary doc
- Path (docs/{major}-upgrade.md):
- Written:

## Deferred / user decisions
```
