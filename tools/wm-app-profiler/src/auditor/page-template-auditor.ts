import * as cheerio from 'cheerio';
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

export function auditPageTemplate(htmlContent: string, pageName: string): TemplateAuditResult {
  const $ = cheerio.load(htmlContent, { xmlMode: false });
  const actionItems: StudioActionItem[] = [];

  // Count WaveMaker widgets (any tag starting with wm- or with wm attribute)
  let widgetCount = 0;
  $('*').each((_, el) => {
    const tagName = (el as any).tagName?.toLowerCase() || (el as any).name?.toLowerCase() || '';
    if (tagName.startsWith('wm-') || $(el).attr('wm') !== undefined) {
      widgetCount++;
    }
  });

  // Calculate maximum DOM depth recursively
  let maxDomDepth = 0;
  function computeDepth(element: any, currentDepth: number) {
    if (currentDepth > maxDomDepth) {
      maxDomDepth = currentDepth;
    }
    $(element).children().each((_, child) => {
      computeDepth(child, currentDepth + 1);
    });
  }

  $('body, wm-page').each((_, root) => {
    computeDepth(root, 1);
  });

  // Monolithic page: too many widgets rendered on one page regardless of which flow is active
  if (widgetCount > 1000) {
    actionItems.push({
      id: `${pageName}_MONOLITHIC_PAGE`,
      category: 'MONOLITHIC_PAGE',
      severity: 'CRITICAL',
      page: pageName,
      title: `Monolithic Page (${widgetCount} widgets)`,
      issueDescription: `Page '${pageName}' renders ${widgetCount} widgets. Pages carrying markup for multiple independent flows (e.g. one page per feature/tab, all rendered at once) compile and enter the digest cycle for every widget at bootstrap, even though only one flow is visible at a time.`,
      studioFix: {
        location: `Studio Canvas -> Page '${pageName}'`,
        stepByStep: [
          `Identify independent flows/sections that don't need to be visible simultaneously.`,
          `Split each into its own page or partial, loaded on demand (e.g. via navigation or a Tab's on-select), instead of keeping all of them on one page.`
        ]
      }
    });
  } else if (widgetCount > 500) {
    actionItems.push({
      id: `${pageName}_MONOLITHIC_PAGE`,
      category: 'MONOLITHIC_PAGE',
      severity: 'WARNING',
      page: pageName,
      title: `Large Page (${widgetCount} widgets)`,
      issueDescription: `Page '${pageName}' renders ${widgetCount} widgets, on the high side for a single page. Consider whether some of this markup belongs in a separate page/partial loaded on demand.`,
      studioFix: {
        location: `Studio Canvas -> Page '${pageName}'`,
        stepByStep: [
          `Review whether this page combines multiple independent flows that could be split into separate pages or partials.`
        ]
      }
    });
  }

  // Dialog count and deferload usage — dialog markup that's always compiled/mounted regardless
  // of whether the dialog is ever opened is a known, isolation-tested driver of slow page loads.
  const dialogCount = $('wm-dialog').length;

  // NOTE on dialogs specifically: <wm-dialog>'s entire content sits inside an <ng-template> in
  // dialog.component.html and is only instantiated on .open() via ngx-bootstrap's BsModalService —
  // verified directly against ng-runtime source. It is NEVER compiled/mounted at page load
  // regardless of dialog count or 'deferload', so neither check below claims otherwise or
  // suggests 'deferload' as a dialog fix (it was previously suggested here and does nothing for
  // dialogs — see the deferload verification below for why).
  if (dialogCount > 50) {
    actionItems.push({
      id: `${pageName}_EXCESSIVE_DIALOGS`,
      category: 'EXCESSIVE_DIALOGS',
      severity: 'CRITICAL',
      page: pageName,
      title: `Excessive Dialog Count (${dialogCount} dialogs)`,
      issueDescription: `Page '${pageName}' contains ${dialogCount} <wm-dialog> elements. Each one is only instantiated when actually opened (never eagerly mounted), but this many still means more markup to ship/parse in this page's component and more definitions to maintain.`,
      studioFix: {
        location: `Studio Canvas -> Page '${pageName}'`,
        stepByStep: [
          `Consolidate dialogs that only wrap a single prefab/widget into one shared dialog with content swapped conditionally.`,
          `If several dialogs are near-identical, extract the shared markup into a Partial instead of keeping separate copies.`
        ]
      }
    });
  } else if (dialogCount > 20) {
    actionItems.push({
      id: `${pageName}_EXCESSIVE_DIALOGS`,
      category: 'EXCESSIVE_DIALOGS',
      severity: 'WARNING',
      page: pageName,
      title: `High Dialog Count (${dialogCount} dialogs)`,
      issueDescription: `Page '${pageName}' contains ${dialogCount} <wm-dialog> elements, on the high side for a single page.`,
      studioFix: {
        location: `Studio Canvas -> Page '${pageName}'`,
        stepByStep: [`Review whether some dialogs can be consolidated into one shared, parameterized dialog.`]
      }
    });
  }

  // 'deferload' only ever becomes a real, working deferral (a genuine *lazyLoad wrapper, verified
  // against the actual transpiler) when the SAME widget also carries a show.bind/show="bind:..."
  // expression — the transpiler reuses that expression as the lazy-load trigger. Without
  // show.bind, setting deferload="true" is silently a no-op. Confirmed empirically on a real
  // project: 0/188 real <wm-dialog> tags and only 5/211 real <wm-prefab> tags had show.bind at
  // all — so this check (and the patch tool's fix) now only fires for the combination that
  // actually does something, instead of recommending 'just add deferload' universally regardless
  // of whether it would have any effect.
  const hasShowBind = (el: any) => {
    const showBind = $(el).attr('show.bind');
    const show = $(el).attr('show');
    return !!showBind || (!!show && show.startsWith('bind:'));
  };
  const deferrablePrefabs = $('wm-prefab').filter((_, el) => hasShowBind(el) && $(el).attr('deferload') !== 'true');
  if (deferrablePrefabs.length > 0) {
    actionItems.push({
      id: `${pageName}_MISSING_DEFERLOAD`,
      category: 'MISSING_DEFERLOAD',
      severity: 'WARNING',
      page: pageName,
      title: `${deferrablePrefabs.length} Conditionally-Shown Prefab(s) Without 'deferload'`,
      issueDescription: `Page '${pageName}' has ${deferrablePrefabs.length} <wm-prefab> element(s) that are already conditionally shown (via 'show') but missing 'deferload="true"'. Adding it here actually takes effect — the transpiler turns 'show' + 'deferload' into a real deferred-render wrapper, so the prefab won't compile/mount until its 'show' condition becomes true.`,
      studioFix: {
        location: `Studio Canvas -> Page '${pageName}'`,
        stepByStep: [
          `Select each flagged prefab (already bound to 'show').`,
          `In the Properties Panel, enable 'Defer Load' (deferload) alongside the existing 'show' condition.`
        ]
      }
    });
  }

  // Tab panes, wizard steps, and accordion panes compile and mount their content immediately at
  // page bootstrap regardless of active/expanded state — toggling active/expanded state only
  // flips a CSS class / the DOM 'hidden' attribute, it never removes the pane's subtree or defers
  // its compilation. So any variable that auto-loads inside a pane the user hasn't opened yet
  // still fires immediately. This part is solidly verified real.
  //
  // What 'deferload="true"' actually does about it is much narrower than it first appears, and
  // this check now reflects that precisely (re-verified after an earlier version of this check
  // recommended 'just add deferload' universally, which turned out to be wrong for most cases):
  //   - `$lazyLoad` on TabPaneComponent/AccordionPaneComponent/WizardStepComponent/PanelComponent
  //     is declared `= noop` and is NEVER reassigned anywhere in ng-runtime — confirmed via a
  //     repo-wide search for `.$lazyLoad =`. Calling it does nothing; it's dead code.
  //   - The only mechanism that genuinely defers compilation is the transpiler's generic
  //     show.bind + deferload -> `*lazyLoad` structural-directive conversion (the same one
  //     verified for prefabs) — it requires the pane to ALSO carry a `show.bind`/`show="bind:..."`
  //     expression, which most tab/wizard/accordion panes don't have (they're driven by
  //     active/expanded state, not a developer-authored show binding). Confirmed empirically: of
  //     313 real tab/wizard/accordion pane tags across 3 real projects, only 88 (~28%) had
  //     show.bind at all.
  // So this check now splits into the case where deferload genuinely helps (show.bind present)
  // and the case where it doesn't — recommending a fix that works either way for the latter,
  // instead of pointing at an attribute that's very likely a no-op.
  let deferrablePaneCount = 0;
  let nonDeferrablePaneCount = 0;

  const hasShowBindAttr = (pane: any) => {
    const showBind = $(pane).attr('show.bind');
    const show = $(pane).attr('show');
    return !!showBind || (!!show && show.startsWith('bind:'));
  };
  const auditInactivePane = (pane: any) => {
    if ($(pane).attr('deferload') === 'true') return;
    if (hasShowBindAttr(pane)) {
      deferrablePaneCount++;
    } else {
      nonDeferrablePaneCount++;
    }
  };

  // Tabs/wizard: exactly one pane is shown by default per container — whichever carries
  // active="true", or the first one in document order if none does. Every sibling pane is
  // inactive by default and should defer its content.
  const auditDefaultActivePanes = (containerSelector: string, paneSelector: string) => {
    $(containerSelector).each((_, container) => {
      const panes = $(container).children(paneSelector);
      if (panes.length < 2) return;
      const paneArr = panes.toArray();
      let activeIndex = paneArr.findIndex(p => $(p).attr('active') === 'true');
      if (activeIndex === -1) activeIndex = 0;
      paneArr.forEach((pane, idx) => {
        if (idx === activeIndex) return;
        auditInactivePane(pane);
      });
    });
  };
  auditDefaultActivePanes('wm-tabs', 'wm-tabpane');
  auditDefaultActivePanes('wm-wizard', 'wm-wizardstep');

  // Accordion: no pane is expanded by default unless explicitly marked active="true" — every
  // other pane is collapsed from the start and should defer its content.
  $('wm-accordion').each((_, container) => {
    $(container)
      .children('wm-accordionpane')
      .each((_, pane) => auditInactivePane(pane));
  });

  if (deferrablePaneCount > 0) {
    actionItems.push({
      id: `${pageName}_INACTIVE_PANE_EAGER_LOAD`,
      category: 'INACTIVE_PANE_EAGER_LOAD',
      severity: 'WARNING',
      page: pageName,
      title: `${deferrablePaneCount} Tab/Wizard/Accordion Pane(s) Loading Eagerly While Inactive`,
      issueDescription: `Page '${pageName}' has ${deferrablePaneCount} tab pane / wizard step / accordion pane element(s) that already have a 'show'/'show.bind' condition but are missing 'deferload="true"'. Adding it here actually works — the transpiler turns show + deferload into a real deferred-render wrapper, so content compiles/mounts only once the pane's own condition becomes true.`,
      studioFix: {
        location: `Studio Canvas -> Page '${pageName}'`,
        stepByStep: [
          `Select each flagged pane (already bound to 'show').`,
          `In the Properties Panel, enable 'Defer Load' (deferload) alongside the existing 'show' condition.`
        ]
      }
    });
  }

  if (nonDeferrablePaneCount > 0) {
    actionItems.push({
      id: `${pageName}_INACTIVE_PANE_NO_SHOW_BIND`,
      category: 'INACTIVE_PANE_EAGER_LOAD',
      severity: 'WARNING',
      page: pageName,
      title: `${nonDeferrablePaneCount} Tab/Wizard/Accordion Pane(s) Load Eagerly, and 'deferload' Won't Help Here`,
      issueDescription: `Page '${pageName}' has ${nonDeferrablePaneCount} tab pane / wizard step / accordion pane element(s) that compile and fire any auto-loading variable immediately, even though they aren't shown by default. Unlike the case above, these panes have no 'show'/'show.bind' condition, so 'deferload="true"' has nothing to attach to and won't defer anything on its own.`,
      studioFix: {
        location: `Studio Canvas -> Page '${pageName}'`,
        stepByStep: [
          `For each variable bound inside these panes, turn off 'Auto Update'/'Update on Page load' in its Behavior settings.`,
          `Instead, invoke that variable manually from the pane's 'On Select'/'On Expand' event, so it only fires once the user actually opens that tab/step/pane.`
        ]
      }
    });
  }

  // An unpaginated table/list rendered inside a tab pane / wizard step / accordion pane is the
  // direct, verified explanation for "switching tabs with large data is slow": whenever that
  // pane's content compiles (at page load if it isn't deferred, or on first activation if it
  // is), every row of the unbounded dataset renders in one pass, right as the user switches to
  // it. Confirmed real: 27 occurrences in Cortex prefabs alone (e.g. FeeSetLinks, IssuerRiskSetLinks,
  // VPanProfileDetail), plus 2 in the NestedWidgets test project.
  const slowTabSwitchWidgets: string[] = [];
  $('wm-tabpane, wm-wizardstep, wm-accordionpane').each((_, pane) => {
    $(pane)
      .find('wm-table, wm-grid, wm-list')
      .each((_, w) => {
        const nav = $(w).attr('navigation');
        const scroll = $(w).attr('scrollmode');
        if (nav === 'None' && scroll !== 'virtual') {
          slowTabSwitchWidgets.push($(w).attr('name') || $(w).attr('id') || 'unnamedWidget');
        }
      });
  });
  // Reporting for this is intentionally suppressed (per explicit user request) — the detection
  // logic above is left in place in case it's needed again, only the audit report finding itself
  // was removed.

  // Binding expression volume — every `bind:` expression adds continuous digest-cycle overhead.
  const bindingExpressionCount = (htmlContent.match(/\bbind:/g) || []).length;
  if (bindingExpressionCount > 3000) {
    actionItems.push({
      id: `${pageName}_EXCESSIVE_BINDINGS`,
      category: 'EXCESSIVE_BINDINGS',
      severity: 'CRITICAL',
      page: pageName,
      title: `Excessive Binding Expressions (${bindingExpressionCount})`,
      issueDescription: `Page '${pageName}' has ${bindingExpressionCount} 'bind:' expressions. At this scale, two-way data binding adds significant continuous digest-cycle overhead, independent of markup size.`,
      studioFix: {
        location: `Studio Canvas -> Page '${pageName}'`,
        stepByStep: [
          `Split independent sections of this page into separate pages/partials so fewer bindings are active at once.`,
          `Replace bindings that don't need to be reactive (values that are set once and never change) with static values.`
        ]
      }
    });
  } else if (bindingExpressionCount > 1000) {
    actionItems.push({
      id: `${pageName}_EXCESSIVE_BINDINGS`,
      category: 'EXCESSIVE_BINDINGS',
      severity: 'WARNING',
      page: pageName,
      title: `High Binding Expression Count (${bindingExpressionCount})`,
      issueDescription: `Page '${pageName}' has ${bindingExpressionCount} 'bind:' expressions, on the high side for a single page.`,
      studioFix: {
        location: `Studio Canvas -> Page '${pageName}'`,
        stepByStep: [`Review whether this page could be split so fewer bindings are active at once.`]
      }
    });
  }

  // Check DOM depth threshold
  if (maxDomDepth > 14) {
    actionItems.push({
      id: `${pageName}_DOM_DEPTH`,
      category: 'DOM_DEPTH',
      severity: 'WARNING',
      page: pageName,
      title: `Excessive DOM Hierarchy (Depth: ${maxDomDepth})`,
      issueDescription: `Container elements are nested ${maxDomDepth} levels deep on page '${pageName}'. Deep DOM hierarchies slow down style calculation and browser rendering.`,
      studioFix: {
        location: `Studio Canvas -> Page '${pageName}'`,
        stepByStep: [
          `Open Page '${pageName}' on the Studio canvas.`,
          `Inspect nested layout containers (wm-layoutgrid -> wm-gridrow -> wm-gridcolumn).`,
          `Flatten unnecessary wrapper containers by moving child widgets into a single wm-container with flex layout.`
        ]
      }
    });
  }

  // Detect heavy widgets
  const chartsCount = $('wm-chart, wm-nvd3-chart').length;
  const richTextCount = $('wm-richtexteditor').length;
  const treeCount = $('wm-tree').length;
  const tablesCount = $('wm-table, wm-grid').length;
  const listsCount = $('wm-list').length;

  // Check if landing/Main page contains heavy widgets
  if ((pageName.toLowerCase() === 'main' || pageName.toLowerCase() === 'home') && (chartsCount > 0 || richTextCount > 0)) {
    actionItems.push({
      id: `${pageName}_HEAVY_LANDING_WIDGET`,
      category: 'HEAVY_WIDGET',
      severity: 'WARNING',
      page: pageName,
      title: `Heavy Widgets on Default Landing Page '${pageName}'`,
      issueDescription: `The default landing page contains heavy widgets (${chartsCount > 0 ? 'Charts' : ''} ${richTextCount > 0 ? 'RichTextEditor' : ''}). This forces all users to download heavy libraries on their very first visit.`,
      studioFix: {
        location: `Studio Canvas -> Page '${pageName}'`,
        stepByStep: [
          `Move the Chart or RichTextEditor widget into a sub-page, dialog, or lazy-loaded Tab Pane.`,
          `For landing summaries, consider using lightweight stat cards or wm-label instead of full charts.`
        ]
      }
    });
  }

  // Check unpaginated tables & lists
  const unpaginatedWidgets: string[] = [];

  $('wm-table, wm-grid').each((_, el) => {
    const widgetName = $(el).attr('name') || $(el).attr('id') || 'unnamedTable';
    const navigation = $(el).attr('navigation'); // 'Basic', 'Pager', 'None', etc.
    const scrollmode = $(el).attr('scrollmode'); // 'virtual', etc.

    if (navigation === 'None' && scrollmode !== 'virtual') {
      // Reporting for this is intentionally suppressed (per explicit user request) —
      // `unpaginatedWidgets` is still tracked (it's part of TemplateAuditResult/PageAuditDetail),
      // only the audit report finding itself was removed.
      unpaginatedWidgets.push(widgetName);
    }
  });

  $('wm-list').each((_, el) => {
    const widgetName = $(el).attr('name') || $(el).attr('id') || 'unnamedList';
    const navigation = $(el).attr('navigation');
    const scrollmode = $(el).attr('scrollmode');

    if (navigation === 'None' && scrollmode !== 'virtual') {
      // Reporting for this is intentionally suppressed (per explicit user request) — see the
      // table-widget case above for the same removal and why.
      unpaginatedWidgets.push(widgetName);
    }
  });

  // Row/item template scope for repeating widgets — where markup is compiled and evaluated once
  // PER RENDERED ROW, not once per page. Two verified real anti-patterns live here:
  //
  // 1. NESTED_REPEATER: a Table/List/LiveTable/Tile found *inside* another repeater's row
  //    template. Confirmed real in Cortex (a <wm-list> nested inside another <wm-list>'s
  //    <wm-listtemplate>, in FeeEventCharges and commissionCharges prefabs) — every outer row
  //    mounts a full copy of the inner repeating widget (its own change-detection subtree, and
  //    its own data fetch if bound to a variable), multiplying cost by outer-rows × inner-rows.
  //    Scoped specifically to wm-table-column/wm-listtemplate/wm-tiletemplate (not "anywhere in
  //    the DOM") so it doesn't false-positive on wm-livetable, which always legitimately wraps
  //    exactly one wm-table as its standard, correct composition — that's outside any row
  //    template, so it's untouched by this scan.
  //
  // 2. EXPENSIVE_ROW_BINDING: a `bind:` expression containing a function call, inside a row
  //    template. Confirmed real in the NestedWidgets test project's RowExpansionSample.html —
  //    a <wm-table-column>'s bind expression calling `row.getProperty('name')` and
  //    `row.getIndex()`. Angular re-evaluates every property binding on each change-detection
  //    cycle; inside a row template that means once per visible row, per digest — a real,
  //    well-documented Angular cost multiplier, independent of which function is being called.
  const ROW_TEMPLATE_SELECTOR = 'wm-table-column, wm-listtemplate, wm-tiletemplate';
  const FUNCTION_CALL_PATTERN = /\b[\w$]+(?:\.[\w$]+)*\s*\([^)]*\)/;

  let nestedRepeaterCount = 0;
  let expensiveRowBindingCount = 0;

  $(ROW_TEMPLATE_SELECTOR).each((_, scope) => {
    nestedRepeaterCount += $(scope).find('wm-table, wm-list, wm-livetable, wm-tile').length;

    $(scope)
      .find('*')
      .addBack()
      .each((_, el) => {
        const attribs = (el as any).attribs || {};
        for (const value of Object.values(attribs)) {
          if (typeof value === 'string' && value.startsWith('bind:') && FUNCTION_CALL_PATTERN.test(value)) {
            expensiveRowBindingCount++;
          }
        }
      });
  });

  if (nestedRepeaterCount > 0) {
    actionItems.push({
      id: `${pageName}_NESTED_REPEATER`,
      category: 'NESTED_REPEATER',
      severity: 'CRITICAL',
      page: pageName,
      title: `${nestedRepeaterCount} Repeating Widget(s) Nested Inside Another Repeater's Row Template`,
      issueDescription: `Page '${pageName}' has a Table/List/LiveTable/Tile widget nested inside another repeating widget's row/item template (wm-table-column, wm-listtemplate, or wm-tiletemplate). Every row of the outer repeater mounts a full, independent copy of the inner repeating widget — including its own change-detection subtree and its own data fetch if bound to a variable — multiplying DOM nodes and digest cost by (outer rows × inner rows).`,
      studioFix: {
        location: `Studio Canvas -> Page '${pageName}'`,
        stepByStep: [
          `Identify the inner Table/List/Tile nested inside the outer repeater's row template.`,
          `Replace it with WaveMaker's Row Detail / row-expansion feature so the inner content is compiled only for the row a user actually expands, instead of for every row.`,
          `If the inner widget genuinely must render for every row, make sure it's paginated or uses virtual scrolling so it doesn't compound the unbounded-row-count risk.`
        ]
      }
    });
  }

  if (expensiveRowBindingCount > 0) {
    actionItems.push({
      id: `${pageName}_EXPENSIVE_ROW_BINDING`,
      category: 'EXPENSIVE_ROW_BINDING',
      severity: 'WARNING',
      page: pageName,
      title: `${expensiveRowBindingCount} Function-Call Binding(s) Inside a Row Template`,
      issueDescription: `Page '${pageName}' has ${expensiveRowBindingCount} 'bind:' expression(s) containing a function call inside a Table/List/Tile row template. Angular re-evaluates every binding on each change-detection cycle — inside a row template that means the function runs once per visible row, per digest, not once per page.`,
      studioFix: {
        location: `Studio Canvas -> Page '${pageName}'`,
        stepByStep: [
          `Open the row/item template (wm-table-column, wm-listtemplate, or wm-tiletemplate) and find the 'bind:' expression calling a function.`,
          `Precompute the value once (e.g. on the variable's dataSet, or in Page.onLoad/on the variable's success handler) and bind to that plain property instead of calling the function from the template.`
        ]
      }
    });
  }

  return {
    widgetCount,
    maxDomDepth,
    unpaginatedWidgets,
    widgetsPresent: {
      charts: chartsCount > 0,
      richText: richTextCount > 0,
      tree: treeCount > 0,
      tables: tablesCount,
      lists: listsCount
    },
    dialogCount,
    bindingExpressionCount,
    nestedRepeaterCount,
    expensiveRowBindingCount,
    inactivePaneEagerLoadCount: deferrablePaneCount + nonDeferrablePaneCount,
    actionItems
  };
}
