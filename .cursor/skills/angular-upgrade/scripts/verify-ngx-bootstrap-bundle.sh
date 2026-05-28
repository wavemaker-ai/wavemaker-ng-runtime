#!/bin/sh
# Optional repo post-build verify (set POST_BUILD_VERIFY_SCRIPT in repo.config.sh).
# This copy: ngx-bootstrap Rollup patches in built runtime bundles.
# Strict by default: both artifacts must exist and pass content checks.
#
# Usage:
#   sh scripts/verify-ngx-bootstrap-bundle.sh
#
# Pre-build only (Steps 4–6 before dist exists): agent may pass --allow-missing
#   to check patch script + upstream without failing on absent bundles.
#
# Exit codes: 0 = pass, 1 = unpatched bundle content, 2 = required artifacts missing

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

ALLOW_MISSING=false
for arg in "$@"; do
  case "$arg" in
    --allow-missing) ALLOW_MISSING=true ;;
    --strict) ;; # no-op; kept for older docs
  esac
done

NGX_BUNDLE="$REPO_ROOT/dist/tmp/libs/ngx-bootstrap/ngx-bootstrap.bundle.js"
WM_LIBS="$REPO_ROOT/dist/bundles/wmapp/scripts/wm-libs.js"
UPSTREAM="$REPO_ROOT/node_modules/ngx-bootstrap/positioning/fesm2022/ngx-bootstrap-positioning.mjs"
PATCH_SCRIPT="$REPO_ROOT/build-scripts/ngx-bootstrap-patch.mjs"

FAIL=0
MISSING=0

echo "=== ngx-bootstrap bundle verification (strict, repo: $REPO_ROOT) ==="

if [ -f "$PATCH_SCRIPT" ]; then
  if grep -q '__destroyRef' "$PATCH_SCRIPT" && grep -q 'takeUntilDestroyed' "$PATCH_SCRIPT"; then
    echo "OK: patch definitions present in build-scripts/ngx-bootstrap-patch.mjs"
  else
    echo "WARN: ngx-bootstrap-patch.mjs may be missing DestroyRef positioning patch"
  fi
else
  echo "FAIL: missing $PATCH_SCRIPT"
  FAIL=1
fi

if [ -f "$UPSTREAM" ]; then
  if grep -q 'takeUntilDestroyed(__destroyRef)' "$UPSTREAM" 2>/dev/null; then
    echo "INFO: upstream positioning uses takeUntilDestroyed(__destroyRef) — bundle patch required"
  else
    echo "INFO: upstream positioning does not reference __destroyRef (patch may be noop)"
  fi
else
  echo "WARN: upstream positioning fesm not found (npm install / ngx-bootstrap version?)"
fi

verify_bundle() {
  label="$1"
  path="$2"
  if [ ! -f "$path" ]; then
    echo "FAIL: $label not found ($path)"
    MISSING=1
    return
  fi
  if grep -q 'takeUntilDestroyed(__destroyRef)' "$path" 2>/dev/null; then
    if grep -q 'inject.*DestroyRef' "$path" 2>/dev/null; then
      echo "OK: $label — DestroyRef inject patch present"
    else
      echo "FAIL: $label — takeUntilDestroyed(__destroyRef) without inject(DestroyRef)"
      FAIL=1
    fi
  else
    echo "OK: $label — no unpatched __destroyRef reference detected"
  fi
}

verify_bundle "ngx-bootstrap.bundle.js" "$NGX_BUNDLE"
verify_bundle "wm-libs.js" "$WM_LIBS"

if [ "$MISSING" -eq 1 ]; then
  if [ "$ALLOW_MISSING" = true ]; then
    echo "WARN (--allow-missing): dist bundles absent — run sh build.sh -f before Step 7"
    if [ "$FAIL" -eq 0 ]; then
      echo "=== ngx-bootstrap upstream/patch checks passed (bundles not built yet) ==="
      exit 0
    fi
  else
    echo "FAIL: run sh build.sh -f before bundle verification"
    exit 2
  fi
fi

if [ "$FAIL" -eq 1 ]; then
  echo "FAIL: ngx-bootstrap bundle verification — extend patch or rebuild with sh build.sh -f"
  exit 1
fi

echo "=== ngx-bootstrap bundle verification passed ==="
exit 0
