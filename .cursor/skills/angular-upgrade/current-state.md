# Current State

## Upgrade config (repo.config.sh)
- Base Angular: 20
- Target Angular: 21
- Preview URL: skip (empty in repo.config.sh)
- Comparison URL: n/a
- Build command: sh build.sh -f
- Incremental build: sh build.sh

## Step 0 overrides (optional — user message only)
- Run bundle verify: yes
- Run unit tests: yes
- Build command override:

## Project
- Branch: WMS-31488
- Started: 2026-06-03
- Node (engines): 22.18.0
- npm (engines): 10.9.3

## Step Status
| Step | Name | Status | Notes |
|---|---|---|---|
| 0 | Upgrade gate | done | fresh Start; repo.config valid |
| 1 | Detect and inventory | done | @angular/core 21.2.14 (already at target) |
| 2 | Plan upgrade path | done | re-validation; packages at 21.x |
| 3 | Apply package upgrades | done | no edits — already at target |
| 4 | Install | done | npm install up to date |
| 5 | Security gate | done | 3 moderate; no critical/high |
| 6 | Repo pattern review | done | greps clean; no must-change |
| 7 | Build gate | done | `sh build.sh -f` ~340s; verify pass |
| 8 | Preview validation | done | PREVIEW_URL empty — URL compare skipped |
| 9 | Unit test gate | done | 126 suites, 4265 passed (~185s) |
| 10 | Finalize | done | docs/21-upgrade.md updated |

## Dependency Decisions
- @angular/* 21.2.14, ngx-bootstrap 21.2.0, typescript 5.9.3 — at target 21

## Package changes
- None this run (already at Angular 21.2.14)

## Pattern files
- PATTERNS_FILE: wavemaker-runtime-patterns.md
- Resolved paths: `.cursor/skills/angular-upgrade/wavemaker-runtime-patterns.md`

## Pattern findings
- safe: legacy compiler absent; createComponent object syntax; expression-parser OK; ngx-bootstrap patch verified
- needs-review: none
- likely-breakage: none
- must-change: none

## Security
- Final: 3 moderate (webpack-dev-server transitive); continue per SKILL

## Build
- Command: sh build.sh -f
- Result: pass (2026-06-03, ~340s)

## Post-build verify
- Result: pass — DestroyRef inject patch in ngx-bootstrap.bundle.js and wm-libs.js

## Unit tests
- Result: pass — 126 suites, 4265 tests (~185s)

## Preview Validation
- Skipped automated URL compare (PREVIEW_URL empty in repo.config)
- Manual checklist: see docs/21-upgrade.md — run when preview URLs configured

## Upgrade summary doc
- Path: docs/21-upgrade.md
- Written: yes

## Deferred / user decisions
- Configure PREVIEW_URL / COMPARISON_URL for automated Step 8 on next run
