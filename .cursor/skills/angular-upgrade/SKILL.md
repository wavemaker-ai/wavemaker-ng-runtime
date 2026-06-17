---
name: angular-upgrade
description: >-
  Resumable Angular upgrade workflow. Step 0: inputs.md + repo.config.sh → confirm → Steps 1–10.
  Local Tomcat validation is Step 8 (inputs from Step 0 only).
---

# Angular upgrade

Conservative, **resumable** workflow. State: `current-state.md`. Summary: `docs/{major}-upgrade.md` (Step 10).

**Principles:** one Angular major per run; `repo.config.sh` holds **defaults** (user overrides via `inputs.md`); stop on `blocked`; minimal code changes outside Step 3 package edits and pattern-driven fixes; every step has a pass/fail/skip before advancing.

**Progress (required):** Maintain a **todo list** for Steps 0–10 in chat (use the todo tool). Update it as each step starts and finishes. When any step is **`blocked`**, **stop advancing** and tell the user immediately using the **Blocker alert** format below — do not bury blockers in prose or only in `current-state.md`.

**Configuration:** Step 0 reads [`inputs.md`](./inputs.md) + `repo.config.sh`, prints effective config, blocks until confirm. Do not install/build until `Inputs confirmed: yes` in `current-state.md`.

**Inputs:** [`inputs.md`](./inputs.md) — canonical Start messages, parsing, who collects inputs (upgrade Step 0 vs standalone local build vs Step 8 no re-prompt).

### Sibling repo: `wavemaker-ng-codegen`

Generated-app fixes (patterns §20) live in **`wavemaker-ng-codegen`**, usually checked out **beside** this repo:

```text
…/wavemaker-studio-frontend/
  wavemaker-ng-runtime/    ← this repo (skill runs here)
  wavemaker-ng-codegen/    ← sibling; codegen templates + gen-tsconfig
```

**Branch policy:** For an upgrade, **both repos should use the same branch name** (e.g. `WMS-31488` / `feature/angular-21`) so runtime and codegen changes land together. At **Step 0** or **Step 2**, compare current branches; if they differ, **ask the user** to create or checkout matching branches on both repos before cross-repo edits. Record both branch names in `current-state.md` under **Upgrade config** or **Deferred / user decisions**.

**Default path:** `../wavemaker-ng-codegen` relative to this repo root. If missing or elsewhere, ask the user for the codegen repo path and record it in `current-state.md`.

**Local Tomcat build:** `LOCAL_BUILD_DOC` is upgrade **Step 8** (upgrade mode — inputs from Step 0 only). The same doc is **standalone** (`@.cursor/commands/local-angular-build`) with its **own** input gate when not run through the skill.

## Port to another repository

1. Copy `.cursor/skills/angular-upgrade/`.
2. Edit **`repo.config.sh`** — versions, URLs, `BUILD_CMD`, gates, **`PATTERNS_FILE`**.
3. On **Start** prompt, Step 0 creates **`current-state.md`** from [`current-state.example.md`](./current-state.example.md) (gitignored session file).

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

**HARD STOP** before editing `package.json`. Follow **Upgrade Step 0 workflow** in [`inputs.md`](./inputs.md).

### Reset `current-state.md` (fresh upgrade only)

**Fresh upgrade** = user says **Start Angular upgrade** (not “resume”), **or** effective base/target (from message or repo.config) differ from **Upgrade config** in `current-state.md`, **or** Step 10 is already `done`.

**Version mismatch always resets** — overwrite `current-state.md` even if the user says “resume” when effective base/target ≠ values stored in current-state.

| Prompt | Action |
|--------|--------|
| **Start Angular upgrade** | Create `current-state.md` from [`current-state.example.md`](./current-state.example.md), filled from `repo.config.sh` |
| **Resume Angular upgrade** | Keep `current-state.md` **only when** effective base/target match stored Upgrade config and Step 10 is not `done` |

**Block Step 0** until:

- `repo.config.sh` has valid `ANGULAR_BASE_VERSION` and `ANGULAR_TARGET_VERSION`
- Effective run config is **confirmed** by the user (`Inputs confirmed: yes` in current-state)
- When `skip preview no`: both effective preview and comparison URLs are non-empty
- User-message base/target (if provided) **override** `repo.config.sh` — record effective values in `current-state.md` (see [`inputs.md`](./inputs.md) version overrides)

On fresh start: read `repo.config.sh`, resolve inputs per [`inputs.md`](./inputs.md), print effective config, **wait for confirm** unless the Start message already contains all inputs + implicit confirm (full canonical message counts as confirm).

Shell variable meanings: see comments in [`repo.config.sh`](./repo.config.sh). User overrides: [`inputs.md`](./inputs.md) parsing table → recorded under **Step 0 overrides** in `current-state.md`. When `POST_BUILD_VERIFY_SCRIPT` or `TEST_CMD` is empty, record gate as **`n/a`**.

If user says “start upgrade”: overwrite `current-state.md` (fresh upgrade rules above), complete Step 0, run Steps 1–10.

If user says “resume upgrade”: keep `current-state.md`, re-read `repo.config.sh`, continue from first step not `done`.

---

## Progress tracking (todo list)

At **Step 0 start** (after effective config is known), create **one todo per step** (0–10). Use these labels:

| Todo id | Label |
|---------|--------|
| `step-0` | Step 0 — Upgrade gate |
| `step-1` | Step 1 — Detect and inventory |
| `step-2` | Step 2 — Plan upgrade path |
| `step-3` | Step 3 — Apply package upgrades |
| `step-4` | Step 4 — Install |
| `step-5` | Step 5 — Security gate |
| `step-6` | Step 6 — Repo pattern review |
| `step-7` | Step 7 — Build gate |
| `step-8` | Step 8 — Local Tomcat validation |
| `step-9` | Step 9 — Unit tests |
| `step-10` | Step 10 — Finalize |

**While running:**

1. Set the **current step** todo to `in_progress` **before** starting work on that step.
2. Set it to `completed` when the step gate passes (or `cancelled` when skipped per Step 0 — e.g. skip preview, skip tests).
3. Keep **only one** step `in_progress` at a time.
4. On **resume**, mark steps already `done` in `current-state.md` as `completed`; set the first non-done step to `in_progress`.

**On session end** (blocked, paused, or complete): leave todos reflecting truth — do not mark a step `completed` if it is `blocked` or still running.

Sync todos with **`current-state.md` Step Status** after every step transition.

---

## Blocker communication

When a step cannot pass its gate, set that step’s status to **`blocked`** in `current-state.md`, set the matching todo to remain **not completed** (leave `in_progress` or revert to `pending` — never `completed`), and **post a Blocker alert** in chat **before** doing unrelated work.

### Blocker alert format (required)

Use this structure so blockers are impossible to miss:

```text
⛔ UPGRADE BLOCKED — Step N: <step name>

What failed: <one sentence — script exit code, audit finding, build error, preview URL, etc.>

Evidence: <command output snippet, URL + HTTP status, or file:line>

Impact: Steps <N+1>–10 are paused until this is resolved.

Suggested fix: <concrete next action — or “needs your decision” with options>

To continue: say “fix and continue” / “defer step N” / “resume upgrade” after you’ve addressed it.
```

**Examples of blockers:**

| Step | Typical blocker |
|------|-----------------|
| 0 | Inputs not confirmed; invalid repo.config; branch mismatch (runtime vs codegen) |
| 1 | Pattern file missing; repo not on expected base version (note drift, don’t silently ignore) |
| 5 | Critical/high npm audit without approved exception |
| 6 | `pattern-review.sh` non-zero; unresolved `must-change` |
| 7 | `BUILD_CMD` or post-build verify failed |
| 8 | Preview URL fails checklist; Tomcat/prereqs missing; iteration exhausted |
| 9 | `test.sh` failed (when tests enabled) |
| 10 | Summary doc missing or has placeholders |

**Deferral:** If the user explicitly defers a blocked step, record under **Deferred / user decisions** in `current-state.md`, mark the todo `cancelled` with reason in chat, and state which later steps may still run (e.g. Step 10 allowed only when Step 8 deferral is recorded per Step 8 rules).

**Non-blockers:** `needs-review` or warnings (e.g. comparison URL temporarily 404, audit lows/moderates with approved policy) — report in chat but **do not** use the Blocker alert unless the step gate requires pass.

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
| 6 | Repo pattern review | **Yes** | `pattern-review.sh` pass; no unresolved `must-change` |
| 7 | Build gate | **Yes** | full `BUILD_CMD` pass (+ verify if enabled) |
| 8 | Local Tomcat validation | **Yes** | skip if `PREVIEW_URL` empty/`skip`; else `LOCAL_BUILD_DOC` + URL compare pass |
| 9 | Unit tests | Optional | skip if tests=no/n/a or `TEST_CMD` empty |
| 10 | Finalize | **Yes** | `docs/{major}-upgrade.md` written |

**Resume:** first step not `done`; do not skip `blocked` unless user clears it. Update `current-state.md` after every step. Re-read `repo.config.sh` before Step 7.

### Step 1 — Detect and inventory

Read `package.json`, lockfile, `angular.json`, `tsconfig*.json`, test config, and inventory paths from every pattern file. Resolve each `PATTERNS_FILE` path (absolute → skill folder → repo root). **Block** if any path is missing. Confirm installed Angular matches `ANGULAR_BASE_VERSION` (or note drift).

### Step 2 — Plan upgrade path

1. [`references.md`](./references.md) for target-major compatibility.
2. All pattern files for repo-specific risks.
3. Plan base → target bumps; note verify/preview/tests from repo.config.
4. **Cross-repo:** Confirm **`wavemaker-ng-codegen`** is available (default `../wavemaker-ng-codegen`) and on the **same branch** as this repo; if not, ask the user to align branches before §20 edits (see **Sibling repo** above).

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
2. Run **mandatory** automated greps:

```bash
sh .cursor/skills/angular-upgrade/scripts/pattern-review.sh
```

3. Run additional greps/checks from each pattern file (§1–§19 in this repo).
4. Merge into **Pattern findings** (`safe`, `needs-review`, `likely-breakage`, `must-change`).
5. **Block** if `pattern-review.sh` exits non-zero **or** any unresolved `must-change`.
6. **Cross-repo (generated apps):** apply **`wavemaker-runtime-patterns.md` §20** fixes in `wavemaker-ng-codegen` (`NG_CODEGEN_PATH` from `repo.config.sh`) on the **same branch** as this repo — edit **`templates/`** and **`src/`** only (never `dist/`). Re-run `pattern-review.sh` after codegen edits. Do **not** defer §20b/§20e blockers to Step 10 follow-ups.

### Step 7 — Build gate

Run **`BUILD_CMD`** from `repo.config.sh` **once** per upgrade (`sh build.sh -f`). **Do not** run `build.sh -f` / `build.sh --force` again in Step 8 local-angular-build — Step 8 only runs `RUNTIME_BUNDLE_CMD` (locale + CLI bundles).

```bash
# Full rebuild (required for Step 7 done) — UPGRADE_BUNDLE_VERIFY from Step 0 (yes/no/n/a)
UPGRADE_BUILD_CMD="$BUILD_CMD" UPGRADE_BUNDLE_VERIFY="${UPGRADE_BUNDLE_VERIFY:-yes}" \
  sh .cursor/skills/angular-upgrade/scripts/build.sh

# Mid-upgrade quick check only — verify skipped; do not mark Step 7 done on this alone
sh .cursor/skills/angular-upgrade/scripts/build.sh --incremental
```

- Block on full build failure.
- Post-build verify runs **only after full `BUILD_CMD`**, when verify = **yes** and `POST_BUILD_VERIFY_SCRIPT` is set (not after `--incremental`).
- Record **Build** and **Post-build verify** (`pass` / `fail` / `skipped — Step 0` / `skipped — not configured`).

When gate not configured, omit `UPGRADE_BUNDLE_VERIFY` or use `n/a`.

### Step 8 — Local Tomcat validation

**Inputs:** Already resolved in **upgrade Step 0** (`current-state.md` → `Inputs confirmed: yes`). **Do not** run the local-angular-build standalone input gate. Read effective `PREVIEW_URL`, `COMPARISON_URL`, and `skip preview` from `current-state.md`.

**Gate:** Skip Step 8 when effective `PREVIEW_URL` is `skip` or empty. Otherwise required.

**Workflow:** Follow **`LOCAL_BUILD_DOC`** in **upgrade mode** (see command doc — “Upgrade Step 8”):

1. Read URLs and flags from `current-state.md` (not from a new user prompt).
2. Export variables per command doc; apply effective preview/comparison from Step 0.
3. Confirm prerequisites (`PROJECT_WAR`, `PROJECT_ZIP`, `UNZIPPED_PROJECT_PATH`, Tomcat).
4. Run local-angular-build **Steps 1, 2b, 3–7** — **not** Step 2a, **not** standalone input gate. **Skip Step 1** when `${PROJECT_WAR}` exists and Tomcat app is already deployed (see `LOCAL_BUILD_DOC` Step 1).
5. **Never edit** `~/Desktop/local-*` generated app source — only ng-runtime / ng-codegen, then re-run codegen.

**Browser verify:** Load `COMPARISON_URL` then `PREVIEW_URL` (from `current-state.md`). Pass/fail criteria: **Preview validation checklist** in [`wavemaker-runtime-patterns.md`](./wavemaker-runtime-patterns.md) (gate + extended items) — do not duplicate here.

**On comparison failure — iterate (do not mark Step 8 `done`):**

1. Set Step 8 status to `blocked`; record errors in **Preview Validation**.
2. Diagnose (browser console, build logs, Tomcat deploy).
3. Fix in **ng-runtime** and/or **ng-codegen** only — never patch `~/Desktop/local-*` or generated app `src/`.
4. Re-run **minimal** local-angular-build steps:

| Fix location | Re-run |
|--------------|--------|
| `wavemaker-ng-runtime` (runtime-base, bundle) | **upgrade Step 7** (`build.sh -f`), then local **2b** → 3 → 4 → 5 → 7 |
| `wavemaker-ng-codegen` (templates, `update-angular-json.js`) | local 3 → 4 → 5 → 7 (skip Step 7 and 2b) |
| Both | **upgrade Step 7**, then local 2b → 3 → 4 → 5 → 7 |
| Maven/backend only | local 1 → 6 → 7 (skip 1 if WAR exists) |
| Locale/bundle only (no runtime source change) | local 2b → 3 → 4 → 5 → 7 |

5. Re-compare `COMPARISON_URL` then `PREVIEW_URL`.
6. Repeat until pass or user explicitly defers (record deferral under **Deferred / user decisions** — Step 10 may still run with noted gap).

**Block Step 10** if Step 8 is `blocked` without user deferral.

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
| Validation completed | Install through local Tomcat (Step 8) + unit tests — pass/fail/skip |
| New platform features not adopted | Optional modernization skipped + reason |
| Known follow-ups | Step 8 iteration gaps, test env, deferred preview items |
| Security notes | Audit outcome |

3. Record path under **Upgrade summary doc**. Block if doc missing or has placeholders.

---

## Scripts and files

| File | Purpose |
|------|---------|
| `SKILL.md` | Workflow (this file) |
| `inputs.md` | User input contract (single source) |
| `repo.config.sh` | Defaults: versions, URLs, build, gates, `PATTERNS_FILE` |
| `current-state.example.md` | Template for gitignored `current-state.md` |
| `references.md` | Step 2 link catalog |
| `wavemaker-runtime-patterns.md` | Default runtime patterns (override via `PATTERNS_FILE`) |
| `current-state.md` | Resumable status (gitignored; Step 0 creates on fresh Start) |
| `scripts/install.sh` | Step 4 |
| `scripts/audit.sh` | Step 5 |
| `scripts/build.sh` | Step 7 |
| `scripts/test.sh` | Step 9 |
| `scripts/pattern-review.sh` | Step 6 — automated blockers (keep in sync with patterns **Automated blockers** table) |
| `scripts/verify-ngx-bootstrap-bundle.sh` | Optional post-build verify (this repo) |
| `.cursor/commands/local-angular-build.md` | Step 8 — local Tomcat deploy workflow (`LOCAL_BUILD_DOC`) |

**Chat recap after each session:** todo list state (which step is active/done/blocked); **Blocker alert** if any step is blocked; completed step(s); next step; repo.config recap; package/security/pattern summary; build/verify/preview/tests results.

