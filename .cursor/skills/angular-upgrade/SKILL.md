---
name: angular-upgrade
description: >-
  Resumable Angular upgrade workflow. Versions and preview URLs come from repo.config.sh;
  optional gate overrides and build command at Step 0. Runs Steps 1–10. Resumes from current-state.md.
---

# Angular upgrade

Conservative, **resumable** workflow. State: `current-state.md`. Summary: `docs/{major}-upgrade.md` (Step 10).

**Principles:** one Angular major per run; `repo.config.sh` is source of truth for versions/URLs; stop on `blocked`; minimal code changes outside Step 3 package edits and pattern-driven fixes; every step has a pass/fail/skip before advancing.

**Configuration:** `repo.config.sh` holds versions, preview URLs, build commands, optional gates, and `PATTERNS_FILE`. Step 0 reads it — do **not** ask the user for versions or URLs. Optional chat overrides: `verify yes/no`, `tests yes/no`, custom build command.

## Port to another repository

1. Copy `.cursor/skills/angular-upgrade/`.
2. Edit **`repo.config.sh`** — versions, URLs, `BUILD_CMD`, gates, **`PATTERNS_FILE`**.
3. On **Start** prompt, Step 0 overwrites **`current-state.md`** from the template below — no manual reset needed.

### `PATTERNS_FILE`

Comma-separated pattern markdown paths. Agent reads all in order for Steps 1–2, 6, and 8.

| Path form | Example |
|-----------|---------|
| Skill folder | `wavemaker-runtime-patterns.md` |
| Sibling repo | `../other-repo/.cursor/skills/angular-upgrade/other-patterns.md` |
| Absolute | `/path/to/patterns.md` |

**Resolution:** absolute → skill folder → repo root. **Block** Step 1 if any path is missing. **Block** Step 6 on unresolved `must-change`. Record resolved paths under **Pattern files** in `current-state.md`.

---

## Step 0 — Upgrade gate

**HARD STOP** before editing `package.json`. Read **`repo.config.sh`**; do not ask for versions or preview URLs.

### Reset `current-state.md` (fresh upgrade only)

**Fresh upgrade** = user says **Start Angular upgrade** (not “resume”), **or** `repo.config.sh` base/target differs from **Upgrade config** in `current-state.md`, **or** Step 10 is already `done`.

**Version mismatch always resets** — overwrite `current-state.md` even if the user says “resume”.

| Prompt | Action |
|--------|--------|
| **Start Angular upgrade** | Overwrite `current-state.md` from the template below, filled from `repo.config.sh` |
| **Resume Angular upgrade** | Keep `current-state.md` **only when** base/target match repo.config and Step 10 is not `done` |

**Block Step 0** until `repo.config.sh` is fixed:

- `ANGULAR_BASE_VERSION` or `ANGULAR_TARGET_VERSION` empty
- `PREVIEW_URL` set (non-empty, not `skip`) but `COMPARISON_URL` empty

On fresh start: read `repo.config.sh`, write `current-state.md` (all steps `pending`, config prefilled), apply Step 0 overrides from the user message, then mark Step 0 `done`.

| Variable | Purpose |
|----------|---------|
| `ANGULAR_BASE_VERSION` / `ANGULAR_TARGET_VERSION` | Major numbers only; both required |
| `PREVIEW_URL` | Upgraded build; empty or `skip` → Step 8 skipped |
| `COMPARISON_URL` | Baseline on base version; **required** when `PREVIEW_URL` is set |
| `BUILD_CMD` | Full rebuild — required to mark Step 7 `done` |
| `BUILD_CMD_INCREMENTAL` | Optional; `scripts/build.sh --incremental` only |

**Optional overrides** (user message only — never ask):

| Override | Default when gate configured |
|----------|-------------------------------|
| Bundle verify (`verify yes/no`) | `DEFAULT_RUN_BUNDLE_VERIFY` (yes) |
| Unit tests (`tests yes/no`) | `DEFAULT_RUN_TESTS` (yes) |
| Build command | `BUILD_CMD` |

When `POST_BUILD_VERIFY_SCRIPT` or `TEST_CMD` is empty, record gate as **`n/a`**.

If user says “start upgrade”: overwrite `current-state.md` (fresh upgrade rules above), complete Step 0, run Steps 1–10.

If user says “resume upgrade”: keep `current-state.md`, re-read `repo.config.sh`, continue from first step not `done`.

---

## Steps 1–10

| Step | Name | Gate | Verify before `done` |
|------|------|------|----------------------|
| 0 | Upgrade gate | **Yes** | repo.config valid; overrides recorded |
| 1 | Detect and inventory | **Yes** | Angular matches base; all pattern paths exist |
| 2 | Plan upgrade path | **Yes** | [`references.md`](./references.md) + all pattern files read |
| 3 | Apply package upgrades | **Yes** | `package.json` edited; **no install yet** |
| 4 | Install | **Yes** | `scripts/install.sh` exit 0 |
| 5 | Security gate | **Yes** | `scripts/audit.sh`; block on critical/high |
| 6 | Repo pattern review | **Yes** | greps run; no unresolved `must-change` |
| 7 | Build gate | **Yes** | full `BUILD_CMD` pass (+ verify if enabled) |
| 8 | Preview validation | Optional | skip if `PREVIEW_URL` empty (manual browser OK); else both URLs checked |
| 9 | Unit tests | Optional | skip if tests=no/n/a or `TEST_CMD` empty |
| 10 | Finalize | **Yes** | `docs/{major}-upgrade.md` written |

**Resume:** first step not `done`; do not skip `blocked` unless user clears it. Update `current-state.md` after every step. Re-read `repo.config.sh` before Step 7.

### Step 1 — Detect and inventory

Read `package.json`, lockfile, `angular.json`, `tsconfig*.json`, test config, and inventory paths from every pattern file. Resolve each `PATTERNS_FILE` path (absolute → skill folder → repo root). **Block** if any path is missing. Confirm installed Angular matches `ANGULAR_BASE_VERSION` (or note drift).

### Step 2 — Plan upgrade path

1. [`references.md`](./references.md) for target-major compatibility.
2. All pattern files for repo-specific risks.
3. Plan base → target bumps; note verify/preview/tests from repo.config.

### Step 3 — Apply package upgrades

Edit `package.json` / overrides per Step 2. **Do not install.** Record under **Package changes**.

### Step 4 — Install

```bash
sh .cursor/skills/angular-upgrade/scripts/install.sh
```

### Step 5 — Security gate

```bash
sh .cursor/skills/angular-upgrade/scripts/audit.sh
```

Block on **critical** / **high** (without approved exception). If `npm audit fix` changed lockfile, re-run `install.sh` before Step 6.

### Step 6 — Repo pattern review

1. Read every `PATTERNS_FILE` entry in order.
2. Run greps/checks from each file.
3. Merge into **Pattern findings** (`safe`, `needs-review`, `likely-breakage`, `must-change`).
4. **Block** on unresolved `must-change`.

### Step 7 — Build gate

Use **`BUILD_CMD`** from `repo.config.sh` (or Step 0 build override recorded in `current-state.md`).

```bash
# Full rebuild (required for Step 7 done) — set UPGRADE_BUILD_CMD to BUILD_CMD from repo.config
UPGRADE_BUILD_CMD="$BUILD_CMD" UPGRADE_BUNDLE_VERIFY=yes \
  sh .cursor/skills/angular-upgrade/scripts/build.sh

# Mid-upgrade quick check only — verify skipped; do not mark Step 7 done on this alone
sh .cursor/skills/angular-upgrade/scripts/build.sh --incremental
```

- Block on full build failure.
- Post-build verify runs **only after full `BUILD_CMD`**, when verify = **yes** and `POST_BUILD_VERIFY_SCRIPT` is set (not after `--incremental`).
- Record **Build** and **Post-build verify** (`pass` / `fail` / `skipped — Step 0` / `skipped — not configured`).

When gate not configured, omit `UPGRADE_BUNDLE_VERIFY` or use `n/a`.

### Step 8 — Preview validation

Skip automated URL comparison when `PREVIEW_URL` empty or `skip` — mark `done` with skip note.

**Manual preview (URLs empty):** run the preview checklist from pattern files in a browser (Chrome DevTools or MCP). Record pass/fail and notes in **Preview Validation** and Step 10 summary doc.

When URLs are set: load both from repo.config; same flows on comparison then preview; use browser tools when available. Block on regressions.

### Step 9 — Unit tests

Skip when Step 0 tests = **no** / **n/a**, or `TEST_CMD` empty.

```bash
sh .cursor/skills/angular-upgrade/scripts/test.sh
```

Block on failure.

### Step 10 — Finalize

1. Summarize in chat (versions, pass/fail/skip for steps 7–9).
2. Write **`docs/{major}-upgrade.md`** (`UPGRADE_DOC_PATH`, `{major}` = `ANGULAR_TARGET_VERSION`):

| Section | Content |
|---------|---------|
| Libraries upgraded | Package table: before → after |
| Compatibility changes | Code/config/build fixes |
| Patches and build hooks | e.g. ngx-bootstrap patch + verify |
| Validation completed | Install through preview — pass/fail/skip |
| New platform features not adopted | Optional modernization skipped + reason |
| Known follow-ups | Preview gaps, test env, cross-repo work |
| Security notes | Audit outcome |

3. Record path under **Upgrade summary doc**. Block if doc missing or has placeholders.

---

## Scripts and files

| File | Purpose |
|------|---------|
| `SKILL.md` | Workflow (this file) |
| `repo.config.sh` | Versions, URLs, build, gates, `PATTERNS_FILE` |
| `references.md` | Step 2 link catalog |
| `wavemaker-runtime-patterns.md` | Default runtime patterns (override via `PATTERNS_FILE`) |
| `current-state.md` | Resumable status (Step 0 overwrites on fresh Start) |
| `scripts/install.sh` | Step 4 |
| `scripts/audit.sh` | Step 5 |
| `scripts/build.sh` | Step 7 |
| `scripts/test.sh` | Step 9 |
| `scripts/verify-ngx-bootstrap-bundle.sh` | Optional post-build verify (this repo) |

**Chat recap after each session:** completed step(s), next step, blockers, repo.config recap, package/security/pattern summary, build/verify/preview/tests results.

---

## `current-state.md` template

```md
# Current State

## Upgrade config (repo.config.sh)
- Base Angular: (ANGULAR_BASE_VERSION)
- Target Angular: (ANGULAR_TARGET_VERSION)
- Preview URL: (PREVIEW_URL or skip)
- Comparison URL: (COMPARISON_URL or n/a)
- Build command: (BUILD_CMD)
- Incremental build: (BUILD_CMD_INCREMENTAL or empty)

## Step 0 overrides (optional — user message only)
- Run bundle verify: yes | no | n/a
- Run unit tests: yes | no | n/a
- Build command override: (only if user specified; else use BUILD_CMD)

## Project
- Branch:
- Started:
- Node (engines):
- npm (engines):

## Step Status
| Step | Name | Status | Notes |
|---|---|---|---|
| 0 | Upgrade gate | pending | read repo.config.sh |
| 1 | Detect and inventory | pending | |
| 2 | Plan upgrade path | pending | |
| 3 | Apply package upgrades | pending | |
| 4 | Install | pending | |
| 5 | Security gate | pending | |
| 6 | Repo pattern review | pending | |
| 7 | Build gate | pending | |
| 8 | Preview validation | pending | skip if PREVIEW_URL empty |
| 9 | Unit test gate | pending | skip if Step 0 tests=no or n/a |
| 10 | Finalize | pending | |

## Dependency Decisions

## Package changes

## Pattern files
- PATTERNS_FILE (from repo.config.sh):
- Resolved paths:

## Pattern findings
- safe:
- needs-review:
- likely-breakage:
- must-change:

## Security

## Build

## Post-build verify
- Result: pass | fail | skipped — Step 0 | skipped — not configured

## Unit tests
- Result: pass | fail | skipped — Step 0 | skipped — not configured

## Preview Validation
- Preview URL result:
- Comparison URL result:
- Regressions vs baseline:

## Upgrade summary doc
- Path:
- Written:

## Deferred / user decisions
```
