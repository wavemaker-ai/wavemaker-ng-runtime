#!/bin/sh
# Rollback: undo upgrade code changes in both repos using git checkout.
#
# Run this when abandoning a partially-applied upgrade. Steps 3 and 6 make
# git-tracked changes (package.json edits and source fixes); this script resets
# both repos to HEAD so you're back to a clean pre-upgrade state.
#
# Steps 4, 5, 7, 8 do not modify tracked files — no rollback needed for those.
# node_modules/ changes from Step 4 are NOT reversed by this script (re-install
# if you need to go back to the pre-upgrade node_modules).
#
# After running this script, also run:
#   sh .claude/skills/angular-upgrade/scripts/reset-state.sh
# to clear current-state.md.

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SKILL_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
REPO_ROOT="$(cd "$SKILL_DIR/../../.." && pwd)"

if [ ! -f "$SKILL_DIR/repo.config.sh" ]; then
  echo "error: missing $SKILL_DIR/repo.config.sh" >&2
  exit 1
fi

# shellcheck source=../repo.config.sh
. "$SKILL_DIR/repo.config.sh"

# --- ng-runtime ---
echo "=== Rolling back ng-runtime ($REPO_ROOT) ==="
cd "$REPO_ROOT"
changed=$(git diff --stat HEAD)
if [ -n "$changed" ]; then
  echo "$changed"
  git checkout -- .
  echo "  done — all uncommitted changes discarded"
else
  echo "  nothing to roll back (working tree is clean)"
fi

# --- ng-codegen ---
NG_CODEGEN_ABS="$(cd "$REPO_ROOT" && cd "$NG_CODEGEN_PATH" 2>/dev/null && pwd || echo "")"
if [ -z "$NG_CODEGEN_ABS" ] || [ ! -d "$NG_CODEGEN_ABS" ]; then
  echo ""
  echo "WARN: ng-codegen path not found ($NG_CODEGEN_PATH) — skipping codegen rollback" >&2
else
  echo ""
  echo "=== Rolling back ng-codegen ($NG_CODEGEN_ABS) ==="
  cd "$NG_CODEGEN_ABS"
  changed=$(git diff --stat HEAD)
  if [ -n "$changed" ]; then
    echo "$changed"
    git checkout -- .
    echo "  done — all uncommitted changes discarded"
  else
    echo "  nothing to roll back (working tree is clean)"
  fi
fi

echo ""
echo "Rollback complete. Next: sh .claude/skills/angular-upgrade/scripts/reset-state.sh"
