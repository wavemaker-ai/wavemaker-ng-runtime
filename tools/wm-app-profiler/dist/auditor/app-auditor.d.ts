import { AppPerformanceReport } from '../types.js';
/**
 * A *generated* Angular workspace (ng-codegen output) has `angular.json` plus a
 * component-based `src/app` tree; the original WM Source project instead lays pages out
 * under `src/main/webapp`. Widget-tag-based Part A checks only understand the Source dialect.
 */
export declare function isGeneratedAngularWorkspace(projectRoot: string): boolean;
export declare function auditWaveMakerApp(projectRoot: string): AppPerformanceReport;
/**
 * Narrows a full-project report down to a single page (case-insensitive match against
 * `PageAuditDetail.pageName`, so it also matches a partial's `[Partial] Name` form). Recomputes
 * totals/score from just that page's data rather than reusing the whole-project numbers.
 * Returns `null` if no page matches, so the caller can list what page names were actually found.
 */
export declare function filterReportToPage(report: AppPerformanceReport, pageName: string): AppPerformanceReport | null;
