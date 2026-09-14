import { StudioActionItem } from '../types.js';
export interface VariableReuseSourceUnit {
    /** Human-readable label, e.g. pageDetails.pageName ('[Partial] X' for prefabs/partials). */
    name: string;
    variablesContent: string;
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
export declare function auditVariableReuse(sources: VariableReuseSourceUnit[]): {
    actionItems: StudioActionItem[];
};
