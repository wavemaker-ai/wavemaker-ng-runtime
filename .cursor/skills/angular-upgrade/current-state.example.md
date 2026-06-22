# Current State

> Gitignored session file. Reset: `sh scripts/reset-state.sh` (Step 10 or Step 0 Start). Template: this file.

## Upgrade config
- Base / Target Angular:
- Preview URL / Comparison URL:
- Skip preview (8) / tests (9) / bundle verify (7):
- Inputs confirmed: no
- BUILD_CMD:
- ng-runtime branch:
- ng-codegen path: (NG_CODEGEN_PATH)
- ng-codegen branch:
- Started:

## Step 0 overrides
- (base, target, URLs, skip flags — chat overrides repo.config.sh)

## Step status
| Step | Name | Status | Notes |
|------|------|--------|-------|
| 0 | Upgrade gate | pending | |
| 1 | Detect and inventory | pending | |
| 2 | Plan upgrade path | pending | references + dual-repo plan |
| 3 | Apply package upgrades | pending | |
| 4 | Install | pending | |
| 5 | Security gate | pending | |
| 6 | Repo pattern review | pending | both repos |
| 7 | Build gate | pending | |
| 8 | Local Tomcat validation | pending | skip if preview skip/empty |
| 9 | Unit tests | pending | skip if tests off |
| 10 | Finalize | pending | |

## Active blocker
- Step / What / Evidence / Since / User action:

## Reference review (Step 2)
- R1–R4, R6, R8–R12: (one bullet each — see references.md format)

## Dual-repo change plan (Step 2)
| § / Ref | Repo | Files | Change |
|---------|------|-------|--------|

## Cross-repo changes (Step 6)
| Repo | File | Change |
|------|------|--------|

## Dependency decisions

## Package changes

## Pattern files
- Resolved PATTERNS_FILE paths:

## Pattern findings
- safe / needs-review / likely-breakage / must-change:

## Security

## Build / Post-build verify

## Unit tests

## Preview validation
- Comparison / Preview / Iterations / Regressions:

## Upgrade summary doc
- Path / Written:

## Deferred / user decisions
