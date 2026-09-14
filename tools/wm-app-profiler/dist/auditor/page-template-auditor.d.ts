import { StudioActionItem } from '../types.js';
export interface TemplateAuditResult {
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
    dialogCount: number;
    bindingExpressionCount: number;
    nestedRepeaterCount: number;
    expensiveRowBindingCount: number;
    inactivePaneEagerLoadCount: number;
    actionItems: StudioActionItem[];
}
export declare function auditPageTemplate(htmlContent: string, pageName: string): TemplateAuditResult;
