#!/usr/bin/env node

/**
 * ngx-bootstrap Angular 20 Compatibility Patch
 * Fixes: DestroyRef injection, Datepicker positioning, Dropdown/Modal classes
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';

const FILES = {
    pos: './node_modules/ngx-bootstrap/positioning/bundles/ngx-bootstrap-positioning.umd.js',
    loader: './node_modules/ngx-bootstrap/component-loader/bundles/ngx-bootstrap-component-loader.umd.js',
    dropdown: './node_modules/ngx-bootstrap/dropdown/bundles/ngx-bootstrap-dropdown.umd.js',
    modal: './node_modules/ngx-bootstrap/modal/bundles/ngx-bootstrap-modal.umd.js'
};

const normalizeCheck = (v) =>
    Array.isArray(v) ? (c) => v.every(x => c.includes(x)) :
        v instanceof RegExp ? (c) => v.test(c) :
            (c) => c.includes(v);

const evaluateChecks = (checks, content) =>
    Object.fromEntries(Object.entries(checks).map(([k, v]) => [k, normalizeCheck(v)(content)]));

const applyPatches = (content, patch) => {
    const checks = evaluateChecks(patch.checks, content);
    const applied = patch.fixes.filter(f => f.condition(checks));
    return { content: applied.reduce((c, f) => f.apply(c), content), applied };
};

const processPatch = (patch) => {
    const path = FILES[patch.file];
    if (!existsSync(path)) return console.error(`❌ File not found: ${path}`) || process.exit(1);

    const { content: patched, applied } = applyPatches(readFileSync(path, 'utf8'), patch);
    if (!applied.length) return console.log(`✅ ${patch.name} already patched`);

    writeFileSync(path, patched, 'utf8');
    applied.forEach(f => console.log(`✅ ${f.description}`));
};

const PATCHES = [
    {
        name: 'PositioningService', file: 'pos',
        checks: { destroyRef: 'const __destroyRef = i0.inject(i0.DestroyRef)', enable: ['this.enable();', 'this.update$$.next(null);'] },
        fixes: [
            {
                description: 'DestroyRef injection', condition: (c) => !c.destroyRef,
                apply: (t) => t.replace(/(constructor\(ngZone, rendererFactory, platformId\)\s*\{[^}]*)(if\s*\(common\.isPlatformBrowser|if\s*\(isPlatformBrowser)/, '$1const __destroyRef = i0.inject(i0.DestroyRef);\n            $2').replace(/rxjsInterop\.takeUntilDestroyed\(\)/g, 'rxjsInterop.takeUntilDestroyed(__destroyRef)')
            },
            {
                description: 'Positioning reopen fix', condition: (c) => !c.enable,
                apply: (t) => t.replace(/this\.positionElements\.set\(_getHtmlElement\(options\.element\), options\);/, `this.positionElements.set(_getHtmlElement(options.element), options);\n                        this.enable();\n                        this.update$$$$.next(null);`)
            }
        ]
    },
    {
        name: 'ComponentLoader', file: 'loader',
        checks: { tracked: 'this._onShownSubscription = this.onShown.subscribe', hide: /hide\(id\) \{[\s\S]*?_unsubscribePositioning\(\)[\s\S]*?deletePositionElement/, unsub: 'if (this._onShownSubscription)' },
        fixes: [
            {
                description: 'Subscription tracking', condition: (c) => !c.tracked,
                apply: (t) => t.replace(/this\.onShown\.subscribe\(\(\) => \{[\s\n]*this\._posService\.position\(\{/, `this._onShownSubscription = this.onShown.subscribe(() => {\n                        this._posService.position({`)
            },
            {
                description: 'Hide cleanup', condition: (c) => !c.hide,
                apply: (t) => t.replace(/hide\(id\) \{[\s\n]*if \(!this\._componentRef\) \{[\s\n]*return this;[\s\n]*\}[\s\n]*this\._posService\.deletePositionElement\(this\._componentRef\.location\);/, `hide(id) {\n                        if (!this._componentRef) {\n                            return this;\n                        }\n                        this._unsubscribePositioning();\n                        this._posService.deletePositionElement(this._componentRef.location);`)
            },
            {
                description: 'Unsubscribe fix', condition: (c) => !c.unsub,
                apply: (t) => t.replace(/_unsubscribePositioning\(\) \{[\s\n]*if \(!this\._zoneSubscription\) \{[\s\n]*return;[\s\n]*\}[\s\n]*this\._zoneSubscription\.unsubscribe\(\);[\s\n]*this\._zoneSubscription = void 0;[\s\n]*\}/, `_unsubscribePositioning() {\n                        if (this._onShownSubscription) {\n                            this._onShownSubscription.unsubscribe();\n                            this._onShownSubscription = void 0;\n                        }\n                        if (this._zoneSubscription) {\n                            this._zoneSubscription.unsubscribe();\n                            this._zoneSubscription = void 0;\n                        }\n                    }`)
            }
        ]
    },
    { name: 'Dropdown', file: 'dropdown', checks: { showBinding: '"class.show": "isOpen"' }, fixes: [{ description: 'Remove show class binding', condition: (c) => c.showBinding, apply: (t) => t.replace(/, "class\.show": "isOpen"/g, '') }] },
    { name: 'Modal', file: 'modal', checks: { showClass: "SHOW: 'show'" }, fixes: [{ description: 'Change show to in class', condition: (c) => c.showClass, apply: (t) => t.replace(/SHOW: 'show'/g, "SHOW: 'in'") }] }
];

console.log('Patching ngx-bootstrap for Angular 20...\n');
PATCHES.forEach(processPatch);
console.log('\n✅ Patching complete!');