#!/bin/sh
# §20g — Dynamic bootstrap parity: runtime app.config.ts ↔ codegen app.config.ts.hbs
#
# Extracts provide*/with* identifiers from the runtime bootstrap file and fails when
# any (non-excluded) identifier is missing from the codegen template. No hardcoded
# Angular-version tokens — new R1 recommendations surface automatically once applied
# to runtime.
#
# Usage: sh scripts/bootstrap-parity.sh
# Exit: 0 = parity OK; 1 = mismatch

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SKILL_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
REPO_ROOT="$(cd "$SKILL_DIR/../../.." && pwd)"

# shellcheck source=../repo.config.sh
. "$SKILL_DIR/repo.config.sh"

NG_CODEGEN_PATH="${NG_CODEGEN_PATH:-../wavemaker-ng-codegen}"
if [ "${NG_CODEGEN_PATH#/}" = "$NG_CODEGEN_PATH" ]; then
  NG_CODEGEN="$(cd "$REPO_ROOT" && cd "$NG_CODEGEN_PATH" 2>/dev/null && pwd || echo "")"
else
  NG_CODEGEN="$NG_CODEGEN_PATH"
fi

RUNTIME_APP_CONFIG="$REPO_ROOT/projects/runtime-dynamic/src/app/app.config.ts"
HBS="${NG_CODEGEN}/templates/app.config.ts.hbs"
EXCLUSIONS="$SKILL_DIR/bootstrap-parity-exclusions.txt"

fail() {
  echo "FAIL [§20g] $1" >&2
  exit 1
}

if [ ! -f "$RUNTIME_APP_CONFIG" ]; then
  fail "missing runtime reference $RUNTIME_APP_CONFIG"
fi
if [ ! -f "$HBS" ]; then
  fail "missing codegen template $HBS"
fi

# provideFoo / withBar — Angular bootstrap helper APIs
extract_bootstrap_apis() {
  _file="$1"
  grep -oE '(provide|with)[A-Z][a-zA-Z0-9]*' "$_file" 2>/dev/null | sort -u || true
}

is_excluded() {
  _sym="$1"
  if [ ! -f "$EXCLUSIONS" ]; then
    return 1
  fi
  grep -vE '^\s*#' "$EXCLUSIONS" 2>/dev/null | grep -vE '^\s*$' | grep -qx "$_sym"
}

RUNTIME_APIS=$(extract_bootstrap_apis "$RUNTIME_APP_CONFIG")
HBS_APIS=$(extract_bootstrap_apis "$HBS")

MISSING=""
for _api in $RUNTIME_APIS; do
  if is_excluded "$_api"; then
    continue
  fi
  if ! echo "$HBS_APIS" | grep -qx "$_api"; then
    MISSING="${MISSING}  - ${_api} (in runtime, missing from app.config.ts.hbs)
"
  fi
done

if [ -n "$MISSING" ]; then
  echo "FAIL [§20g] runtime bootstrap APIs not mirrored in codegen template:" >&2
  echo "$MISSING" >&2
  echo "Fix: apply R1 recommendation to runtime first, mirror to templates/app.config.ts.hbs per §20g." >&2
  echo "Runtime APIs: $(echo "$RUNTIME_APIS" | tr '\n' ' ')" >&2
  echo "HBS APIs:     $(echo "$HBS_APIS" | tr '\n' ' ')" >&2
  exit 1
fi

echo "OK   [§20g] bootstrap provide*/with* APIs aligned (runtime ↔ app.config.ts.hbs)"
echo "     runtime: $(echo "$RUNTIME_APIS" | tr '\n' ' ')"
exit 0
