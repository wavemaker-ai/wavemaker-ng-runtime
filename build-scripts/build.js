const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

let processArgs = process.argv;
if (processArgs.findIndex(arg => arg.startsWith('--max-old-space-size')) !== -1) {
    process.env.NODE_OPTIONS = processArgs.pop();
    console.log("Setting node options: ", process.env.NODE_OPTIONS);
}

/**
 * Find ngx-bootstrap-patch.mjs. Prefer paths derived from this file's location
 * (`__dirname`) so resolution does not break when `process.cwd()` is not the
 * app root. Fall back to cwd-based paths for edge cases.
 */
function resolveNgxBootstrapPatch() {
    const fromScriptDir = path.join(__dirname, 'ngx-bootstrap-patch.mjs');
    const fromAppConfig = path.join(__dirname, '..', 'config', 'ngx-bootstrap-patch.mjs');
    const fromCwdBuildScripts = path.resolve(process.cwd(), 'build-scripts', 'ngx-bootstrap-patch.mjs');
    const fromCwdConfig = path.resolve(process.cwd(), 'config', 'ngx-bootstrap-patch.mjs');
    const candidates = [fromScriptDir, fromAppConfig, fromCwdBuildScripts, fromCwdConfig];
    for (const p of candidates) {
        if (fs.existsSync(p)) {
            return p;
        }
    }
    return { missing: true, tried: candidates };
}

const patchResult = resolveNgxBootstrapPatch();
if (patchResult.missing) {
    console.error(
        'Cannot find ngx-bootstrap-patch.mjs. Searched:',
        patchResult.tried
    );
    process.exit(1);
}
const patchScript = patchResult;
console.log('Using ngx-bootstrap patch at:', patchScript);
console.log("\x1b[36m", "Patching ngx-bootstrap ESM files...\x1b[0m");
const patchProcess = spawnSync('node', [patchScript], { stdio: 'inherit' });

if (patchProcess.status !== 0) {
    console.error('Error patching ngx-bootstrap:', patchProcess.error || patchProcess.stderr);
    process.exit(1);
}

const args = processArgs.slice(2);
const ngBuildArgs = ['build', ...args];
console.log("\x1b[33m", "Angular build params: ", ngBuildArgs);

//Trigger angular build with the passed params
const ngPath = path.resolve(process.cwd(), 'node_modules', '.bin', "ng");
const ngBuildProcess = spawnSync(ngPath, ngBuildArgs, { stdio: 'inherit', shell: true });

if (ngBuildProcess.status === 0) {
    console.log('ng build completed successfully!');
} else {
    // TODO: JS heap out of memory error handling
    console.error('Error during ng build:', ngBuildProcess.error || ngBuildProcess.stderr);
    process.exit(1);
}

const postBuildPath = path.join(__dirname, 'post-build.js');
const ngPostBuildArgs = [postBuildPath, ...args];
console.log("Post build params - ", ngPostBuildArgs);

const ngPostBuildProcess = spawnSync('node', ngPostBuildArgs, { stdio: 'inherit' });

if (ngPostBuildProcess.status === 0) {
    console.log('ng post build completed successfully!');
} else {
    console.error('Error during ng build:', ngPostBuildProcess.error || ngPostBuildProcess.stderr);
    process.exit(1);
}
