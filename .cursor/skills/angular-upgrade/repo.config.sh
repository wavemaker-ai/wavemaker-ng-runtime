# Repo-specific settings for the angular-upgrade skill.
# Edit this file (and PATTERNS_FILE) when porting the skill or starting a new major bump.
# Step 0 reads versions and preview URLs from here only — not from user chat.
#
# --- Suggested chat prompt (attach skill: @.cursor/skills/angular-upgrade) ---
#
# Start or resume (default — all config from this file):
#   Start Angular upgrade. Follow SKILL.md: read repo.config.sh and current-state.md,
#   run Steps 0–10. Do not ask for Angular versions or preview URLs.
#
# With optional gate overrides (append one line):
#   … verify yes | verify no
#   … tests yes | tests no
#
# Resume after a blocker (same prompt — agent continues from first step not done):
#   Resume Angular upgrade. Follow SKILL.md from current-state.md.
#
# --- Steps 0–10 (workflow summary) ---
#
#  0  Upgrade gate          Read repo.config.sh; record versions, URLs, gates, overrides.
#                           Block if base/target empty; COMPARISON_URL required when PREVIEW_URL set.
#  1  Detect and inventory  package.json, lockfile, angular.json, tsconfig*, tests; resolve PATTERNS_FILE.
#                           Confirm installed Angular matches ANGULAR_BASE_VERSION.
#  2  Plan upgrade path     Read references.md + all pattern files; plan base → target bumps.
#  3  Apply package upgrades Edit package.json / overrides only — do not install yet.
#  4  Install               scripts/install.sh (INSTALL_CMD)
#  5  Security gate         scripts/audit.sh — block on critical/high; re-install if audit fix changed lockfile.
#  6  Repo pattern review   Run greps from pattern files; block on unresolved must-change.
#  7  Build gate            Full BUILD_CMD via scripts/build.sh — block on failure.
#                           Optional POST_BUILD_VERIFY_SCRIPT when verify=yes (DEFAULT_RUN_BUNDLE_VERIFY).
#                           scripts/build.sh --incremental allowed mid-fix; not enough to mark Step 7 done.
#  8  Preview validation    Optional — skip if PREVIEW_URL empty. Else same flows on COMPARISON_URL then PREVIEW_URL.
#  9  Unit tests            Optional — skip if tests=no/n/a or TEST_CMD empty. Else scripts/test.sh.
# 10  Finalize              Summarize in chat; write UPGRADE_DOC_PATH (e.g. docs/{major}-upgrade.md).
#                           Update current-state.md after every step; resume at first step not done.

# --- Angular version range (required) ---
# Major numbers only (e.g. 20, 21). One major bump per upgrade run.
ANGULAR_BASE_VERSION="20"
ANGULAR_TARGET_VERSION="21"

# --- Preview validation (Step 8) ---
# PREVIEW_URL: upgraded build URL. Empty or "skip" = skip Step 8.
# COMPARISON_URL: baseline on base Angular version. Required when PREVIEW_URL is set.
PREVIEW_URL=""
COMPARISON_URL=""

# Install (Step 4)
INSTALL_CMD="npm install"

# Full rebuild (Step 7 gate — required pass before marking Step 7 done)
BUILD_CMD="sh build.sh -f"

# Incremental build — use via scripts/build.sh --incremental when a faster rebuild is enough
BUILD_CMD_INCREMENTAL="sh build.sh"

# --- Optional gates (leave empty to disable a gate entirely) ---

# Post-build verify (Step 7). Script name under scripts/.
POST_BUILD_VERIFY_SCRIPT="verify-ngx-bootstrap-bundle.sh"
DEFAULT_RUN_BUNDLE_VERIFY=yes

# Unit tests (Step 9).
TEST_CMD="npm test"
DEFAULT_RUN_TESTS=yes

# Pattern catalog — comma-separated paths; user sets in repo.config.sh only.
# Relative paths: skill folder first, then repo root. Absolute paths OK.
# Example: PATTERNS_FILE="wavemaker-runtime-patterns.md"
# Example: PATTERNS_FILE="my-patterns.md,../other-repo/patterns.md"
PATTERNS_FILE="wavemaker-runtime-patterns.md"

# Step 10: upgrade summary doc ({major} = ANGULAR_TARGET_VERSION)
UPGRADE_DOC_PATH="docs/{major}-upgrade.md"
