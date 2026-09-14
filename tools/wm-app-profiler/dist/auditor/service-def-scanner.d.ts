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
export declare function scanServiceOperationSizeParams(projectRoot: string): Map<string, boolean> | null;
