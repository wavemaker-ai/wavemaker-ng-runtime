# History — WMS commit refs by section

Traceability index for commit hashes cited in the pattern files. Organized by pattern section — look up the section you're working on to find every prior fix.

> **Partial coverage:** only sections with tracked commit history appear below. Sections not listed (§3, §5, §8, §8b, §10, §12, §14, §20, §21–§25) either had no tracked commits at the time of writing or their changes were bundled under another section's commit. Absence of an entry does not mean the section has never been applied — check `git log --all -S <symbol>` to search by code.

---

## §1 — Legacy runtime compiler

| Ticket | Commit | What it did |
|--------|--------|-------------|
| WMS-29275 | `a2062ecf8` | Removed deprecated `wm-view` transpiler registration; completed standalone migration |

---

## §2 — Standalone dynamic component creation

| Ticket | Commit | What it did |
|--------|--------|-------------|
| WMS-29275 | `d9a05f1be` | `createComponent` object syntax; initial Angular 20 port |
| WMS-29275 | `3c1028fe8` | `createComponent` with `environmentInjector` in remaining directive paths |
| WMS-29275 | `a2062ecf8` | Complete standalone migration (same commit as §1) |

---

## §4 — Template parser / transpiler integration

| Ticket | Commit | What it did |
|--------|--------|-------------|
| WMS-29275 | `46917e48c` | Angular 20 `Element` constructor arity — 9 args required; centralized in `createCompilerElement()` |

---

## §6 — ngx-bootstrap patch and widgets

| Ticket | Commit | What it did |
|--------|--------|-------------|
| WMS-29275 | `a6b0848e7` | Patch: `positioning` — DestroyRef injection + `update$$.next` reopen line |
| WMS-29275 | `bfc670354` | Patch: `component-loader` — track `_onShownSubscription`, call `_unsubscribePositioning()` in `hide()` |
| WMS-29275 | `2fef2d417` | Patch: `dropdown` restore `"class.show": "isOpen"` on BS5 host |
| WMS-29275 | `9fb962af5` | Patch: `modal` SHOW class + `typeahead` overflow style removal |
| WMS-29275 | `bfb1f5bb4` | `BaseDialog` manual open/close callbacks — `BsModalService.onShown/onHidden` removed in ngx-bootstrap 20 |

---

## §7 — Runtime bootstrap / providers

| Ticket | Commit | What it did |
|--------|--------|-------------|
| WMS-29275 | `197e3cec6` | Bootstrap providers fixes for Angular 20 |
| WMS-29275 | `b39be62c4` | Bootstrap providers fixes for Angular 20 |
| WMS-29275 | `5442cebf0` | Bootstrap + page query params combined fix (also §15) |

---

## §9 — Jest / widget specs

| Ticket | Commit | What it did |
|--------|--------|-------------|
| WMS-29275 | `d30689ff8` | Jest spec fixes for Angular 20 (async pipes, detectChanges) |

---

## §11 — RouterOutlet attach/detach monkey-patch

| Ticket | Commit | What it did |
|--------|--------|-------------|
| WMS-31488 | `dae9a74fc` | Product baseline: reverted `ChangeDetectorRef.detectChanges`, `@if (spinner.show)` wrapper, `scheduleOverrideRouterOutlet` polling. Settled on `@ViewChild(RouterOutlet)` setter + `[show]="spinner.show"` + `setTimeout(10)` in `base-layout.component.ts` |
| WMS-28429 | (no hash) | `@ViewChild(RouterOutlet)` setter pattern first introduced — see §11 for pattern |

---

## §13 — WMDomRendererFactory2 / WMDomSharedStylesHost (CSP fork)

| Ticket | Commit | What it did |
|--------|--------|-------------|
| WMS-29275 | `d9a05f1be` | WMDomRenderer initial Angular 20 port |
| WMS-29275 | `26ff7c6ee` | Added animation `@` property handling to WMDomRenderer |
| WMS-29275 | `bd406e2a7` | Animation event handling — **later reverted by WMS-25708 `56f3b9ce6`**; re-validate in preview if page-param variables fail on first load |
| WMS-22503 | (no hash) | CSP nonce support (Angular 14) |
| WMS-25166 | (no hash) | DOM API changes: `listen()`, `DOCUMENT` (Angular 16) |
| WMS-27103 | (no hash) | `removeChild` signature change (Angular 18) |

---

## §15 — Page query params timing

| Ticket | Commit | What it did |
|--------|--------|-------------|
| WMS-29275 | `0c69b8010` | Snapshot + subscribe pattern for Angular 20 router |
| WMS-29275 | `5442cebf0` | Bootstrap + page query params combined fix (also §7) |
| WMS-29275 | `80faec7f4` | Query param timing fix; list/table createCustomInjector (also §16) |
| WMS-25708 | `56f3b9ce6` | Reverted `bd406e2a7` (§13 animation event fix) — caused regression in page-param-driven variables on first load |

---

## §16 — List/table embedded template context / DI

| Ticket | Commit | What it did |
|--------|--------|-------------|
| WMS-29275 | `1aad018d4` | `createEmbeddedView` + `createCustomInjector` — but reverted blanket-apply to inline-edit cells after regression |
| WMS-29275 | `4daf7d759` | Context key caching for per-template injectors |
| WMS-29275 | `80faec7f4` | Query param timing fix; list/table (also §15) |

---

## §19 — WaveMaker expression parser (ASTCompiler / $parseExpr)

| Ticket | Commit | What it did |
|--------|--------|-------------|
| WMS-29275 | `b4ecc7218` | Angular 20 `Parser` — `location` / `sourceSpan` args mandatory in `parseBinding` / `parseAction` |
| WMS-26038 | (no hash) | Angular 17 dropped middle `false` arg from `parseBinding` / `parseAction` — do not revert to 3-arg call |
| WMS-22541 | (no hash) | `KeyedRead.obj` → `KeyedRead.receiver` (Angular 12) |
| WMS-23342 | (no hash) | `MethodCall` → `Call` (Angular 14) |
| WMS-25048 | (no hash) | Add `Unary` node handler (Angular 14+) |
| WMS-29275 | (no hash) | `PropertyWrite` removed — assignment AST path commented out (Angular 20) |
| WMS-31316 | (no hash) | `ParenthesizedExpression` is a distinct node — must unwrap (Angular 20+) |

---

## Cross-reference

- §13 and §15 interact: `bd406e2a7` introduced an animation fix that broke page-param variables; `56f3b9ce6` reverted it. If §13 animation handling is re-attempted, re-validate §15 in preview.
- §7 and §15 share commit `5442cebf0` — bootstrap providers and page query params were fixed together.
- §15 and §16 share commit `80faec7f4` — query param timing and list/table injectors were fixed together.
