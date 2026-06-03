#!/bin/sh
# Unit test gate (Step 9). Optional per repo — runs when Step 0 and TEST_CMD are set.
# Command from repo.config.sh TEST_CMD.
# Usage: sh scripts/test.sh [-- <extra args passed to test runner>]

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

if [ -z "$TEST_CMD" ]; then
  echo "=== unit tests skipped — TEST_CMD not set in repo.config.sh ==="
  exit 0
fi

if [ "$1" = "--" ]; then
  shift
  echo "=== $TEST_CMD (repo: $REPO_ROOT) extra: $* ==="
  # shellcheck disable=SC2086
  eval "$TEST_CMD" -- "$@"
else
  echo "=== $TEST_CMD (repo: $REPO_ROOT) ==="
  # shellcheck disable=SC2086
  eval "$TEST_CMD"
fi
