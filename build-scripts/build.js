const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

let processArgs = process.argv;
if (processArgs.findIndex(arg => arg.startsWith('--max-old-space-size')) !== -1) {
    process.env.NODE_OPTIONS = processArgs.pop();
    console.log("Setting node options: ", process.env.NODE_OPTIONS);
}

// Patch lives only in build-scripts/ (next to this file), shipped in @wavemaker-ai/angular-app as build-scripts/.
const patchPath = path.join(__dirname, 'ngx-bootstrap-patch.mjs');
if (!fs.existsSync(patchPath)) {
    console.error('Cannot find ngx-bootstrap-patch.mjs at', patchPath);
    process.exit(1);
}
console.log('Using ngx-bootstrap patch at:', patchPath);
console.log("\x1b[36m", "Patching ngx-bootstrap ESM files...\x1b[0m");
const patchProcess = spawnSync('node', [patchPath], { stdio: 'inherit' });

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
