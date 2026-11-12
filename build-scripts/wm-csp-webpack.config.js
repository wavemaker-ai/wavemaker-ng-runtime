/*
 * Custom webpack config for apps built with Content-Security-Policy support.
 *
 * Same as wm-custom-webpack.config.js, plus the library NgModule scopes are kept (see
 * keep-ngmodule-scopes.webpack.js), so components compiled at runtime (dynamic tables, ...) work in
 * the AOT build a CSP app needs. The runtime compiles them with its CSP-safe JIT evaluator.
 *
 * Exported as a function, so the merge the custom-webpack builder does for an object config is done
 * here, with the builder's own merger.
 */
const { mergeConfigs } = require('@angular-builders/custom-webpack/dist/webpack-config-merger');
const keepNgModuleScopes = require('./keep-ngmodule-scopes.webpack');
const wmCustomConfig = require('../wm-custom-webpack.config');

module.exports = (config) => keepNgModuleScopes(mergeConfigs(config, wmCustomConfig));
