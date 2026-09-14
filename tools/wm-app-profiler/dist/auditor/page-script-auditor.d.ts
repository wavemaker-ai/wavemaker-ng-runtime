import { StudioActionItem } from '../types.js';
export interface ScriptAuditResult {
    leakingTimers: number;
    detachedListeners: number;
    directDomQueries: number;
    debuggerStatements: number;
    /** Byte length of the script content, regardless of whether it could be parsed. */
    scriptSizeBytes: number;
    /** Function names declared/assigned in this script (e.g. `Page.onError = function(){}` -> "onError"),
     *  used to check whether a variable's `onError` callback actually points at something real. */
    declaredFunctionNames: string[];
    actionItems: StudioActionItem[];
}
export declare function auditPageScript(jsContent: string, pageName: string): ScriptAuditResult;
