---
name: angular-upgrade
description: >-
  Runs a resumable WaveMaker Angular major-version upgrade across wavemaker-ng-runtime
  and wavemaker-ng-codegen: input gate, reference review, package bumps, security audit,
  dual-repo pattern fixes, build gate, local Tomcat preview, unit tests, and upgrade summary.
  Use when the user says Start Angular upgrade, Resume Angular upgrade, Angular upgrade,
  bump Angular major, or asks to upgrade wavemaker-ng-runtime to a new Angular version.
disable-model-invocation: true
---

# Angular upgrade

Resumable workflow: one Angular major per run. State in gitignored `current-state.md`. Summary in `docs/{major}-upgrade.md`. **When Step 10 finishes, reset `current-state.md` to start position** (see below).

## Quick start

1. Read [`inputs.md`](inputs.md) + [`repo.config.sh`](repo.config.sh). Do **not** install or build until `Inputs confirmed: yes`.
2. Create todos `step-0` … `step-10`. Sync with `current-state.md` after each step.
3. On `blocked`, post **Blocker alert** (see [`examples.md`](examples.md)) before other work.
4. Step 2: complete [`references.md`](references.md) checklist + **Dual-repo change plan**.
5. Step 6: apply plan in **ng-runtime** and **ng-codegen**; run `scripts/pattern-review.sh` after each repo’s edits.
6. Never patch `~/Desktop/local-*` or generated app `src/` — fix source repos and re-run codegen.

**Dual-repo:** sibling `../wavemaker-ng-codegen` (`NG_CODEGEN_PATH`). Same branch on both repos. Repo→path map: [`references.md`](references.md).

---

## Instructions

Copy progress into todos and `current-state.md` **Step status**:

```
- [ ] Step 0 — Upgrade gate
- [ ] Step 1 — Detect and inventory
- [ ] Step 2 — Plan upgrade path
- [ ] Step 3 — Apply package upgrades
- [ ] Step 4 — Install
- [ ] Step 5 — Security gate
- [ ] Step 6 — Repo pattern review
- [ ] Step 7 — Build gate
- [ ] Step 8 — Local Tomcat validation
- [ ] Step 9 — Unit tests
- [ ] Step 10 — Finalize
```

| Step | Gate | Done when |
|------|------|-----------|
| 0 | Yes | Config confirmed; branches/path in `current-state.md`. See [`inputs.md`](inputs.md) **State reset** rules. |
| 1 | Yes | Pattern paths resolve; Angular ≈ `ANGULAR_BASE_VERSION`. |
| 2 | Yes | [`references.md`](references.md) R1–R4,R6–R12 reviewed; **Dual-repo change plan** filled. Block if R1,R2,R3,R8,R12 missing. |
| 3 | Yes | `package.json` edited per repo plan; **no install**. |
| 4 | Yes | `scripts/install.sh` exit 0. |
| 5 | Yes | `scripts/audit.sh`; block critical/high. Re-install if lockfile changed. |
| 6 | Yes | Plan applied in both repos; `pattern-review.sh` pass; no open `must-change`. See [`wavemaker-runtime-patterns.md`](wavemaker-runtime-patterns.md). |
| 7 | Yes | Full `BUILD_CMD` (+ post-build verify if enabled). Step 8 uses `RUNTIME_BUNDLE_CMD` only. |
| 8 | Yes | Skip if preview empty/`skip`; else [`local-angular-build.md`](../../commands/local-angular-build.md) upgrade mode + patterns § Preview validation. |
| 9 | Optional | Skip if tests off or `TEST_CMD` empty. |
| 10 | Yes | `docs/{major}-upgrade.md` complete; then **reset `current-state.md`** to start position. |

**Resume:** First step not `done`. Never skip `blocked` without user clearing. Re-read `repo.config.sh` before Step 7. **Do not resume** a completed round — Step 10 reset clears in-progress state; next run always begins at Step 0.

### State reset (required)

**When Step 10 gate passes**, immediately after the upgrade summary doc is written:

1. Tell the user the run is complete and where `docs/{major}-upgrade.md` was written.
2. Run `sh .cursor/skills/angular-upgrade/scripts/reset-state.sh` — start position for the next major bump.
3. Cancel or clear todos `step-0` … `step-10` (none in progress).

**Step 0 also resets** (same start position) when opening an existing `current-state.md` and any of:

- User says **Start Angular upgrade** (not resume)
- Stored base/target ≠ effective base/target from message or `repo.config.sh`
- Step 10 is still `done` in the file (e.g. reset was skipped in a prior session)

**Resume** keeps `current-state.md` only while a run is **in progress** (Step 10 not `done`, base/target unchanged).

### Step 6 — dual-repo edits

| Repo | Edit | Rebuild when |
|------|------|--------------|
| ng-runtime | `projects/`, `tsconfig*.json`, transpiler, patches, `angular-app/dependencies/` | Transpiler or `tsconfig.web-app.json` changes |
| ng-codegen | `templates/`, `src/` only — never `dist/` | `sh build.sh` in codegen |

Record edits in **Cross-repo changes**. Run manual greps from patterns §1–§19.

### Step 8 — fix loop

| Fix in | Re-run |
|--------|--------|
| ng-runtime | Step 7 → local 2b→3→4→5→7 |
| ng-codegen | local 3→4→5→7 |
| Both | Step 7 → local 2b→3→4→5→7 |
| Maven/backend only | local 1→6→7 (skip 1 if WAR exists) |
| Locale/bundle only | local 2b→3→4→5→7 |

Deferral → **Deferred / user decisions**. Block Step 10 if Step 8 blocked without deferral.

---

## Utility scripts

Run from repo root:

```bash
sh .cursor/skills/angular-upgrade/scripts/install.sh          # Step 4
sh .cursor/skills/angular-upgrade/scripts/audit.sh            # Step 5
sh .cursor/skills/angular-upgrade/scripts/pattern-review.sh  # Step 6 — after each repo’s edits
UPGRADE_BUILD_CMD="$BUILD_CMD" UPGRADE_BUNDLE_VERIFY=yes \
  sh .cursor/skills/angular-upgrade/scripts/build.sh          # Step 7 full
sh .cursor/skills/angular-upgrade/scripts/build.sh --incremental  # mid-upgrade only
sh .cursor/skills/angular-upgrade/scripts/test.sh             # Step 9
sh .cursor/skills/angular-upgrade/scripts/reset-state.sh     # Step 10 done / Step 0 fresh Start
```

Config source: [`repo.config.sh`](repo.config.sh) (sourced by scripts).

---

## Additional resources

| File | Read when |
|------|-----------|
| [`inputs.md`](inputs.md) | Step 0 parsing; who collects inputs |
| [`examples.md`](examples.md) | Canonical Start/Resume messages |
| [`references.md`](references.md) | Step 2 external links + dual-repo map |
| [`wavemaker-runtime-patterns.md`](wavemaker-runtime-patterns.md) | Step 6 greps; Step 8 preview checklist |
| [`current-state.example.md`](current-state.example.md) | Template for session state |
| [`../../commands/local-angular-build.md`](../../commands/local-angular-build.md) | Step 8 Tomcat workflow |

**Port skill:** Copy `.cursor/skills/angular-upgrade/`; edit `repo.config.sh` (`ANGULAR_*`, URLs, `BUILD_CMD`, `PATTERNS_FILE`).

**Session recap:** Todo state; blocker if any; steps done/next; build, verify, preview, test results.
