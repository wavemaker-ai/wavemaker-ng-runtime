#!/bin/sh
# Install dependencies (Step 4). Command from repo.config.sh INSTALL_CMD.

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SKILL_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
REPO_ROOT="$(cd "$SKILL_DIR/../../.." && pwd)"

if [ ! -f "$REPO_ROOT/package.json" ]; then
  echo "error: expected package.json at repo root: $REPO_ROOT" >&2
  exit 1
fi

if [ ! -f "$SKILL_DIR/repo.config.sh" ]; then
  echo "error: missing $SKILL_DIR/repo.config.sh" >&2
  exit 1
fi

# shellcheck source=../repo.config.sh
. "$SKILL_DIR/repo.config.sh"
cd "$REPO_ROOT"

echo "=== $INSTALL_CMD (repo: $REPO_ROOT) ==="
# shellcheck disable=SC2086
eval "$INSTALL_CMD"
