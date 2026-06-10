# References

Read this file during **Step 2 — Plan upgrade path**. `SKILL.md` keeps workflow rules; this file is the link catalog only.

## Angular (primary)

- [Angular Update Guide](https://angular.dev/update-guide)
- [Angular Version Compatibility](https://angular.dev/reference/versions) — includes TypeScript and Node ranges per Angular major
- [Angular Releases](https://angular.dev/reference/releases)
- [Angular CLI `ng update`](https://angular.dev/cli/update)
- [Angular CHANGELOG](https://github.com/angular/angular/blob/main/CHANGELOG.md)

## npm security

- [Auditing package dependencies](https://docs.npmjs.com/auditing-package-dependencies-for-security-vulnerabilities/)
- [`npm audit` CLI](https://docs.npmjs.com/cli/audit/)
- [`npm audit fix` CLI](https://docs.npmjs.com/cli/audit/#npm-audit-fix) — never use `--force` in this skill without explicit user approval

## Ecosystem (optional — this repo)

- [ngx-bootstrap documentation](https://valor-software.com/ngx-bootstrap/documentation)
- [jest-preset-angular](https://github.com/thymikee/jest-preset-angular) — align with Angular major
- [ng-packagr](https://github.com/ng-packagr/ng-packagr) — library builds under `projects/`
- [Node.js releases](https://nodejs.org/en/about/previous-releases) — repo pins exact Node in `package.json` `engines`

## Optional (report only, not a gate)

- OWASP dependency check: `npm run owasp` in repo root (slower; use when user asks)

## In-repo

- [`wavemaker-runtime-patterns.md`](./wavemaker-runtime-patterns.md) — default runtime pattern catalog (override via `PATTERNS_FILE` in `repo.config.sh`); **§20** = generated-app / codegen cross-repo fixes
- `docs/{major}-upgrade.md` — per-major upgrade summary (Step 10; path from `UPGRADE_DOC_PATH` in `repo.config.sh`)

## Cross-repo (generated Angular apps)

**Layout:** `wavemaker-ng-codegen` is a **sibling repo**, usually beside `wavemaker-ng-runtime` under the same parent (e.g. `wavemaker-studio-frontend/`). Default path from this repo: **`../wavemaker-ng-codegen`**.

**Branches:** During an upgrade, keep **the same branch name** on both repos (e.g. ticket/feature branch). If branches differ, ask the user to create or checkout matching branches before cross-repo code changes.

- **`wavemaker-ng-codegen`** — codegen templates and `gen-tsconfig.js`; active bootstrap template **`templates/app.config.ts.hbs`** (emitted as `app.config.ts`); `templates/app.module.ts.hbs` is **legacy/unused**; renames `tsconfig.web-app.json` → `tsconfig.json`
- **`@wavemaker-ai/angular-app`** — shipped from **this repo** (`wavemaker-ng-runtime`); includes `tsconfig.web-app.json`, `dependencies/*.cjs.js`, `build-scripts/build.js`
- After each major bump: align **`tsconfig.web-app.json`** with **`tsconfig.json`**, update **`app.config.ts.hbs`** in ng-codegen, rebuild both packages, **re-run codegen** on test apps (see patterns §20)
