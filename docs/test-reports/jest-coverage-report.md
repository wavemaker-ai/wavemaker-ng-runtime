# wavemaker-ng-runtime: jest coverage report

- Repo: `wavemaker-ng-runtime`
- Branch: `feature/angular-22-upgrade`
- Date: 2026-10-07
- Command: `npx jest --coverage`

## Totals

| Metric | Covered | Total | % |
|---|---|---|---|
| statements | 23622 | 26449 | 89.31 |
| branches | 14312 | 16902 | 84.67 |
| functions | 4294 | 4875 | 88.08 |
| lines | 22677 | 25370 | 89.38 |

Tests: 9459 passed, 0 failed, 1 skipped. Suites: 388 passed, 0 failed (of 388).

## Files below 100% statement coverage (44), most uncovered statements first

| File | Uncovered stmts | Stmts % | Branch % | Func % | Lines % |
|---|---|---|---|---|---|
| .yalc/@wavemaker-ai/variables/src/manager/variable/live-variable.manager.js | 489 | 9.44 | 1.74 | 4.58 | 9.71 |
| .yalc/@wavemaker-ai/variables/src/util/variable/live-variable.utils.js | 335 | 10.18 | 0 | 1.56 | 10.49 |
| .yalc/@wavemaker-ai/variables/src/manager/variable/service-variable.manager.js | 321 | 13.94 | 3.59 | 10.9 | 14.2 |
| .yalc/@wavemaker-ai/variables/src/util/variable/pagination.utils.js | 218 | 7.23 | 0 | 5 | 7.45 |
| .yalc/@wavemaker-ai/variables/src/util/variable/variables.utils.js | 178 | 32.06 | 8.48 | 16.66 | 27.86 |
| .yalc/@wavemaker-ai/variables/src/util/variable/service-variable.utils.js | 169 | 11.05 | 0 | 4 | 11.86 |
| .yalc/@wavemaker-ai/variables/src/manager/variable/crud-variable.manager.js | 166 | 18.22 | 5.08 | 18.18 | 18.68 |
| .yalc/@wavemaker-ai/variables/src/util/utils.js | 162 | 22.11 | 2.22 | 3.12 | 19.2 |
| .yalc/@wavemaker-ai/variables/src/model/variable/live-variable.js | 118 | 29.34 | 9.52 | 17.64 | 29.69 |
| .yalc/@wavemaker-ai/variables/src/model/variable/crud-variable.js | 86 | 35.82 | 13.79 | 26.92 | 36.36 |
| .yalc/@wavemaker-ai/variables/src/model/variable/service-variable.js | 67 | 36.19 | 17.02 | 26.08 | 36.89 |
| .yalc/@wavemaker-ai/variables/src/util/file-upload.util.js | 63 | 30.76 | 20 | 21.87 | 31.46 |
| .yalc/@wavemaker-ai/variables/src/model/base-variable.js | 59 | 45.37 | 27.41 | 22.72 | 46.66 |
| .yalc/@wavemaker-ai/variables/src/util/variable/live-variable.http.utils.js | 58 | 15.94 | 0 | 0 | 13.43 |
| .yalc/@wavemaker-ai/variables/src/util/dataset-util.js | 43 | 37.68 | 20.83 | 25 | 37.68 |
| .yalc/@wavemaker-ai/variables/src/util/inflight-queue.js | 41 | 18 | 0 | 25 | 18.75 |
| .yalc/@wavemaker-ai/variables/src/model/variable/model-variable.js | 34 | 44.26 | 30 | 46.15 | 45.76 |
| .yalc/@wavemaker-ai/variables/src/model/base-action.js | 27 | 52.63 | 14.28 | 17.64 | 55.55 |
| .yalc/@wavemaker-ai/variables/src/manager/variable/base-variable.manager.js | 26 | 27.77 | 0 | 16.66 | 30.3 |
| .yalc/@wavemaker-ai/variables/src/manager/variable/model-variable.manager.js | 19 | 47.22 | 19.44 | 45.45 | 50 |
| .yalc/@wavemaker-ai/variables/src/model/action/timer-action.js | 18 | 60 | 36 | 42.85 | 62.79 |
| .yalc/@wavemaker-ai/variables/src/util/notify-promise.js | 18 | 14.28 | 0 | 11.11 | 15 |
| .yalc/@wavemaker-ai/variables/src/manager/action/timer-action.manager.js | 16 | 33.33 | 0 | 16.66 | 38.09 |
| .yalc/@wavemaker-ai/variables/src/types/event-notifier.js | 11 | 35.29 | 0 | 28.57 | 37.5 |
| projects/variables/src/util/variable/variables.utils.ts | 10 | 97.48 | 97.56 | 95.08 | 97.38 |
| projects/components/widgets/input/calendar/src/calendar.component.ts | 8 | 97.35 | 96.29 | 96.42 | 97.31 |
| projects/core/src/utils/expression-parser.ts | 8 | 98.05 | 97.83 | 98.11 | 98 |
| projects/components/widgets/data/table/src/table.component.ts | 7 | 99.46 | 99.16 | 99.17 | 99.46 |
| projects/components/base/src/utils/form-utils.ts | 6 | 97.11 | 96.42 | 94.44 | 97.4 |
| projects/core/src/utils/utils.ts | 6 | 99.3 | 99.1 | 99.42 | 99.18 |
| .yalc/@wavemaker-ai/variables/src/model/variable/api-aware-variable.js | 5 | 75 | 55.55 | 75 | 83.33 |
| .yalc/@wavemaker-ai/variables/src/model/crud-create.js | 4 | 63.63 | 0 | 50 | 63.63 |
| .yalc/@wavemaker-ai/variables/src/model/crud-delete.js | 4 | 63.63 | 0 | 50 | 63.63 |
| .yalc/@wavemaker-ai/variables/src/model/crud-list.js | 4 | 63.63 | 0 | 50 | 63.63 |
| .yalc/@wavemaker-ai/variables/src/model/crud-update.js | 4 | 63.63 | 0 | 50 | 63.63 |
| projects/components/base/src/utils/widget-utils.ts | 4 | 98.38 | 96.51 | 97.5 | 98.24 |
| .yalc/@wavemaker-ai/variables/src/util/oAuth.utils.js | 3 | 70 | 0 | 0 | 57.14 |
| projects/core/src/utils/watcher.ts | 3 | 98.42 | 100 | 93.93 | 98.81 |
| projects/security/src/security.service.ts | 3 | 98.06 | 95.45 | 100 | 98.01 |
| projects/oAuth/src/oAuth.utils.ts | 2 | 98.88 | 97.02 | 100 | 98.83 |
| projects/components/widgets/data/table/src/datatable.js | 1 | 99.94 | 99.19 | 100 | 99.94 |
| projects/components/widgets/input/text/src/number-locale/number-locale.ts | 1 | 99.61 | 99.67 | 100 | 99.61 |
| projects/components/widgets/navigation/popover/src/popover.component.ts | 1 | 99.61 | 98.63 | 100 | 99.58 |
| projects/core/src/services/state-persistence.service.ts | 1 | 99.36 | 99.37 | 100 | 99.35 |
