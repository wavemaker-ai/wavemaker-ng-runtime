import { nodeResolve } from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import alias from '@rollup/plugin-alias';

export default [
    {
        input: 'libraries/build-task/fesm2022/index.mjs',
        output: {
            file: 'dist/transpilation/transpilation-web.cjs.js',
            format: 'cjs'
        },
        plugins: [
            alias({
                entries: [
                    { find: 'rxjs/Subject', replacement: 'node_modules/rxjs/_esm5/internal/Subject.js' },
                    { find: '@wm/core', replacement: 'libraries/core/fesm2022/index.mjs' },
                    { find: '@wm/transpiler', replacement: 'libraries/transpiler/fesm2022/index.mjs' }
                ]
            }),
            nodeResolve({
                jsnext: true,
                main: true
            }),
            commonjs({
                include: 'node_modules/**',
                ignoreGlobal: true
            })
        ]
    },
    {
        // NOTE: ng-packagr 19.2.2 no longer emits per-file esm2022/<path>.mjs output (only the
        // flattened fesm2022/index.mjs bundle) — was previously
        // 'libraries/core/esm2022/utils/expression-parser.mjs'. @rollup/plugin-multi-entry was
        // also removed here (deprecated, silently produced empty chunks against rollup 4.60.1) —
        // it's unneeded for a single entry anyway.
        input: 'libraries/core/fesm2022/index.mjs',
        output: {
            file: 'dist/transpilation/expression-parser.cjs.js',
            format: 'cjs'
        },
        plugins: [
            nodeResolve({
                jsnext: true,
                main: true
            }),
            commonjs({
                include: 'node_modules/**',
                ignoreGlobal: true
            })
        ]
    },
    {
        // NOTE: was 3 separate esm2022/pipes/*.mjs files combined via @rollup/plugin-multi-entry
        // (removed, see note above) — ng-packagr 19.2.2 only emits the flattened per-library
        // fesm2022/index.mjs, which already contains all three pipes' exports in one file.
        // (Tried narrowing to a 3-export shim first — doesn't help: Angular decorators are
        // side-effecting, so rollup can't tree-shake sibling classes out of the barrel anyway;
        // reverted to the full barrel, matching pipe-provider.cjs.js's approach below.)
        input: 'libraries/components/base/fesm2022/index.mjs',
        output: {
            file: 'dist/transpilation/all-pipes.es.js',
            format: 'es'
        },
        plugins: [
            alias({
                entries: [
                    { find: '@wm/core', replacement: 'libraries/core/fesm2022/index.mjs' }
                ]
            }),
            nodeResolve({
                jsnext: true,
                main: true
            }),
            commonjs({
                include: 'node_modules/**',
                ignoreGlobal: true
            })
        ]
    },
    {
        // NOTE: was 'libraries/runtime/base/esm2022/services/pipe-provider.service.mjs' — ng-packagr
        // 19.2.2 no longer emits per-file esm2022 output (see note above), so this now bundles the
        // whole runtime/base fesm2022 barrel — which imports from every @wm/components/* subpath
        // (Angular decorators are side-effecting, so PipeProvider's sibling classes in the same
        // barrel file can't be tree-shaken away; tried narrowing via a shim first, doesn't help).
        // The generic @wm/(.+) alias below resolves every one of those subpaths to its real
        // libraries/<path>/fesm2022/index.mjs instead of listing dozens by hand.
        input: 'libraries/runtime/base/fesm2022/index.mjs',
        output: {
            file: 'dist/transpilation/pipe-provider.cjs.js',
            format: 'cjs'
        },
        plugins: [
            alias({
                // Order matters — first match wins. @wm/components/page and @wm/components/dialogs
                // are special-cased (multiple implementations; "default" is the one actually used),
                // matching tsconfig.json's own path mappings — must come before the generic @wm/(.+)
                // catch-all below or they'd wrongly resolve to libraries/components/page/fesm2022/
                // (doesn't exist) instead of libraries/components/page/default/fesm2022/.
                entries: [
                    { find: 'rxjs/Subject', replacement: 'node_modules/rxjs/_esm5/internal/Subject.js' },
                    { find: '@swipey', replacement: 'libraries/swipey/fesm2022/index.mjs' },
                    // @wavemaker/variables (separate sibling repo, yalc-linked) has a malformed
                    // package.json "exports" map ({".": "./index"}, missing the .js extension) —
                    // unrelated to this repo's Angular bump, but blocks nodeResolve's strict
                    // exports-map resolution (which doesn't auto-append extensions the way
                    // legacy "main" resolution does).
                    { find: '@wavemaker/variables', replacement: '.yalc/@wavemaker/variables/index.js' },
                    // Anchored regex, not a plain string — plugin-alias string matches are
                    // prefix matches, and unanchored 'dialogs'/'page' also swallow real sibling
                    // subpaths like @wm/components/dialogs/confirm-dialog (its own real path).
                    { find: /^@wm\/components\/page$/, replacement: 'libraries/components/page/default/fesm2022/index.mjs' },
                    { find: /^@wm\/components\/dialogs$/, replacement: 'libraries/components/dialogs/default/fesm2022/index.mjs' },
                    { find: /^@wm\/(.+)$/, replacement: 'libraries/$1/fesm2022/index.mjs' }
                ]
            }),
            nodeResolve({
                jsnext: true,
                main: true
            }),
            commonjs({
                include: 'node_modules/**',
                ignoreGlobal: true
            })
        ]
    }
]
