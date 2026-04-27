/**
 * Rollup config to bundle ngx-bootstrap fesm2020/fesm2022 modules into a single IIFE file
 * for inclusion in wm-libs.js runtime bundle.
 * 
 * This config:
 * 1. Creates a virtual entry that imports all ngx-bootstrap modules
 * 2. Applies patches for Angular 20 compatibility and positioning fixes
 * 3. Outputs to dist/tmp/libs/ngx-bootstrap/ngx-bootstrap.bundle.js
 */

import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import { ngxBootstrapPatchPlugin } from '../build-scripts/ngx-bootstrap-patch.mjs';

// ngx-bootstrap modules to bundle
const NGX_BOOTSTRAP_MODULES = [
    'accordion', 'buttons', 'carousel', 'chronos', 'collapse',
    'component-loader', 'datepicker', 'dropdown', 'focus-trap',
    'locale', 'mini-ngrx', 'modal', 'pagination', 'popover',
    'positioning', 'progressbar', 'rating', 'sortable', 'tabs',
    'timepicker', 'tooltip', 'typeahead', 'utils'
];

const ANGULAR_EXTERNALS = {
    '@angular/core': 'ng.core',
    '@angular/common': 'ng.common',
    '@angular/forms': 'ng.forms',
    '@angular/animations': 'ng.animations',
    '@angular/router': 'ng.router',
    '@angular/platform-browser': 'ng.platformBrowser',
    '@angular/core/rxjs-interop': 'ng.core.rxjsInterop',
    'rxjs': 'rxjs',
    'rxjs/operators': 'rxjs.operators'
};

// ============================================
// Utilities
// ============================================

function toCamelCase(str) {
    return str.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
}

// ============================================
// Entry File Generation
// ============================================

function generateEntryContent() {
    const moduleVars = NGX_BOOTSTRAP_MODULES.map(mod => ({
        module: mod,
        varName: toCamelCase(mod)
    }));
    
    const imports = moduleVars
        .map(({ module, varName }) => `import * as ${varName} from 'ngx-bootstrap/${module}';`)
        .join('\n');

    const moduleList = moduleVars
        .map(({ varName }) => `        ${varName}: ${varName}`)
        .join(',\n');

    const legacyAssignments = moduleVars
        .map(({ module, varName }) => `    global['ngx-bootstrap/${module}'] = ${varName};`)
        .join('\n');

    const exports = moduleVars
        .map(({ varName }) => varName)
        .join(', ');

    return `/**
 * Auto-generated entry file for bundling ngx-bootstrap modules.
 */

${imports}

(function (global) {
    'use strict';

    var _ngxBootstrap = {
${moduleList}
    };

    global.ngxBootstrap = _ngxBootstrap;

${legacyAssignments}

})(typeof window !== 'undefined' ? window : typeof global !== 'undefined' ? global : this);

export { ${exports} };
`;
}

// ============================================
// Virtual Entry Plugin
// ============================================

function virtualEntryPlugin() {
    const VIRTUAL_ENTRY_ID = '\0virtual:ngx-bootstrap-entry';
    const entryContent = generateEntryContent();

    return {
        name: 'virtual-entry',
        resolveId(id) {
            return id === 'virtual:ngx-bootstrap-entry' ? VIRTUAL_ENTRY_ID : null;
        },
        load(id) {
            return id === VIRTUAL_ENTRY_ID ? entryContent : null;
        }
    };
}

// ============================================
// Rollup Configuration Export
// ============================================

export default {
    input: 'virtual:ngx-bootstrap-entry',
    output: {
        file: 'dist/tmp/libs/ngx-bootstrap/ngx-bootstrap.bundle.js',
        format: 'iife',
        name: 'ngxBootstrap',
        globals: ANGULAR_EXTERNALS
    },
    external: Object.keys(ANGULAR_EXTERNALS),
    plugins: [
        virtualEntryPlugin(),
        ngxBootstrapPatchPlugin(),
        resolve({
            browser: true,
            preferBuiltins: false
        }),
        commonjs()
    ]
};