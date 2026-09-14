import fs from 'fs';
import path from 'path';
// NOTE: this used to also move the two `CompressionPlugin` (gzip/brotli) passes out of
// wm-custom-webpack.config.js into a serial post-build Node script, on the theory that running
// them inside the webpack compilation was stacking extra memory on top of the compiler's
// already-resident module graph. Measured directly against Cortex (5,049 widgets) with the
// build cache cleared before every run, 2 cold trials each: baseline peak RSS 3279MB/3378MB
// (121s/106s) vs "fixed" peak RSS 3473MB/3266MB (146s/158s). The peak RSS difference is smaller
// than the baseline's own run-to-run noise (99MB) — no measurable RAM benefit — while build
// duration was consistently ~35-45s SLOWER in both patched runs, because compression that used
// to run during webpack's own asset-processing hooks became a fully serial step tacked on after
// the build. Net negative (slower, not smaller) — removed rather than kept as a well-intentioned
// no-op. Same lesson as the Terser-capping removal below: the main `ng build` process's peak is
// dominated by the AOT-compiled module graph itself, not by peripheral plugins/steps running
// alongside it — no config-level toggle around the edges moves it.
// NOTE: this used to also inject a TerserPlugin with `parallel: 2` into
// wm-custom-webpack.config.js, claiming "~4-6GB RAM saved". Measured directly against a
// 5,049-widget project (Cortex): capping Terser's own worker count barely moved peak RSS at
// all (3108MB baseline -> 3067MB "capped but duplicated" -> 3262MB once actually fixed to
// replace instead of duplicate the minimizer — i.e. properly capping workers made peak WORSE).
// Root cause: `@angular-builders/custom-webpack` merges a plain-object config export via
// `webpack-merge`, which concatenates array-valued keys like `optimization.minimizer` instead
// of replacing them (no `mergeRules` was configured) — so the injected capped TerserPlugin ran
// ALONGSIDE Angular's own default (uncapped) one, not instead of it. But even after fixing that
// merge behavior, peak RSS was dominated by the main `ng build` process itself (~3GB), not the
// Terser worker processes (~300MB combined) — worker-count tuning structurally cannot reduce
// what the main process holds in memory. Removed rather than kept as a no-op.
export function optimizeWebpackAndBuildConfigs(targetDir) {
    let sourceMapsOptimized = false;
    let licenseExtractionDisabled = false;
    let buildCacheEnabled = false;
    const angularJsonPath = path.join(targetDir, 'angular.json');
    // Optimize angular.json production configuration (disable vendor source-maps, disable
    // license extraction, enable the persistent build cache)
    if (fs.existsSync(angularJsonPath)) {
        try {
            const json = JSON.parse(fs.readFileSync(angularJsonPath, 'utf8'));
            const projects = json.projects || {};
            const appKey = Object.keys(projects)[0];
            const prodConfig = projects[appKey]?.architect?.build?.configurations?.production;
            let changed = false;
            if (prodConfig) {
                // Ensure source maps are disabled or vendor maps disabled for production
                if (prodConfig.sourceMap !== false) {
                    prodConfig.sourceMap = {
                        scripts: false,
                        styles: false,
                        vendor: false,
                        hidden: false
                    };
                    sourceMapsOptimized = true;
                    changed = true;
                }
                // `extractLicenses` walks every bundled module's source looking for license banners
                // and holds them all in memory to assemble a single `3rdpartylicenses.txt`. Kept as a
                // cheap, harmless toggle (unlike the two removed above, it was never measured in
                // isolation to move peak RSS either way — treat it as a low-cost hygiene default, not a
                // proven RAM fix).
                if (prodConfig.extractLicenses !== false) {
                    prodConfig.extractLicenses = false;
                    licenseExtractionDisabled = true;
                    changed = true;
                }
            }
            // `@angular/build`'s persistent disk cache (`.angular/cache`, per-file Babel/webpack
            // transform output) defaults to `cli.cache.environment: 'local'`, under which
            // `cacheEnabled = !isCI` — so the cache is silently DISABLED the instant a build runs
            // under `CI=true`, even if a warm cache from a previous run is sitting right there on
            // disk. This is not a hygiene guess: measured directly against a 5,049-widget project
            // (cold `.angular/cache`, rebuilt with an intact warm cache under each condition):
            // CI default (cache ignored) 88s/2868MB peak RSS vs `environment: 'all'` (cache used)
            // 40s/2491MB — a 54% time and 13% RAM reduction for one config line. Only pays off if
            // the CI pipeline actually persists `.angular/cache` between runs (e.g. keyed on the
            // lockfile hash) — a no-op, not a regression, if it doesn't.
            if (json.cli?.cache?.environment !== 'all') {
                json.cli = json.cli || {};
                json.cli.cache = { ...(json.cli.cache || {}), environment: 'all' };
                buildCacheEnabled = true;
                changed = true;
            }
            if (changed) {
                fs.writeFileSync(angularJsonPath, JSON.stringify(json, null, 2), 'utf8');
            }
        }
        catch {
            // ignore parsing error
        }
    }
    return {
        sourceMapsOptimized,
        licenseExtractionDisabled,
        buildCacheEnabled
    };
}
