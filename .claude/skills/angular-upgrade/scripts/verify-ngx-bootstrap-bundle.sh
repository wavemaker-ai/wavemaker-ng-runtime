#!/bin/sh
# Optional repo post-build verify (set POST_BUILD_VERIFY_SCRIPT in repo.config.sh).
# This copy: ngx-bootstrap Rollup patches in built runtime bundles.
# Strict by default: both artifacts must exist and pass content checks.
#
# Usage:
#   sh scripts/verify-ngx-bootstrap-bundle.sh
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
  echo "error: missing $SKILL_DIR/repo.config.sh" >&2
  exit 1
fi

# shellcheck source=../repo.config.sh
. "$SKILL_DIR/repo.config.sh"
cd "$REPO_ROOT"

# NOTE: filename was ngx-bootstrap.umd.js as of this repo's build.sh at Angular 19 (concatenated
# via `cat ... > dist/tmp/libs/ngx-bootstrap/ngx-bootstrap.umd.js`, not a rollup-produced
# "bundle.js"). If a later hop's build.sh renames/restructures this artifact, update this path —
# don't assume the ".bundle.js" name from whichever branch this script was ported from.
NGX_BUNDLE="$REPO_ROOT/dist/tmp/libs/ngx-bootstrap/ngx-bootstrap.umd.js"
WM_LIBS="$REPO_ROOT/dist/bundles/wmapp/scripts/wm-libs.js"
UPSTREAM="$REPO_ROOT/node_modules/ngx-bootstrap/positioning/fesm2022/ngx-bootstrap-positioning.mjs"
PATCH_SCRIPT="$REPO_ROOT/build-scripts/ngx-bootstrap-patch.mjs"

FAIL=0
MISSING=0

echo "=== ngx-bootstrap bundle verification (strict, repo: $REPO_ROOT) ==="

# Whether the patch is even needed depends on whether upstream's PositioningService actually
# calls takeUntilDestroyed(__destroyRef) without declaring it (checklist.md §12 — first required
# at ngx-bootstrap 21/Angular 21). Check upstream FIRST so a missing patch script below a version
# that doesn't need it yet is informational, not a hard FAIL.
UPSTREAM_NEEDS_PATCH=0
if [ -f "$UPSTREAM" ]; then
  # Check for the BARE takeUntilDestroyed() — that is the hazardous upstream form the patch
  # exists to fix (it injects a DestroyRef and passes it explicitly). Looking for
  # `takeUntilDestroyed(__destroyRef)` here was inverted logic: `__destroyRef` is what the PATCH
  # adds, so upstream never contains it, and the script always reported "patch not needed".
  # Confirmed wrong at ngx-bootstrap 20.0.2 / 21.2.2 / 22.0.0 — all three ship the bare form.
  if grep -qE 'takeUntilDestroyed\(\s*\)' "$UPSTREAM" 2>/dev/null; then
    echo "INFO: upstream positioning uses bare takeUntilDestroyed() — bundle patch required"
    UPSTREAM_NEEDS_PATCH=1
  else
    echo "INFO: upstream positioning has no bare takeUntilDestroyed() — re-verify §12 against this ngx-bootstrap version before trusting that the patch is unnecessary"
  fi
else
  echo "WARN: upstream positioning fesm not found (npm install / ngx-bootstrap version?)"
fi

if [ -f "$PATCH_SCRIPT" ]; then
  if grep -q '__destroyRef' "$PATCH_SCRIPT" && grep -q 'takeUntilDestroyed' "$PATCH_SCRIPT"; then
    echo "OK: patch definitions present in build-scripts/ngx-bootstrap-patch.mjs"
  else
    echo "WARN: ngx-bootstrap-patch.mjs may be missing DestroyRef positioning patch"
  fi
elif [ "$UPSTREAM_NEEDS_PATCH" -eq 1 ]; then
  echo "FAIL: missing $PATCH_SCRIPT (upstream needs it at this ngx-bootstrap version)"
  FAIL=1
else
  echo "INFO: $PATCH_SCRIPT not present — not yet needed at this ngx-bootstrap version"
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
  echo "FAIL: run sh build.sh -f before bundle verification"
  exit 2
fi

if [ "$FAIL" -eq 1 ]; then
  echo "FAIL: ngx-bootstrap bundle verification — extend patch or rebuild with sh build.sh -f"
  exit 1
fi

echo "=== ngx-bootstrap bundle verification passed ==="
exit 0
