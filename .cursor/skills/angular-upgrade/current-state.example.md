# Current State

> Gitignored session file — updated after **every step**. Reset: `sh scripts/reset-state.sh`.

---

## Schema

**Upgrade Config fields:**

| Field | Legal values / format |
|-------|-----------------------|
| `Base → Target Angular` | `<N> → <N+1>` (integers) |
| `Preview URL` | full URL or `skip` or empty |
| `Comparison URL` | full URL or empty |
| `Skip preview (9) / tests (8) / bundle verify (7)` | `yes / yes / yes` (each slot: `yes` or `no`) |
| `Inputs confirmed` | `yes` or `no` |
| `BUILD_CMD` | shell command string, e.g. `sh build.sh -f` |
| `ng-runtime branch` | git branch name |
| `ng-codegen path` | absolute filesystem path |
| `ng-codegen branch` | git branch name (must match ng-runtime branch) |
| `Started` | ISO 8601 date, e.g. `2026-06-25` |

**Step Status values:** `pending` | `in-progress` | `done` | `skipped` | `blocked`

**Active Blocker fields:** `Step` (number), `What` (description), `Evidence` (output/file), `Since` (ISO date), `User action needed` (instruction)

---

## Upgrade Config

- Base → Target Angular:
- Preview URL:
- Comparison URL:
- Skip preview (9) / tests (8) / bundle verify (7):
- Inputs confirmed: no
- BUILD_CMD:
- ng-runtime branch:
- ng-codegen path:
- ng-codegen branch:
- Started:

## Step 0 Overrides

- (chat overrides — base version, target version, URLs, skip flags)

---

## Step Status

| Step | Name | Status | Notes |
|------|------|--------|-------|
| 0 | Config & Confirm | pending | |
| 1 | Inventory | pending | |
| 2 | Research & Plan | pending | |
| 3 | Bump Packages | pending | both repos |
| 4 | Install | pending | |
| 5 | Security Audit | pending | |
| 6 | Apply Fixes | pending | both repos + ng-codegen build |
| 7 | Build ng-runtime | pending | |
| 8 | Unit Tests | pending | skip if tests off |
| 9 | Preview Validation | pending | skip if preview skip/empty |
| 10 | Finalize & Reset | pending | |

---

## Active Blocker

- Step:
- What:
- Evidence:
- Since:
- User action needed:

---

## R2 Version Pins (Step 2 → drives Step 3)

- TypeScript:
- Node (engines.node):
- RxJS:
- zone.js:
- jest-preset-angular (R9 — major must match Angular target):
- ng-packagr (R10 — compatible with Angular target):
- Other:

---

## Reference Review (Step 2)

One bullet per reference. Format: `- RN: reviewed — <summary> — runtime: <files>; codegen: <files|n/a>`

For R1 and R3: every breaking change must appear in the Dual-repo change plan below, or be annotated `[N/A: reason]`.

- R1: (Angular Update Guide — breaking changes → see plan rows below or [N/A: reason])
- R2: (Version Compatibility — TS/Node/RxJS/zone.js — also recorded in R2 Version Pins above)
- R3: (CHANGELOG — breaking changes → see plan rows below or [N/A: reason])
- R4: `ng update --dry-run` output reviewed — migrations listed: <list or "none">; will apply manually where relevant
- R5: target version <N.N.N> confirmed stable (not RC/pre-release)
- R6: (npm audit policy — critical/high block, deferred items if any)
- R8: (ngx-bootstrap API changes for target version)
- R9: (jest-preset-angular version compatible with target Angular)
- R10: (ng-packagr version for target)
- R11: (Node LTS version for target — matches engines.node pin above)
- R12: (wavemaker-runtime-patterns.md — must-change findings)
- R13: (prior upgrade doc — context only; do not copy non-compatibility patterns)

---

## Dual-Repo Change Plan (Step 2)

| § / Ref | Repo | Files | Change | Breaking change source |
|---------|------|-------|--------|----------------------|

---

## Package Changes (Step 3)

### ng-runtime

| Package | From | To |
|---------|------|----|

### ng-codegen

| Package | From | To |
|---------|------|----|

---

## Cross-Repo Changes (Step 6)

| Repo | File | Change | § ref |
|------|------|--------|-------|

---

## Dependency Decisions

---

## Pattern Findings (Step 6)

- must-change (resolved):
- must-change (open / blocking):
- likely-breakage:
- needs-review:
- safe:

---

## ng-codegen Build (Step 6 gate)

- Build result:
- Errors / warnings:

---

## Security (Step 5)

- Initial audit result:
- Packages changed by audit fix:
- Final audit result:
- Remaining deferred vulnerabilities:

---

## Build / Post-build Verify (Step 7)

- Build result:
- Bundle verify result:

---

## Bundle Sizes (Step 7 baseline)

Record after each Step 7 build. **Keep every row** — do not overwrite earlier entries. The first post-upgrade build is the anchor baseline; the 15% threshold is checked against the most recent row above the current one. If a size increase is legitimate (new polyfill, intentional library addition), annotate the row and treat the new size as the new anchor going forward.

| Artifact | Size | Date | Notes |
|----------|------|------|-------|
| `dist/tmp/libs/ngx-bootstrap/ngx-bootstrap.bundle.js` | | | initial post-upgrade |
| `dist/bundles/wmapp/scripts/wm-libs.js` | | | initial post-upgrade |
| `dist/bundles/wmapp/scripts/angular-app-cli.js` | | | initial post-upgrade |

---

## Unit Tests (Step 8)

- Test result:
- Failures fixed:
- Skipped (reason):

---

## Preview Validation (Step 9)

### Comparison URL (stage baseline)

- URL:
- Status:

### Preview URL (local Tomcat)

- URL:
- Iterations:

### Visual Parity Checks

| Check | Comparison | Preview | Match? | Notes |
|-------|------------|---------|--------|-------|
| G1 Comparison loads | | | | |
| G2 Preview loads | | | | |
| G3 Same widgets visible | | | | |
| G4 No fatal console errors | | | | |
| G5 No extra console errors | | | | |
| G6 Interactions work | | | | |
| G7 Data renders | | | | |

### Extended Checks (run where applicable)

| # | Check | Result | Notes |
|---|-------|--------|-------|
| E1 | Page query params on first load | | |
| E2 | Runtime-compiled page/partial | | |
| E3 | Table row expand / actions / filter | | |
| E4 | List + row menu | | |
| E5 | Modal open/close | | |
| E6 | Popover/dropdown positioning | | |
| E7 | Popover + date/time picker inside | | |
| E8 | Date/time picker reopen | | |
| E9 | Typeahead not clipped | | |
| E10 | File upload success/delete | | |
| E11 | Table bound to variable (no datasource) | | |
| E12 | Watch/bind with parenthesized expr + pipe | | |
| E13 | ngx-bootstrap bundle patch (overlay) | | |

### Regressions / Deferred Preview Issues

---

## Upgrade Summary Doc

- Path:
- Written:

---

## Deferred / User Decisions
