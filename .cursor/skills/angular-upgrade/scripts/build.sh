#!/bin/sh
# Build gate (Step 7). Commands from repo.config.sh.
#
# Usage:
#   sh scripts/build.sh       # BUILD_CMD (incremental)
#   sh scripts/build.sh -f    # BUILD_CMD_FULL (recommended after Angular upgrade)

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SKILL_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
REPO_ROOT="$(cd "$SKILL_DIR/../../.." && pwd)"

if [ ! -f "$REPO_ROOT/package.json" ]; then
  echo "error: expected package.json at repo root: $REPO_ROOT" >&2
  exit 1
fi

if [ ! -f "$SKILL_DIR/repo.config.sh" ]; then
  echo "error: missing $SKILL_DIR/repo.config.sh (copy from repo.config.example.sh)" >&2
  exit 1
fi

# shellcheck source=../repo.config.sh
. "$SKILL_DIR/repo.config.sh"
cd "$REPO_ROOT"

USE_FULL=false
EXTRA_ARGS=""
for arg in "$@"; do
  case "$arg" in
    -f|--full|--force) USE_FULL=true ;;
    *) EXTRA_ARGS="$EXTRA_ARGS $arg" ;;
  esac
done

if [ "$USE_FULL" = true ]; then
  echo "=== $BUILD_CMD_FULL (repo: $REPO_ROOT) ==="
  [ -n "$REPO_BUILD_NOTE" ] && echo "    $REPO_BUILD_NOTE"
  # shellcheck disable=SC2086
  eval "$BUILD_CMD_FULL" $EXTRA_ARGS
else
  echo "=== $BUILD_CMD (repo: $REPO_ROOT) ==="
  [ -n "$REPO_BUILD_NOTE" ] && echo "    $REPO_BUILD_NOTE"
  # shellcheck disable=SC2086
  eval "$BUILD_CMD" $EXTRA_ARGS
fi

if [ -n "$POST_BUILD_VERIFY_SCRIPT" ] && [ -f "$SCRIPT_DIR/$POST_BUILD_VERIFY_SCRIPT" ]; then
  echo ""
  echo "=== post-build verify: $POST_BUILD_VERIFY_SCRIPT ==="
  sh "$SCRIPT_DIR/$POST_BUILD_VERIFY_SCRIPT"
fi
