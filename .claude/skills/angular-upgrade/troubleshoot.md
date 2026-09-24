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
| `TS2724: '"@angular/compiler"' has no exported member named 'PropertyWrite'` | §19b | `PropertyWrite` AST class removed from `@angular/compiler` at Angular 20 — comment out `processPropertyWrite()`/`instanceof PropertyWrite` in `ASTCompiler.build()` |
| `TS2554: Expected 9-10 arguments, but got 6` on `new Element(...)` | §4 | Angular 20 `Element` ctor needs `directives`/`isSelfClosing`/`isVoid` args too — check for duplicated local `createElement`/`createCompilerElement` helpers across `projects/transpiler/src/build.ts` AND every `projects/components/transpile/src/**/*.build.ts` (not shared code — each file has its own copy, fix all of them) |
| `SyntaxError: Unexpected token ','` at `new Function` inside `ASTCompiler.compile` | §19b | An AST node type silently falls through `ASTCompiler.build()`'s unhandled-case (returns `undefined`, no error) and gets joined into a comma-separated arg/array list downstream. Confirmed cause: `ParenthesizedExpression` (WMS-31316) via `swipey.jquery.plugin.js`'s `{{...}}` CSS-animation binding — but don't assume it's always this one; see the diagnostic technique below |
| `Cannot find module '@wm/X'` across dozens/hundreds of files, one build run | §1 (methodology) | Near-certainly ONE root cause, not many — find the EARLIEST-built library with a real (non-cascade) error and fix that first; see "Reading a cascading build failure" below |

**Reading a cascading build failure:** `build.sh`'s per-library `ng-packagr` step does not abort the whole script on one library's compile error — it keeps going, so a single early failure (e.g. `@wm/core`) can produce `Cannot find module '@wm/core'`/`'@wm/transpiler'`/etc. across 400+ downstream files in the same log, all traceable to the one real bug. Don't triage file-by-file: grep the log for `Building entry point` to find build order, then read each entry point's section top-to-bottom until you hit the FIRST real (non-`TS2307`/module-not-found) error — that's the actual root cause. Fix it, rebuild, and expect the error count to collapse by an order of magnitude, revealing the next real (if any) root cause rather than more cascade noise.

**Diagnosing a silent `ASTCompiler.build()` fallthrough (no error, wrong/missing output):** don't guess which AST node class is unhandled — temporarily add an `else` branch at the end of `build()`'s `if`/`else if` chain: `console.error('[DIAG]', ast?.constructor?.name, ast)`, rebuild, reproduce, read the logged constructor name, then remove the diagnostic before the real fix. This settled a real hop-2 case in one rebuild cycle where the wrong AST node (`PropertyWrite`, changed in the same file/hop) was initially and incorrectly suspected — the diagnostic pointed to `ParenthesizedExpression` instead, an unrelated pre-existing gap.

---

**Where to find the sections:**
- §1–§19 → [`patterns/runtime.md`](patterns/runtime.md)
- §20 → [`patterns/codegen.md`](patterns/codegen.md)
- §21–§25 → [`checklist.md`](checklist.md)
