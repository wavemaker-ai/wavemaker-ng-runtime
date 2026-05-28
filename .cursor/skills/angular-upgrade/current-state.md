# Current State

## Project
- Branch: stage-ai
- Started: 2026-05-28
- Preview URL: https://proxy-studio.wmdev.com/run-jlqb2h631c/SearchWidgetScenarios_master/#/LiveForm_DefaultValue_FormData
- Current Angular: 21.2.14
- Target Angular: 21.2.x
- Node (engines): 22.18.0
- npm (engines): 10.9.3

## Step Status
| Step | Name | Status | Notes |
|---|---|---|---|
| 0 | Upgrade gate | done | |
| 1 | Detect and inventory | done | |
| 2 | Plan upgrade path | done | |
| 3 | Apply package upgrades | done | |
| 4 | Install | done | |
| 5 | Security gate | done | 3 moderate, no fix |
| 6 | Repo pattern review | done | see Pattern findings |
| 7 | Build gate | done | rebuild after router-outlet fix |
| 8 | Preview validation | pending | user sign-off |
| 9 | Unit test gate | pending | mandatory after Step 8 |
| 10 | Finalize | pending | |

## Dependency Decisions
- See `upgrade-history.md` § 20 → 21

## Package changes
- See `upgrade-history.md` § 20 → 21

## Pattern findings
- safe: rollup primitives paths; ngx-bootstrap patch + bundle verify; scheduleOverrideRouterOutlet
- needs-review: HostListener `['$event']` on some widgets (build accepts)
- likely-breakage: none unresolved at build
- must-change: none at last build

## Security
- Final: 3 moderate (webpack-dev-server transitive), continue per SKILL

## Build
- Last full: `sh build.sh -f` success

## Post-build verify
- `verify-ngx-bootstrap-bundle.sh`: passed (ngx-bootstrap.bundle.js + wm-libs.js)

## Unit tests
- Result: pending mandatory run after Step 8

## Preview Validation
- URL recorded; confirm after router-outlet fix deploy

## Upgrade summary doc
- Path: docs/21-upgrade.md
- Written: yes (Step 10 artifact)

## Deferred / user decisions
- User preview pass/fail for Step 8
