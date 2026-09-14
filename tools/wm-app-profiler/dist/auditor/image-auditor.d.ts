import { StudioActionItem } from '../types.js';
/**
 * Resolves each statically-referenced image against the project's real webapp root and flags
 * ones over 300KB (WARNING) or 800KB (CRITICAL) — sized directly from the file on disk, never
 * estimated. A reference that can't be resolved to a real file is silently skipped rather than
 * guessed at (e.g. a path relative to a prefab's own resource folder instead of the app root).
 */
export declare function auditPageImages(htmlContent: string, pageName: string, webappRoot: string): StudioActionItem[];
/**
 * Project-wide pass (like PREFAB_OVERHEAD/duplication) over every page/partial name, flagging
 * ones whose name itself signals it's a leftover backup/test copy rather than live content.
 * Advisory only (WARNING) — deletion needs a human to confirm nothing still references it.
 */
export declare function auditDeadPageNames(pageNames: string[]): StudioActionItem[];
