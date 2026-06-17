#!/bin/sh
# Step 6 — mandatory pattern greps (wavemaker-runtime-patterns.md).
# Keep in sync with "Automated blockers" table at top of wavemaker-runtime-patterns.md.
# Exit 1 on any must-change finding. Run from repo root:
#   sh .cursor/skills/angular-upgrade/scripts/pattern-review.sh
#
# Enforced sections: §1, §11b, §11c, §20a, §20b, §20e

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

cd "$REPO_ROOT"

NG_CODEGEN_PATH="${NG_CODEGEN_PATH:-../wavemaker-ng-codegen}"
if [ "${NG_CODEGEN_PATH#/}" = "$NG_CODEGEN_PATH" ]; then
  NG_CODEGEN="$(cd "$REPO_ROOT" && cd "$NG_CODEGEN_PATH" && pwd)"
else
  NG_CODEGEN="$NG_CODEGEN_PATH"
fi

FAIL=0

fail() {
  echo "BLOCKER: $1" >&2
  FAIL=1
}

ok() {
  echo "OK: $1"
}

echo "=== pattern-review (Step 6) ==="
echo "repo: $REPO_ROOT"
echo "ng-codegen: $NG_CODEGEN"
echo ""

# --- This repo: tsconfig.web-app.json alignment (§20a) ---
if [ -f tsconfig.json ] && [ -f tsconfig.web-app.json ]; then
  MR_ROOT=$(grep -E '^\s*"moduleResolution"' tsconfig.json | head -1 | sed 's/.*: *"\([^"]*\)".*/\1/')
  MR_WEB=$(grep -E '^\s*"moduleResolution"' tsconfig.web-app.json | head -1 | sed 's/.*: *"\([^"]*\)".*/\1/')
  if [ "$MR_ROOT" != "$MR_WEB" ]; then
    fail "§20a tsconfig moduleResolution mismatch (root=$MR_ROOT web-app=$MR_WEB)"
  else
    ok "§20a tsconfig moduleResolution aligned ($MR_ROOT)"
  fi
  if [ "${ANGULAR_TARGET_VERSION:-21}" -ge 21 ] 2>/dev/null; then
    if [ "$MR_WEB" != "bundler" ]; then
      fail "§20a tsconfig.web-app.json must use moduleResolution bundler on Angular 21+ (got $MR_WEB)"
    fi
  fi
else
  fail "§20a missing tsconfig.json or tsconfig.web-app.json"
fi

# --- §11b: startApp + ChangeDetectorRef ---
APP_TS="projects/runtime-base/src/components/app-component/app.component.ts"
if [ -f "$APP_TS" ]; then
  if grep -q 'startApp = true' "$APP_TS" && ! grep -q 'cdr\.detectChanges' "$APP_TS"; then
    fail "§11b startApp toggled without ChangeDetectorRef.detectChanges() in app.component.ts"
  else
    ok "§11b startApp bootstrap includes detectChanges (or pattern absent)"
  fi
fi

# --- §11c: spinner @if guard ---
APP_HTML="projects/runtime-base/src/components/app-component/app.component.html"
if [ -f "$APP_HTML" ]; then
  if grep -q 'app-spinner' "$APP_HTML" && ! grep -q '@if (spinner.show)' "$APP_HTML"; then
    fail "§11c global spinner should be wrapped in @if (spinner.show) or use detectChanges after subscription"
  else
    ok "§11c global spinner guard present (or N/A)"
  fi
fi

# --- Cross-repo: ng-codegen ---
if [ ! -d "$NG_CODEGEN" ]; then
  fail "§20 ng-codegen repo not found at $NG_CODEGEN — set NG_CODEGEN_PATH in repo.config.sh"
else
  HBS="$NG_CODEGEN/templates/app.config.ts.hbs"
  if [ -f "$HBS" ]; then
    if grep -qE 'ModalModule\.forRoot|BsDatepickerModule\.forRoot' "$HBS"; then
      fail "§20b $HBS still calls ngx-bootstrap .forRoot() on ModalModule or BsDatepickerModule"
    else
      ok "§20b app.config.ts.hbs — no Modal/BsDatepicker .forRoot()"
    fi
  else
    fail "§20b missing $HBS"
  fi

  UAJ="$NG_CODEGEN/src/update-angular-json.js"
  if [ -f "$UAJ" ]; then
    if grep -q 'foundation-css/foundation/foundation\.css' "$UAJ"; then
      fail "§20e $UAJ uses wrong foundation-css path (must be dist/styles/foundation/foundation.css)"
    elif ! grep -q 'foundation-css/dist/styles/foundation/foundation\.css' "$UAJ"; then
      fail "§20e $UAJ missing dist/styles/foundation/foundation.css path for Prism"
    else
      ok "§20e update-angular-json.js foundation-css dist path"
    fi
  else
    fail "§20e missing $UAJ"
  fi
fi

# --- Legacy compiler absent (§1) ---
if command -v rg >/dev/null 2>&1; then
  if rg -q 'compileModuleAndAllComponentsSync' projects/runtime-base 2>/dev/null; then
    fail "§1 legacy compileModuleAndAllComponentsSync still present in runtime-base"
  else
    ok "§1 no legacy compileModuleAndAllComponentsSync in runtime-base"
  fi
else
  echo "WARN: rg not installed — skipping §1 grep"
fi

echo ""
if [ "$FAIL" -ne 0 ]; then
  echo "=== pattern-review FAILED — fix blockers before Step 6 done ===" >&2
  exit 1
fi

echo "=== pattern-review PASSED ==="
exit 0
