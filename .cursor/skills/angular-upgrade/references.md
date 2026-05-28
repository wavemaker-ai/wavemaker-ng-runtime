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

- [`upgrade-history.md`](./upgrade-history.md) — append one section per completed major bump
- [`wavemaker-patterns.md`](./wavemaker-patterns.md) — this repository’s pattern catalog (`PATTERNS_FILE`)
