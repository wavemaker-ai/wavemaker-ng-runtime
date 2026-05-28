# Example repo.config.sh — copy to repo.config.sh and edit for your repository.

INSTALL_CMD="npm install"
# or: INSTALL_CMD="npm ci"

BUILD_CMD="npm run build"
BUILD_CMD_FULL="npm run build -- --configuration production"

TEST_CMD="npm test"

# Optional: script filename under scripts/ (leave empty if not used)
POST_BUILD_VERIFY_SCRIPT=""

# Rename to match your patterns doc (this repo uses wavemaker-patterns.md)
PATTERNS_FILE="your-patterns.md"

# Step 10 output: docs/21-upgrade.md, docs/22-upgrade.md, etc.
UPGRADE_DOC_PATH="docs/{major}-upgrade.md"

REPO_BUILD_NOTE=""
