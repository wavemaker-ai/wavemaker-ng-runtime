import { StudioActionItem } from '../types.js';
export interface VariableAuditResult {
    totalVariables: number;
    startupCount: number;
    unboundedCount: number;
    errorHandlingGaps: number;
    actionItems: StudioActionItem[];
}
export declare function auditVariablesJson(variablesContent: string | Record<string, any>, pageName: string, declaredFunctionNames?: string[], operationSizeParamMap?: Map<string, boolean> | null): VariableAuditResult;
