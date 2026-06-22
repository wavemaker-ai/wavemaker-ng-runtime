# References

Step 2 checklist. Record in `current-state.md` → **Reference review**. Map changes → **Dual-repo change plan**. Step 6 applies both; Step 10 cites R1/R8/R12 in compatibility section. Workflow: [`SKILL.md`](./SKILL.md).

---

## Checklist

Base/target from Step 0. **Block Step 2** if R1, R2, R3, R8, or R12 = not reviewed.

| # | Reference | Req | Steps | Verify | Repo |
|---|-----------|-----|-------|--------|------|
| R1 | [Angular Update Guide](https://angular.dev/update-guide) (From=base, To=target, advanced) | **Y** | 2,3,6 | Breaking changes for this major hop | per item → runtime and/or codegen |
| R2 | [Version Compatibility](https://angular.dev/reference/versions) | **Y** | 2,3 | TS, Node, RxJS for target | `package.json` engines/deps |
| R3 | [CHANGELOG](https://github.com/angular/angular/blob/main/CHANGELOG.md) | **Y** | 2,6 | Breaking changes base→target | runtime source; codegen templates if API changed |
| R4 | [`ng update`](https://angular.dev/cli/update) | Y | 2 | Package set vs manual bump plan | runtime `package.json`, `angular.json` |
| R5 | [Releases](https://angular.dev/reference/releases) | — | 2 | Target stable? (report only) | — |
| R6 | [npm audit](https://docs.npmjs.com/cli/audit/) + [audit guide](https://docs.npmjs.com/auditing-package-dependencies-for-security-vulnerabilities/) | Y | 5 | Critical/high policy | runtime lockfile |
| R8 | [ngx-bootstrap](https://valor-software.com/ngx-bootstrap/documentation) | **Y** | 2,6 | Module API for target major | runtime: transpiler, widgets, patch; codegen: `app.config.ts.hbs` |
| R9 | [jest-preset-angular](https://github.com/thymikee/jest-preset-angular) | Y | 2,9 | Preset ↔ Angular target | runtime jest config |
| R10 | [ng-packagr](https://github.com/ng-packagr/ng-packagr) | Y | 2,7 | Library builds | runtime `projects/*` |
| R11 | [Node releases](https://nodejs.org/en/about/previous-releases) | Y | 2,3 | LTS for target Angular | `engines.node` |
| R12 | [`wavemaker-runtime-patterns.md`](./wavemaker-runtime-patterns.md) | **Y** | 2,6,8 | must-change / likely-breakage / §20 | both repos — see patterns header |
| R13 | Prior `docs/{major}-upgrade.md` | — | 10 | Context from last major | — |

**Record format** (one bullet per required row):

```text
- R1: reviewed — <summary> — runtime: <files>; codegen: <files|n/a>
```

Optional: `npm run owasp` when user asks.

---

## Dual-repo map

| Concern | ng-runtime | ng-codegen |
|---------|------------|------------|
| Angular/TS/Node | `package.json`, `angular.json`, `tsconfig.json` | `package.json` if present |
| Generated `tsconfig.json` | **`tsconfig.web-app.json`** → `@wavemaker-ai/angular-app` | `src/gen-tsconfig.js` (rename) |
| Bootstrap | `runtime-dynamic/`, `runtime-base`, transpiler | **`templates/app.config.ts.hbs`** |
| Page imports | **`transpiler/src/imports.ts`** + rebuild dependencies | via transpiler (no page `.hbs`) |
| Prism styles | angular-app build | **`src/update-angular-json.js`** |
| ngx-bootstrap widgets | `components/`, patch, rollup | bootstrap template |
| `.cjs.js` requires | `angular-app/dependencies/` names | `src/expr-parser-utils.js`, `wm-utils.js`, `pages-util.js` |

**Layout:** sibling `../wavemaker-ng-codegen`. **Branches:** same name — `pattern-review.sh`. **Never** patch `~/Desktop/local-*` or generated app `src/`.

**Packages:** `@wavemaker-ai/angular-app` ships from ng-runtime. After major bump: align tsconfigs, update codegen templates/src, rebuild both, re-run codegen (§20).
