# WaveMaker patterns — ng-codegen (§20)

Codegen repo: `../wavemaker-ng-codegen` (`NG_CODEGEN_PATH`). Step 6 edits **`templates/`** and **`src/`** only — never `dist/`.

**Re-check every major:** `tsconfig.web-app.json` ↔ `tsconfig.json`, ngx-bootstrap API (`forRoot` removal on third-party modules), **`templates/app.config.ts.hbs`** (codegen's only app-bootstrap template — **mirror runtime per §20g after R1 walkthrough**), transpiler `imports.ts`, dependency filenames under `angular-app/dependencies/` if codegen fails at require time.

Workflow: [`SKILL.md`](./SKILL.md). Meta index: [`wavemaker-runtime-patterns.md`](./wavemaker-runtime-patterns.md).

---

## §20 — ng-codegen templates and src

### 20a. Generated tsconfig parity (must-change)

When ng-runtime `tsconfig.json` changes `moduleResolution`, `module`, or `lib`, update:

| ng-runtime | ng-codegen |
|------------|------------|
| `tsconfig.json` | `src/gen-tsconfig.js` (rename fields) |
| `tsconfig.web-app.json` | shipped via `@wavemaker-ai/angular-app` |

**Automated:** `pattern-review.sh` §20a compares `moduleResolution`, `module`, `lib` between the two tsconfigs.

### 20b. ngx-bootstrap `.forRoot()` removal in bootstrap template (must-change)

When ngx-bootstrap removes `.forRoot()` on ModalModule / BsDatepickerModule / NgCircleProgressModule (R8), remove from **`templates/app.config.ts.hbs`**:

```typescript
// Before
ModalModule.forRoot(),
BsDatepickerModule.forRoot(),
NgCircleProgressModule.forRoot(),

// After — bare modules inside importProvidersFrom
ModalModule,
BsDatepickerModule,
NgCircleProgressModule,
```

**Automated:** `pattern-review.sh` §20b FAIL if disallowed `.forRoot()` remains in hbs.

**Page / partial templates** (`page/page.component.ts.hbs`, `partial/partial.component.ts.hbs`): **no `.hbs` change** for ngx-bootstrap — imports come from transpiler via `{{WMComponentsImportStmts}}` / `{{WMComponentModuleStmts}}`. Fix **`projects/transpiler/src/imports.ts`** in ng-runtime (remove `forRoot: true` on ngx-bootstrap `ImportDef`s) and rebuild the transpilation bundle shipped in `angular-app/dependencies/`.

#### 20g. Bootstrap provider parity — runtime `app.config.ts` ↔ codegen `app.config.ts.hbs` (must-change)

**Why this exists:** Runtime preview (`projects/runtime-dynamic/src/app/app.config.ts`) and generated apps (`templates/app.config.ts.hbs` → `src/app/app.config.ts`) are **separate bootstrap paths**. Build/test can pass on runtime alone while codegen ships stale providers.

**Not a hardcoded token list.** Parity is driven by:

1. **R1 Update Guide Traceability** (Step 2) — each bootstrap/DI/HTTP/router recommendation marked `[Y]` must name both repos and have a plan row.
2. **`bootstrap-parity.sh`** (Step 6) — dynamically compares `provide*` / `with*` identifiers in runtime vs hbs (preview-only symbols listed in `bootstrap-parity-exclusions.txt`, not per-version Angular APIs).

**Step 2 workflow (required every major):**

1. Complete R1 walkthrough per [`references.md`](references.md) — record URL + one bullet per recommendation.
2. For each R1 `[Y]` touching bootstrap, read runtime `app.config.ts` and codegen `app.config.ts.hbs`.
3. Add a **Dual-repo change plan** row for every file delta (runtime and/or codegen).
4. Apply runtime changes first (Step 6), then mirror into the hbs template **in the same pass**.

**Step 6 verification:**

```bash
sh .cursor/skills/angular-upgrade/scripts/bootstrap-parity.sh
sh .cursor/skills/angular-upgrade/scripts/verify-r1-traceability.sh
# or both via:
sh .cursor/skills/angular-upgrade/scripts/pattern-review.sh
```

**Manual parity checklist** (Step 6 — after automated scripts pass):

- Provider ordering in `providers: [` matches runtime for Angular core services
- `APP_INITIALIZER` + `LOCALE_ID` factory `deps` arrays match runtime
- CSP block (`{{#if isCSP}}` renderer overrides) unchanged unless runtime CSP path changed
- Preview-only runtime providers (`XhrFactory`, `RendererFactory2`, etc.) stay out of hbs — document as `codegen: n/a` in R1 traceability, not in `bootstrap-parity-exclusions.txt` unless they appear as `provide*`/`with*` APIs

**Step 6 classification:** runtime has `provide*`/`with*` API, hbs missing → **`must-change`** (blocks Step 6). R1 `[Y]` with codegen files listed but hbs not updated → **`must-change`**. Preview-only extras in runtime → R1 traceability `codegen: n/a` with reason — do not copy into hbs.

#### 20c. Codegen dependency paths (likely-breakage — apply when codegen fails)

**When to fix:** Only if running codegen throws `Cannot find module '../dependencies/...'` — not a build-gate item until observed.

When `@wavemaker-ai/angular-app/dependencies/` filenames use a `.cjs.js` suffix, update **`wavemaker-ng-codegen/src/`** (not `dist/`):

| Old require | Angular 21+ shipped name |
|-------------|--------------------------|
| `../dependencies/@wavemaker/app-ng-runtime/fesm2022/wavemaker-app-ng-runtime.mjs` | verify actual filename after ng-runtime build |
| expr-parser / wm-utils / pages-util paths | match `angular-app/dependencies/` tree |

**Grep when codegen fails:**

```bash
grep -r "dependencies/" ../wavemaker-ng-codegen/src/
ls angular-app/dependencies/
```

#### 20d. Branch alignment (must-change)

ng-runtime and ng-codegen must be on the **same branch**. **Automated:** `pattern-review.sh` §20.

#### 20e. foundation-css dist path in update-angular-json.js (must-change)

Prism ng build expects:

```javascript
'node_modules/@wavemaker/foundation-css/dist/styles/foundation/foundation.css'
```

Not `foundation-css/foundation/foundation.css`. **Automated:** `pattern-review.sh` §20e.

---

## Cross-repo checklist (Step 6)

| Change in ng-runtime | Also update in ng-codegen |
|----------------------|---------------------------|
| `tsconfig.json` moduleResolution | `src/gen-tsconfig.js` |
| transpiler ngx-bootstrap imports | page `.hbs` via transpiler bundle (rebuild dependencies) |
| runtime `app.config.ts` bootstrap APIs | `templates/app.config.ts.hbs` (§20g + R1 traceability) |
| foundation-css package layout | `src/update-angular-json.js` |
| dependency `.cjs.js` renames | `src/expr-parser-utils.js`, etc. (§20c when observed) |

After ng-codegen edits: `cd ../wavemaker-ng-codegen && sh build.sh` before Step 9.
