# Troubleshoot — error-message quick lookup

Paste the error fragment into the table below to jump to the right pattern section. Full grep details are in the section itself.

For the fix, open the file listed in **Section** and follow its instructions. Workflow: [`SKILL.md`](./SKILL.md).

---

| Error fragment | Section | Notes |
|----------------|---------|-------|
| `TS2307: Cannot find module '@angular/common/http'` | §20a | `moduleResolution: "node"` in tsconfig — switch to `"bundler"` |
| `TS2307: Cannot find module 'ngx-bootstrap/datepicker'` | §20a | Same — package exports subpaths not resolved |
| `TS2307: Cannot find module '@angular/core/primitives/di'` | §20a | Same |
| `NG1010: imports array is not statically analyzable` | §8b | `forRoot()` return value in `imports` — use bare module |
| `TS2339: Property 'forRoot' does not exist on type 'typeof ModalModule'` | §20b | ngx-bootstrap 21 removed `forRoot` on `ModalModule` |
| `TS2339: Property 'forRoot' does not exist on type 'typeof BsDatepickerModule'` | §20b | Same — `BsDatepickerModule` |
| `ReferenceError: __destroyRef is not defined` | §12 | ngx-bootstrap positioning patch missing or regex drifted after minor bump |
| `TypeError: Cannot read properties of undefined (reading 'attach')` | §11 | `overrideRouterOutlet` fires before `RouterOutlet` created |
| Nav labels / widget styles disappear after page navigation | §13a | Two `WMDomSharedStylesHost` instances — `ɵSharedStylesHost` added to both `app.config.ts` and `runtime-base.module.ts`; child injector `ngOnDestroy` strips style nodes. Remove from `app.config.ts`. |
| `Error: Unexpected synthetic property @…` | §13g | `WMDomRenderer` not ignoring `@`-prefixed animation properties |
| `TypeError: Cannot set properties of null` in `setProperty` | §13g | Null `el` guard missing in `WMDomRendererFactory2` |
| `Error: Unsupported event target … for event …` | §13d | `addGlobalEventListener` reverted instead of `DOCUMENT`-based resolve |
| `Expected N arguments, but got M` on `parseBinding` / `parseAction` | §19a | `ParseSourceSpan` not passed — old string placeholder |
| `Cannot find module '../dependencies/expression-parser.cjs'` | §20c | Dependency filename suffix changed to `.cjs.js` |
| `Error: Could not resolve entry point` from ng-packagr | §21 | Library `public-api.ts` or `ng-package.json` incompatible with new ng-packagr |
| `WARN unmet peer dependency @angular/core@^N` during install | §22 | Yalc-linked package declares old Angular peer dep |
| `Schema validation failed … must NOT have additional properties` | §23 | `angular.json` builder option renamed or removed in this Angular major |
| `The …:browser builder is deprecated` | §23 | Builder rename — plan migration |
| `takeUntilDestroyed` / `wasPatched: false` in build log | §6, §12 | ngx-bootstrap patch didn't apply — regex drift after minor bump |
| `NG0201: No provider for EnvironmentInjector` in specs | §2 | Mock not injected in `partial-container.spec.ts` constructor |
| `Cannot find module 'lodash-es'` in Jest | §9 | `transformIgnorePatterns` missing `lodash-es` |
| `APP_INITIALIZER` resolves before locale / before variables | §7 | Wrong provider ordering in `app.config.ts` |
| `TS1484: 'X' is a type and must be imported using a type-only import` | §25 | `verbatimModuleSyntax` in TS 5.0+ — use `import type` |
| `TS4114: This member must have an 'override' modifier` | §25 | `noImplicitOverride` strictness — add `override` keyword |
| New TS error in file with no Angular API change | §25 | TypeScript version strictness ratchet — check §25 table |

---

**Where to find the sections:**
- §1–§19 → [`patterns/runtime.md`](patterns/runtime.md)
- §20 → [`patterns/codegen.md`](patterns/codegen.md)
- §21–§25 → [`checklist.md`](checklist.md)
