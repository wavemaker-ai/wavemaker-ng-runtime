#!/bin/sh
# Step 6 automated greps — sync with wavemaker-runtime-patterns.md "Automated blockers" table.
# Usage: sh .cursor/skills/angular-upgrade/scripts/pattern-review.sh

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

grep_tsconfig_field() {
  field="$1"
  file="$2"
  grep -E "^\s*\"${field}\"" "$file" | head -1 | sed 's/.*: *"\([^"]*\)".*/\1/'
}

echo "=== pattern-review (Step 6) ==="
echo "repo: $REPO_ROOT"
echo "ng-codegen: $NG_CODEGEN"
echo ""

# --- §20: branch alignment (both repos) ---
RUNTIME_BRANCH="$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo unknown)"
if [ ! -d "$NG_CODEGEN" ]; then
  fail "§20 ng-codegen repo not found at $NG_CODEGEN — set NG_CODEGEN_PATH in repo.config.sh"
elif [ ! -d "$NG_CODEGEN/.git" ]; then
  fail "§20 ng-codegen path is not a git repo: $NG_CODEGEN"
else
  CODEGEN_BRANCH="$(cd "$NG_CODEGEN" && git rev-parse --abbrev-ref HEAD 2>/dev/null || echo unknown)"
  if [ "$RUNTIME_BRANCH" != "$CODEGEN_BRANCH" ]; then
    fail "§20 branch mismatch (ng-runtime=$RUNTIME_BRANCH ng-codegen=$CODEGEN_BRANCH) — align branches before Step 6 done"
  else
    ok "§20 branch aligned ($RUNTIME_BRANCH)"
  fi
fi

# --- This repo: tsconfig.web-app.json alignment (§20a) ---
if [ -f tsconfig.json ] && [ -f tsconfig.web-app.json ]; then
  MR_ROOT=$(grep_tsconfig_field moduleResolution tsconfig.json)
  MR_WEB=$(grep_tsconfig_field moduleResolution tsconfig.web-app.json)
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
  MOD_ROOT=$(grep_tsconfig_field module tsconfig.json)
  MOD_WEB=$(grep_tsconfig_field module tsconfig.web-app.json)
  if [ -n "$MOD_ROOT" ] && [ -n "$MOD_WEB" ] && [ "$MOD_ROOT" != "$MOD_WEB" ]; then
    fail "§20a tsconfig module mismatch (root=$MOD_ROOT web-app=$MOD_WEB)"
  else
    ok "§20a tsconfig module aligned (${MOD_WEB:-n/a})"
  fi
  LIB_ROOT=$(grep -E '^\s*"lib"' tsconfig.json | head -1 | tr -d ' \t')
  LIB_WEB=$(grep -E '^\s*"lib"' tsconfig.web-app.json | head -1 | tr -d ' \t')
  if [ -n "$LIB_ROOT" ] && [ -n "$LIB_WEB" ] && [ "$LIB_ROOT" != "$LIB_WEB" ]; then
    fail "§20a tsconfig lib mismatch between tsconfig.json and tsconfig.web-app.json"
  else
    ok "§20a tsconfig lib aligned (or absent)"
  fi
else
  fail "§20a missing tsconfig.json or tsconfig.web-app.json"
fi

# --- §11: accepted app-shell baseline (WMS-31488 dae9a74fc — not a blocker) ---
APP_TS="projects/runtime-base/src/components/app-component/app.component.ts"
if [ -f "$APP_TS" ]; then
  if grep -q '@ViewChild(RouterOutlet) set routerOutlet' "$APP_TS"; then
    ok "§11 app shell — ViewChild RouterOutlet setter (accepted baseline)"
  else
    echo "INFO: §11 — no RouterOutlet ViewChild setter; check overrideRouterOutlet timing if preview fails"
  fi
fi

# --- Cross-repo: ng-codegen required files + §20b / §20e ---
if [ -d "$NG_CODEGEN" ]; then
  GTJ="$NG_CODEGEN/src/gen-tsconfig.js"
  if [ -f "$GTJ" ]; then
    ok "§20a gen-tsconfig.js present"
  else
    fail "§20 missing $GTJ"
  fi

  HBS="$NG_CODEGEN/templates/app.config.ts.hbs"
  if [ -f "$HBS" ]; then
    if grep -qE 'ModalModule\.forRoot|BsDatepickerModule\.forRoot|NgCircleProgressModule\.forRoot' "$HBS"; then
      fail "§20b $HBS still calls ngx-bootstrap .forRoot() on ModalModule, BsDatepickerModule, or NgCircleProgressModule"
    else
      ok "§20b app.config.ts.hbs — no disallowed ngx-bootstrap .forRoot()"
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
  echo "=== pattern-review FAILED — fix blockers in ng-runtime and/or ng-codegen before Step 6 done ===" >&2
  exit 1
fi

echo "=== pattern-review PASSED (automated) — complete manual § greps per SKILL.md Step 6 ==="
exit 0
