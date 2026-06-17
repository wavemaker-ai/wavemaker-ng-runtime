# User inputs (single source of truth)

Defaults live in **`repo.config.sh`**. User overrides come from the chat message. **Chat overrides always win** over repo.config. Agent prints **effective config**, waits for **`confirm`** or **`proceed with defaults`**, then runs.

**Who collects inputs:**

| Invoke | Collector |
|--------|-----------|
| `@.cursor/skills/angular-upgrade` | Upgrade **Step 0** only |
| `@.cursor/commands/local-angular-build` standalone | **This command** only |
| Upgrade **Step 8** (local build) | **No re-prompt** — read `current-state.md` |

---

## Parsing (upgrade + standalone)

| Input | Phrases | Default |
|-------|---------|---------|
| Base version | `base version <N>` | `ANGULAR_BASE_VERSION` |
| Target version | `target version <N>` | `ANGULAR_TARGET_VERSION` |
| Preview URL | `preview url <url>` | `PREVIEW_URL` |
| Comparison URL | `comparison url <url>` | `COMPARISON_URL` |
| Skip Tomcat/browser | `skip preview yes`, `skip step 8`, `skip tomcat` | `no` when URLs set |
| Run Tomcat/browser | `skip preview no` | default |
| Skip unit tests | `skip tests yes` / `no` | `DEFAULT_RUN_TESTS` |
| Skip bundle verify | `skip verify yes` / `no` | `DEFAULT_RUN_BUNDLE_VERIFY` |
| Project name (standalone) | `project name <Name>` | `PROJECT_NAME` in local-angular-build |
| Confirm defaults | `confirm`, `proceed with defaults` | after agent shows table |

`skip preview yes` → effective `PREVIEW_URL=skip` (comparison URL not required).

**Version overrides:** If the Start message sets `base version` / `target version` different from `repo.config.sh`, those values are **effective** for the run. Record under **Step 0 overrides** in `current-state.md`. Fresh Start with version mismatch resets `current-state.md` even on “resume”.

**Project name (standalone):** `project name Foo` sets `PROJECT_NAME=Foo` and derives paths (do not hand-edit each path):

| Variable | Formula |
|----------|---------|
| `PROJECT_WAR` | `$HOME/Desktop/${PROJECT_NAME}.war` |
| `PROJECT_ZIP` | `$HOME/Desktop/${PROJECT_NAME}.zip` |
| `UNZIPPED_PROJECT_PATH` | `$HOME/Desktop/${PROJECT_NAME}` |
| `TEMP_FOLDER` | `$HOME/Desktop/local-${PROJECT_NAME}` — **output only**; never hand-edit |
| `GENERATED_APP` | `$HOME/Desktop/local-${PROJECT_NAME}/${PROJECT_NAME}` — codegen target; never hand-edit `src/` |
| `TOMCAT_APP` | `${TOMCAT_WEBAPPS}/${PROJECT_NAME}` |
| `APP_URL` | `http://localhost:${TOMCAT_PORT}/${PROJECT_NAME}/` |

Update **preview/comparison URLs** when the project name changes (e.g. `http://localhost:8080/Foo/#/...`).

**No Desktop local-folder edits:** `~/Desktop/local-${PROJECT_NAME}/` (e.g. `local-SearchWidgetScenarios`) is ephemeral codegen output. Agents must not patch files there — only regenerate (Step 4), `npm i`, build, and deploy `dist/`.

**Browser comparison note:** preview and comparison URLs may be **different routes** (e.g. local `#/LiveForm_Autocomplete` vs stage `#/Main`). Stage URL is a **health baseline**; preview URL is the **primary pass/fail** target.

---

## Upgrade — canonical Start message

```text
Start Angular upgrade.

base version 20
target version 21
preview url http://localhost:8080/SearchWidgetScenarios/#/LiveForm_Autocomplete
comparison url https://stage-platform.wavemaker.ai/run-jlqb2h631c/SearchWidgetScenarios_master/#/Main
skip preview no
skip tests no
skip verify no
```

### Upgrade Step 0 workflow

1. Read `repo.config.sh`.
2. Parse user message (table above); chat overrides win.
3. Print effective config (all rows).
4. Block Steps 1–10 until full Start message **or** `confirm` / `proceed with defaults`.
5. Write `current-state.md`; set `Inputs confirmed: yes`.

Bare `Start Angular upgrade` → show this file + defaults → **stop** until confirm.

---

## Standalone local build — canonical message

```text
@.cursor/commands/local-angular-build

project name SearchWidgetScenarios
preview url http://localhost:8080/SearchWidgetScenarios/#/LiveForm_Autocomplete
comparison url https://stage-platform.wavemaker.ai/run-jlqb2h631c/SearchWidgetScenarios_master/#/Main
skip preview no
```

### Standalone workflow

1. Read `repo.config.sh` + path formulas in `local-angular-build.md` Configuration.
2. Parse user message; derive `PROJECT_*` from `project name`; re-export URL overrides.
3. Print effective config; block until confirm.
4. Run prerequisites + Steps 1–7 + browser verify (skip Maven Step 1 when WAR + Tomcat app exist).

**Upgrade Step 8:** skip this gate; use `current-state.md` from upgrade Step 0.
