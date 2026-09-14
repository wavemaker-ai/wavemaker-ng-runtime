import fs from 'fs';
import path from 'path';
/**
 * Scans a WM Source project for `prefab-servicedefs/*.json` files (the only place service
 * operation metadata is actually exported in a WM Source zip — there's no project-root
 * equivalent) and builds a map of operationId -> whether that operation's own parameter list
 * declares a literal `size` parameter.
 *
 * Why this matters: a ServiceVariable's `maxResults` only ever reaches the actual HTTP request
 * when the underlying operation has a parameter literally named `size` (verified against
 * service-variable.manager.ts's `getMethodInfo` — it patches `param.sampleValue` only for
 * parameters in `['page', 'size', 'sort']` that the operation itself declares). Confirmed on a
 * real project (Cortex): 0 of 571 scanned operations had a top-level `size` parameter — every one
 * embeds its pagination inside the request body instead (a `paginationInfo`-shaped field), which
 * `maxResults` never touches. So for many real integrations, "just set maxResults" is a no-op,
 * the same failure mode already found and fixed for `deferload`.
 *
 * Returns `null` (not an empty map) when no service-def files were found at all, so callers can
 * distinguish "verified this operation has no size param" from "never had data to check" instead
 * of treating both the same way.
 */
export function scanServiceOperationSizeParams(projectRoot) {
    const files = [];
    function walk(dir, depth) {
        if (depth > 6)
            return;
        let entries;
        try {
            entries = fs.readdirSync(dir, { withFileTypes: true });
        }
        catch {
            return;
        }
        for (const entry of entries) {
            if (entry.name.startsWith('.') || entry.name === 'node_modules' || entry.name === 'dist')
                continue;
            const full = path.join(dir, entry.name);
            if (entry.isDirectory()) {
                walk(full, depth + 1);
            }
            else if (entry.isFile() && entry.name.endsWith('.json') && dir.includes('servicedefs')) {
                files.push(full);
            }
        }
    }
    walk(projectRoot, 0);
    if (files.length === 0)
        return null;
    const result = new Map();
    for (const file of files) {
        let data;
        try {
            data = JSON.parse(fs.readFileSync(file, 'utf8'));
        }
        catch {
            continue;
        }
        if (!data || typeof data !== 'object')
            continue;
        for (const [operationId, op] of Object.entries(data)) {
            if (!op || typeof op !== 'object')
                continue;
            const parameters = op?.wmServiceOperationInfo?.parameters;
            if (!Array.isArray(parameters))
                continue;
            const hasSizeParam = parameters.some((p) => p && p.name === 'size');
            // A later file confirming `true` should win over an earlier `false` for the same
            // operationId (the same operation may be duplicated per-prefab; only need one match).
            if (hasSizeParam || !result.has(operationId)) {
                result.set(operationId, hasSizeParam || (result.get(operationId) ?? false));
            }
        }
    }
    return result;
}
