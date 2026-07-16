#!/bin/sh
# Step 0 pre-flight check — verifies:
#   1. Both repos have no uncommitted changes (dirty files obscure upgrade vs pre-existing changes)
#   2. current-state.md is gitignored (prevents accidental commit of session state with URLs)
#
# Exit codes: 0 = all checks pass; 1 = one or more checks failed
#
# Usage: sh .claude/skills/angular-upgrade/scripts/preflight.sh

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SKILL_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
REPO_ROOT="$(cd "$SKILL_DIR/../../.." && pwd)"

# shellcheck source=../repo.config.sh
. "$SKILL_DIR/repo.config.sh"

DIRTY=0

# ─── current-state.md gitignore ──────────────────────────────────────────────
CS_REL=".claude/skills/angular-upgrade/current-state.md"
GITIGNORE="$REPO_ROOT/.gitignore"
if grep -qF "$CS_REL" "$GITIGNORE" 2>/dev/null; then
  # Entry is in .gitignore — but git ignores .gitignore for already-tracked files.
  # If the file is tracked, changes will still be staged and committed.
  if git -C "$REPO_ROOT" ls-files --cached -- "$CS_REL" | grep -q .; then
    echo "WARN   current-state.md is in .gitignore but still tracked by git"
    echo "       Run: git rm --cached $CS_REL"
    echo "       Then commit the removal so the file is no longer tracked."
    DIRTY=1
  else
    echo "CLEAN  current-state.md is gitignored and not tracked"
  fi
else
  echo "FIX    current-state.md is not in .gitignore — adding to $GITIGNORE"
  printf '\n# angular-upgrade session state (template: .claude/skills/angular-upgrade/state.md)\n%s\n' \
    "$CS_REL" >> "$GITIGNORE"
  echo "       Added. Commit .gitignore before proceeding."
fi

# ─── ng-runtime ──────────────────────────────────────────────────────────────
RT_STATUS="$(git -C "$REPO_ROOT" status --porcelain 2>/dev/null)"
if [ -n "$RT_STATUS" ]; then
  echo "DIRTY  ng-runtime ($REPO_ROOT):"
  echo "$RT_STATUS" | sed 's/^/         /'
  DIRTY=1
else
  echo "CLEAN  ng-runtime"
fi

# ─── ng-codegen ──────────────────────────────────────────────────────────────
CG_PATH="$(cd "$REPO_ROOT/$NG_CODEGEN_PATH" 2>/dev/null && pwd)"
if [ -z "$CG_PATH" ]; then
  echo "WARN   ng-codegen path not found: $NG_CODEGEN_PATH (skipping check)"
else
  CG_STATUS="$(git -C "$CG_PATH" status --porcelain 2>/dev/null)"
  if [ -n "$CG_STATUS" ]; then
    echo "DIRTY  ng-codegen ($CG_PATH):"
    echo "$CG_STATUS" | sed 's/^/         /'
    DIRTY=1
  else
    echo "CLEAN  ng-codegen"
  fi
fi

# ─── Result ──────────────────────────────────────────────────────────────────
if [ "$DIRTY" -ne 0 ]; then
  echo ""
  echo "Pre-flight FAILED — uncommitted changes found."
  echo "Options:"
  echo "  1. Commit or stash the changes, then re-run Step 0."
  echo "  2. Type 'proceed with uncommitted changes' to skip this check."
  echo "     (Use only if the dirty files are unrelated to the Angular upgrade.)"
  exit 1
fi

echo ""
echo "Pre-flight PASSED — both repos are clean."
exit 0
