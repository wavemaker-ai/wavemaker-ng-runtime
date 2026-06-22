# User inputs

Defaults: [`repo.config.sh`](repo.config.sh). Chat overrides win. Print effective config → wait for **`confirm`** or **`proceed with defaults`**.

Canonical messages: [`examples.md`](examples.md).

| Invoke | Who collects |
|--------|--------------|
| `@.cursor/skills/angular-upgrade` | Step 0 only |
| `@.cursor/commands/local-angular-build` | That command only |
| Upgrade Step 8 | `current-state.md` — no re-prompt |

---

## Parsing

| Input | Phrases | Default |
|-------|---------|---------|
| Base / target version | `base version <N>`, `target version <N>` | `ANGULAR_*` |
| Preview / comparison URL | `preview url …`, `comparison url …` | `PREVIEW_*`, `COMPARISON_*` |
| Skip preview | `skip preview yes`, `skip step 8`, `skip tomcat` | no when URLs set |
| Skip tests / verify | `skip tests yes/no`, `skip verify yes/no` | `DEFAULT_RUN_*` |
| Project name (standalone) | `project name <Name>` | local-angular-build |
| Confirm | `confirm`, `proceed with defaults` | after config table |

`skip preview yes` → `PREVIEW_URL=skip`.

Version overrides → **Step 0 overrides** in `current-state.md`. Version mismatch on Start/Resume → reset to start position.

---

## State reset

See [`SKILL.md`](SKILL.md) § State reset. Step 10 or Step 0 Start → run:

```bash
sh .cursor/skills/angular-upgrade/scripts/reset-state.sh
```

---

## Step 0 workflow

1. If reset required (Step 10 `done`, user **Start**, or base/target mismatch) → `reset-state.sh`.
2. Read `repo.config.sh`.
3. Parse user message.
4. Print effective config.
5. Block Steps 1–10 until full Start message ([`examples.md`](examples.md)) or confirm.
6. Write `current-state.md`; set `Inputs confirmed: yes`.

---

## Standalone path formulas

Set `project name Foo`:

| Variable | Path |
|----------|------|
| `PROJECT_WAR` | `$HOME/Desktop/${PROJECT_NAME}.war` |
| `PROJECT_ZIP` | `$HOME/Desktop/${PROJECT_NAME}.zip` |
| `UNZIPPED_PROJECT_PATH` | `$HOME/Desktop/${PROJECT_NAME}` |
| `TEMP_FOLDER` | `$HOME/Desktop/local-${PROJECT_NAME}` — output only |
| `GENERATED_APP` | `$TEMP_FOLDER/${PROJECT_NAME}` — never edit `src/` |
| `TOMCAT_APP` | `${TOMCAT_WEBAPPS}/${PROJECT_NAME}` |

Never edit `~/Desktop/local-*`. Preview URL is primary pass/fail; comparison URL is stage baseline.
