# Repo defaults — sourced by scripts/*.sh
# Skill layout: SKILL.md | templates.md | research.md | checklist.md (meta) | patterns/runtime.md (§1–§19) | patterns/codegen.md (§20)
#
# PORTING TO ANOTHER REPO: edit this file + pattern files.
# The pattern files (patterns/runtime.md, patterns/codegen.md, checklist.md) are
# ng-runtime/ng-codegen-specific — file paths, WMS tickets, and commit refs will not apply to
# other repos. Replace or supplement §1–§20 with patterns relevant to your codebase.
# Step 0:  ANGULAR_* (overridable in chat)
# Step 9:  VALIDATION_MODES + each mode's <urlVar>/<comparisonVar> — a mode is
#          skipped if its urlVar is empty or "skip"; Step 9 as a whole is
#          skipped only when every configured mode is skipped
# Step 6:  NG_CODEGEN_PATH, PATTERNS_FILE
# Step 7:  BUILD_CMD, POST_BUILD_VERIFY_*, DEFAULT_RUN_BUNDLE_VERIFY
# Step 9:  RUNTIME_BUNDLE_CMD (locale + CLI bundles only), LOCAL_BUILD_DOC
# Step 8:  TEST_CMD, DEFAULT_RUN_TESTS
# Step 10: UPGRADE_DOC_PATH

# --- Angular version range (defaults — user may override in Start message) ---
# STATUS: fresh run on stage-classic (branch was previously on Angular 18.2.13,
# never run through this skill). Skill folder + docs/patterns ported over from
# branch WMS-32451, which independently carried a different code history all
# the way to Angular 22/23 — that branch's package/code changes were NOT
# brought over, only the skill machinery and reference docs (patterns/runtime.md,
# patterns/codegen.md, checklist.md, docs/21-upgrade.md, docs/22-upgrade.md,
# docs/upgrade-log/*). First hop of this run: 18 -> 19.
ANGULAR_BASE_VERSION="18"
ANGULAR_TARGET_VERSION="19"

# --- Node.js version pin (R11 — set per upgrade; drives engines.node in Step 3) ---
# Scripts source this and, if nvm is available, auto-activate this exact version
# before running install/build/audit/test/pattern-review — the active `node` in a
# fresh shell is whatever this machine's PATH snapshot points to (not necessarily
# this pin), and `nvm use` from a prior command does not persist to the next one.
# Update this whenever Step 2/R11 picks a different Node version for the target
# Angular major. If unset, scripts skip activation and use whatever `node` is on PATH.
NODE_VERSION="22.18.0"

# --- Validation modes (Step 9) ---
# Space-separated list of "key:urlVar:comparisonVar" triples. Each urlVar/
# comparisonVar named here MUST be defined below. comparisonVar may hold
# multiple comma-separated URLs (Step 9 validates the mode's URL against each
# in turn). A mode with an empty or "skip" urlVar is skipped independently of
# every other mode.
#
# To add a new mode: add one "key:urlVar:comparisonVar" entry here, define its
# two URL vars below, and — only if it needs its own automated build/deploy
# step (unlike wavemaker_preview, whose URL is supplied directly) — add a short
# subsection to SKILL.md Step 9 describing how to produce it. Nothing else in
# the skill needs to change; Step 9's skip logic, gate table (G1-G7/E1-E13),
# fix loop, and "done when" criterion are all mode-generic already.
VALIDATION_MODES="angular_deployment:LOCAL_DEPLOYMENT_URL:WAVEMAKER_DEPLOYMENT_URL wavemaker_preview:LOCAL_PREVIEW_URL:WAVEMAKER_PREVIEW_URL"

# --- Project used by local-angular-build.md (Studio export name; must match
# the project segment in the URLs below) ---
PROJECT_NAME="NestedWidgets"

# --- Angular Deployment (Tomcat) validation — built/deployed by
# local-angular-build.md; see LOCAL_BUILD_DOC below ---
LOCAL_DEPLOYMENT_URL="http://localhost:8080/NestedWidgets/#/Main"
# WAVEMAKER_DEPLOYMENT_URL: the WMTheme value inherited from the ported skill (WMS-32451)
# does not apply to NestedWidgets — needs a real comparison URL from the user before Step 9's
# browser verify can run for this mode. Left as "skip" until supplied.
WAVEMAKER_DEPLOYMENT_URL="skip"

# --- WaveMaker Preview validation — supplied directly (like the pair above);
# not built by this skill's automation. Leave empty to skip this mode. ---
# Same issue: WMTheme-specific URLs inherited from the ported skill, not valid for
# NestedWidgets. Left as "skip" until the user supplies real URLs for this project.
LOCAL_PREVIEW_URL="skip"
WAVEMAKER_PREVIEW_URL="skip"

NG_CODEGEN_PATH="../wavemaker-ng-codegen"
LOCAL_BUILD_DOC="../../commands/local-angular-build.md"

INSTALL_CMD="npm install"
BUILD_CMD="sh build.sh -f"
RUNTIME_BUNDLE_CMD="sh build.sh --locale && sh bundle-runtime-cli.sh && sh bundle-angular-app-cli.sh"
BUILD_CMD_INCREMENTAL="sh build.sh"

POST_BUILD_VERIFY_SCRIPT="verify-ngx-bootstrap-bundle.sh"
DEFAULT_RUN_BUNDLE_VERIFY=yes

TEST_CMD="npm test"
DEFAULT_RUN_TESTS=yes

PATTERNS_FILE="checklist.md"
UPGRADE_DOC_PATH="docs/{major}-upgrade.md"
