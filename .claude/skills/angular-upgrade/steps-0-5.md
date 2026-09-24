# Steps 0–5 — Setup & Planning

Part of [`SKILL.md`](SKILL.md)'s Instructions (Step Overview, Compatibility Policy, resume rules all live there — read that first). Steps 6–10: [`steps-6-10.md`](steps-6-10.md).

---

### Step 0 — Config & Confirm

Step 0 is the **one and only confirmation point** for the entire run. After the user confirms here, Steps 1–10 run to completion without any further interruptions.

**Do all of the following in a single pass before asking anything:**

1. Run preflight: `sh scripts/preflight.sh`
2. Read `repo.config.sh` and parse the user trigger message (table below)
3. Resolve ng-runtime branch (`git rev-parse --abbrev-ref HEAD`)
4. Resolve ng-codegen path and branch (`cd $NG_CODEGEN_PATH && git rev-parse --abbrev-ref HEAD`)

**Then show ONE summary table** containing all of the following together:

| Field                               | Value                       | Status                               |
|-------------------------------------|-----------------------------|--------------------------------------|
| Base → Target Angular               | e.g. 20 → 21                | ok / ⚠ mismatch                      |
| Angular Deployment URL / Comparison | `<url>` / `<url>` or `skip` | ok / ⚠ not configured (mode skipped) |
| WaveMaker Preview URL / Comparison  | `<url>` / `<url>` or `skip` | ok / ⚠ not configured (mode skipped) |
| Skip tests / verify                 | yes/no                      | ok                                   |
| ng-runtime branch                   | WMS-31488                   | ok / ⚠ detached HEAD                 |
| ng-codegen path                     | /abs/path                   | ok / ⚠ not found                     |
| ng-codegen branch                   | WMS-31488                   | ok / ⚠ mismatch                      |
| Workspace clean                     | yes                         | ok / ⚠ dirty: file1, file2           |

Show one row per entry in `VALIDATION_MODES` (currently `angular_deployment`, `wavemaker_preview`) — A mode row's Status is `⚠ not configured (mode skipped)`, not a blocker — an unconfigured mode simply doesn't run; it does not block confirmation.

Below the table, add a single line for each ⚠ issue with the action needed (e.g. "dirty: commit or stash before confirming"). Then ask **once**: "Confirm to start, or fix the issues above first."

**ng-codegen branch mismatch blocks by default.** Unlike a mode-not-configured row (informational only), `⚠ mismatch` on the ng-codegen branch row blocks Step 0 from completing — per "Both repos together" in `SKILL.md`'s Important Rules, ng-runtime and ng-codegen must upgrade on the same branch name. Do not accept a plain "confirm" as clearing this row. Proceed past it only if the user explicitly says so (e.g. "proceed with mismatched branches"), and record that explicit override in `current-state.md` → Step 0 Overrides.

The user's reply — "confirm", "yes", "go", or any affirmative — starts Steps 1–10. Do not interrupt again after this point regardless of what is found during the run. Unexpected findings (new pattern warnings, audit results, build warnings) are recorded in `current-state.md` and reported at the end of each step as informational — never as blocking prompts.

**Parsing rules:**

| Input                             | Phrases in user message                                     | Default (from `repo.config.sh`)  |
|-----------------------------------|-------------------------------------------------------------|----------------------------------|
| Base version                      | `base version <N>`                                          | `ANGULAR_BASE_VERSION`           |
| Target version                    | `target version <N>`                                        | `ANGULAR_TARGET_VERSION`         |
| Angular Deployment URL            | `preview url <url>`                                         | `LOCAL_DEPLOYMENT_URL`           |
| Angular Deployment comparison URL | `comparison url <url>`                                      | `WAVEMAKER_DEPLOYMENT_URL`       |
| WaveMaker Preview URL             | `wavemaker preview url <url>`                                | `LOCAL_PREVIEW_URL`              |
| WaveMaker Preview comparison URL  | `wavemaker preview comparison url <url>`                    | `WAVEMAKER_PREVIEW_URL`          |
| Skip preview (all modes)          | `skip preview yes`, `skip step 9`                           | `no` when any mode has a URL set |
| Skip one mode                     | `skip angular deployment yes`, `skip wavemaker preview yes` | `no` when that mode's URL is set |
| Skip tests                        | `skip tests yes/no`                                         | `no` when `DEFAULT_RUN_TESTS=yes`; `yes` when `DEFAULT_RUN_TESTS=no` |
| Skip verify                       | `skip verify yes/no`                                        | `no` when `DEFAULT_RUN_BUNDLE_VERIFY=yes`; `yes` when `DEFAULT_RUN_BUNDLE_VERIFY=no` |

These phrases match `templates.md`'s canonical trigger examples exactly — `preview url`/`comparison url` name the Angular Deployment mode's pair, `wavemaker preview url`/`wavemaker preview comparison url` name the WaveMaker Preview mode's pair. The `Skip tests`/`Skip verify` defaults are shown inverted from the underlying `DEFAULT_RUN_*` config vars because those vars are phrased as "run" flags (`yes` = do run = do not skip); see Step 8 in [`steps-6-10.md`](steps-6-10.md) for the same inversion stated in context.

`skip preview yes` sets **every** mode's url var to `skip` (matches the pre-existing blanket behavior). `skip <mode name> yes` sets only that mode's url var to `skip`, leaving other modes unaffected — useful when only one mode is relevant for a given run. A mode whose url var is empty or `skip` is skipped independently at Step 9; this is not a separate flag, it's the same convention `LOCAL_DEPLOYMENT_URL=skip` has always used, now applied per mode. Chat overrides win over `repo.config.sh` defaults.

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

**Before editing any existing §N row or section** (here or in Step 6), append its prior value to `docs/upgrade-log/{base}-to-{target}.md` first — see [`checklist.md` → Verification Principle](checklist.md#verification-principle-pattern-gates-are-hints-not-guarantees) step 4 and the skeleton in [`templates.md`](templates.md#pattern-diff-log-skeleton-step-26--docsupgrade-logbase-to-targetmd). New §N entries don't need a diff-log row — there's no prior value to lose.

- ng-runtime source pattern → `patterns/runtime.md`
- ng-codegen template/src pattern → `patterns/codegen.md`
- Evergreen or meta check (applies to any Angular major) → `checklist.md` §21+

See [`research.md`](research.md) for the full reference format and dual-repo file map.

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
sh scripts/install.sh
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
sh scripts/audit.sh
```

The script audits, then runs `npm audit fix` (no `--force`), then audits again. Before running fix it checks that none of the Angular/TS packages pinned in Step 3 would change — those pins are intentional and audit fix shouldn't override them.

Block on any remaining critical or high vulnerability that is not a verifiable false positive. If the lockfile changed, re-run `scripts/install.sh` before continuing.

**Done when:** `npm audit` reports no critical/high; Step 3 package versions unchanged.

---

Continue to [`steps-6-10.md`](steps-6-10.md) — Step 6 (Apply Fixes).
