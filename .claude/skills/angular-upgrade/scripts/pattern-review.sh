#!/bin/sh
# Step 6 automated pattern review — checklist.md §1–§25.
#
# Automated (FAIL/WARN/OK):
#   §1  legacy compiler   §2  createComponent   §6  ngx-bootstrap forRoot + patch
#   §9  jest-preset       §11 RouterOutlet       §12 PositioningService DestroyRef
#   §13 WMDomRenderer     §14 template this.     §19 expression parser
#   §19b ParenthesizedExpression handler (WARN)  §20 branch/tsconfig/codegen files
#   §22 yalc peer deps    §23 angular.json builders    §37 projects/*/package.json peer deps    §38 Preview renderer provider + rxjs-interop UMD    §39 HttpXhrBackend    §20g codegen Eager templates    PARITY Preview↔Deployment bootstrap providers
#
# Manual checks listed at end (printed each run):
#   §3 §4 §5 §7 §8 §8b §10 §10a §10b §13c §15 §16
#   §19b (ASTCompiler node renames — separate from automated ParenthesizedExpression check)
#   §21 §24 §25
#
# Exit codes: 0 = all FAIL checks pass (WARNs do not block); 1 = at least one FAIL
#
# Usage: sh scripts/pattern-review.sh (from the skill directory)

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

if ! cd "$REPO_ROOT" 2>/dev/null; then
  echo "error: cannot cd to REPO_ROOT=$REPO_ROOT — check script path (expected 3 levels below repo root)" >&2
  exit 1
fi

# Activate the Node version pinned in repo.config.sh (NODE_VERSION), if nvm is available.
# A fresh shell's active `node` reflects this machine's PATH snapshot, not necessarily
# this pin, and `nvm use` from a prior command does not persist to this one.
if [ -n "$NODE_VERSION" ] && [ -s "$HOME/.nvm/nvm.sh" ]; then
  # shellcheck disable=SC1091
  . "$HOME/.nvm/nvm.sh"
  nvm use "$NODE_VERSION" >/dev/null 2>&1 || echo "warn: nvm could not activate Node $NODE_VERSION (not installed?) — run: nvm install $NODE_VERSION" >&2
fi

NG_CODEGEN_PATH="${NG_CODEGEN_PATH:-../wavemaker-ng-codegen}"
if [ "${NG_CODEGEN_PATH#/}" = "$NG_CODEGEN_PATH" ]; then
  NG_CODEGEN="$(cd "$REPO_ROOT" && cd "$NG_CODEGEN_PATH" 2>/dev/null && pwd || echo "")"
else
  NG_CODEGEN="$NG_CODEGEN_PATH"
fi

FAIL=0
FAIL_COUNT=0
WARN_COUNT=0
FAIL_MSGS=""
WARN_MSGS=""

fail() {
  _msg="FAIL [§${1}] ${2}"
  echo "$_msg" >&2
  FAIL=1
  FAIL_COUNT=$((FAIL_COUNT + 1))
  FAIL_MSGS="${FAIL_MSGS}  ${_msg}
"
}
warn() {
  _msg="WARN [§${1}] ${2}"
  echo "$_msg"
  WARN_COUNT=$((WARN_COUNT + 1))
  WARN_MSGS="${WARN_MSGS}  ${_msg}
"
}
ok()    { echo "OK   [§${1}] ${2}"; }
info()  { echo "INFO [§${1}] ${2}"; }

# fail_or_warn_below SECTION THRESHOLD MSG — fail if ANGULAR_TARGET_VERSION >= THRESHOLD,
# else warn (found, but not yet required — tracked, not blocking). Used for §N checks whose
# pattern doc documents an explicit "not required until Angular <THRESHOLD>" gate (verified
# against the actual installed @angular/* .d.ts, not assumed from the gate table alone) —
# see checklist.md's "Verification Principle" and Section version history.
fail_or_warn_below() {
  _section="$1"; _threshold="$2"; _msg="$3"
  if [ -n "${ANGULAR_TARGET_VERSION:-}" ] && [ "$ANGULAR_TARGET_VERSION" -ge "$_threshold" ] 2>/dev/null; then
    fail "$_section" "$_msg"
  else
    warn "$_section" "$_msg (not required until Angular $_threshold — target is $ANGULAR_TARGET_VERSION; tracked, not blocking)"
  fi
}

# search PATTERN [PATHS...] — 0=found, 1=not-found; uses rg when available
search() {
  _pat="$1"; shift
  if command -v rg >/dev/null 2>&1; then
    rg -q "$_pat" "$@" 2>/dev/null
  else
    grep -rq "$_pat" "$@" 2>/dev/null
  fi
}

# search_glob PATTERN GLOB [PATHS...] — like search() but restricts to filename glob
search_glob() {
  _pat="$1"; _glob="$2"; shift 2
  if command -v rg >/dev/null 2>&1; then
    rg -q "$_pat" --glob "$_glob" "$@" 2>/dev/null
  else
    grep -rq --include="$_glob" "$_pat" "$@" 2>/dev/null
  fi
}

grep_tsconfig_field() {
  _field="$1"; _file="$2"
  grep -E "^\s*\"${_field}\"" "$_file" 2>/dev/null | head -1 | sed 's/.*: *"\([^"]*\)".*/\1/'
}

echo "=== pattern-review (Step 6) ==="
echo "repo:       $REPO_ROOT"
echo "ng-codegen: ${NG_CODEGEN:-not found}"
echo "target:     Angular ${ANGULAR_TARGET_VERSION:-?}"
echo ""

# ─────────────────────────────────────────────────────────────────────────────
# §1  Legacy runtime compiler
# ─────────────────────────────────────────────────────────────────────────────
# Match real calls only — comment lines mentioning the removed API (e.g. migration notes) are not usage.
if grep -rn 'compileModuleAndAllComponentsSync' projects/runtime-base projects/runtime-dynamic 2>/dev/null \
    | grep -Ev ':[0-9]+:[[:space:]]*(//|\*|/\*)' | grep -q .; then
  fail_or_warn_below 1 22 "Compiler.compileModuleAndAllComponentsSync() called in runtime-base/runtime-dynamic — @deprecated but still present through @angular/core 21; REMOVED in 22 (verify: grep -rn compileModuleAndAllComponentsSync node_modules/@angular/core/types/ -> zero hits at 22.2.0). See patterns/runtime.md §1/§33"
else
  ok 1 "no compileModuleAndAllComponentsSync calls (comment mentions ignored)"
fi

# ─────────────────────────────────────────────────────────────────────────────
# §2  Standalone dynamic component creation
# ─────────────────────────────────────────────────────────────────────────────
# Positional args: createComponent(Cls, 0, inj) or createComponent(Cls, index, ...)
if search 'createComponent([^,)]*,[[:space:]]*[0-9]' projects/ 2>/dev/null; then
  warn 2 "createComponent() with positional numeric arg found — the positional/factory overload was @deprecated through Angular 21 and REMOVED in 22 (see patterns/runtime.md §33) — replace with createComponent(Type, {index, injector, ...}). Re-verify against the installed types/core.d.ts."
else
  ok 2 "no positional createComponent() calls"
fi
if search 'ComponentFactoryResolver|resolveComponentFactory' projects/ 2>/dev/null; then
  warn 2 "ComponentFactoryResolver / resolveComponentFactory found — verify replaced with createComponent object syntax"
else
  ok 2 "no ComponentFactoryResolver usage"
fi

# ─────────────────────────────────────────────────────────────────────────────
# §6  ngx-bootstrap .forRoot() in ng-runtime source (codegen checked in §20b)
# ─────────────────────────────────────────────────────────────────────────────
# NgCircleProgressModule deliberately excluded — it ships from ng-circle-progress, a separate
# package not bumped alongside ngx-bootstrap; its .forRoot() is unaffected and still required.
# Confirmed at the 20->21 hop that ALL ngx-bootstrap modules lost .forRoot(), not just modal/
# datepicker (prior version of this check only covered 2 of 10) — see patterns/runtime.md §8b.
if search 'ModalModule\.forRoot\|BsDatepickerModule\.forRoot\|TimepickerModule\.forRoot\|BsDropdownModule\.forRoot\|PaginationModule\.forRoot\|TypeaheadModule\.forRoot\|ProgressbarModule\.forRoot\|CarouselModule\.forRoot\|PopoverModule\.forRoot\|TooltipModule\.forRoot' projects/ 2>/dev/null; then
  fail_or_warn_below 6 21 "ngx-bootstrap .forRoot() found on a module that removed it at ngx-bootstrap 21 (all modules except NgCircleProgressModule, which is a separate package) — verify the ngx-bootstrap version this hop actually pins — .forRoot() may still be present in its .d.ts below that"
else
  ok 6 "no disallowed ngx-bootstrap .forRoot() in projects/"
fi

if [ -f build-scripts/ngx-bootstrap-patch.mjs ]; then
  if grep -q '__destroyRef\|takeUntilDestroyed' build-scripts/ngx-bootstrap-patch.mjs; then
    ok 6 "ngx-bootstrap-patch.mjs references DestroyRef injection"
  else
    fail 6 "ngx-bootstrap-patch.mjs does not inject __destroyRef — PositioningService will throw at runtime"
  fi
else
  warn 6 "build-scripts/ngx-bootstrap-patch.mjs not found"
fi

# ─────────────────────────────────────────────────────────────────────────────
# §9  jest-preset-angular — verify peer dep covers Angular target
# jest-preset-angular uses its own version scheme (not aligned to Angular majors).
# Check the installed package's peerDependencies range rather than comparing major numbers.
# ─────────────────────────────────────────────────────────────────────────────
if [ -f package.json ] && [ -n "${ANGULAR_TARGET_VERSION:-}" ]; then
  JPT_VER=$(node -e "
    try {
      const p = require('./package.json');
      const d = Object.assign({}, p.dependencies || {}, p.devDependencies || {});
      console.log(d['jest-preset-angular'] || 'not-found');
    } catch(e) { console.log('not-found'); }
  " 2>/dev/null || echo "not-found")
  if [ "$JPT_VER" = "not-found" ]; then
    info 9 "jest-preset-angular not in package.json"
  else
    JPT_MAJOR=$(echo "$JPT_VER" | tr -d '^~>= ' | cut -d. -f1)
    # Read peer dep range from installed package (more accurate than major comparison)
    JPT_PEER=$(node -e "
      try {
        const p = require('./node_modules/jest-preset-angular/package.json');
        console.log((p.peerDependencies || {})['@angular/core'] || 'unknown');
      } catch(e) { console.log('unknown'); }
    " 2>/dev/null || echo "unknown")
    # Check if Angular target falls within the peer dep range
    JPT_COMPATIBLE=$(node -e "
      try {
        const peer = '$JPT_PEER';
        const target = parseInt('$ANGULAR_TARGET_VERSION', 10);
        const m = peer.match(/>=(\d+).*?<(\d+)/);
        if (m) {
          console.log(target >= parseInt(m[1]) && target < parseInt(m[2]) ? 'yes' : 'no');
        } else {
          console.log('unknown');
        }
      } catch(e) { console.log('unknown'); }
    " 2>/dev/null || echo "unknown")
    if [ "$JPT_COMPATIBLE" = "yes" ]; then
      ok 9 "jest-preset-angular $JPT_MAJOR peer deps ($JPT_PEER) cover Angular $ANGULAR_TARGET_VERSION"
    elif [ "$JPT_COMPATIBLE" = "no" ]; then
      warn 9 "jest-preset-angular $JPT_MAJOR peer deps ($JPT_PEER) do not cover Angular $ANGULAR_TARGET_VERSION — update per §9"
    else
      warn 9 "jest-preset-angular $JPT_MAJOR installed; peer dep range unknown ($JPT_PEER) — verify compatibility with Angular $ANGULAR_TARGET_VERSION per §9"
    fi
  fi
fi

# ─────────────────────────────────────────────────────────────────────────────
# §11  RouterOutlet monkey-patch timing
# ─────────────────────────────────────────────────────────────────────────────
APP_TS="projects/runtime-base/src/components/app-component/app.component.ts"
if [ -f "$APP_TS" ]; then
  if grep -q 'overrideRouterOutlet\|routerOutlet\.attach' "$APP_TS"; then
    if grep -q 'set routerOutlet\b' "$APP_TS"; then
      ok 11 "RouterOutlet @ViewChild setter pattern present (accepted baseline)"
    else
      warn 11 "overrideRouterOutlet found but no @ViewChild RouterOutlet setter — outlet timing risk (§11)"
    fi
  else
    ok 11 "no overrideRouterOutlet in app.component.ts"
  fi
fi

# ─────────────────────────────────────────────────────────────────────────────
# §12  ngx-bootstrap PositioningService __destroyRef
# ─────────────────────────────────────────────────────────────────────────────
NGXBS_POS="$(find node_modules/ngx-bootstrap/positioning -name 'ngx-bootstrap-positioning.mjs' 2>/dev/null | head -1)"
if [ -n "$NGXBS_POS" ] && [ -f "$NGXBS_POS" ]; then
  # Match the BARE takeUntilDestroyed() — the hazardous upstream form the patch fixes by
  # injecting a DestroyRef and passing it explicitly. The previous check looked for
  # `takeUntilDestroyed(__destroyRef)` in UPSTREAM, but `__destroyRef` is what the PATCH adds,
  # so it never matched and this always printed the misleading "may no longer be needed" INFO.
  # All of ngx-bootstrap 20.0.2 / 21.2.2 / 22.0.0 ship the bare form — the patch is still needed.
  if grep -qE 'takeUntilDestroyed\(\s*\)' "$NGXBS_POS"; then
    if grep -q 'const __destroyRef\|DestroyRef' build-scripts/ngx-bootstrap-patch.mjs 2>/dev/null; then
      ok 12 "upstream has bare takeUntilDestroyed() — patch file covers it"
    else
      fail 12 "upstream PositioningService uses bare takeUntilDestroyed() but patch does not inject a DestroyRef — preview will throw NG0203"
    fi
  else
    info 12 "upstream PositioningService has no bare takeUntilDestroyed() — re-verify §12 against this ngx-bootstrap version before assuming the patch is unnecessary"
  fi
else
  warn 12 "ngx-bootstrap positioning bundle not found under node_modules/ngx-bootstrap/positioning/ — run npm install first (Step 4)"
fi

# ─────────────────────────────────────────────────────────────────────────────
# §13  WMDomRendererFactory2 / WMDomSharedStylesHost
# ─────────────────────────────────────────────────────────────────────────────
WM_DOM="projects/runtime-base/src/overrides/wm_dom_renderer.ts"
if [ -f "$WM_DOM" ]; then
  # §13d: addGlobalEventListener must NOT be present
  if grep -q 'addGlobalEventListener' "$WM_DOM"; then
    fail "13d" "wm_dom_renderer.ts uses addGlobalEventListener — must use injected DOCUMENT (Angular 16+)"
  else
    ok "13d" "no addGlobalEventListener in wm_dom_renderer.ts"
  fi

  # §13e: parent.removeChild must NOT be present (use el.remove() — Angular 18+)
  if grep -q 'parent\.removeChild(' "$WM_DOM"; then
    fail "13e" "wm_dom_renderer.ts uses parent.removeChild() — must use oldChild.remove() (Angular 18+)"
  else
    ok "13e" "no parent.removeChild() in wm_dom_renderer.ts"
  fi

  # §13g: animation @ property guard must exist
  if grep -q 'AT_CHARCODE\|charCodeAt(0) ===' "$WM_DOM"; then
    ok "13g" "animation @ property guard present in wm_dom_renderer.ts"
  else
    warn "13g" "no AT_CHARCODE / animation @ guard in wm_dom_renderer.ts — synthetic property errors in preview"
  fi
else
  warn 13 "wm_dom_renderer.ts not found at expected path"
fi

# §13a: ɵSharedStylesHost must be in runtime-base.module.ts ONLY
# Do NOT add to app.config.ts — RuntimeBaseModule lazy routes create a child injector;
# two instances cause ngOnDestroy to strip style nodes on navigation (WMS-31488).
RUNTIME_MODULE="projects/runtime-base/src/runtime-base.module.ts"
APP_CONFIG_TS="projects/runtime-dynamic/src/app/app.config.ts"
if [ -f "$RUNTIME_MODULE" ]; then
  if grep -q 'ɵSharedStylesHost\|WMDomSharedStylesHost' "$RUNTIME_MODULE"; then
    ok "13a" "ɵSharedStylesHost token registered in runtime-base.module.ts"
  else
    fail "13a" "runtime-base.module.ts missing ɵSharedStylesHost token — CSP nonce won't apply to dynamic styles"
  fi
fi
if [ -f "$APP_CONFIG_TS" ]; then
  if grep -q 'ɵSharedStylesHost\|WMDomSharedStylesHost' "$APP_CONFIG_TS"; then
    fail "13a" "app.config.ts registers ɵSharedStylesHost — causes double WMDomSharedStylesHost instance in lazy routes; nav styles stripped on navigation. Remove from app.config.ts (see §13a)."
  else
    ok "13a" "app.config.ts correctly omits ɵSharedStylesHost (NgModule registration is sufficient)"
  fi
fi

# ─────────────────────────────────────────────────────────────────────────────
# §14  Template this. context references in widget HTML
# ─────────────────────────────────────────────────────────────────────────────
if search_glob 'this\.(appLocale|_\w+)' '*.html' projects/components/widgets 2>/dev/null; then
  fail 14 "explicit this. references found in widget HTML templates — remove this. prefix (Angular 20+)"
else
  ok 14 "no this. references in widget HTML templates"
fi

# ─────────────────────────────────────────────────────────────────────────────
# §19  WaveMaker expression parser (ASTCompiler / $parseExpr)
# ─────────────────────────────────────────────────────────────────────────────
EXPR_PARSER="projects/core/src/utils/expression-parser.ts"
if [ -f "$EXPR_PARSER" ]; then
  # §19a: old-style string placeholder must NOT be present
  if grep -q "parseBinding.*'', 0\|parseAction.*'', 0\|parseAction.*false, ''" "$EXPR_PARSER"; then
    fail_or_warn_below "19a" 20 "expression-parser.ts uses old string placeholder in parseBinding/parseAction — must use ParseSourceSpan (mandatory from Angular 20 per patterns/runtime.md §19a — the @angular/compiler \`Parser\` class's parseBinding/parseAction keep a string \`location\` param below that; do not assume ParseSourceSpan is required without checking the installed .d.ts, and do not confuse this with the unrelated BindingParser class's similarly-named method)"
  else
    ok "19a" "no old-style parseBinding/parseAction string placeholder"
  fi

  # §19a: ParseSourceSpan must be used
  if grep -q 'ParseSourceSpan\|createParseSourceSpan' "$EXPR_PARSER"; then
    ok "19a" "ParseSourceSpan present in expression-parser.ts"
  else
    warn "19a" "ParseSourceSpan not found in expression-parser.ts — verify §19a fix applied"
  fi

  # §19b: ParenthesizedExpression handler should exist
  if grep -q 'ParenthesizedExpression' "$EXPR_PARSER"; then
    ok "19b" "ParenthesizedExpression handler present"
  else
    warn "19b" "ParenthesizedExpression not handled — watch expressions with parentheses may fail"
  fi

  # §19c: setPipeProvider must be called somewhere
  if search 'setPipeProvider' projects/runtime-base projects/core 2>/dev/null; then
    ok "19c" "setPipeProvider call found"
  else
    warn "19c" "setPipeProvider not found — dynamic bindings may silently return noop if pipe provider uninitialised"
  fi
else
  warn 19 "expression-parser.ts not found at expected path"
fi

# ─────────────────────────────────────────────────────────────────────────────
# §20  Branch alignment + tsconfig + codegen required files
# ─────────────────────────────────────────────────────────────────────────────
RUNTIME_BRANCH="$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo unknown)"
if [ "$RUNTIME_BRANCH" = "HEAD" ]; then
  fail 20 "ng-runtime is in detached HEAD state — check out a named branch before running the upgrade"
elif [ -z "$NG_CODEGEN" ] || [ ! -d "$NG_CODEGEN" ]; then
  fail 20 "ng-codegen repo not found at '$NG_CODEGEN_PATH' — set NG_CODEGEN_PATH in repo.config.sh"
elif [ ! -d "$NG_CODEGEN/.git" ]; then
  fail 20 "ng-codegen path is not a git repo: $NG_CODEGEN"
else
  CODEGEN_BRANCH="$(cd "$NG_CODEGEN" && git rev-parse --abbrev-ref HEAD 2>/dev/null || echo unknown)"
  if [ "$CODEGEN_BRANCH" = "HEAD" ]; then
    fail 20 "ng-codegen is in detached HEAD state — check out a named branch before running the upgrade"
  elif [ "$RUNTIME_BRANCH" != "$CODEGEN_BRANCH" ]; then
    fail 20 "branch mismatch: ng-runtime=$RUNTIME_BRANCH  ng-codegen=$CODEGEN_BRANCH"
  else
    ok 20 "branches aligned ($RUNTIME_BRANCH)"
  fi
fi

# §20a tsconfig alignment
if [ -f tsconfig.json ] && [ -f tsconfig.web-app.json ]; then
  MR_ROOT=$(grep_tsconfig_field moduleResolution tsconfig.json)
  MR_WEB=$(grep_tsconfig_field  moduleResolution tsconfig.web-app.json)
  if [ "$MR_ROOT" != "$MR_WEB" ]; then
    fail "20a" "tsconfig moduleResolution mismatch: root=$MR_ROOT  web-app=$MR_WEB"
  else
    ok "20a" "tsconfig moduleResolution aligned ($MR_ROOT)"
  fi

  if [ "${ANGULAR_TARGET_VERSION:-0}" -ge 21 ] 2>/dev/null; then
    if [ "$MR_WEB" != "bundler" ]; then
      fail "20a" "tsconfig.web-app.json must use moduleResolution:bundler on Angular 21+ (got '$MR_WEB')"
    fi
  fi

  MOD_ROOT=$(grep_tsconfig_field module tsconfig.json)
  MOD_WEB=$(grep_tsconfig_field  module tsconfig.web-app.json)
  if [ -n "$MOD_ROOT" ] && [ -n "$MOD_WEB" ] && [ "$MOD_ROOT" != "$MOD_WEB" ]; then
    fail_or_warn_below "20a" 21 "tsconfig module mismatch: root=$MOD_ROOT  web-app=$MOD_WEB — part of the §20a moduleResolution:bundler transition bundle, resync together at that hop rather than piecemeal"
  else
    ok "20a" "tsconfig module aligned (${MOD_WEB:-n/a})"
  fi

  LIB_ROOT=$(grep -E '^\s*"lib"' tsconfig.json     | head -1 | tr -d ' \t')
  LIB_WEB=$(grep  -E '^\s*"lib"' tsconfig.web-app.json | head -1 | tr -d ' \t')
  if [ -n "$LIB_ROOT" ] && [ -n "$LIB_WEB" ] && [ "$LIB_ROOT" != "$LIB_WEB" ]; then
    fail "20a" "tsconfig lib mismatch between tsconfig.json and tsconfig.web-app.json"
  else
    ok "20a" "tsconfig lib aligned (or absent)"
  fi
else
  fail "20a" "missing tsconfig.json or tsconfig.web-app.json"
fi

# §20 codegen required files + §20b + §20e
if [ -n "$NG_CODEGEN" ] && [ -d "$NG_CODEGEN" ]; then
  GTJ="$NG_CODEGEN/src/gen-tsconfig.js"
  if [ -f "$GTJ" ]; then
    ok 20 "gen-tsconfig.js present"
  else
    fail 20 "missing $GTJ"
  fi

  HBS="$NG_CODEGEN/templates/app.config.ts.hbs"
  if [ -f "$HBS" ]; then
    # NgCircleProgressModule excluded — separate package, .forRoot() still valid, see §8b.
    if grep -qE 'ModalModule\.forRoot|BsDatepickerModule\.forRoot' "$HBS"; then
      fail_or_warn_below "20b" 21 "app.config.ts.hbs calls disallowed ngx-bootstrap .forRoot() — removed in ngx-bootstrap 21"
    else
      ok "20b" "app.config.ts.hbs — no disallowed ngx-bootstrap .forRoot()"
    fi
  else
    fail "20b" "missing $HBS"
  fi

  UAJ="$NG_CODEGEN/src/update-angular-json.js"
  if [ -f "$UAJ" ]; then
    if grep -q 'foundation-css/foundation/foundation\.css' "$UAJ"; then
      ok "20e" "update-angular-json.js foundation-css path is foundation-css/foundation/foundation.css"
    else
      fail "20e" "$UAJ foundation-css path must be exactly ./node_modules/<scope>/foundation-css/foundation/foundation.css — no extra path segments (patterns/codegen.md §20e, global CLAUDE.md rule)"
    fi
  else
    fail "20e" "missing $UAJ"
  fi

  # Rule: no extra directory segment between foundation-css/ and foundation/ in any angular.json / update-angular-json script.
  for _f in angular.json "$NG_CODEGEN/src/update-angular-json.js"; do
    [ -f "$_f" ] || continue
    if grep -nE 'foundation-css/[^"'"'"' ]+/foundation/' "$_f" >/dev/null 2>&1; then
      fail "20e" "$_f: foundation-css path has an extra directory segment before foundation/ — remove it (global CLAUDE.md rule)"
    fi
  done
fi

# ─────────────────────────────────────────────────────────────────────────────
# §22  Yalc-linked package peer dependency mismatch
# ─────────────────────────────────────────────────────────────────────────────
if [ -d .yalc ] && [ -n "${ANGULAR_TARGET_VERSION:-}" ]; then
  OLD_ANG=$((ANGULAR_TARGET_VERSION - 1))
  YALC_OLD=$(find .yalc -name 'package.json' -maxdepth 3 2>/dev/null \
    | xargs grep -l "\"@angular/core\": \"\\^${OLD_ANG}\." 2>/dev/null | head -5 || true)
  if [ -n "$YALC_OLD" ]; then
    warn 22 "yalc package(s) still declare Angular ${OLD_ANG} peer dep — verify 'npm install' warnings after Step 4"
    for _f in $YALC_OLD; do info 22 "  stale peer dep: $_f"; done
  else
    ok 22 "no yalc packages with stale Angular $((ANGULAR_TARGET_VERSION - 1)) peer dep"
  fi
fi

# ─────────────────────────────────────────────────────────────────────────────
# §23  angular.json deprecated builder
# ─────────────────────────────────────────────────────────────────────────────
if [ -f angular.json ]; then
  if grep -q '"@angular-devkit/build-angular:browser"' angular.json; then
    warn 23 "angular.json uses deprecated @angular-devkit/build-angular:browser — plan migration to :application (§23)"
  else
    ok 23 "no deprecated :browser builder in angular.json"
  fi
fi

# ─────────────────────────────────────────────────────────────────────────────
# §37  projects/*/package.json peerDependencies on the target Angular major
# ─────────────────────────────────────────────────────────────────────────────
if [ -n "${ANGULAR_TARGET_VERSION:-}" ]; then
  PEER_STALE=$(git ls-files 'projects/*/package.json' 2>/dev/null \
    | xargs grep -Hn '"@angular/[a-z-]*": "[\^~]\{0,1\}[0-9]' 2>/dev/null \
    | grep -v "\"[\^~]\{0,1\}${ANGULAR_TARGET_VERSION}\." || true)
  if [ -n "$PEER_STALE" ]; then
    fail 37 "projects/*/package.json @angular/* peer dep not on Angular ${ANGULAR_TARGET_VERSION} — bump in Step 3 (§37)"
    echo "$PEER_STALE" | while read -r _l; do info 37 "  stale peer dep: $_l"; done
  else
    ok 37 "all projects/*/package.json @angular/* peer deps on Angular ${ANGULAR_TARGET_VERSION}"
  fi
fi

# ─────────────────────────────────────────────────────────────────────────────
# §38  Preview renderer: RendererFactory2 bound to WMDomRendererFactory2 in runtime-dynamic app.config
# ─────────────────────────────────────────────────────────────────────────────
if [ -f projects/runtime-dynamic/src/app/app.config.ts ]; then
  if grep -q 'provide: RendererFactory2, useClass: WMDomRendererFactory2' projects/runtime-dynamic/src/app/app.config.ts; then
    ok 38 "runtime-dynamic app.config provides RendererFactory2 -> WMDomRendererFactory2"
  else
    fail 38 "runtime-dynamic app.config.ts lacks { provide: RendererFactory2, useClass: WMDomRendererFactory2 } after provideAnimations() — Preview NG0200 on Angular 22 (§38)"
  fi
fi

# ─────────────────────────────────────────────────────────────────────────────
# §38 (related)  @angular/core/rxjs-interop UMD global — ngx-bootstrap positioning imports it
# ─────────────────────────────────────────────────────────────────────────────
if grep -q "@angular/core/rxjs-interop" node_modules/ngx-bootstrap/positioning/fesm2022/ngx-bootstrap-positioning.mjs 2>/dev/null; then
  if grep -q "core-rxjs-interop.umd.js" build.sh 2>/dev/null && grep -q "'@angular/core/rxjs-interop': 'ng.core.rxjsInterop'" config/rollup-utils.mjs 2>/dev/null && grep -q "core-rxjs-interop.umd.js" config/rollup.ng-libs.config.mjs 2>/dev/null; then
    ok 38 "rxjs-interop UMD entry + global + build.sh concat present"
  else
    fail 38 "ngx-bootstrap positioning imports @angular/core/rxjs-interop but the UMD entry/global/build.sh concat is incomplete — Preview: takeUntilDestroyed undefined (§38 related)"
  fi
fi

# ─────────────────────────────────────────────────────────────────────────────
# §39  Preview runtime-dynamic app.config: explicit HttpXhrBackend (copied from reviewed branch)
# ─────────────────────────────────────────────────────────────────────────────
if [ -f projects/runtime-dynamic/src/app/app.config.ts ]; then
  if grep -q 'HttpXhrBackend' projects/runtime-dynamic/src/app/app.config.ts; then
    ok 39 "runtime-dynamic app.config provides HttpXhrBackend/XhrFactory"
  else
    warn 39 "runtime-dynamic app.config.ts has no explicit HttpXhrBackend/XhrFactory provider (reference branch feature/angular-22-upgrade has one) — verify Preview uploads/HTTP (§39)"
  fi
fi

# ─────────────────────────────────────────────────────────────────────────────
# §20g  Codegen templates: Eager change detection on generated components
# ─────────────────────────────────────────────────────────────────────────────
if [ -n "${NG_CODEGEN:-}" ] && [ -d "$NG_CODEGEN/templates" ]; then
  _missing=""
  for _t in page/page partial/partial prefab/prefab layout/layout customwidget/customwidget; do
    grep -q 'ChangeDetectionStrategy.Eager' "$NG_CODEGEN/templates/${_t}.component.ts.hbs" 2>/dev/null || _missing="$_missing ${_t}"
  done
  if [ -n "$_missing" ]; then
    fail_or_warn_below "20g" 22 "codegen templates missing ChangeDetectionStrategy.Eager:$_missing — generated components fall back to Angular 22 OnPush default (§27a, patterns/codegen.md §20g)"
  else
    ok "20g" "codegen component templates pin ChangeDetectionStrategy.Eager"
  fi
fi

# ─────────────────────────────────────────────────────────────────────────────
# PARITY  Preview bootstrap (runtime-dynamic/app.config.ts) vs Deployment bootstrap (app.config.ts.hbs)
# ─────────────────────────────────────────────────────────────────────────────
PV_CFG=projects/runtime-dynamic/src/app/app.config.ts
DP_CFG="$NG_CODEGEN/templates/app.config.ts.hbs"
if [ -f "$PV_CFG" ] && [ -f "$DP_CFG" ]; then
  _sym() { grep -oE '\b(provide[A-Z][A-Za-z]*|with[A-Z][A-Za-z]*|Http[A-Za-z]*Backend|XhrFactory|RendererFactory2|WMDomRendererFactory2|ɵ[A-Za-z0-9]+)\b' "$1" | sort -u; }
  _pv=$(mktemp); _dp=$(mktemp)
  _sym "$PV_CFG" > "$_pv"; _sym "$DP_CFG" > "$_dp"
  # Known, intentional differences (preview-vs-deployment.md parity matrix). Add a symbol here ONLY with a recorded reason.
  #   Preview-only:    HttpXhrBackend XhrFactory RendererFactory2  (reference branch has them in runtime only; renderer bound always in Preview)
  #   Deployment-only: ɵDomRendererFactory2 ɵSharedStylesHost      (CSP-only renderer override in the generated app)
  _known="HttpXhrBackend XhrFactory RendererFactory2 ɵDomRendererFactory2 ɵSharedStylesHost"
  _gap=""
  for _s in $(comm -3 "$_pv" "$_dp" | tr -d '\t'); do
    case " $_known " in *" $_s "*) ;; *) _gap="$_gap $_s" ;; esac
  done
  rm -f "$_pv" "$_dp"
  if [ -n "$_gap" ]; then
    warn PARITY "Preview and Deployment bootstrap differ on:$_gap — apply the counterpart change or record it as intentional (preview-vs-deployment.md parity matrix)"
  else
    ok PARITY "Preview and Deployment bootstrap providers match (known intentional differences only)"
  fi
fi

# ─────────────────────────────────────────────────────────────────────────────
# Manual checks reminder
# ─────────────────────────────────────────────────────────────────────────────
echo ""
echo "--- Manual checks still required (run each section's Step 6 grep) ---"
echo "  §3   attachView/detachView called after every createComponent"
echo "  §4   HtmlParser/Element arity — diff against Angular ${ANGULAR_TARGET_VERSION:-N} upstream"
echo "  §5   Generated @if/@for in transpiler output"
echo "  §7   APP_INITIALIZER provider ordering in app.config.ts"
echo "  §8   Rollup fesm renames — inspect rollup.ng-libs.config.mjs"
echo "  §8b  NG1010 — bare modules in importProvidersFrom (no .forRoot())"
echo "  §10  Preview-sensitive patterns — verified in Step 9 only"
echo "  §13c Upstream WMDomRenderer sync — diff dom_renderer.mjs vs wm_dom_renderer.ts"
echo "  §15  Page query params snapshot+subscribe pattern"
echo "  §16  ngTemplateOutletContext row aliasing in list/table"
echo "  §10a Popover + datetime picker outside-click (subsection of §10) — Step 9 visual check only"
echo "  §10b File upload template bindings (subsection of §10) — read file-upload.component.html"
echo "  §19b ASTCompiler AST node renames — read expression-parser.ts"
echo "  §21  ng-packagr library failures — caught by build.sh exit code"
echo "  §24  Deprecation watch list — populate from R1/R3 at Step 10"
echo "  §25  TypeScript strictness — run: npx tsc --noEmit"
echo ""

# ─────────────────────────────────────────────────────────────────────────────
# Compact summary (all issues in one place at the end)
# ─────────────────────────────────────────────────────────────────────────────
if [ "$FAIL" -ne 0 ] || [ "$WARN_COUNT" -ne 0 ]; then
  echo ""
  echo "══════════════════════ SUMMARY ══════════════════════"
  if [ "$FAIL" -ne 0 ]; then
    printf '%s' "$FAIL_MSGS"
  fi
  if [ "$WARN_COUNT" -ne 0 ]; then
    printf '%s' "$WARN_MSGS"
  fi
  echo "═════════════════════════════════════════════════════"
fi

# ─────────────────────────────────────────────────────────────────────────────
# Result
# ─────────────────────────────────────────────────────────────────────────────
if [ "$FAIL" -ne 0 ]; then
  echo "=== pattern-review FAILED (${FAIL_COUNT:-?} fail, ${WARN_COUNT} warn) — fix FAIL items before marking Step 6 done ===" >&2
  exit 1
fi

if [ "$WARN_COUNT" -ne 0 ]; then
  echo "=== pattern-review PASSED with ${WARN_COUNT} warning(s) — disposition each WARN before Step 9 ==="
else
  echo "=== pattern-review PASSED — all automated checks clear ==="
fi
exit 0
