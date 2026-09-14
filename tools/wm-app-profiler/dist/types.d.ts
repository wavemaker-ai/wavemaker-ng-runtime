/**
 * Data structures for WaveMaker App Performance Auditor & Resource Profiler
 */
export type Severity = 'CRITICAL' | 'WARNING' | 'INFO';
export interface StudioActionItem {
    id: string;
    category: 'DOM_PAGINATION' | 'VARIABLE_WATERFALL' | 'QUERY_OVERFETCH' | 'SCRIPT_LEAK' | 'DOM_DEPTH' | 'HEAVY_WIDGET' | 'DEBUGGER_STATEMENT' | 'EXCESSIVE_DIALOGS' | 'MISSING_DEFERLOAD' | 'MONOLITHIC_PAGE' | 'EXCESSIVE_BINDINGS' | 'ERROR_HANDLING_GAP' | 'OVERSIZED_PAYLOAD' | 'NESTED_REPEATER' | 'EXPENSIVE_ROW_BINDING' | 'INACTIVE_PANE_EAGER_LOAD' | 'PREFAB_OVERHEAD' | 'SLOW_TAB_SWITCH' | 'DUPLICATED_HTML_BLOCK' | 'DUPLICATED_JS_LOGIC' | 'DUPLICATED_CSS_RULE' | 'OVERSIZED_IMAGE' | 'DEAD_PAGE_CANDIDATE' | 'STRUCTURAL_VALIDITY' | 'NEAR_DUPLICATE_HTML_BLOCK' | 'MERGEABLE_PARTIALS' | 'SPLIT_CANDIDATE' | 'APP_LEVEL_VARIABLE_REUSE_CANDIDATE' | 'RENDER_BLOCKING_SCRIPT' | 'RENDER_BLOCKING_CSS' | 'VENDOR_SOURCEMAPS_ENABLED' | 'LICENSE_EXTRACTION_ENABLED' | 'CI_BUILD_CACHE_DISABLED' | 'SELF_NESTED_DEPENDENCY' | 'TRUST_AS_HTML_RISK' | 'STALE_GENERATED_WORKSPACE';
    severity: Severity;
    page: string;
    targetWidget?: string;
    targetVariable?: string;
    title: string;
    issueDescription: string;
    studioFix: {
        location: string;
        stepByStep: string[];
        codeSnippet?: string;
    };
}
export interface PageAuditDetail {
    pageName: string;
    filePath: string;
    widgetCount: number;
    maxDomDepth: number;
    unpaginatedWidgets: string[];
    widgetsPresent: {
        charts: boolean;
        richText: boolean;
        tree: boolean;
        tables: number;
        lists: number;
    };
    variables: {
        total: number;
        startupCount: number;
        unboundedCount: number;
    };
    scriptIssues: {
        leakingTimers: number;
        detachedListeners: number;
        directDomQueries: number;
        debuggerStatements: number;
    };
    dialogCount: number;
    bindingExpressionCount: number;
    nestedRepeaterCount: number;
    expensiveRowBindingCount: number;
    inactivePaneEagerLoadCount: number;
    /**
     * This page's own health score (0-100, same formula as the project-wide `overallScore`, scoped
     * to just this page's action items). Lets a large multi-page app be triaged by "fix this page
     * first" instead of only reading raw per-column counts in the risk matrix.
     */
    riskScore: number;
    /** Raw byte size of this page's .html / .js / .variables.json (or their generated-app equivalents). */
    fileSizesBytes: {
        html: number;
        script: number;
        variablesJson: number;
    };
}
export interface AppPerformanceReport {
    projectName: string;
    projectPath: string;
    analyzedAt: string;
    overallScore: number;
    totalPages: number;
    totalWidgets: number;
    totalVariables: number;
    actionItems: StudioActionItem[];
    pages: PageAuditDetail[];
    unusedGlobalLibraries: {
        libraryName: string;
        scriptFile: string;
        savedKB: number;
        /**
         * True when ng-codegen already marked this script inject:false/bundleName (fetched on demand
         * per-page, not injected into index.html). An unused library in that state costs nothing at
         * runtime — only build output size — unlike one still injected unconditionally (e.g. zTree,
         * which ng-codegen doesn't mark lazy).
         */
        alreadyLazy?: boolean;
    }[];
    /**
     * True when `projectPath` looks like a *generated* Angular workspace (ng-codegen output)
     * rather than the original WM Source project. Widget-level Part A checks (pagination, DOM
     * depth, heavy widgets) only recognize WM Source's `<wm-table>` tag-name markup dialect —
     * ng-codegen instead emits standard HTML tags carrying camelCase attribute directives
     * (e.g. `wmTable` as an attribute on a `<div>`), which these checks cannot see. When true,
     * Part A findings here are unreliable/incomplete; re-run against the WM Source project.
     */
    isGeneratedAngularWorkspace: boolean;
    /**
     * Set when `projectPath` itself couldn't be read at all (e.g. permission-restricted). When
     * present, every count/score above is meaningless — the scan found nothing because it
     * couldn't read anything, not because the project is actually clean.
     */
    rootReadError?: string;
    /** Undefined when the project has no `WEB-INF/prefabs` directory at all (nothing to summarize). */
    prefabOverheadSummary?: {
        totalPrefabs: number;
        neverUsed: number;
        singleUse: number;
        genuinelyReused: number;
    };
}
export interface MemorySample {
    timestamp: number;
    phase: string;
    /** Total RSS summed across the monitored root process and every live descendant at this tick. */
    rssMB: number;
    /** How many processes (root + descendants) contributed to `rssMB` at this tick. */
    processCount: number;
    cpuPercent?: number;
}
/** Peak memory contribution of one kind of process (e.g. "node" main build vs Terser workers). */
export interface ProcessRoleUsage {
    /** Command name as reported by `ps` (e.g. "node"), not a specific PID — PIDs are transient. */
    role: string;
    peakRssMB: number;
    /** Highest number of concurrent processes of this role seen at any single sample. */
    peakConcurrentCount: number;
}
export interface BuildResourceReport {
    projectName: string;
    /** Peak total RSS across the whole process tree (root process + all descendants) at any sample. */
    peakRssMB: number;
    initialNodeLimitMB?: number;
    recommendedNodeLimitMB: number;
    /**
     * Total physical RAM (MB) on the machine that ran this `monitor` build — not necessarily the
     * eventual CI/deploy target, but directly actionable when `monitor` is run on that machine (or
     * on one provisioned the same way). Lets `recommendedNodeLimitMB` be checked against something
     * concrete instead of read in isolation.
     */
    systemTotalMemMB: number;
    buildDurationSec: number;
    phaseBreakdown: {
        phase: string;
        durationSec: number;
        peakMemoryMB: number;
        /** Which process roles contributed to this phase's peak, highest first. */
        roleBreakdown: ProcessRoleUsage[];
    }[];
    vendorSourceMapsDisabled: boolean;
    /** Only present when a baseline (unpatched) peak RSS was supplied to compare against. */
    measuredMemorySavedMB?: number;
    samples: MemorySample[];
}
export interface AutoPatchResult {
    patchedAngularJson: boolean;
    removedScripts: string[];
    sourceMapsOptimized: boolean;
    licenseExtractionDisabled: boolean;
    buildCacheEnabled?: boolean;
    patchedSourceVariablesCount?: number;
    patchedSourceWidgetsCount?: number;
    patchedDeferloadCount?: number;
    patchedDebuggerStatementsCount?: number;
    patchedRenderBlockingScriptsCount?: number;
    modifiedSourceFiles?: string[];
    skippedWidgetPatchReason?: string;
    summary: string;
}
export interface FullAuditReport {
    appPerformance: AppPerformanceReport;
    buildResources?: BuildResourceReport;
    patchResult?: AutoPatchResult;
}
