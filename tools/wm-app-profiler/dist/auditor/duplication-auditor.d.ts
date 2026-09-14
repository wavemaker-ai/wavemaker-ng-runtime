import { StudioActionItem } from '../types.js';
export interface DuplicationSourceUnit {
    /** Human-readable label already used elsewhere (e.g. pageDetails.pageName, so '[Partial] X' for prefabs/partials). */
    name: string;
    html: string;
    js: string;
    css: string;
}
export declare function auditDuplication(sources: DuplicationSourceUnit[]): {
    actionItems: StudioActionItem[];
};
