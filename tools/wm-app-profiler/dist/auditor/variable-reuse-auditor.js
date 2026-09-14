// Data/action-fetching categories worth checking for reuse — "API services" (ServiceVariable/
// LiveVariable) and "actions" (NavigationVariable/NotificationVariable). Deliberately excludes
// plain wm.Variable (often intentionally page-local model/state with a fresh starting value per
// page) and wm.TimerVariable (usually page-specific timing behavior, not shared reference data).
const REUSE_CHECK_CATEGORIES = new Set(['wm.ServiceVariable', 'wm.LiveVariable', 'wm.NavigationVariable', 'wm.NotificationVariable']);
/** Deterministic JSON stringify (sorted keys at every level) so two logically-identical variable
 * definitions hash the same even if their source files happened to serialize keys in a different
 * order. */
function stableStringify(value) {
    if (Array.isArray(value)) {
        return `[${value.map(stableStringify).join(',')}]`;
    }
    if (value && typeof value === 'object') {
        const keys = Object.keys(value).sort();
        return `{${keys.map(k => `${JSON.stringify(k)}:${stableStringify(value[k])}`).join(',')}}`;
    }
    return JSON.stringify(value);
}
/**
 * Finds a variable/action (by name + full configuration) that's independently redefined,
 * byte-for-byte identically, across multiple distinct pages/partials/prefabs — instead of being
 * defined once as a shared App-level variable and reused everywhere. Confirmed real on a client
 * project: lookup-table LiveVariables like 'AmassetType' redefined identically across 25 separate
 * pages, 'Amasset' across 23, 'AmassetClass' across 17 — each one independently re-fetching the
 * same reference data on every page load instead of loading it once at the App level.
 *
 * Deliberately requires an EXACT match on the full definition (minus `_id`/`owner`, which are
 * expected to differ per copy and aren't meaningful to the comparison) rather than just a matching
 * name or operationId — a shared name/operation alone can legitimately serve different purposes
 * per page (e.g. Cortex's generic 'cortex_searchUsingPOST_42' search endpoint reused by
 * differently-configured variables for entirely different entities). Exact-match keeps this
 * precise: only genuinely-the-same variable gets flagged, never a coincidental resemblance.
 */
export function auditVariableReuse(sources) {
    const actionItems = [];
    // key: `${category}::${varName}::${hash}` -> distinct source names that define it identically
    const occurrences = new Map();
    for (const src of sources) {
        if (!src.variablesContent)
            continue;
        let vars;
        try {
            vars = JSON.parse(src.variablesContent);
        }
        catch {
            continue;
        }
        if (!vars || typeof vars !== 'object')
            continue;
        for (const [varName, defn] of Object.entries(vars)) {
            if (!defn || typeof defn !== 'object')
                continue;
            const category = defn.category;
            if (!REUSE_CHECK_CATEGORIES.has(category))
                continue;
            const normalized = { ...defn };
            delete normalized._id;
            delete normalized.owner;
            delete normalized.name;
            const hash = stableStringify(normalized);
            const key = `${category}::${varName}::${hash}`;
            if (!occurrences.has(key))
                occurrences.set(key, { category, varName, sources: new Set() });
            occurrences.get(key).sources.add(src.name);
        }
    }
    for (const { category, varName, sources: srcSet } of occurrences.values()) {
        if (srcSet.size < 2)
            continue;
        const distinctSources = Array.from(srcSet);
        const isAction = category === 'wm.NavigationVariable' || category === 'wm.NotificationVariable';
        const kind = isAction ? 'action' : 'variable';
        const displayList = distinctSources.length > 8 ? `${distinctSources.slice(0, 8).join(', ')}, and ${distinctSources.length - 8} more` : distinctSources.join(', ');
        actionItems.push({
            id: `APP_LEVEL_REUSE_${category}_${varName}`,
            category: 'APP_LEVEL_VARIABLE_REUSE_CANDIDATE',
            severity: 'WARNING',
            page: 'App (Global)',
            targetVariable: varName,
            title: `${kind === 'action' ? 'Action' : 'Variable'} '${varName}' Redefined Identically Across ${distinctSources.length} Pages`,
            issueDescription: `'${varName}' (${category}) is defined with the exact same configuration independently on ${distinctSources.length} separate pages/prefabs (${displayList}), instead of once as a shared App-level ${kind}. Each page's copy loads/invokes separately — ${distinctSources.length}x the network calls for what is functionally one piece of ${kind === 'action' ? 'logic' : 'data'}, and ${distinctSources.length}x the places to update it.`,
            studioFix: {
                location: `Studio -> App Variables/Actions`,
                stepByStep: [
                    `Create one App-level ${kind === 'action' ? 'Action' : 'Variable'} with '${varName}'s configuration.`,
                    `Update each of the ${distinctSources.length} pages to reference 'App.${kind === 'action' ? 'Actions' : 'Variables'}.${varName}' instead of keeping its own local copy.`,
                    `Delete the ${distinctSources.length} redundant page-level copies once every reference is repointed.`
                ]
            }
        });
    }
    return { actionItems };
}
