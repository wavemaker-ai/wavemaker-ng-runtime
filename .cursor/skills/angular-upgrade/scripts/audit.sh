#!/bin/sh
# Security gate (Step 5): audit → audit fix (no --force) → audit again.
# Usage: sh scripts/audit.sh [-- extra args for npm audit only]

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

run_audit() {
  # npm audit exits 1 when vulnerabilities are listed — not a script failure.
  npm audit "$@" || {
    audit_ec=$?
    if [ "$audit_ec" -gt 1 ]; then
      exit "$audit_ec"
    fi
  }
}

AUDIT_ARGS=""
if [ "$1" = "--" ]; then
  shift
  AUDIT_ARGS="$*"
fi

echo "=== npm audit (1/3) (repo: $REPO_ROOT) ==="
# shellcheck disable=SC2086
run_audit $AUDIT_ARGS

echo ""
echo "=== npm audit fix (2/3, no --force) (repo: $REPO_ROOT) ==="
npm audit fix || {
  fix_ec=$?
  if [ "$fix_ec" -gt 1 ]; then
    exit "$fix_ec"
  fi
}

echo ""
echo "=== npm audit (3/3) (repo: $REPO_ROOT) ==="
# shellcheck disable=SC2086
run_audit $AUDIT_ARGS
