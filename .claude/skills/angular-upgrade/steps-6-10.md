# Steps 6–10 — Apply Fixes, Build, Validate, Finalize

Part of [`SKILL.md`](SKILL.md)'s Instructions (Step Overview, Compatibility Policy, resume rules all live there — read that first). Steps 0–5: [`steps-0-5.md`](steps-0-5.md).

---

### Step 6 — Apply Fixes

Apply changes to **both repos** — ng-runtime first, then ng-codegen. ng-codegen §20 templates reference ng-runtime APIs, so runtime fixes must be in place before reviewing codegen changes. Two sources drive what to change:

1. **[`research.md`](research.md) findings** — the dual-repo change plan from Step 2. Each row names which repo(s) to edit.
2. **Pattern file checks** — greps against both repos. [`patterns/runtime.md`](patterns/runtime.md) §1–§19 cover ng-runtime source; [`patterns/codegen.md`](patterns/codegen.md) §20 covers ng-codegen templates and src. [`checklist.md`](checklist.md) has the Automated blockers table, §21–§25, and the Classification guide.

**Read pattern sections targeted to your Step 2 findings** — do not load all three files blindly:

| If Step 2 plan includes            | Read                                                             |
|------------------------------------|------------------------------------------------------------------|
| Always                             | Automated blockers (`checklist.md`), §20 (`patterns/codegen.md`) |
| ngx-bootstrap version bump (R8)    | §6, §8b, §12 (in `patterns/runtime.md`)                          |
| tsconfig / moduleResolution change | §20a (in `patterns/codegen.md`)                                  |
| TypeScript major bump              | §4, §19 (in `patterns/runtime.md`)                               |
| RouterOutlet / bootstrap providers | §7, §11 (in `patterns/runtime.md`)                               |
| DOM renderer changes               | §13 (in `patterns/runtime.md`)                                   |
| Test failures expected             | §9 (in `patterns/runtime.md`)                                    |
| ng-packagr version bump (R10)      | §30 (in `patterns/runtime.md`) — check even if Angular's own major didn't force it |

See [`checklist.md § Automated blockers`](checklist.md#automated-blockers-pattern-reviewsh) for the full automated vs manual section breakdown. Do not assume `pattern-review.sh` exit 0 means all patterns are clear — manual sections require separate grep.

Compatibility Policy (see [`SKILL.md`](SKILL.md)) applies to every edit — fix compile errors only, not modernization.

**Editable paths:** ng-runtime: `projects/`, `tsconfig*.json`, `build-scripts/`, `angular-app/dependencies/`. ng-codegen: `templates/` and `src/` only — never `dist/`.

Classify every finding using the Classification guide in [`checklist.md`](checklist.md) — block on any unresolved `must-change`.

After edits, run the automated check:

```bash
sh scripts/pattern-review.sh
```

**Build ng-codegen after fixes** — Step 9's local angular build runs ng-codegen to generate the app, so codegen must compile cleanly before Step 9 can succeed:

```bash
# NG_CODEGEN_PATH from repo.config.sh (default: ../wavemaker-ng-codegen)
cd <NG_CODEGEN_PATH> && sh build.sh
```

**Blanket changes — confirm once, apply to all.** If a fix means the same mechanical edit across many files (e.g. adding `changeDetection: ChangeDetectionStrategy.Eager` to every `@Component`, adding `provideZoneChangeDetection(...)` to bootstrap/provider lists, a repeated import/rename/decorator-option change), do **not** ask per file and do not edit silently:

1. Grep to list every affected file and count them.
2. Show the user one confirmation: the exact before/after edit, the file count, and a sample of paths (plus any files you propose to exclude and why).
3. On approval, apply it to **all** matched files in one pass, then re-grep to confirm zero remaining matches.
4. Record it as a single row in `current-state.md` → **Cross-repo Changes** (edit, file count, repo).

If the user declines or narrows the scope, follow their scope. Only ask again if a later blanket change is a different edit. This is the one exception to "one confirmation only" (see [`SKILL.md`](SKILL.md) Important Rules); all other findings still run without prompts.

Record all edits in `current-state.md` → **Cross-repo Changes**.

**Done when:** `pattern-review.sh` exit 0; every WARN item either fixed or explicitly deferred (record reason in `current-state.md` → **Pattern Findings**); no open `must-change`; ng-codegen `build.sh` exit 0; changes committed in both repos before proceeding to Step 7 (do not leave uncommitted upgrade changes).

---

### Step 7 — Build ng-runtime

The script sources `repo.config.sh` at runtime — `BUILD_CMD` and bundle verify flags are always read fresh, so mid-session config changes take effect automatically.

```bash
sh scripts/build.sh
```

**Done when:** `BUILD_CMD` exit 0; `verify-ngx-bootstrap-bundle.sh` pass (or `POST_BUILD_VERIFY_SCRIPT` not configured).

---

### Step 8 — Unit Tests

Skip if `DEFAULT_RUN_TESTS=no` or `TEST_CMD` is empty — record reason in Step Status table.

```bash
sh scripts/test.sh
```

Test failures mean something broke in the upgrade. Diagnose and fix in source — don't weaken assertions or skip specs. See [`patterns/runtime.md`](patterns/runtime.md) §9 for common jest-preset-angular issues.

**Done when:** `TEST_CMD` exit 0; or skipped (record reason).

---

### Step 9 — Preview Validation

Step 9 validates **every configured mode** in `VALIDATION_MODES` (`repo.config.sh`) — both are first-class, neither is the "default" one. Step 9 is skipped entirely only when **every** mode's url var is empty or `skip`; an individual mode with an empty/skip url var is simply skipped on its own, independent of the others.

**Validation modes:**

| Mode               | url var / comparison var                            | Has automated build?                                                    |
|--------------------|-----------------------------------------------------|---------------------------------------------------------------------------|
| Angular Deployment | `LOCAL_DEPLOYMENT_URL` / `WAVEMAKER_DEPLOYMENT_URL` | Yes — [`local-angular-build.md`](../../commands/local-angular-build.md) |
| WaveMaker Preview  | `LOCAL_PREVIEW_URL` / `WAVEMAKER_PREVIEW_URL`       | No — URL supplied directly, same as a comparison URL                    |

**This step has two parts per mode: AI builds (mode-dependent), human verifies (always).** The AI cannot open a browser or compare visual output — do not self-report G6/G7 as passed for any mode.

**Angular Deployment: AI build and deploy (automated)**

Follow [`local-angular-build.md`](../../commands/local-angular-build.md) — **upgrade mode** (Steps 2b → 3 → 4 → 5 → 6 → 7).

**WaveMaker Preview: no build step**

Nothing to run — its URL is supplied directly in `repo.config.sh`/chat, same as a comparison URL. Go straight to the hand-off below.

**Hand-off to the user, once per configured (non-skipped) mode:**

> "**<Mode name>** — please open both URLs, hard-refresh each, and verify G1–G7.
> Preview: `<mode's url var>` | Comparison: `<mode's comparison var>`
> Report back: 'preview pass' or describe what failed."

If both modes are configured, send both hand-offs (either together or in sequence) and wait for the user's response(s) before recording results.

**User: visual verification (manual)** — same checklist for every mode:

| Check                   | Pass condition                                                                |
|-------------------------|-------------------------------------------------------------------------------|
| G1 Comparison loads     | Stage baseline route renders without errors                                   |
| G2 Preview loads        | Preview route shows content — no blank page, no stuck spinner                 |
| G3 Same widgets visible | Every widget on comparison is also on preview                                 |
| G4 No fatal errors      | No `overrideRouterOutlet`, `__destroyRef`, `NG0201`, unresolved module errors |
| G5 No extra errors      | Preview has no console errors absent from comparison                          |
| G6 Interactions match   | Autocomplete, dropdowns, pickers, modals all behave the same as comparison    |
| G7 Data renders         | Same data/UI state as comparison (excluding live-data freshness)              |

G4 is the only check the AI can verify from build/deploy logs. G1–G3 and G5–G7 require human eyes. See [`checklist.md`](checklist.md) preview section for extended checks E1–E13 — also mode-generic, run for each configured mode.

**Fix loop (after user reports a failure in either mode):**

Diagnose which check failed and which repo owns the code causing it. Fix the source there first — do not re-run the build before the source is corrected. Because both modes view the same underlying build, **re-verify every other already-passed mode too** after a fix, not just the one that surfaced the failure.

local-angular-build step reference: 1=Maven build, 2b=ng-runtime bundles, 3=build ng-codegen, 4=generate Angular app, 5=install+build generated app, 6=deploy WAR to Tomcat, 7=copy Angular dist.

| Fix needed in | Re-run |
|---------------|--------|
| ng-runtime | Step 7 → local-angular-build: 2b → 3 → 4 → 5 → 7 |
| ng-codegen | `sh build.sh` in codegen → local-angular-build: 3 → 4 → 5 → 7 |
| Both repos | Step 7 → local-angular-build: 2b → 3 → 4 → 5 → 7 |
| Maven/backend only | local-angular-build: 1 → 6 → 7 |
| Locale/bundle only | local-angular-build: 2b → 3 → 4 → 5 → 7 |

Deferrals block Step 10 unless explicitly accepted by the user.

**Done when:** user confirms G1–G7 pass for **every configured (non-skipped) mode**.

---

### Step 10 — Finalize & Reset

Write `docs/{major}-upgrade.md` covering: Angular versions, date, branch names, references reviewed, package changes in both repos, breaking changes fixed, preview validation result, deferred items.

Confirm `docs/upgrade-log/{base}-to-{target}.md` exists and has an entry for every §N row edited during this run (Step 2/6). If no existing §N row was ever edited (only new §N entries were added), the file may not exist — that's fine, don't create an empty one.

```bash
sh scripts/reset-state.sh
```

Tell the user: _"Angular {target} upgrade complete. Upgrade doc: `docs/{major}-upgrade.md`."_ See [`templates.md`](templates.md) for the canonical completion message.

**Post-merge checklist (share with user):**
- [ ] Merge both `ng-runtime` and `ng-codegen` branches (coordinated — same PR window or back-to-back)
- [ ] Update `repo.config.sh`: set `ANGULAR_BASE_VERSION` to the target just shipped and `ANGULAR_TARGET_VERSION` to the next major — so the next upgrade starts with correct defaults
- [ ] If Node.js version changed: update CI pipeline node version (`.github/workflows/`, `Jenkinsfile`, or equivalent)
- [ ] If Node.js version changed: notify any dependent packages/consumers to align `engines.node`
- [ ] Share `docs/{major}-upgrade.md` with the team (PR description or channel)

**Done when:** upgrade doc written; `current-state.md` reset; todos cleared.
