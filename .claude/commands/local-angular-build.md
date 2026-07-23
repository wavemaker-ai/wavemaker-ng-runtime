---
description: Build wavemaker-ng-runtime + wavemaker-ng-codegen, generate an Angular app, and deploy it to local Tomcat for preview
---

# Local Angular Build & Tomcat Deploy

Run this workflow **step by step, in order**. Execute each step fully before moving to the next. Stop and report errors if any step fails.

**Scope note:** this workflow only ever produces the **Angular Deployment** validation target (Tomcat WAR + Angular dist). It has no automation for **WaveMaker Preview** — that mode's URL is supplied directly via `LOCAL_PREVIEW_URL`/`WAVEMAKER_PREVIEW_URL` in `repo.config.sh` (see angular-upgrade `SKILL.md` Step 9) and does not need this command to run at all. Both are first-class validation modes in Step 9; this file is the automation for exactly one of them.

## Invocation modes & who collects inputs

| Mode | Invoke | Inputs |
|------|--------|--------|
| **Standalone** | `/local-angular-build` | [`inputs.md`](../skills/angular-upgrade/inputs.md) — standalone gate |
| **Upgrade Step 9** | invoked from the `angular-upgrade` skill (Steps 0–7 done) | `current-state.md` only — **no re-prompt** |

| Mode | ng-runtime build | Steps to run | Browser verify |
|------|------------------|--------------|----------------|
| **Standalone** | Step **2a** — `build.sh --force` + bundles | **Input gate → prerequisites → 1–7** → Browser verify | Per standalone inputs |
| **Upgrade Step 9** | Step **2b** — `RUNTIME_BUNDLE_CMD` | **1, 2b, 3–7** → Browser verify (no input gate) | From `current-state.md` Step 0 |

**Shared rules:** never edit generated app source; fix `NG_RUNTIME` or `NG_CODEGEN` and re-run affected steps.

### Desktop folders — no hand-edits

| Path | Role | Agent may |
|------|------|-----------|
| `~/Desktop/${PROJECT_NAME}/` | Studio ZIP export (source for Maven + codegen) | Read; run Maven — **do not edit** project files |
| `~/Desktop/local-${PROJECT_NAME}/` | **Ephemeral codegen output** (e.g. `local-SearchWidgetScenarios`) | Regenerate via Step 4; `npm i` + build in `${GENERATED_APP}` only |
| `${GENERATED_APP}/` | Generated Angular app inside `local-*` | **Never** edit `src/`, `angular.json`, `app.config.ts`, `libraries/` |

All product fixes go in **`wavemaker-ng-runtime`** and **`wavemaker-ng-codegen`** only. Step 4 overwrites `${GENERATED_APP}`; Step 7 copies **`dist/`** to Tomcat — nothing under `~/Desktop/local-*` is committed or patched by hand.

---

## Standalone input gate

**Skip when running as upgrade Step 9.** Follow **Standalone workflow** in [`inputs.md`](../skills/angular-upgrade/inputs.md): show defaults, parse message, print effective config, block until `confirm` / `proceed with defaults`.

For upgrade, use the canonical Start message in [`examples.md`](../skills/angular-upgrade/examples.md) — Step 0 collects all URLs and flags.

## Configuration — edit these values

Set **`PROJECT_NAME`** (or `project name` in chat). Other `PROJECT_*` paths **derive from it** — keep the export block formulas in sync with this table.

| Variable | Value (derived from `PROJECT_NAME`) |
|---|---|
| `PROJECT_NAME` | `SearchWidgetScenarios` |
| `PROJECT_WAR` | `~/Desktop/${PROJECT_NAME}.war` |
| `PROJECT_ZIP` | `~/Desktop/${PROJECT_NAME}.zip` |
| `UNZIPPED_PROJECT_PATH` | `~/Desktop/${PROJECT_NAME}` |
| `TEMP_FOLDER` | `~/Desktop/local-${PROJECT_NAME}` |
| `GENERATED_APP` | `~/Desktop/local-${PROJECT_NAME}/${PROJECT_NAME}` |
| `NG_RUNTIME` | `.` (this repo — ng-runtime workspace root) |
| `NG_CODEGEN` | `${NG_CODEGEN_PATH:-../wavemaker-ng-codegen}` (from `repo.config.sh` when sourced) |
| `CODEGEN_APP` | `${NG_CODEGEN}/dist/codegen/codegen-app` |
| `YALC_VARIABLES` | `${NG_RUNTIME}/.yalc/@wavemaker/variables` |
| `APACHE_TOMCAT_PATH` | `${CATALINA_HOME:-$HOME/tomcat}` |
| `TOMCAT_WEBAPPS` | `${APACHE_TOMCAT_PATH}/webapps` |
| `TOMCAT_APP` | `${TOMCAT_WEBAPPS}/${PROJECT_NAME}` |
| `MAVEN_SETTINGS` | `~/.m2/settings-nexus.xml` |
| `NPM_REGISTRY` | `https://repository.wavemaker.com/repository/wavemaker-npm-repo/` |
| `TOMCAT_PORT` | `8080` |
| `APP_URL` | `http://localhost:${TOMCAT_PORT}/${PROJECT_NAME}/` |
| `LOCAL_DEPLOYMENT_URL` | from `repo.config.sh` or chat override (see `inputs.md`) |
| `WAVEMAKER_DEPLOYMENT_URL` | from `repo.config.sh` or chat override |

Tomcat is running locally on **port `${TOMCAT_PORT}`**.

`NG_RUNTIME` and `NG_CODEGEN` are relative to the **ng-runtime workspace root** (where this command is invoked).

Before running any step, export from the ng-runtime repo root (re-export in a new shell):

```bash
export NG_RUNTIME="."
SKILL_ROOT="${NG_RUNTIME}/.claude/skills/angular-upgrade"
[ -d "$SKILL_ROOT" ] || SKILL_ROOT="${NG_RUNTIME}/.cursor/skills/angular-upgrade"
# shellcheck source=/dev/null
. "${SKILL_ROOT}/repo.config.sh"

export PROJECT_NAME="${PROJECT_NAME:-SearchWidgetScenarios}"
export PROJECT_WAR="${PROJECT_WAR:-$HOME/Desktop/${PROJECT_NAME}.war}"
export PROJECT_ZIP="${PROJECT_ZIP:-$HOME/Desktop/${PROJECT_NAME}.zip}"
export UNZIPPED_PROJECT_PATH="${UNZIPPED_PROJECT_PATH:-$HOME/Desktop/${PROJECT_NAME}}"
export TEMP_FOLDER="${TEMP_FOLDER:-$HOME/Desktop/local-${PROJECT_NAME}}"
export GENERATED_APP="${GENERATED_APP:-$HOME/Desktop/local-${PROJECT_NAME}/${PROJECT_NAME}}"
export NG_CODEGEN="${NG_CODEGEN_PATH:-../wavemaker-ng-codegen}"
export CODEGEN_APP="${NG_CODEGEN}/dist/codegen/codegen-app"
export YALC_VARIABLES="${NG_RUNTIME}/.yalc/@wavemaker/variables"
# Tomcat: export CATALINA_HOME to your install libexec if not using ~/tomcat
export APACHE_TOMCAT_PATH="${CATALINA_HOME:-$HOME/tomcat}"
export TOMCAT_WEBAPPS="${APACHE_TOMCAT_PATH}/webapps"
export TOMCAT_APP="${TOMCAT_WEBAPPS}/${PROJECT_NAME}"
export MAVEN_SETTINGS="${MAVEN_SETTINGS:-$HOME/.m2/settings-nexus.xml}"
export NPM_REGISTRY=https://repository.wavemaker.com/repository/wavemaker-npm-repo/
export TOMCAT_PORT=8080
export APP_URL="http://localhost:${TOMCAT_PORT}/${PROJECT_NAME}/"
# LOCAL_DEPLOYMENT_URL / WAVEMAKER_DEPLOYMENT_URL come from repo.config.sh above.
# After input gate: re-export if chat overrides differ from repo.config defaults.
```

---

## Step 0 — Prerequisites (manual, if not already done)

1. In WaveMaker Studio, export **`${PROJECT_NAME}`** with the **deployment profile** as:
   - `${PROJECT_WAR}`
2. Export the same project as **ZIP** to:
   - `${PROJECT_ZIP}`
3. Unzip the project to:
   - `${UNZIPPED_PROJECT_PATH}`
4. Confirm Tomcat is running at `http://localhost:${TOMCAT_PORT}`.
5. Set **`CATALINA_HOME`** to your Tomcat `libexec` directory if not using the default `~/tomcat` fallback.

---

## Step 1 — Maven build (unzipped project backend)

**Skip when** `${PROJECT_WAR}` already exists and `${TOMCAT_APP}/` is deployed — use the existing WAR for Step 6 instead of rebuilding the backend (avoids Maven UI OOM on large projects). Re-run Step 1 only when the backend export changed.

```bash
cd "${UNZIPPED_PROJECT_PATH}"

npm_config_registry="${NPM_REGISTRY}" \
  mvn clean install -Pwavemaker-internal \
  --settings "${MAVEN_SETTINGS}"
```

---

## Step 2 — Build wavemaker-ng-runtime

`sh build.sh -f` / `sh build.sh --force` runs **once per upgrade** in angular-upgrade **Step 7**. Do not run it in both places.

### Step 2a — Full rebuild (standalone only)

Use when this command is invoked **directly**, not from angular-upgrade Step 9:

```bash
cd "${NG_RUNTIME}"

sh build.sh --force
sh build.sh --locale
sh bundle-runtime-cli.sh
sh bundle-angular-app-cli.sh
```

### Step 2b — Bundles only (angular-upgrade Step 9)

Use when angular-upgrade **Step 7** already passed (`BUILD_CMD` = `sh build.sh -f`):

```bash
cd "${NG_RUNTIME}"

# Do NOT run build.sh --force / build.sh -f here — Step 7 already did it.
# RUNTIME_BUNDLE_CMD from repo.config.sh (sourced in export block above)
eval "$RUNTIME_BUNDLE_CMD"
```

Run `sh build.sh --locale` if `bundle-angular-app-cli.sh` fails copying `dist/bundles/wmapp/locales`.

**Iteration after runtime source fix:** re-run angular-upgrade **Step 7** first, then Step **2b** (not 2a).

---

## Step 3 — Build wavemaker-ng-codegen

Codegen repo is beside ng-runtime:

```bash
cd "${NG_CODEGEN}"

sh build.sh
```

This produces `${CODEGEN_APP}` with `angular-app` and `codegen-app`.

---

## Step 4 — Generate Angular app (codegen)

**Overwrites** `${GENERATED_APP}` under `~/Desktop/local-${PROJECT_NAME}/`. Do not preserve or merge hand-edits in that tree — fix upstream repos and re-run codegen.

```bash
mkdir -p "${TEMP_FOLDER}"

cd "${CODEGEN_APP}"

node src/codegen-args-cli \
  -s "${UNZIPPED_PROJECT_PATH}" \
  -t "${GENERATED_APP}" \
  --codegenPath . \
  --spa true
```

Output app: `${GENERATED_APP}`

---

## Step 5 — Install deps & build generated Angular app

**Do not edit** anything under `~/Desktop/local-${PROJECT_NAME}/` except allowed commands below. No changes to `src/`, `angular.json`, `app.config.ts`, or `libraries/`. Fixes belong in `${NG_RUNTIME}` or `${NG_CODEGEN}`; Step 4 codegen refreshes `${GENERATED_APP}`.

```bash
cd "${GENERATED_APP}"

npm i
```

If `@wavemaker` packages are missing or stale, copy the variables folder:

```bash
cp -R "${YALC_VARIABLES}" "${GENERATED_APP}/node_modules/@wavemaker/variables"
```

Build (pick one):

```bash
# Development (debugging)
node ./build-scripts/build.js --c=development

# Production
node ./build-scripts/build.js --c=production
```

This creates `${GENERATED_APP}/dist/index.html` and `${GENERATED_APP}/dist/ng-bundle/`.

---

## Step 6 — Deploy WAR to Tomcat (backend)

Copy the WAR into Tomcat `webapps` (Tomcat auto-deploys/extracts on refresh):

```bash
cp "${PROJECT_WAR}" "${TOMCAT_WEBAPPS}/"
```

Wait for Tomcat to extract the WAR (check `${TOMCAT_APP}/` exists). Increase Tomcat heap if the deploy fails with OOM.

---

## Step 7 — Copy Angular dist into Tomcat webapp (frontend)

```bash
cp "${GENERATED_APP}/dist/index.html" "${TOMCAT_APP}/"
cp -R "${GENERATED_APP}/dist/ng-bundle" "${TOMCAT_APP}/"
```

---

## Browser verify (after Step 7 deploy)

**Standalone:** if effective `LOCAL_DEPLOYMENT_URL` is `skip` or empty, smoke-check `${APP_URL}` only and stop.

**With URLs:** load `${WAVEMAKER_DEPLOYMENT_URL}` then `${LOCAL_DEPLOYMENT_URL}` (or `${APP_URL}`). Pass/fail: **Preview validation checklist** in [`wavemaker-runtime-patterns.md`](../skills/angular-upgrade/wavemaker-runtime-patterns.md) (gate G1–G4 required; extended E1–E13 where applicable).

On failure: do not edit `~/Desktop/local-*` or generated app source. Fix `NG_RUNTIME` or `NG_CODEGEN`; re-run affected steps. **Upgrade:** `SKILL.md` Step 9 iteration table. **Standalone:** same matrix (runtime fix → 2a; codegen fix → 3→4→5→7; both → 2a→3→4→5→7).

---

## Agent instructions

### Detect mode

| Signal | Mode |
|--------|------|
| User invoked `/local-angular-build` only | **Standalone** |
| The `angular-upgrade` skill is running and upgrade Step 7 is `done` | **Upgrade Step 9** |

### Standalone

1. Run standalone gate per [`inputs.md`](../skills/angular-upgrade/inputs.md).
2. Source `repo.config.sh`; set `PROJECT_NAME` from chat if given; derive `PROJECT_*` paths per export block; re-export `LOCAL_DEPLOYMENT_URL` / `WAVEMAKER_DEPLOYMENT_URL` if chat overrides differ from repo.config.
3. Run the export block (Configuration table formulas).
4. Run **prerequisites** + Steps **1–7** (Step **2a**; skip Step 1 when WAR + Tomcat app already exist).
5. **Browser verify** per patterns § Preview validation checklist unless `skip preview yes`.

### Upgrade Step 9

1. **Do not** run standalone input gate.
2. Read `current-state.md` — require `Inputs confirmed: yes`; use effective preview/comparison/skip preview from upgrade Step 0.
3. Export variables (`PROJECT_NAME` + derived paths, effective URLs from current-state).
4. Run Steps **1, 2b, 3–7** only (skip Step 1 when WAR + Tomcat app already exist).
5. **Browser verify** per patterns § Preview validation checklist unless `skip preview yes`.

### Both modes

- Confirm `PROJECT_WAR`, `PROJECT_ZIP`, `UNZIPPED_PROJECT_PATH` exist before Maven (or skip Maven per Step 1 note).
- Long `block_until_ms` for Maven and `build.sh --force` (standalone 2a only).
- Never edit `~/Desktop/local-*` generated app source; fix upstream and re-run affected steps.

## Quick reference (all repos)

```
${NG_RUNTIME}/                  ← Step 2a (standalone) or 2b (upgrade Step 9)
${NG_CODEGEN}/                  ← Step 3 & 4
${CODEGEN_APP}/                 ← Step 4 (codegen CLI)

${PROJECT_WAR}                  ← Step 6
${PROJECT_ZIP}                  ← Step 0 (Studio ZIP export)
${UNZIPPED_PROJECT_PATH}/       ← Step 1 (unzipped export)
${GENERATED_APP}/               ← Step 4–5 (generated Angular app)
${TOMCAT_APP}/                  ← Step 6–7 (Tomcat deploy target)
```
