# Repo-specific settings for the angular-upgrade skill.
# When copying this skill to another repository, edit ONLY this file and PATTERNS_FILE.
# Scripts under scripts/ load this file directly (inline repo-root resolution).

# Install (Step 4)
INSTALL_CMD="npm install"

# Build (Step 7) — full rebuild recommended after every major Angular bump
BUILD_CMD="sh build.sh"
BUILD_CMD_FULL="sh build.sh -f"

# Unit tests (Step 9) — mandatory gate
TEST_CMD="npm test"

# Optional post-build check — script name in scripts/ (empty to disable)
POST_BUILD_VERIFY_SCRIPT="verify-ngx-bootstrap-bundle.sh"

# Repo-specific pattern catalog and preview checklist (Step 6 / 8)
PATTERNS_FILE="wavemaker-patterns.md"

# Step 10: upgrade summary doc at repo root ({major} = target Angular major, e.g. 21)
UPGRADE_DOC_PATH="docs/{major}-upgrade.md"

# Agent hint when build/test commands differ from package.json scripts
REPO_BUILD_NOTE="Platform build is sh build.sh -f, not npm run build. See wavemaker-patterns.md."
