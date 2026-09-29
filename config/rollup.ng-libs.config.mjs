export default [
    {
        input: "node_modules/@angular/core/fesm2022/core.mjs",
        output: {
            file: "node_modules/@angular/core/bundles/core.umd.js",
            format: "umd",
            name: "ng.core",
            globals: {
                "@angular/core": "ng.core",
                "@angular/core/primitives/signals": "ng.signals",
                "@angular/core/primitives/event-dispatch": "ng.event-dispatch",
                "@angular/core/primitives/di": "ng.di",
                "rxjs": "rxjs",
                "rxjs/operators": "rxjs.operators",
            }
        },
        external: ["rxjs", "rxjs/operators", "@angular/core/primitives/signals", "@angular/core/primitives/event-dispatch", "@angular/core/primitives/di"],
    },
    {
        input: "node_modules/@angular/animations/fesm2022/animations.mjs",
        output: {
            file: "node_modules/@angular/animations/bundles/animations.umd.js",
            format: "umd",
            name: "ng.animations",
            globals: {
                "@angular/animations": "ng.animations",
                "@angular/core": "ng.core",
                "@angular/common": "ng.common",
            }
        },
        external: ["@angular/core", "@angular/common"]
    },
    {
        input: "node_modules/@angular/common/fesm2022/common.mjs",
        output: {
            file: "node_modules/@angular/common/bundles/common.umd.js",
            format: "umd",
            name: "ng.common",
            globals: {
                "@angular/common": "ng.common",
                "@angular/core": "ng.core",
            }
        },
        external: ["@angular/core"],
    },
    {
        input: "node_modules/@angular/compiler/fesm2022/compiler.mjs",
        output: {
            file: "node_modules/@angular/compiler/bundles/compiler.umd.js",
            format: "umd",
            name: "ng.compiler"
        }
    },
    {
        input: "node_modules/@angular/platform-browser/fesm2022/platform-browser.mjs",
        output: {
            file: "node_modules/@angular/platform-browser/bundles/platform-browser.umd.js",
            format: "umd",
            name: "ng.platformBrowser",
            globals: {
                "@angular/common": "ng.common",
                "@angular/common/http": "ng.common.http",
                "@angular/core": "ng.core",
            }
        },
        external: ["@angular/core", "@angular/common", "@angular/common/http"],
    },
    {
        input: "node_modules/@angular/platform-browser-dynamic/fesm2022/platform-browser-dynamic.mjs",
        output: {
            file: "node_modules/@angular/platform-browser-dynamic/bundles/platform-browser-dynamic.umd.js",
            format: "umd",
            name: "ng.platformBrowserDynamic",
            globals: {
                "@angular/compiler": "ng.compiler",
                "@angular/common": "ng.common",
                "@angular/core": "ng.core",
                "@angular/platform-browser": "ng.platformBrowser",
            }
        },
        external: [
            "@angular/compiler",
            "@angular/core",
            "@angular/common",
            "@angular/platform-browser",
        ]
    },
    {
        input: "./node_modules/@angular/common/fesm2022/http.mjs",
        output: {
            file: "node_modules/@angular/common/bundles/common-http.umd.js",
            format: "umd",
            name: "ng.common.http",
            globals: {
                "@angular/common/http": "ng.common.http",
                "@angular/common": "ng.common",
                "@angular/core": "ng.core",
                "rxjs": "rxjs",
                "rxjs/operators": "rxjs.operators",
            },
        },
        external: ["@angular/core", "@angular/common", "rxjs", "rxjs/operators"],
    },
    {
        // Angular 21: ng-packagr flattened fesm2022/primitives/signals.mjs to fesm2022/primitives-signals.mjs
        // (no more nested primitives/ subfolder) - see patterns/runtime.md §8.
        input: 'node_modules/@angular/core/fesm2022/primitives-signals.mjs',
        output: {
            file: 'node_modules/@angular/core/bundles/core-signals.umd.js',
            format: 'umd',
            name: 'ng.signals',
            globals: {}
        },
        external: [],
    },
    {
        input: 'node_modules/@angular/core/fesm2022/primitives-event-dispatch.mjs',
        output: {
            file: 'node_modules/@angular/core/bundles/core-event-dispatch.umd.js',
            format: 'umd',
            name: 'ng.event-dispatch',
            globals: {}
        },
        external: [],
    },
    {
        // New at Angular 21 - core.mjs now also imports '@angular/core/primitives/di' as a
        // package-subpath external, same pattern as signals/event-dispatch above.
        input: 'node_modules/@angular/core/fesm2022/primitives-di.mjs',
        output: {
            file: 'node_modules/@angular/core/bundles/core-di.umd.js',
            format: 'umd',
            name: 'ng.di',
            globals: {}
        },
        external: [],
    },
    {
        // ngx-bootstrap 22's positioning code imports takeUntilDestroyed from '@angular/core/rxjs-interop';
        // without a UMD global here the ngx-bootstrap bundle resolved it to an undefined `rxjsInterop`
        // and PositioningService threw "Cannot read properties of undefined (reading 'takeUntilDestroyed')".
        // Same entry as feature/angular-22-upgrade.
        input: 'node_modules/@angular/core/fesm2022/rxjs-interop.mjs',
        output: {
            file: 'node_modules/@angular/core/bundles/core-rxjs-interop.umd.js',
            format: 'umd',
            name: 'ng.core.rxjsInterop',
            globals: {
                "@angular/core": "ng.core",
                "rxjs": "rxjs",
                "rxjs/operators": "rxjs.operators"
            }
        },
        external: ["@angular/core", "rxjs", "rxjs/operators"],
    },
    {
        input: "node_modules/@angular/forms/fesm2022/forms.mjs",
        output: {
            file: "node_modules/@angular/forms/bundles/forms.umd.js",
            format: "umd",
            name: "ng.forms",
            globals: {
                "@angular/core": "ng.core",
                "@angular/common": "ng.common",
                "rxjs": "rxjs",
                "rxjs/operators": "rxjs.operators",
            }
        },
        external: ["@angular/core", "@angular/common", "rxjs", "rxjs/operators"],
    },
    {
        input: "node_modules/@angular/router/fesm2022/router.mjs",
        output: {
            file: "node_modules/@angular/router/bundles/router.umd.js",
            format: "umd",
            name: "ng.router",
            globals: {
                "@angular/core": "ng.core",
                "@angular/common": "ng.common",
                "@angular/platform-browser": "ng.platformBrowser",
                "rxjs": "rxjs",
                "rxjs/operators": "rxjs.operators",
            }
        },
        external: ["@angular/core", "@angular/common", "@angular/platform-browser", "rxjs", "rxjs/operators"],
    },
    {
        input: 'node_modules/@angular/animations/fesm2022/browser.mjs',
        output: {
            file: 'node_modules/@angular/animations/bundles/animations-browser.umd.js',
            format: 'umd',
            name: 'ng.animations.browser',
            globals: {
                "@angular/common": "ng.common",
                "@angular/core": "ng.core",
                "@angular/animations": "ng.animations",
            }
        },
        external: ["@angular/core", "@angular/common", "@angular/animations"],
    },
    {
        input: 'node_modules/@angular/platform-browser/fesm2022/animations.mjs',
        output: {
            file: 'node_modules/@angular/platform-browser/bundles/platform-browser-animations.umd.js',
            format: 'umd',
            name: 'ng.platformBrowser.animations',
            globals: {
                "@angular/common": "ng.common",
                "@angular/core": "ng.core",
                "@angular/animations": "ng.animations",
                "@angular/platform-browser": "ng.platformBrowser",
                "@angular/animations/browser": "ng.animations.browser"
            }
        },
        external: ["@angular/core", "@angular/common", "@angular/animations", "@angular/platform-browser", "@angular/animations/browser"],
    }
]
