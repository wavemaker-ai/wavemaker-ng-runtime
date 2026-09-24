/**
 * ngx-bootstrap patching utilities.
 * Canonical path: build-scripts/ next to build.js only (angular-app tarball → generated-app/build-scripts/).
 * Do not rely on a separate copy under config/.
 *
 * Provides Rollup plugin for bundling and standalone function for patching ESM files.
 * Patches: PositioningService (DestroyRef, reopen), ComponentLoader (subscriptions),
 * Dropdown/Modal (ngx-bootstrap v20 compatibility).
 *
 * Copied from feature/angular-22-upgrade (WMS-32451, 21→22 hop on stage-classic) — that branch
 * carries 4 patch categories (componentLoader, dropdown, modal, typeahead) this repo's own
 * ngx-bootstrap-patch.mjs never had, tracing back to WMS-29275 (the original 18→20 upgrade).
 * Confirmed the underlying bugs are real on stage-classic's own installed ngx-bootstrap 22.0.0
 * before copying — see patterns/runtime.md §12 for per-patch verification evidence.
 */

import fs from 'fs';
import path from 'path';

// ============================================
// Utilities
// ============================================

const matchesModule = (id, ...modules) =>
    modules.some(mod => id.includes(`ngx-bootstrap-${mod}`) || id.includes(`ngx-bootstrap/${mod}`));

const applyReplacement = (code, pattern, replacement, logMsg) => {
    const patched = code.replace(pattern, replacement);
    const changed = patched !== code;
    if (changed && logMsg) console.log(`  ✅ ${logMsg}`);
    return { code: patched, changed };
};

// ============================================
// Patch Definitions
// ============================================

const PATCHES = {
    positioning: {
        matcher: (id) => matchesModule(id, 'positioning'),
        apply: (code) => {
            let current = code;
            let anyChanged = false;

            // DestroyRef injection fix (ngx-bootstrap 21: takeUntilDestroyed(__destroyRef) without declaration)
            if (
                current.includes('takeUntilDestroyed(__destroyRef)') &&
                !current.includes('const __destroyRef = i0.inject(i0.DestroyRef)')
            ) {
                const r1 = applyReplacement(
                    current,
                    /(constructor\s*\(\s*(?:ngZone\s*,\s*)?rendererFactory\s*,\s*platformId\s*\)\s*\{)/,
                    '$1\n        const __destroyRef = i0.inject(i0.DestroyRef);',
                    'Patched PositioningService: DestroyRef injection'
                );
                current = r1.code;
                anyChanged = r1.changed || anyChanged;
            } else if (
                current.includes('takeUntilDestroyed()') &&
                !current.includes('const __destroyRef = i0.inject(i0.DestroyRef)')
            ) {
                const r1 = applyReplacement(
                    current,
                    /(constructor\s*\(\s*(?:ngZone\s*,\s*)?rendererFactory\s*,\s*platformId\s*\)\s*\{)/,
                    '$1\n        const __destroyRef = i0.inject(i0.DestroyRef);',
                    null
                );
                const r2 = applyReplacement(
                    r1.code,
                    /takeUntilDestroyed\(\)/g,
                    'takeUntilDestroyed(__destroyRef)',
                    'Patched PositioningService: DestroyRef injection'
                );
                current = r2.code;
                anyChanged = r2.changed || anyChanged;
            }

            // Repair bad reopen line: a plain replacement string cannot contain literal $$ (see reopen fix below).
            if (current.includes('this.update$.next')) {
                const beforeRepair = current;
                current = current.replace(/this\.update\$\.next\(null\);?/g, () => 'this.update$$.next(null);');
                if (current !== beforeRepair) {
                    anyChanged = true;
                    console.log('  ✅ Patched PositioningService: Repair update$$.next reopen line');
                }
            }

            // Reopen fix: pristine addPositionElement only calls set(); gate on that body (not global
            // this.enable(); / calcPosition’s update$$) so the patch still applies after ngx-bootstrap edits.
            const needsPositioningReopenFix =
                /addPositionElement\(options\)\s*\{\s*\n\s*this\.positionElements\.set\(_getHtmlElement\(options\.element\),\s*options\);\s*\n\s*\}/m.test(
                    current
                );
            if (needsPositioningReopenFix) {
                const result = applyReplacement(
                    current,
                    /this\.positionElements\.set\(_getHtmlElement\(options\.element\),\s*options\);/g,
                    'this.positionElements.set(_getHtmlElement(options.element), options);\n        this.enable();\n        this.update$$$$.next(null);',
                    'Patched PositioningService: Reopen fix'
                );
                current = result.code;
                anyChanged = result.changed || anyChanged;
            }

            // BS5: computeAutoPlacement returns hyphenated keys (e.g. bottom-end) not in PlacementForBs5;
            // lookup is undefined → dataPlacement.split throws during PositioningService Map.forEach (wm-libs).
            if (!current.includes('PlacementForBs5[data.placement] ?? data.placement')) {
                const r3 = applyReplacement(
                    current,
                    /const dataPlacement = getBsVer\(\)\.isBs5\s*\n\s*\?\s*PlacementForBs5\[data\.placement\]\s*\n\s*:\s*data\.placement;/,
                    `const dataPlacementRaw = getBsVer().isBs5
        ? PlacementForBs5[data.placement] ?? data.placement
        : data.placement;
    const dataPlacement = dataPlacementRaw ?? '';`,
                    'Patched updateContainerClass: BS5 placement fallback'
                );
                current = r3.code;
                anyChanged = r3.changed || anyChanged;
            }
            if (!current.includes('String(dataPlacement).split(/[\\s-]/)[0]')) {
                const safeReplaceLine =
                    'containerClass = containerClass.replace(/left|right|top|bottom|end|start/g, `' +
                    '${(String(dataPlacement).split(/[\\s-]/)[0] || \'bottom\')}`' +
                    ');';
                const r4 = applyReplacement(
                    current,
                    /containerClass = containerClass\.replace\(\/left\|right\|top\|bottom\|end\|start\/g, `\$\{dataPlacement\.split\(' '\)\[0\]\}`\);/,
                    safeReplaceLine,
                    'Patched updateContainerClass: safe placement primary axis'
                );
                current = r4.code;
                anyChanged = r4.changed || anyChanged;
            }

            return { code: current, wasPatched: anyChanged };
        }
    },

    componentLoader: {
        matcher: (id) => matchesModule(id, 'component-loader'),
        apply: (code) => {
            let current = code;
            let anyChanged = false;

            const patches = [
                {
                    condition: !current.includes('this._onShownSubscription = this.onShown.subscribe'),
                    pattern: /this\.onShown\.subscribe\(\(\)\s*=>\s*\{/g,
                    replacement: 'this._onShownSubscription = this.onShown.subscribe(() => {',
                    msg: 'Patched ComponentLoader: Subscription tracking'
                },
                {
                    condition: !/hide\([^)]*\)\s*\{[\s\S]*?_unsubscribePositioning\(\)[\s\S]*?_posService\.deletePositionElement/.test(current),
                    pattern: /(hide\([^)]*\)\s*\{\s*\n\s*if\s*\(\s*!this\._componentRef\s*\)\s*\{\s*\n\s*return\s+this;\s*\n\s*\}\s*\n\s*)(this\._posService\.deletePositionElement)/,
                    replacement: '$1this._unsubscribePositioning();\n        $2',
                    msg: 'Patched ComponentLoader: Hide cleanup'
                },
                {
                    condition: !current.includes('if (this._onShownSubscription)'),
                    pattern: /(_unsubscribePositioning\(\)\s*\{\s*\n\s*)(if\s*\(\s*!this\._zoneSubscription\s*\))/,
                    replacement: `$1if (this._onShownSubscription) {\n            this._onShownSubscription.unsubscribe();\n            this._onShownSubscription = void 0;\n        }\n        $2`,
                    msg: 'Patched ComponentLoader: Unsubscribe fix'
                }
            ];

            for (const { condition, pattern, replacement, msg } of patches) {
                if (condition) {
                    const result = applyReplacement(current, pattern, replacement, msg);
                    current = result.code;
                    anyChanged = result.changed || anyChanged;
                }
            }

            return { code: current, wasPatched: anyChanged };
        }
    },

    dropdown: {
        matcher: (id) => matchesModule(id, 'dropdown'),
        apply: (code) => {
            // ngx-bootstrap 20 + Bootstrap 5: host `.show` toggles dropdown visibility. Removing it breaks
            // datetime timepicker (dropdown menu) and similar `[dropdown]` hosts — restore if stripped.
            if (
                code.includes(
                    'properties: { "class.dropup": "dropup", "class.open": "isOpen", "class.show": "isOpen" }'
                )
            ) {
                return { code, wasPatched: false };
            }
            const result = applyReplacement(
                code,
                /properties: \{ "class\.dropup": "dropup", "class\.open": "isOpen" \}/,
                'properties: { "class.dropup": "dropup", "class.open": "isOpen", "class.show": "isOpen" }',
                'Patched Dropdown: Restore BS5 show class on directive host'
            );
            return { code: result.code, wasPatched: result.changed };
        }
    },

    modal: {
        matcher: (id) => matchesModule(id, 'modal'),
        apply: (code) => {
            if (!code.includes("SHOW: 'show'")) {
                return { code, wasPatched: false };
            }
            const result = applyReplacement(
                code,
                /SHOW: 'show'/g,
                "SHOW: 'in'",
                'Patched Modal: SHOW class to in'
            );
            return { code: result.code, wasPatched: result.changed };
        }
    },

    typeahead: {
        matcher: (id) => matchesModule(id, 'typeahead'),
        apply: (code) => {
            let current = code;
            let anyChanged = false;

            if (current.includes(':host.dropdown-menu,.dropdown-menu{overflow-y:auto;height:100px}')) {
                const result = applyReplacement(
                    current,
                    /:host\.dropdown-menu,\.dropdown-menu\{overflow-y:auto;height:100px\}/g,
                    '',
                    'Patched Typeahead: Remove overflow-y and height styles'
                );
                current = result.code;
                anyChanged = result.changed || anyChanged;
            }

            return { code: current, wasPatched: anyChanged };
        }
    }
};

// ============================================
// Rollup Plugin
// ============================================

export function ngxBootstrapPatchPlugin() {
    return {
        name: 'ngx-bootstrap-patch',
        transform(code, id) {
            for (const patch of Object.values(PATCHES)) {
                if (patch.matcher(id)) {
                    const result = patch.apply(code);
                    if (result.wasPatched || result.code !== code) {
                        return { code: result.code, map: null };
                    }
                }
            }
            return null;
        }
    };
}
/**
 * Files to patch in node_modules/ngx-bootstrap (fesm2022 only for Angular 17+)
 */
const FILES_TO_PATCH = [
    { path: 'positioning/fesm2022/ngx-bootstrap-positioning.mjs', patchKey: 'positioning' },
    { path: 'component-loader/fesm2022/ngx-bootstrap-component-loader.mjs', patchKey: 'componentLoader' },
    { path: 'dropdown/fesm2022/ngx-bootstrap-dropdown.mjs', patchKey: 'dropdown' },
    { path: 'modal/fesm2022/ngx-bootstrap-modal.mjs', patchKey: 'modal' },
    { path: 'typeahead/fesm2022/ngx-bootstrap-typeahead.mjs', patchKey: 'typeahead' }
];

/**
 * Patch ngx-bootstrap ESM files directly in node_modules.
 * Call this from build.js before Angular build.
 */
export function patchNgxBootstrapFiles(nodeModulesPath = 'node_modules') {
    console.log('\n🔧 Patching ngx-bootstrap ESM files...\n');

    const ngxPath = path.join(nodeModulesPath, 'ngx-bootstrap');
    let totalPatched = 0;

    for (const { path: filePath, patchKey } of FILES_TO_PATCH) {
        const fullPath = path.join(ngxPath, filePath);

        if (!fs.existsSync(fullPath)) continue;

        const code = fs.readFileSync(fullPath, 'utf-8');
        const patch = PATCHES[patchKey];

        if (patch) {
            const result = patch.apply(code);
            if (result.wasPatched) {
                fs.writeFileSync(fullPath, result.code, 'utf-8');
                totalPatched++;
            }
        }
    }

    console.log(
        totalPatched > 0
            ? `\n✅ Patched ${totalPatched} ngx-bootstrap file(s)\n`
            : '\n✓ ngx-bootstrap files already patched or no patches needed\n'
    );

    return totalPatched;
}

// CLI entry point
if (process.argv[1]?.includes('ngx-bootstrap-patch')) {
    patchNgxBootstrapFiles();
}
