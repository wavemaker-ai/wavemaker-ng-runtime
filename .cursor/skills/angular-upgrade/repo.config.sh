# Repo defaults — sourced by scripts/*.sh
# Skill layout: SKILL.md (workflow) | inputs.md | examples.md | references.md | wavemaker-runtime-patterns.md
# Step 0:  ANGULAR_* (overridable in chat)
# Step 8:  PREVIEW_*, COMPARISON_* — empty or skip → Step 8 skipped
# Step 6:  NG_CODEGEN_PATH, PATTERNS_FILE
# Step 7:  BUILD_CMD, POST_BUILD_VERIFY_*, DEFAULT_RUN_BUNDLE_VERIFY
# Step 8:  RUNTIME_BUNDLE_CMD (locale + CLI bundles only), LOCAL_BUILD_DOC
# Step 9:  TEST_CMD, DEFAULT_RUN_TESTS
# Step 10: UPGRADE_DOC_PATH

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
