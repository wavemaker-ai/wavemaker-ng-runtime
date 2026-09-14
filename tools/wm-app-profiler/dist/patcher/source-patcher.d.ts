export interface SourcePatchResult {
    patchedVariablesCount: number;
    patchedWidgetsCount: number;
    patchedDeferloadCount: number;
    patchedDebuggerStatementsCount: number;
    patchedRenderBlockingScriptsCount: number;
    modifiedFiles: string[];
    /** Set when the HTML widget-pagination patch was skipped (see isGeneratedAngularWorkspace). */
    skippedWidgetPatchReason?: string;
}
/**
 * Automatically patches WaveMaker Source project files (HTML markup & variables.json)
 */
export declare function patchWaveMakerSourceProject(projectRoot: string): SourcePatchResult;
