# Angular 21 upgrade — wavemaker-ng-runtime

## Summary

Upgrade from Angular **20** to **21** on branch `stage-ai`. Platform packages at `@angular/core` **21.2.14**, `ngx-bootstrap` **21.2.0**.

Configuration source: `.cursor/skills/angular-upgrade/repo.config.sh` (`ANGULAR_BASE_VERSION`, `ANGULAR_TARGET_VERSION`, preview URLs, gates, `BUILD_CMD`).

## Repo config (this upgrade)

| Setting | Value |
|---------|--------|
| Base Angular | 20 |
| Target Angular | 21 |
| Post-build verify | yes (default) |
| Unit tests | no (override) |
| Build | `sh build.sh -f` |
| Preview URL | skip (empty in repo.config) |
| Comparison URL | n/a |

## Validation

| Gate | Result | Notes |
|------|--------|-------|
| Install | pass | |
| Security audit | pass (with known moderate) | 3 moderate webpack-dev-server |
| Build | pass | ~385s force rebuild |
| ngx-bootstrap bundle verify | pass | `verify-ngx-bootstrap-bundle.sh` |
| Unit tests | skipped | override tests=no |
| Preview | pass | manual Chrome DevTools (PREVIEW_URL empty in repo.config for this run) |

## Build fix (2026-06-01)

`@wm/variables` ng-packagr failed with TS6059 because `@wavemaker-ai/variables` tsconfig path resolved to yalc **source** outside `projects/variables/src` rootDir. Fixed by preferring compiled output:

```json
"@wavemaker-ai/variables": [
  ".yalc/@wavemaker-ai/variables/dist/es2015/index",
  "node_modules/@wavemaker-ai/variables/dist/es2015/index",
  ".yalc/@wavemaker-ai/variables/index"
]
```

## Manual preview checklist

Set `PREVIEW_URL` and `COMPARISON_URL` in `repo.config.sh`, then repeat the same flows on both URLs. See `wavemaker-runtime-patterns.md` § Preview validation checklist.

1. App shell loads — no `overrideRouterOutlet` / `reading 'attach'` errors
2. Popover opens; date and time pickers visible where applicable
3. Open date/time picker inside popover — popover stays open
4. Reopen picker after close
5. No `__destroyRef is not defined` / `PositioningService` console errors

## References

- Patterns: `.cursor/skills/angular-upgrade/wavemaker-runtime-patterns.md`
