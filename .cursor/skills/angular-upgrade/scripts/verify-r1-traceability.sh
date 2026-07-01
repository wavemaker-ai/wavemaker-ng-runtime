#!/bin/sh
# Step 6 gate — R1 Update Guide traceability in current-state.md
#
# Ensures Step 2 walked every angular.dev/update-guide recommendation and recorded
# runtime + codegen disposition for each (no hardcoded Angular-version checklist).
#
# Usage: sh scripts/verify-r1-traceability.sh
# Exit: 0 = traceability OK; 1 = Step 2 incomplete or invalid

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SKILL_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
STATE="$SKILL_DIR/current-state.md"

fail() {
  echo "FAIL [R1] $1" >&2
  exit 1
}

if [ ! -f "$STATE" ]; then
  fail "current-state.md missing — complete Step 2 before Step 6"
fi

if ! grep -q "## R1 Update Guide Traceability" "$STATE"; then
  fail "missing '## R1 Update Guide Traceability' in current-state.md — Step 2 must document each update-guide recommendation"
fi

if grep -qE '^- R1: \(Angular Update Guide' "$STATE"; then
  fail "R1 reference review is still the template placeholder — fetch angular.dev/update-guide and fill traceability"
fi
if grep -qE '^- R1:\s*$' "$STATE"; then
  fail "R1 reference review is empty"
fi

if ! grep -qE 'update-guide|angular\.dev/update' "$STATE"; then
  fail "R1 traceability must record the update-guide URL fetched (From=base, To=target, advanced)"
fi

ENTRY_COUNT=$(grep -cE '^- \[(Y|N)\]' "$STATE" 2>/dev/null || true)
if [ "${ENTRY_COUNT:-0}" -lt 3 ]; then
  fail "R1 traceability has ${ENTRY_COUNT:-0} entries — Step 2 requires one bullet per update-guide recommendation (expected several per major bump)"
fi

grep -E '^- \[(Y|N)\]' "$STATE" > /tmp/r1-trace-$$.txt || true
while IFS= read -r _line; do
  [ -z "$_line" ] && continue
  _applies=$(echo "$_line" | sed -n 's/^- \[\([YN]\)\].*/\1/p')
  if [ "$_applies" = "Y" ]; then
    echo "$_line" | grep -q 'runtime:' || fail "[Y] entry missing runtime: — $_line"
    echo "$_line" | grep -q 'codegen:' || fail "[Y] entry missing codegen: — $_line"
    if ! echo "$_line" | grep -qE 'plan:|plan row|Dual-Repo Change Plan|§[0-9]'; then
      fail "[Y] entry missing plan reference (plan: / §N / dual-repo plan row) — $_line"
    fi
  fi
  if [ "$_applies" = "N" ]; then
    echo "$_line" | grep -qE '\[N/A:|plan: \[N/A' || fail "[N] entry must include [N/A: reason] — $_line"
  fi
done < /tmp/r1-trace-$$.txt
rm -f /tmp/r1-trace-$$.txt

# Codegen-affecting [Y] entries require at least one dual-repo plan row
_codegen_hits=$(grep -E '^- \[Y\]' "$STATE" | grep 'codegen:' | grep -vE 'codegen: n/a|codegen: none|codegen: —' || true)
if [ -n "$_codegen_hits" ]; then
  if ! grep -qE '^\| §' "$STATE"; then
    fail "R1 [Y] entries reference codegen changes but Dual-Repo Change Plan has no rows"
  fi
fi

echo "OK   [R1] update-guide traceability present ($ENTRY_COUNT recommendations documented)"
exit 0
