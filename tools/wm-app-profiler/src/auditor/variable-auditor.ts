import { parseExpression } from '@babel/parser';
import { StudioActionItem } from '../types.js';

export interface VariableAuditResult {
  totalVariables: number;
  startupCount: number;
  unboundedCount: number;
  errorHandlingGaps: number;
  actionItems: StudioActionItem[];
}

/**
 * Statically evaluates a JS object-literal AST node into a plain value, without
 * executing any code. Used instead of `new Function`/`eval` so that auditing an
 * untrusted project's *.variables.ts source can never run arbitrary code.
 */
function staticEvalNode(node: any): any {
  switch (node?.type) {
    case 'ObjectExpression': {
      const obj: Record<string, any> = {};
      for (const prop of node.properties) {
        if (prop.type !== 'ObjectProperty' || prop.computed) continue;
        const key = prop.key.type === 'Identifier' ? prop.key.name : prop.key.value;
        obj[key] = staticEvalNode(prop.value);
      }
      return obj;
    }
    case 'ArrayExpression':
      return node.elements.map((el: any) => (el ? staticEvalNode(el) : null));
    case 'StringLiteral':
    case 'NumericLiteral':
    case 'BooleanLiteral':
      return node.value;
    case 'NullLiteral':
      return null;
    case 'TemplateLiteral':
      return node.quasis.map((q: any) => q.value.cooked).join('');
    case 'UnaryExpression':
      if (node.operator === '-') return -staticEvalNode(node.argument);
      if (node.operator === '+') return staticEvalNode(node.argument);
      return undefined;
    case 'Identifier':
      return node.name === 'undefined' ? undefined : undefined;
    case 'TSAsExpression':
    case 'TSSatisfiesExpression':
      return staticEvalNode(node.expression);
    default:
      return undefined;
  }
}

export function auditVariablesJson(
  variablesContent: string | Record<string, any>,
  pageName: string,
  declaredFunctionNames: string[] = [],
  operationSizeParamMap: Map<string, boolean> | null = null
): VariableAuditResult {
  let vars: Record<string, any> = {};
  if (typeof variablesContent === 'string') {
    let raw = variablesContent.trim();
    if (raw.includes('export const') || raw.includes('=')) {
      const firstBrace = raw.indexOf('{');
      const lastBrace = raw.lastIndexOf('}');
      if (firstBrace !== -1 && lastBrace !== -1) {
        raw = raw.substring(firstBrace, lastBrace + 1);
      }
    }
    try {
      vars = JSON.parse(raw);
    } catch {
      try {
        const ast = parseExpression(raw, { plugins: ['typescript'] });
        vars = staticEvalNode(ast) || {};
      } catch {
        return { totalVariables: 0, startupCount: 0, unboundedCount: 0, errorHandlingGaps: 0, actionItems: [] };
      }
    }
  } else {
    vars = variablesContent || {};
  }

  const actionItems: StudioActionItem[] = [];
  const startupVariables: string[] = [];
  let unboundedCount = 0;
  let errorHandlingGaps = 0;
  const PLACEHOLDER_ONERROR_VALUES = ['javascript', 'js', 'function', 'callback'];

  const entries = Object.entries(vars);
  const totalVariables = entries.length;

  for (const [varName, def] of entries) {
    if (!def || typeof def !== 'object') continue;

    // Check if variable fires on page load
    const isStartup = def.startUpdate === true || (def.autoUpdate === true && def.category !== 'wm.ModelVariable');
    if (isStartup) {
      startupVariables.push(varName);
    }

    // Check unbounded dataset fetch on LiveVariable or ServiceVariable
    const isDataFetch = def.category === 'wm.LiveVariable' || def.category === 'wm.ServiceVariable';
    if (isDataFetch) {
      const maxResults = def.maxResults;
      const isUnbounded = maxResults === undefined || maxResults === null || maxResults === '' || Number(maxResults) > 100;
      if (isUnbounded) {
        unboundedCount++;

        // For wm.LiveVariable, `maxResults` reliably maps straight to the request's 'size' param
        // (verified in live-variable.manager.ts — Studio's own generated CRUD backend always
        // supports page/size). For wm.ServiceVariable it's far less certain: the runtime only
        // patches a parameter literally named 'size' among the operation's OWN declared params
        // (service-variable.manager.ts's getMethodInfo) — if the backend operation doesn't expose
        // one (very common for body-driven/SOAP-wrapped integrations that embed pagination inside
        // the request body instead), setting 'Records per request' in Studio does nothing.
        // Confirmed on a real project: 0 of 571 scanned service operations had a top-level 'size'
        // parameter. Adjust the claim/fix based on whatever service-def data is actually available
        // for this specific operation, rather than assuming the fix works universally.
        let sizeParamStatus: 'confirmed' | 'confirmed-missing' | 'unknown' = 'unknown';
        if (def.category === 'wm.ServiceVariable' && operationSizeParamMap && def.operationId) {
          if (operationSizeParamMap.has(def.operationId)) {
            sizeParamStatus = operationSizeParamMap.get(def.operationId) ? 'confirmed' : 'confirmed-missing';
          }
        }

        if (sizeParamStatus === 'confirmed-missing') {
          actionItems.push({
            id: `${pageName}_${varName}_UNBOUNDED`,
            category: 'QUERY_OVERFETCH',
            severity: 'CRITICAL',
            page: pageName,
            targetVariable: varName,
            title: `Unbounded Data Query in Variable '${varName}' — 'maxResults' Won't Fix This`,
            issueDescription: `Variable '${varName}' has no 'Records per request' limit (maxResults: ${maxResults || 'unlimited'}), and every record is fetched into the browser at once. Unlike the usual case, setting 'maxResults' in Studio won't help here — this variable's underlying operation ('${def.operationId}') has no 'size' parameter of its own (confirmed against this project's service definitions), so the runtime never applies 'Records per request' to the actual request. Its pagination is controlled elsewhere in the request body instead.`,
            studioFix: {
              location: `Studio -> Page '${pageName}' -> Variables Tab -> '${varName}'`,
              stepByStep: [
                `Open the service operation's request body in Studio and look for a pagination-shaped field (e.g. a 'paginationInfo'/'startIndex'+'size' structure).`,
                `Bind that field directly to a small page size (e.g. a variable set to 10-20), the same way this project's other paginated calls already do.`,
                `'Records per request' (maxResults) on this variable has no effect and can be left as-is.`
              ]
            }
          });
        } else {
          const caveat =
            sizeParamStatus === 'unknown' && def.category === 'wm.ServiceVariable'
              ? ` (This assumes the underlying service operation exposes a 'size' parameter — could not be verified from this project's data; confirm in Studio's service operation designer before relying on it.)`
              : '';
          actionItems.push({
            id: `${pageName}_${varName}_UNBOUNDED`,
            category: 'QUERY_OVERFETCH',
            severity: 'CRITICAL',
            page: pageName,
            targetVariable: varName,
            title: `Unbounded Data Query in Variable '${varName}'`,
            issueDescription: `Variable '${varName}' has no 'Records per request' limit (maxResults: ${maxResults || 'unlimited'}). This causes the browser to download and store all records in memory at once, causing heap exhaustion.${caveat}`,
            studioFix: {
              location: `Studio -> Page '${pageName}' -> Variables Tab -> '${varName}'`,
              stepByStep: [
                `Open Page '${pageName}'.`,
                `Navigate to the 'Variables' tab and select '${varName}'.`,
                `Under 'Behavior' / 'Data Configuration' -> set 'Records per request' (maxResults) to 20 or 50.`,
                `Bind the variable to a paginated Table or List widget.`
              ]
            }
          });
        }
      }

      // Check error-handling gaps: no handler configured, a placeholder value instead of a
      // real function, or a handler that points at a function this page's script never declares.
      const onError = typeof def.onError === 'string' ? def.onError.trim() : def.onError;
      if (!onError) {
        // Reporting for this specific case is intentionally suppressed (per explicit user
        // request — real, but not a performance-optimization finding). `errorHandlingGaps` is
        // still counted; the sibling cases below (placeholder value, references a non-existent
        // function) are untouched since those are different, more clearly broken situations.
        errorHandlingGaps++;
      } else if (PLACEHOLDER_ONERROR_VALUES.includes(onError.toLowerCase())) {
        errorHandlingGaps++;
        actionItems.push({
          id: `${pageName}_${varName}_PLACEHOLDER_ONERROR`,
          category: 'ERROR_HANDLING_GAP',
          severity: 'WARNING',
          page: pageName,
          targetVariable: varName,
          title: `Placeholder 'onError' Value on '${varName}'`,
          issueDescription: `Variable '${varName}' has 'onError' set to the literal placeholder string "${onError}", not a real handler function. Failures are silently swallowed.`,
          studioFix: {
            location: `Studio -> Page '${pageName}' -> Variables Tab -> '${varName}'`,
            stepByStep: [
              `Open Page '${pageName}' -> Variables Tab -> '${varName}'.`,
              `Replace the placeholder 'On Error' value with a real handler function.`
            ]
          }
        });
      } else if (declaredFunctionNames.length > 0 && !declaredFunctionNames.includes(onError)) {
        // Reporting for this is intentionally suppressed (per explicit user request) —
        // `errorHandlingGaps` is still counted; this is a real bug (onError set but points at a
        // function that doesn't exist anywhere) so treat removing it from the report as a
        // deliberate choice to keep, not evidence it isn't real.
        errorHandlingGaps++;
      }
    }
  }

  // Check for startup waterfall
  if (startupVariables.length > 5) {
    actionItems.push({
      id: `${pageName}_STARTUP_WATERFALL`,
      category: 'VARIABLE_WATERFALL',
      severity: 'WARNING',
      page: pageName,
      title: `Page Load Variable Waterfall (${startupVariables.length} simultaneous calls)`,
      issueDescription: `Page '${pageName}' triggers ${startupVariables.length} variable calls simultaneously upon page initialization (${startupVariables.slice(0, 4).join(', ')}...). This congests the browser's HTTP connection pool.`,
      studioFix: {
        location: `Studio -> Page '${pageName}' -> Variables Tab`,
        stepByStep: [
          `Review the variables configured on Page '${pageName}'.`,
          `Keep only the critical above-the-fold variable (e.g. user profile / main summary) on page load.`,
          `For secondary data (tabs, modals, charts), uncheck 'Request data on page load' and invoke them on demand (e.g. on tab select or button click).`
        ]
      }
    });
  }

  return {
    totalVariables,
    startupCount: startupVariables.length,
    unboundedCount,
    errorHandlingGaps,
    actionItems
  };
}
