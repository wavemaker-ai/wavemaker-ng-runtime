import fs from 'fs';
export function pruneAngularJsonScripts(angularJsonPath, unusedLibs) {
    if (!fs.existsSync(angularJsonPath)) {
        return { modified: false, removedScripts: [] };
    }
    let json;
    try {
        json = JSON.parse(fs.readFileSync(angularJsonPath, 'utf8'));
    }
    catch {
        // Unreadable (e.g. permission-restricted) or invalid JSON — skip rather than crash.
        return { modified: false, removedScripts: [] };
    }
    // Locate the scripts array
    const projects = json.projects || {};
    const appProjectKey = Object.keys(projects)[0];
    if (!appProjectKey)
        return { modified: false, removedScripts: [] };
    const buildOptions = projects[appProjectKey]?.architect?.build?.options;
    if (!buildOptions || !Array.isArray(buildOptions.scripts)) {
        return { modified: false, removedScripts: [] };
    }
    const originalScripts = buildOptions.scripts;
    const removedScripts = [];
    // Script patterns to prune based on unused libraries
    const prunePatterns = [];
    for (const lib of unusedLibs) {
        if (lib.scriptFile.includes('d3')) {
            prunePatterns.push('d3.min.js', 'nv.d3.min.js');
        }
        if (lib.scriptFile.includes('summernote')) {
            prunePatterns.push('summernote-lite.min.js');
        }
        if (lib.scriptFile.includes('ztree')) {
            prunePatterns.push('jquery.ztree.all.js', 'keyboard-navigation.js');
        }
    }
    // Also remove global duplicate lodash if present
    prunePatterns.push('lodash/lodash.min.js');
    const filteredScripts = originalScripts.filter(scriptItem => {
        const scriptPath = typeof scriptItem === 'string' ? scriptItem : (scriptItem?.input || '');
        const shouldRemove = prunePatterns.some(pattern => scriptPath.includes(pattern));
        if (shouldRemove) {
            removedScripts.push(scriptPath);
            return false;
        }
        return true;
    });
    if (removedScripts.length > 0) {
        buildOptions.scripts = filteredScripts;
        fs.writeFileSync(angularJsonPath, JSON.stringify(json, null, 2), 'utf8');
        return { modified: true, removedScripts };
    }
    return { modified: false, removedScripts: [] };
}
