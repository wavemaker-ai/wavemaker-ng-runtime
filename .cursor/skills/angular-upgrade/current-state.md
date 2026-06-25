# Current State

> Gitignored session file — updated after **every step**. Reset: `sh scripts/reset-state.sh`.

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

Status values: `pending` | `in-progress` | `done` | `skipped` | `blocked`

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
- Other:

---

## Reference Review (Step 2)

One bullet per reference. Format: `- RN: reviewed — <summary> — runtime: <files>; codegen: <files|n/a>`

For R1 and R3: every breaking change must appear in the Dual-repo change plan below, or be annotated `[N/A: reason]`.

- R1: (Angular Update Guide — breaking changes → see plan rows below or [N/A: reason])
- R2: (Version Compatibility — TS/Node/RxJS/zone.js — also recorded in R2 Version Pins above)
- R3: (CHANGELOG — breaking changes → see plan rows below or [N/A: reason])
- R4: reference-only — `ng update` not run: custom build pipeline (`build.sh -f`) would be overwritten
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
