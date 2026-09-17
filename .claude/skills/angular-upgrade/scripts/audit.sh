#!/bin/sh
# Security gate (Step 5): audit → guarded audit fix → audit again.
#
# Guards: before running audit fix, checks that it would not change @angular/*,
# typescript, rxjs, or zone.js packages (those are pinned by Step 3).
# If any of those would change, exits with an error so the user can reconcile.
#
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

# --- helper: get installed version from node_modules ---
pkg_version() {
  pkg="$1"
  node -e "
    try {
      console.log(require('./node_modules/$pkg/package.json').version);
    } catch(e) { console.log('not-found'); }
  " 2>/dev/null || echo "not-found"
}

# --- helper: list @angular/* packages pinned in package.json ---
# Reads from package.json (the Step 3 pins) rather than scanning node_modules,
# so the snapshot reflects what was intentionally pinned, not transitive installs.
angular_pins_from_pkg() {
  node -e "
    const p = require('./package.json');
    const deps = Object.assign({}, p.dependencies || {}, p.devDependencies || {});
    Object.entries(deps)
      .filter(([k]) => k.startsWith('@angular/'))
      .forEach(([k]) => {
        try {
          const v = require('./node_modules/' + k + '/package.json').version;
          console.log(k + '=' + v);
        } catch(e) { console.log(k + '=not-found'); }
      });
  " 2>/dev/null | sort
}

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

# --- Step 1: initial audit report ---
echo "=== npm audit (1/3) (repo: $REPO_ROOT) ==="
# shellcheck disable=SC2086
run_audit $AUDIT_ARGS

# --- Step 2: snapshot all @angular/* and core TS/RxJS/zone packages before audit fix ---
# These are pinned by Step 3. If audit fix changes any of them the user must reconcile.
echo ""
echo "=== recording pinned package versions before audit fix ==="

# @angular/* packages from package.json pins (not full node_modules scan)
ANG_PKGS=$(angular_pins_from_pkg)
echo "$ANG_PKGS" | sed 's/^/  /'

TS_BEFORE=$(pkg_version "typescript")
RXJS_BEFORE=$(pkg_version "rxjs")
ZONE_BEFORE=$(pkg_version "zone.js")
NGPACK_BEFORE=$(pkg_version "ng-packagr")
echo "  typescript:  $TS_BEFORE"
echo "  rxjs:        $RXJS_BEFORE"
echo "  zone.js:     $ZONE_BEFORE"
echo "  ng-packagr:  $NGPACK_BEFORE"

# --- Step 3: audit fix (no --force) ---
echo ""
echo "=== npm audit fix (2/3, no --force) (repo: $REPO_ROOT) ==="
npm audit fix || {
  fix_ec=$?
  if [ "$fix_ec" -gt 1 ]; then
    exit "$fix_ec"
  fi
}

# --- Step 4: check that pinned packages were not changed by audit fix ---
echo ""
echo "=== verifying pinned packages unchanged after audit fix ==="

PINNED_CHANGED=0

# Check all @angular/* packages (same set as before: only those pinned in package.json)
ANG_PKGS_AFTER=$(angular_pins_from_pkg)

major_ver() { echo "$1" | cut -d. -f1; }

if [ "$ANG_PKGS" != "$ANG_PKGS_AFTER" ]; then
  # Show what changed (avoid <() process substitution — not portable to plain /bin/sh)
  BEFORE_TMP=$(mktemp)
  AFTER_TMP=$(mktemp)
  printf '%s\n' "$ANG_PKGS" > "$BEFORE_TMP"
  printf '%s\n' "$ANG_PKGS_AFTER" > "$AFTER_TMP"
  diff "$BEFORE_TMP" "$AFTER_TMP" 2>/dev/null | grep '^[<>]' \
    | sed 's/^</  before: /; s/^>/  after:  /' || true
  rm -f "$BEFORE_TMP" "$AFTER_TMP"
  # Strip minor.patch — only flag if the major version changed
  ANG_MAJORS_BEFORE=$(echo "$ANG_PKGS"       | sed 's/=\([0-9]*\)\.[0-9.]*$/=\1/' | sort)
  ANG_MAJORS_AFTER=$(echo  "$ANG_PKGS_AFTER" | sed 's/=\([0-9]*\)\.[0-9.]*$/=\1/' | sort)
  if [ "$ANG_MAJORS_BEFORE" != "$ANG_MAJORS_AFTER" ]; then
    echo "FAIL: audit fix changed one or more @angular/* major versions." >&2
    PINNED_CHANGED=1
  else
    echo "  OK: @angular/* major versions unchanged (minor/patch bumps are acceptable — update Step 3 pins to lock the exact version if needed)"
  fi
else
  echo "  OK: all @angular/* versions unchanged"
fi

check_pinned() {
  pkg="$1"; before="$2"; after="$3"
  if [ "$before" != "not-found" ] && [ "$before" != "$after" ]; then
    if [ "$(major_ver "$before")" != "$(major_ver "$after")" ]; then
      echo "FAIL: audit fix changed $pkg major version  $before → $after" >&2
      PINNED_CHANGED=1
    else
      echo "  WARN: $pkg bumped $before → $after (minor/patch — update Step 3 pin if you want to lock the exact version)"
    fi
  else
    echo "  OK: $pkg ($after)"
  fi
}

check_pinned "typescript" "$TS_BEFORE"    "$(pkg_version "typescript")"
check_pinned "rxjs"       "$RXJS_BEFORE"  "$(pkg_version "rxjs")"
check_pinned "zone.js"    "$ZONE_BEFORE"  "$(pkg_version "zone.js")"
check_pinned "ng-packagr" "$NGPACK_BEFORE" "$(pkg_version "ng-packagr")"

if [ "$PINNED_CHANGED" -ne 0 ]; then
  echo "" >&2
  echo "error: npm audit fix changed one or more Angular/TS packages that are pinned by Step 3." >&2
  echo "  Options:" >&2
  echo "    1. Update Step 3 package.json pins to accept the new versions, re-run install and audit." >&2
  echo "    2. Pin the vulnerable transitive package separately (npm install <pkg>@<safe-version>)." >&2
  echo "    3. Accept with justification — document in current-state.md Security section." >&2
  exit 3
fi

# --- Step 5: final audit report ---
echo ""
echo "=== npm audit (3/3) (repo: $REPO_ROOT) ==="
# shellcheck disable=SC2086
run_audit $AUDIT_ARGS
