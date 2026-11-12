/*
 * Keeps the selector scope (declarations / exports) of library NgModules in an AOT build.
 *
 * Some widgets (e.g. a table whose columns come from the data) compile markup into a component at
 * runtime with the JIT compiler. That component imports NgModules like FormsModule, ReactiveFormsModule
 * and CommonModule to get directives such as formControlName, ngModel and ngClass. In an AOT build the
 * Angular linker drops the scope of library NgModules (it only keeps it when linking in JIT mode), so
 * those directives would silently be missing from the runtime-compiled component.
 *
 * The `aot` option of Angular's babel loader is only used to choose the linker mode, so turning it off
 * for that loader keeps the NgModule scopes while the app itself is still compiled AOT.
 *
 * Usable directly as a custom webpack config (function form), or as a helper on a merged config.
 */
const BABEL_LOADER = /[\\/]babel[\\/]webpack-loader(\.js)?$/;

const keepNgModuleScopes = (config) => {
    let patched = 0;
    const visit = (rules = []) => {
        for (const rule of rules) {
            if (!rule || typeof rule !== 'object') {
                continue;
            }
            visit(rule.oneOf);
            visit(rule.rules);
            const uses = Array.isArray(rule.use) ? rule.use : [rule.use];
            for (const use of uses) {
                if (use && typeof use === 'object' && BABEL_LOADER.test(use.loader || '') && use.options && use.options.aot) {
                    use.options = { ...use.options, aot: false };
                    patched++;
                }
            }
        }
    };
    visit(config.module && config.module.rules);
    if (!patched) {
        // the Angular CLI webpack config changed: fail the build instead of producing an app whose
        // runtime-compiled components are silently missing directives
        throw new Error('keep-ngmodule-scopes: Angular babel loader not found in the webpack config');
    }
    return config;
};

module.exports = keepNgModuleScopes;
