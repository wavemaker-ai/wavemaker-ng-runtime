# Repo-specific settings for the angular-upgrade skill.
# User inputs: inputs.md. Workflow: SKILL.md. Browser pass/fail: wavemaker-runtime-patterns.md § Preview validation.
#
# ANGULAR_*     — major versions (Step 0 / inputs.md)
# PREVIEW_*     — Step 8 local Tomcat URL; empty or skip → Step 8 skipped
# COMPARISON_*  — stage baseline; required when preview runs
# NG_CODEGEN_PATH — sibling codegen repo (Step 6 §20, Step 8 codegen)
# LOCAL_BUILD_DOC — path to local-angular-build command
# BUILD_CMD     — full rebuild; Step 7 only (not Step 8)
# RUNTIME_BUNDLE_CMD — locale + CLI bundles; Step 8 Step 2b only
# BUILD_CMD_INCREMENTAL — optional mid-upgrade check (scripts/build.sh --incremental)
# POST_BUILD_VERIFY_* / DEFAULT_RUN_BUNDLE_VERIFY — Step 7 ngx-bootstrap verify
# TEST_CMD / DEFAULT_RUN_TESTS — Step 9 unit tests
# PATTERNS_FILE — comma-separated pattern markdown paths (Step 6)
# UPGRADE_DOC_PATH — Step 10 summary doc (docs/{major}-upgrade.md)

# --- Angular version range (defaults — user may override in Start message) ---
ANGULAR_BASE_VERSION="20"
ANGULAR_TARGET_VERSION="21"

# --- Local Tomcat validation (Step 8 defaults) ---
PREVIEW_URL="http://localhost:8080/SearchWidgetScenarios/#/LiveForm_Autocomplete"
COMPARISON_URL="https://stage-platform.wavemaker.ai/run-jlqb2h631c/SearchWidgetScenarios_master/#/Main"

NG_CODEGEN_PATH="../wavemaker-ng-codegen"
LOCAL_BUILD_DOC=".cursor/commands/local-angular-build.md"

INSTALL_CMD="npm install"
BUILD_CMD="sh build.sh -f"
RUNTIME_BUNDLE_CMD="sh build.sh --locale && sh bundle-runtime-cli.sh && sh bundle-angular-app-cli.sh"
BUILD_CMD_INCREMENTAL="sh build.sh"

POST_BUILD_VERIFY_SCRIPT="verify-ngx-bootstrap-bundle.sh"
DEFAULT_RUN_BUNDLE_VERIFY=yes

TEST_CMD="npm test"
DEFAULT_RUN_TESTS=yes

PATTERNS_FILE="wavemaker-runtime-patterns.md"
UPGRADE_DOC_PATH="docs/{major}-upgrade.md"
