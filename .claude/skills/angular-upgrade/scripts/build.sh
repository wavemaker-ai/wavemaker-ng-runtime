#!/bin/sh
# Build gate (Step 7). Command from UPGRADE_BUILD_CMD or repo.config BUILD_CMD / BUILD_CMD_INCREMENTAL.
#
# Usage:
#   UPGRADE_BUILD_CMD="$BUILD_CMD" UPGRADE_BUNDLE_VERIFY=yes sh scripts/build.sh
#   sh scripts/build.sh --incremental   # verify skipped

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

# Activate the Node version pinned in repo.config.sh (NODE_VERSION), if nvm is available.
# A fresh shell's active `node` reflects this machine's PATH snapshot, not necessarily
# this pin, and `nvm use` from a prior command does not persist to this one.
if [ -n "$NODE_VERSION" ] && [ -s "$HOME/.nvm/nvm.sh" ]; then
  # shellcheck disable=SC1091
  . "$HOME/.nvm/nvm.sh"
  nvm use "$NODE_VERSION" >/dev/null 2>&1 || echo "warn: nvm could not activate Node $NODE_VERSION (not installed?) — run: nvm install $NODE_VERSION" >&2
fi

USE_INCREMENTAL=false
EXTRA_ARGS=""
for arg in "$@"; do
  case "$arg" in
    -i|--incremental) USE_INCREMENTAL=true ;;
    *) EXTRA_ARGS="$EXTRA_ARGS $arg" ;;
  esac
done

# Resolve bundle verify: n/a when repo has no script; else Step 0 env, else repo default (yes).
if [ -z "$POST_BUILD_VERIFY_SCRIPT" ]; then
  RESOLVED_BUNDLE_VERIFY=n/a
elif [ "$UPGRADE_BUNDLE_VERIFY" = "yes" ] || [ "$UPGRADE_BUNDLE_VERIFY" = "no" ]; then
  RESOLVED_BUNDLE_VERIFY=$UPGRADE_BUNDLE_VERIFY
elif [ "$DEFAULT_RUN_BUNDLE_VERIFY" = "yes" ]; then
  RESOLVED_BUNDLE_VERIFY=yes
else
  RESOLVED_BUNDLE_VERIFY=no
fi

if [ -n "$UPGRADE_BUILD_CMD" ]; then
  SELECTED_BUILD_CMD=$UPGRADE_BUILD_CMD
  BUILD_LABEL="Step 0 build"
  if [ -n "$POST_BUILD_VERIFY_SCRIPT" ] \
    && [ "$UPGRADE_BUNDLE_VERIFY" != "yes" ] \
    && [ "$UPGRADE_BUNDLE_VERIFY" != "no" ] \
    && [ "$UPGRADE_BUNDLE_VERIFY" != "n/a" ]; then
    echo "error: set UPGRADE_BUNDLE_VERIFY=yes|no from Step 0 (or omit to use DEFAULT_RUN_BUNDLE_VERIFY)" >&2
    exit 2
  fi
elif [ "$USE_INCREMENTAL" = true ]; then
  if [ -z "$BUILD_CMD_INCREMENTAL" ]; then
    echo "error: incremental build requested but BUILD_CMD_INCREMENTAL is not set in repo.config.sh" >&2
    exit 2
  fi
  SELECTED_BUILD_CMD=$BUILD_CMD_INCREMENTAL
  BUILD_LABEL="incremental build"
else
  SELECTED_BUILD_CMD=$BUILD_CMD
  BUILD_LABEL="full build"
fi

echo "=== $BUILD_LABEL: $SELECTED_BUILD_CMD (repo: $REPO_ROOT) ==="
# shellcheck disable=SC2086
eval "$SELECTED_BUILD_CMD" $EXTRA_ARGS

if [ "$USE_INCREMENTAL" = true ] && [ -z "$UPGRADE_BUILD_CMD" ]; then
  echo "=== post-build verify skipped — incremental build only (use full BUILD_CMD for Step 7) ==="
elif [ "$RESOLVED_BUNDLE_VERIFY" = "yes" ]; then
  if [ -n "$POST_BUILD_VERIFY_SCRIPT" ] && [ -f "$SCRIPT_DIR/$POST_BUILD_VERIFY_SCRIPT" ]; then
    echo ""
    echo "=== post-build verify: $POST_BUILD_VERIFY_SCRIPT ==="
    sh "$SCRIPT_DIR/$POST_BUILD_VERIFY_SCRIPT"
  else
    echo "error: bundle verify enabled but POST_BUILD_VERIFY_SCRIPT is missing or not found under scripts/" >&2
    exit 1
  fi
elif [ "$RESOLVED_BUNDLE_VERIFY" = "no" ]; then
  echo "=== post-build verify skipped (Step 0 or repo default: no) ==="
else
  echo "=== post-build verify skipped — not configured in repo.config.sh ==="
fi
