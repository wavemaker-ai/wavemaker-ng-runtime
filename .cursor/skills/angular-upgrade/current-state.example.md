# Current State

> Copy to `current-state.md` on fresh Start, or let Step 0 create it. `current-state.md` is gitignored (session file).

## Upgrade config (repo.config.sh + Step 0 effective)
- Base Angular: (effective base)
- Target Angular: (effective target)
- Preview URL: (effective PREVIEW_URL or skip)
- Comparison URL: (effective COMPARISON_URL or n/a)
- Skip preview (Step 8): yes | no
- Skip tests (Step 9): yes | no
- Skip bundle verify (Step 7): yes | no
- Inputs confirmed: no
- Build command: (BUILD_CMD)

## Step 0 overrides (resolved from user message)
- Base version override:
- Target version override:
- Preview URL override:
- Comparison URL override:
- Skip preview:
- Run bundle verify:
- Run unit tests:
- Build command override:

## Project
- Branch:
- Started:
- Node (engines):
- npm (engines):

## Step Status
| Step | Name | Status | Notes |
|---|---|---|---|
| 0 | Upgrade gate | pending | read inputs.md + repo.config.sh |
| 1 | Detect and inventory | pending | |
| 2 | Plan upgrade path | pending | |
| 3 | Apply package upgrades | pending | |
| 4 | Install | pending | |
| 5 | Security gate | pending | |
| 6 | Repo pattern review | pending | |
| 7 | Build gate | pending | |
| 8 | Local Tomcat validation | pending | skip if PREVIEW_URL skip/empty |
| 9 | Unit test gate | pending | skip if skip tests yes |
| 10 | Finalize | pending | |

## Active blocker
- Step:
- What failed:
- Evidence:
- Since:
- User action needed:

## Dependency Decisions

## Package changes

## Pattern files
- PATTERNS_FILE:
- Resolved paths:

## Pattern findings
- safe:
- needs-review:
- likely-breakage:
- must-change:

## Security

## Build

## Post-build verify
- Result:

## Unit tests
- Result:

## Preview Validation
- Comparison URL result:
- Preview URL result:
- Iteration count:
- Regressions vs baseline:

## Upgrade summary doc
- Path:
- Written:

## Deferred / user decisions
