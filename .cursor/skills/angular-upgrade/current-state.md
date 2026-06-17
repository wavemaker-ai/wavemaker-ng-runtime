# Current State

## Upgrade config (repo.config.sh + Step 0 effective)
- Base Angular: 20
- Target Angular: 21
- Preview URL: http://localhost:8080/SearchWidgetScenarios/#/LiveForm_Autocomplete
- Comparison URL: https://stage-platform.wavemaker.ai/run-jlqb2h631c/SearchWidgetScenarios_master/#/Main
- Skip preview (Step 8): no
- Skip tests (Step 9): yes
- Skip bundle verify (Step 7): no
- Inputs confirmed: yes
- Build command: sh build.sh -f
- NG_CODEGEN_PATH: ../wavemaker-ng-codegen
- Codegen branch: WMS-31488

## Step 0 overrides (resolved from user message)
- Base version override: (none — repo default 20)
- Target version override: (none — repo default 21)
- Preview URL override: (none — repo default)
- Comparison URL override: (none — repo default)
- Skip preview: no
- Run bundle verify: yes
- Run unit tests: no (skip tests yes)
- Build command override: (none)

## Project
- Branch: WMS-31488
- Started: 2026-06-16
- Node (engines): 22.18.0
- npm (engines): 10.9.3

## Step Status
| Step | Name | Status | Notes |
|---|---|---|---|
| 0 | Upgrade gate | done | defaults + skip tests yes; confirmed |
| 1 | Detect and inventory | done | Angular 21.2.17 installed |
| 2 | Plan upgrade path | done | 20→21; codegen WMS-31488 aligned |
| 3 | Apply package upgrades | done | @angular/* 21.2.17; CLI/devkit 21.2.15 |
| 4 | Install | done | install.sh + yalc refresh |
| 5 | Security gate | done | audit.sh pass; 32 vulns documented (build toolchain) |
| 6 | Repo pattern review | done | pattern-review.sh PASSED |
| 7 | Build gate | done | build.sh -f pass; ngx-bootstrap verify pass |
| 8 | Local Tomcat validation | done | preview pass; comparison pass (stage Main) |
| 9 | Unit test gate | skipped | skip tests yes |
| 10 | Finalize | done | docs/21-upgrade.md written |

## Dependency Decisions
- yalc `@wavemaker-ai/angular-app` must be re-published after Angular bumps (`bundle-angular-app-cli.sh` + npm install in `.yalc/` copy).

## Package changes
- package.json: @angular/* → 21.2.17; @angular/cli + @angular-devkit/build-angular → 21.2.15
- wavemaker-ng-codegen: update-angular-json.js foundation-css path fix

## Pattern files
- PATTERNS_FILE: wavemaker-runtime-patterns.md
- Resolved paths: .cursor/skills/angular-upgrade/wavemaker-runtime-patterns.md

## Pattern findings
- safe: §20a bundler alignment, §20b no forRoot, §20e foundation path, §11b/§11c, §1 no legacy compiler
- needs-review:
- likely-breakage:
- must-change: (none — pattern-review passed)

## Security
- audit.sh exit 0; 32 vulns remain (build-toolchain transitive)
- @angular/* at 21.2.17 in root and yalc copy

## Build
- Step 7: pass — sh build.sh -f

## Post-build verify
- Result: pass — verify-ngx-bootstrap-bundle.sh

## Unit tests
- Result: skipped — Step 0 (skip tests yes)

## Preview Validation
- Comparison URL result: pass — Main page loads (nav, Department Details form, Employees table)
- Preview URL result: pass — LiveForm_Autocomplete form + nav + table render
- Iteration count: 1 (redeploy index.html after WAR overwrite)
- Regressions vs baseline: none observed (stage Main page healthy; different route than preview)

## Upgrade summary doc
- Path: docs/21-upgrade.md
- Written: yes

## Deferred / user decisions
- Stage comparison URL — now returns 200; Main page verified 2026-06-16
- Unit tests deferred per skip tests yes
