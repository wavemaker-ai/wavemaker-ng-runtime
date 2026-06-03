# Current State

## Upgrade config (repo.config.sh)
- Base Angular: 20
- Target Angular: 21
- Preview URL: skip (empty in repo.config.sh)
- Comparison URL: n/a
- Build command: sh build.sh -f
- Incremental build: sh build.sh

## Step 0 overrides (optional)
- Run bundle verify: yes
- Run unit tests: no

## Project
- Branch: stage-ai
- Started: 2026-05-28
- Node (engines): 22.18.0
- npm (engines): 10.9.3

## Step Status
| Step | Name | Status | Notes |
|---|---|---|---|
| 0 | Upgrade gate | done | from repo.config.sh |
| 1 | Detect and inventory | done | |
| 2 | Plan upgrade path | done | |
| 3 | Apply package upgrades | done | |
| 4 | Install | done | |
| 5 | Security gate | done | 3 moderate, no fix |
| 6 | Repo pattern review | done | |
| 7 | Build gate | done | `sh build.sh -f` pass (~385s); verify-ngx-bootstrap-bundle.sh pass |
| 8 | Preview validation | done | preview URLs not set in repo.config for this run; validated manually via Chrome DevTools |
| 9 | Unit test gate | done | skipped — override tests=no |
| 10 | Finalize | done | docs/21-upgrade.md updated |

## Dependency Decisions
- See `docs/21-upgrade.md`

## Package changes
- See `docs/21-upgrade.md`

## Pattern files
- PATTERNS_FILE: wavemaker-runtime-patterns.md
- Resolved: `.cursor/skills/angular-upgrade/wavemaker-runtime-patterns.md`

## Pattern findings
- See `docs/21-upgrade.md`

## Security
- Final: 3 moderate (webpack-dev-server transitive); continue per SKILL

## Build
- Command: sh build.sh -f
- Result: pass (2026-06-01, ~385s)
- Fix applied: `tsconfig.json` — `@wavemaker-ai/variables` path prefers `dist/es2015` over yalc source (TS6059 rootDir)

## Post-build verify
- Result: pass — DestroyRef inject patch in `ngx-bootstrap.bundle.js` and `wm-libs.js`

## Unit tests
- Result: skipped — override tests=no

## Preview Validation
- Skipped per repo.config (empty PREVIEW_URL); manual Chrome DevTools pass recorded in `docs/21-upgrade.md`

## Upgrade summary doc
- Path: docs/21-upgrade.md
- Written: yes

## Deferred / user decisions
- None
