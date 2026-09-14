import { parse } from '@babel/parser';
import traverseModule from '@babel/traverse';
import { StudioActionItem } from '../types.js';

// Handle ES module vs CommonJS export interoperability for babel traverse
const traverse = (traverseModule as any).default || traverseModule;

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

export function auditPageScript(jsContent: string, pageName: string): ScriptAuditResult {
  const actionItems: StudioActionItem[] = [];
  let leakingTimers = 0;
  let detachedListeners = 0;
  let directDomQueries = 0;
  let debuggerStatements = 0;
  const declaredFunctionNames: string[] = [];
  const scriptSizeBytes = jsContent ? Buffer.byteLength(jsContent, 'utf8') : 0;

  if (!jsContent || jsContent.trim().length === 0) {
    return {
      leakingTimers,
      detachedListeners,
      directDomQueries,
      debuggerStatements,
      scriptSizeBytes,
      declaredFunctionNames,
      actionItems
    };
  }

  let ast: any;
  try {
    ast = parse(jsContent, {
      sourceType: 'unambiguous',
      plugins: ['typescript']
    });
  } catch {
    // If syntax error in custom JS, return gracefully
    return {
      leakingTimers,
      detachedListeners,
      directDomQueries,
      debuggerStatements,
      scriptSizeBytes,
      declaredFunctionNames,
      actionItems
    };
  }

  const timersCreated: { line: number; name?: string }[] = [];
  let hasClearInterval = false;

  const listenersAdded: { line: number; target: string; event: string }[] = [];
  let hasRemoveEventListener = false;

  traverse(ast, {
    CallExpression(path: any) {
      const callee = path.node.callee;

      // Detect setInterval
      if (
        (callee.type === 'Identifier' && callee.name === 'setInterval') ||
        (callee.type === 'MemberExpression' &&
          callee.object?.name === 'window' &&
          callee.property?.name === 'setInterval')
      ) {
        timersCreated.push({
          line: path.node.loc?.start.line || 1
        });
      }

      // Detect clearInterval
      if (
        (callee.type === 'Identifier' && callee.name === 'clearInterval') ||
        (callee.type === 'MemberExpression' &&
          callee.object?.name === 'window' &&
          callee.property?.name === 'clearInterval')
      ) {
        hasClearInterval = true;
      }

      // Detect window.addEventListener or document.addEventListener
      if (
        callee.type === 'MemberExpression' &&
        (callee.object?.name === 'window' || callee.object?.name === 'document') &&
        callee.property?.name === 'addEventListener'
      ) {
        const eventName = path.node.arguments[0]?.value || 'event';
        listenersAdded.push({
          line: path.node.loc?.start.line || 1,
          target: callee.object.name,
          event: eventName
        });
      }

      // Detect removeEventListener
      if (
        callee.type === 'MemberExpression' &&
        (callee.object?.name === 'window' || callee.object?.name === 'document') &&
        callee.property?.name === 'removeEventListener'
      ) {
        hasRemoveEventListener = true;
      }

      // Detect direct DOM manipulation: document.getElementById, document.querySelector, jQuery
      if (
        callee.type === 'MemberExpression' &&
        callee.object?.name === 'document' &&
        ['getElementById', 'querySelector', 'querySelectorAll', 'getElementsByClassName'].includes(callee.property?.name)
      ) {
        directDomQueries++;
      }
    },

    DebuggerStatement() {
      debuggerStatements++;
    },

    FunctionDeclaration(path: any) {
      if (path.node.id?.name) declaredFunctionNames.push(path.node.id.name);
    },

    AssignmentExpression(path: any) {
      const right = path.node.right;
      if (right?.type !== 'FunctionExpression' && right?.type !== 'ArrowFunctionExpression') return;
      const left = path.node.left;
      if (left?.type === 'Identifier') {
        declaredFunctionNames.push(left.name);
      } else if (left?.type === 'MemberExpression' && !left.computed && left.property?.type === 'Identifier') {
        declaredFunctionNames.push(left.property.name);
      }
    }
  });

  // Evaluate timers without clear
  if (timersCreated.length > 0 && !hasClearInterval) {
    leakingTimers = timersCreated.length;
    actionItems.push({
      id: `${pageName}_TIMER_LEAK`,
      category: 'SCRIPT_LEAK',
      severity: 'CRITICAL',
      page: pageName,
      title: `Uncleared 'setInterval' Timer in Page Script (Line ${timersCreated[0].line})`,
      issueDescription: `Found 'setInterval' on Line ${timersCreated[0].line} in '${pageName}.js' without a corresponding 'clearInterval' inside 'Page.onPageDestroy'. When users navigate away and return, new intervals stack up, leaking memory and consuming 100% CPU.`,
      studioFix: {
        location: `Studio -> Page '${pageName}' -> Script Tab (JavaScript)`,
        stepByStep: [
          `Open Page '${pageName}' and switch to the Script tab.`,
          `Store the interval reference on the Page object: 'Page._myInterval = setInterval(...)'`,
          `Implement 'Page.onPageDestroy' to clear it whenever the user leaves the page:`
        ],
        codeSnippet: `Page.onPageDestroy = function () {\n    if (Page._myInterval) {\n        clearInterval(Page._myInterval);\n    }\n};`
      }
    });
  }

  // Evaluate event listeners without remove
  if (listenersAdded.length > 0 && !hasRemoveEventListener) {
    detachedListeners = listenersAdded.length;
    actionItems.push({
      id: `${pageName}_LISTENER_LEAK`,
      category: 'SCRIPT_LEAK',
      severity: 'WARNING',
      page: pageName,
      title: `Detached Event Listener on '${listenersAdded[0].target}' (Line ${listenersAdded[0].line})`,
      issueDescription: `Found '${listenersAdded[0].target}.addEventListener("${listenersAdded[0].event}", ...)' without 'removeEventListener' in 'Page.onPageDestroy'. Retains detached DOM tree references after navigation.`,
      studioFix: {
        location: `Studio -> Page '${pageName}' -> Script Tab (JavaScript)`,
        stepByStep: [
          `Open Page '${pageName}' Script tab.`,
          `Remove the global listener when the page destroys:`
        ],
        codeSnippet: `Page.onPageDestroy = function () {\n    ${listenersAdded[0].target}.removeEventListener("${listenersAdded[0].event}", Page._eventHandler);\n};`
      }
    });
  }

  // Reporting for this is intentionally suppressed (per explicit user request) — `debuggerStatements`
  // is still counted below and still returned in scriptIssues, and `patch` still silently strips
  // every 'debugger;' statement (source-patcher.ts's own independent AST scan); only the audit
  // report finding itself was removed.

  return {
    leakingTimers,
    detachedListeners,
    directDomQueries,
    debuggerStatements,
    scriptSizeBytes,
    declaredFunctionNames,
    actionItems
  };
}
