#!/bin/sh
# Reset current-state.md to start position (Step 10 done or Step 0 fresh Start).
# Usage: sh .claude/skills/angular-upgrade/scripts/reset-state.sh

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SKILL_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
REPO_ROOT="$(cd "$SKILL_DIR/../../.." && pwd)"
TEMPLATE="$SKILL_DIR/state.md"
TARGET="$SKILL_DIR/current-state.md"

if [ ! -f "$TEMPLATE" ]; then
  echo "error: missing template $TEMPLATE" >&2
  exit 1
fi

cp "$TEMPLATE" "$TARGET"
echo "OK: reset $TARGET from state.md (start position)"
