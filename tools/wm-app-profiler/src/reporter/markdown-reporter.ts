import { FullAuditReport, StudioActionItem } from '../types.js';

// Every category the auditor can ever produce, with a human-readable label — used to report
// "checked and clean" for whichever ones produced zero findings on this specific project. Without
// this, a well-built project's genuinely good areas are invisible: silence reads the same whether
// a check ran and found nothing, or was never relevant here. Confirmed the gap is real by
// comparing three actual client projects — one had zero findings across several categories
// (disciplined prefab/partial choice, no duplicated dialogs, no leftover dead pages) and that
// discipline was completely invisible in the report before this existed.
const ALL_CATEGORY_LABELS: Record<string, string> = {
  DOM_PAGINATION: 'Table/List Pagination',
  VARIABLE_WATERFALL: 'Startup Variable Waterfalls',
  QUERY_OVERFETCH: 'Unbounded Data Queries',
  SCRIPT_LEAK: 'Script Memory Leaks',
  DOM_DEPTH: 'Excessive DOM Depth',
  HEAVY_WIDGET: 'Unused Heavy Widget Libraries',
  DEBUGGER_STATEMENT: 'Debugger Statements',
  EXCESSIVE_DIALOGS: 'Excessive Dialog Count',
  MISSING_DEFERLOAD: 'Missing Defer Load',
  MONOLITHIC_PAGE: 'Monolithic Pages',
  EXCESSIVE_BINDINGS: 'Excessive Binding Expressions',
  ERROR_HANDLING_GAP: 'Error Handling Gaps',
  OVERSIZED_PAYLOAD: 'Oversized Page Payload',
  NESTED_REPEATER: 'Nested Repeaters',
  EXPENSIVE_ROW_BINDING: 'Expensive Row Bindings',
  INACTIVE_PANE_EAGER_LOAD: 'Inactive Tab/Wizard/Accordion Eager Load',
  PREFAB_OVERHEAD: 'Prefab Overhead (Should Be Partial)',
  SLOW_TAB_SWITCH: 'Slow Tab Switching',
  DUPLICATED_HTML_BLOCK: 'Duplicated Dialog Markup',
  DUPLICATED_JS_LOGIC: 'Duplicated JS Logic',
  DUPLICATED_CSS_RULE: 'Duplicated CSS Rules',
  OVERSIZED_IMAGE: 'Oversized Images',
  DEAD_PAGE_CANDIDATE: 'Leftover Backup/Test Pages',
  STRUCTURAL_VALIDITY: 'Markup Structural Validity',
  NEAR_DUPLICATE_HTML_BLOCK: 'Near-Duplicate Dialog Markup',
  MERGEABLE_PARTIALS: 'Near-Identical Prefabs/Partials',
  SPLIT_CANDIDATE: 'Multi-Mode Prefab/Partial Split Candidates',
  APP_LEVEL_VARIABLE_REUSE_CANDIDATE: 'Variables/Actions Redefined Per-Page',
  VENDOR_SOURCEMAPS_ENABLED: 'Vendor Source Maps Enabled',
  LICENSE_EXTRACTION_ENABLED: 'License Extraction Enabled',
  CI_BUILD_CACHE_DISABLED: 'Persistent Build Cache Disabled Under CI',
  SELF_NESTED_DEPENDENCY: 'Self-Nested Package Output',
  TRUST_AS_HTML_RISK: 'Unsanitized HTML via trustAs',
  STALE_GENERATED_WORKSPACE: 'Leftover Generated Angular Workspace'
};

export function generateMarkdownReport(report: FullAuditReport): string {
  const { appPerformance, buildResources, patchResult } = report;

  // Plain ASCII markers only — no emoji anywhere in this report. Confirmed real problem: emoji
  // bytes reliably get mangled into mojibake ("ð´", "â ï¸") by common viewers/terminals with a
  // non-UTF8 locale, which throws off a reader's whole sense of the report's formatting even
  // though the underlying markdown tables are perfectly valid. ASCII never has this failure mode.
  const scoreLabel = appPerformance.overallScore >= 80 ? '[GOOD]' : appPerformance.overallScore >= 50 ? '[FAIR]' : '[POOR]';

  let md = `# WaveMaker App Performance & Resource Audit Report

**Project Name**: \`${appPerformance.projectName}\`  
**Analyzed At**: ${new Date(appPerformance.analyzedAt).toLocaleString()}  
**Overall Performance Health**: ${scoreLabel} **${appPerformance.overallScore} / 100**
**Total Pages Scanned**: ${appPerformance.totalPages} | **Total Widgets**: ${appPerformance.totalWidgets} | **Variables**: ${appPerformance.totalVariables}

---

## SUMMARY OF ACTIONABLE FINDINGS

| Audit Pillar | Status | Key Focus |
| :--- | :---: | :--- |
| **Part A: Application Performance (Studio Fixes)** | ${appPerformance.actionItems.length === 0 ? '[OK] Optimal' : '[WARN] Action Required'} | ${appPerformance.actionItems.length} recommendations for WaveMaker Studio developer |
| **Part B: Build & Deployment Resources** | ${buildResources ? '[OK] Monitored' : '[INFO] Config Ready'} | Auto-patch disables license extraction, enables the CI build cache & prunes unused global scripts |

`;

  const foundCategories = new Set(appPerformance.actionItems.map(i => i.category));
  const cleanCategories = Object.entries(ALL_CATEGORY_LABELS)
    .filter(([category]) => !foundCategories.has(category as any))
    .map(([, label]) => label);
  if (cleanCategories.length > 0) {
    md += `### Checked & Clean (${cleanCategories.length} of ${Object.keys(ALL_CATEGORY_LABELS).length} checks)\n`;
    md += `These checks ran against every page/prefab/partial scanned and found nothing to report — genuinely clean, not un-checked:\n\n`;
    md += cleanCategories.map(label => `\`${label}\``).join(', ') + '\n\n';
  }

  // Raw counts alone aren't comparable across projects of different sizes (a 400-page project
  // will always have more raw findings than a 140-page one). Normalizing by page count is what
  // actually lets you compare "is this project's rendering-performance discipline better or worse
  // than another one" — confirmed valuable directly from comparing three real client projects,
  // where raw counts told a misleading story that per-page rates corrected.
  if (appPerformance.totalPages > 0) {
    const byCategory = new Map<string, number>();
    for (const item of appPerformance.actionItems) {
      byCategory.set(item.category, (byCategory.get(item.category) || 0) + 1);
    }
    const rows = Array.from(byCategory.entries())
      .map(([category, count]) => ({
        label: ALL_CATEGORY_LABELS[category] || category,
        count,
        rate: (count / appPerformance.totalPages) * 100
      }))
      .sort((a, b) => b.rate - a.rate);

    if (rows.length > 0) {
      md += `### Findings Rate Per Page\n`;
      md += `Normalized by page count, so this is comparable across projects of different sizes:\n\n`;
      md += `| Category | Count | Rate per Page |\n`;
      md += `| :--- | :---: | :---: |\n`;
      for (const row of rows) {
        md += `| ${row.label} | ${row.count} | ${row.rate.toFixed(1)}% |\n`;
      }
      md += `\n`;
    }
  }

  if (appPerformance.prefabOverheadSummary) {
    const s = appPerformance.prefabOverheadSummary;
    md += `### Prefab Overhead Summary\n`;
    md += `A prefab's duplicated service-defs, eagerly-registered config, and extra prefab-specific DI/lifecycle layer only pay off with real reuse — this project's ${s.totalPrefabs} prefab(s) broken down by how many places each is actually used:\n\n`;
    md += `| Prefab Status | Count | % of Total |\n`;
    md += `| :--- | :---: | :---: |\n`;
    md += `| **Total Prefabs** | ${s.totalPrefabs} | 100% |\n`;
    md += `| Never used anywhere | ${s.neverUsed} | ${((s.neverUsed / s.totalPrefabs) * 100).toFixed(0)}% |\n`;
    md += `| Used in exactly one place (should likely be a Partial) | ${s.singleUse} | ${((s.singleUse / s.totalPrefabs) * 100).toFixed(0)}% |\n`;
    md += `| Genuinely reused (2+ places) | ${s.genuinelyReused} | ${((s.genuinelyReused / s.totalPrefabs) * 100).toFixed(0)}% |\n\n`;
  }

  md += `---

# PART A: APPLICATION PERFORMANCE OPTIMIZATIONS
> **Audience: WaveMaker Studio Low-Code Developer**
> These issues directly affect end-user speed, mobile responsiveness, and memory usage. Follow the exact Studio steps below to resolve them.

`;

  if (appPerformance.rootReadError) {
    md += `> [CRITICAL] **This report is INVALID — the project directory itself could not be read** (\`${appPerformance.rootReadError}\`).
> Every count and score above is meaningless: the scan found nothing because it couldn't read anything, not because the project is clean. This is usually a permission problem — on macOS, check System Settings → Privacy & Security → Files and Folders (or Full Disk Access) for the app running this command.

`;
  }

  if (appPerformance.isGeneratedAngularWorkspace) {
    md += `> [WARN] **This directory looks like a *generated* Angular workspace (ng-codegen output), not the original WM Source project.**
> Part A's widget-level checks (pagination, DOM depth, heavy widgets) only recognize WM Source's \`<wm-table>\` tag-name markup. ng-codegen instead emits standard HTML tags carrying camelCase attribute directives (e.g. \`wmTable\` as an attribute on a \`<div>\`), which these checks cannot see — so the findings below are likely incomplete. **Re-run \`audit\` against the exported WM Source project** (the directory containing \`src/main/webapp/pages\`) for accurate Part A results. Part B below is unaffected, since it inspects \`angular.json\`/\`wm-custom-webpack.config.js\` directly.

`;
  }

  // Duplication/reuse findings get their own spotlighted section (below), pulled out of the
  // generic Errors/Warnings buckets — otherwise a real project's 500+ ERROR_HANDLING_GAP items
  // bury the "these N things should become one Partial" findings, which are exactly the kind of
  // structural/architectural fix worth a developer's attention over a pile of per-widget nitpicks.
  const DUPLICATION_CATEGORIES = new Set([
    'DUPLICATED_HTML_BLOCK',
    'NEAR_DUPLICATE_HTML_BLOCK',
    'DUPLICATED_JS_LOGIC',
    'DUPLICATED_CSS_RULE',
    'PREFAB_OVERHEAD',
    'MERGEABLE_PARTIALS',
    'SPLIT_CANDIDATE',
    'APP_LEVEL_VARIABLE_REUSE_CANDIDATE'
  ]);
  const duplicationItems = appPerformance.actionItems.filter(i => DUPLICATION_CATEGORIES.has(i.category));
  const nonDuplicationItems = appPerformance.actionItems.filter(i => !DUPLICATION_CATEGORIES.has(i.category));

  // Two sections for everything else: Errors (CRITICAL) then Warnings (WARNING + INFO combined —
  // INFO-severity findings are still real but low-urgency; a separate third section for a handful
  // of INFO items just adds noise without helping anyone find what actually needs attention).
  const errorItems = nonDuplicationItems.filter(i => i.severity === 'CRITICAL');
  const warningItems = nonDuplicationItems.filter(i => i.severity === 'WARNING' || i.severity === 'INFO');

  if (duplicationItems.length > 0) {
    md += formatDuplicationSection(duplicationItems);
  }

  if (errorItems.length > 0) {
    md += `### Errors (High Priority)\n\n`;
    errorItems.forEach((item, idx) => {
      md += formatStudioActionItem(item, idx + 1);
    });
  }

  if (warningItems.length > 0) {
    md += `### Warnings (Medium Priority)\n\n`;
    warningItems.forEach((item, idx) => {
      md += formatStudioActionItem(item, idx + 1);
    });
  }

  if (duplicationItems.length === 0 && errorItems.length === 0 && warningItems.length === 0) {
    md += `[OK] **No critical runtime issues found!** Your WaveMaker pages and variables follow low-code best practices.\n\n`;
  }

  // Page-by-Page Breakdown Table — sorted worst-risk-score-first, since raw column counts alone
  // don't tell a developer which of a 200+ page app to fix first (a page can have a lower widget
  // count than another yet carry more/higher-severity findings).
  md += `### Page-by-Page Complexity & Risk Matrix\n`;
  md += `Sorted by Risk Score, worst first — same 0-100 scale as the overall Performance Health score above, scoped to just this page.\n\n`;
  md += `| Page Name | Risk Score | Widgets | Max DOM Depth | Tables/Lists | Variables (Startup/Total) | Leaking Timers |\n`;
  md += `| :--- | :---: | :---: | :---: | :---: | :---: | :---: |\n`;
  const pagesByRisk = [...appPerformance.pages].sort((a, b) => a.riskScore - b.riskScore);
  for (const page of pagesByRisk) {
    const tableListCount = page.widgetsPresent.tables + page.widgetsPresent.lists;
    const varText = `${page.variables.startupCount} / ${page.variables.total}`;
    const timerText = page.scriptIssues.leakingTimers > 0 ? `[!] ${page.scriptIssues.leakingTimers}` : '0';
    md += `| \`${page.pageName}\` | ${page.riskScore} | ${page.widgetCount} | ${page.maxDomDepth} | ${tableListCount} | ${varText} | ${timerText} |\n`;
  }

  md += `\n---\n\n`;

  // PART B: BUILD & DEPLOYMENT RESOURCES
  md += `# PART B: BUILD & DEPLOYMENT RESOURCE OPTIMIZATIONS
> **Audience: DevOps, Platform Engineers, and Build Administrators**
> Reducing production build RAM/CPU usage and preventing Out-of-Memory (OOM) crashes.

`;

  if (buildResources) {
    md += `### Real-Time Memory Consumption Profile\n\n`;
    md += `- **Peak Resident Set Size (RSS)**: \`${buildResources.peakRssMB} MB\`\n`;
    md += `- **Build Duration**: \`${buildResources.buildDurationSec} seconds\`\n`;
    md += `- **Recommended Safe Node Memory Limit**: \`${buildResources.recommendedNodeLimitMB} MB\` (30% headroom over this project's own measured peak — not a generic guess)\n`;
    md += `- **System Total RAM** (machine that ran this measurement): \`${buildResources.systemTotalMemMB} MB\`\n`;
    if (buildResources.recommendedNodeLimitMB > buildResources.systemTotalMemMB) {
      md += `- [WARN] **Recommended memory limit exceeds this machine's total RAM.** If this machine is (or matches) the real build target, provisioning \`--max-old-space-size\` alone won't help — the build will OOM-kill the whole system before Node's own limit is reached. Provision more RAM.\n`;
    } else if (buildResources.recommendedNodeLimitMB > buildResources.systemTotalMemMB * 0.85) {
      md += `- [WARN] **Recommended memory limit is within 15% of this machine's total RAM** — little headroom left for the OS and any other concurrent process.\n`;
    }
    md += `\n`;

    if (buildResources.phaseBreakdown.length > 0) {
      md += `| Build Phase | Peak Memory | Duration |\n`;
      md += `| :--- | :---: | :---: |\n`;
      for (const p of buildResources.phaseBreakdown) {
        md += `| ${p.phase} | ${p.peakMemoryMB} MB | ${p.durationSec}s |\n`;
      }
      md += `\n`;
    }
  }

  // NOTE: this table used to claim specific GB-savings figures for Terser worker-capping and
  // vendor source-map disabling ("saves 4-5 GB" / "saves 3-4 GB"), plus a blanket recommendation
  // to cap Node at --max-old-space-size=3072. Direct, repeated measurement (cold builds, a real
  // 17,843-widget project) disproved all of it: Terser worker-capping saved nothing (sometimes
  // made peak RSS worse) and was removed from this tool entirely; the source-map figure was never
  // isolated/verified in the first place; and a flat 3GB cap is actively dangerous — this tool has
  // directly measured real builds peaking above 3.4GB. None of these are safe claims to print
  // unconditionally in a report a client acts on. What's below only states what the auto-patcher
  // actually does, with no fabricated savings numbers attached.
  md += `### Build Resource Auto-Patches Applied\n\n`;
  md += `| Resource Area | Why It Matters | Auto-Patcher Remediation |\n`;
  md += `| :--- | :--- | :--- |\n`;
  md += `| **Vendor Source Maps** | Generates full source-maps for node_modules during the production build. | [OK] Set \`sourceMap.vendor: false\` in \`angular.json\`. Effect on peak build RAM not independently verified — treat as hygiene, not a guaranteed RAM reduction. |\n`;
  md += `| **License Extraction** | Scans every bundled module's source for license banners to assemble \`3rdpartylicenses.txt\`, while the compiler already holds the full module graph in memory. | [OK] Set \`extractLicenses: false\` in \`angular.json\`. Cheap and harmless; effect on peak build RAM not independently verified. |\n`;
  md += `| **CI Build Cache Disabled** | \`@angular/build\`'s persistent disk cache defaults to \`cli.cache.environment: 'local'\`, which disables itself the instant \`CI=true\` is set — even with a warm cache already on disk from a prior run. | [OK] Set \`cli.cache.environment: 'all'\` in \`angular.json\`. **Measured** on a 5,049-widget project: 88s/2868MB (CI default) -> 40s/2491MB (fixed) — a 54% time / 13% RAM reduction, provided the CI pipeline actually persists \`.angular/cache\` between runs. |\n`;
  md += `| **Unused Global Scripts** | Heavy third-party scripts (D3, Summernote, zTree) loaded globally regardless of usage. | [OK] Pruned unreferenced libraries from \`angular.json\` scripts. |\n`;
  md += `| **Node VM Memory Cap** | A memory limit set below the build's actual peak RSS causes an out-of-memory crash, not a graceful slowdown. | [ACTION] Set \`--max-old-space-size\` to this project's own **Recommended Safe Node Memory Limit** above (only available when a real \`monitor\` run has measured this project) — never a generic fixed number. |\n\n`;
  md += `Large WaveMaker apps can have a substantial *fixed* build-memory floor — driven by the compiler/bundler's own handling of the shared framework surface, not by how much page-specific code exists — that none of the patches above can reduce. If a project's peak RSS is still high after these patches, provisioning the build machine for the actually-measured peak (via a real \`monitor\` run) is the reliable fix, not further config tuning.\n\n`;

  if (appPerformance.unusedGlobalLibraries.length > 0) {
    md += `### Unused Global Libraries Eligible for Pruning\n\n`;
    md += `The following libraries are included in the project but are never used by any page:\n\n`;
    for (const lib of appPerformance.unusedGlobalLibraries) {
      if (lib.alreadyLazy) {
        md += `- **${lib.libraryName}** (\`${lib.scriptFile}\`): already lazy (\`inject:false\`) — costs nothing at page load since it's never fetched unused; pruning it only trims **~${lib.savedKB} KB** off build output, not runtime payload\n`;
      } else {
        md += `- **${lib.libraryName}** (\`${lib.scriptFile}\`): injected unconditionally on every page load — **~${lib.savedKB} KB unminified bundle savings** at runtime if pruned\n`;
      }
    }
    md += `\n`;
  }

  if (patchResult) {
    md += `### Auto-Patcher Execution Summary\n\n`;
    md += `- **angular.json updated**: ${patchResult.patchedAngularJson ? 'Yes' : 'No'}\n`;
    md += `- **Removed Scripts**: ${patchResult.removedScripts.length > 0 ? patchResult.removedScripts.map(s => `\`${s}\``).join(', ') : 'None'}\n`;
    md += `- **Vendor Source Maps Disabled**: ${patchResult.sourceMapsOptimized ? 'Yes' : 'Already Disabled'}\n`;
    md += `- **License Extraction Disabled**: ${patchResult.licenseExtractionDisabled ? 'Yes' : 'Already Disabled'}\n`;
    md += `- **CI Build Cache Enabled** (\`cli.cache.environment: 'all'\`): ${patchResult.buildCacheEnabled ? 'Yes' : 'Already Enabled'}\n`;
    md += `- **Overall**: ${patchResult.summary}\n\n`;
  }

  md += `\n---\n*Report generated locally by WaveMaker App Performance & Resource Platform (Zero-LLM, Air-Gapped).*`;

  return md;
}

const DUPLICATION_GROUP_META: Record<string, { heading: string; callout: string }> = {
  DUPLICATED_HTML_BLOCK: {
    heading: 'Duplicated Dialog Markup — Convert to Partial',
    callout: '→ **Convert to Partial**: extract this markup once, reference it from every page listed.'
  },
  NEAR_DUPLICATE_HTML_BLOCK: {
    heading: 'Near-Duplicate Dialog Markup — Likely Convert to Partial',
    callout:
      '→ **Likely convert to Partial**: same widgets/layout everywhere, only a few attribute values differ — parameterize those as partial input properties if a developer confirms the difference is safe to share.'
  },
  DUPLICATED_JS_LOGIC: {
    heading: 'Duplicated JS Logic — Move to App.js',
    callout: '→ **Move to a shared App.js function**: same logic maintained separately in every page/prefab listed.'
  },
  DUPLICATED_CSS_RULE: {
    heading: 'Duplicated CSS Rules — Move to Global/Theme CSS',
    callout: '→ **Move to global/theme CSS**: same rule defined separately in every page listed.'
  },
  PREFAB_OVERHEAD: {
    heading: 'Prefab Overhead — Convert to Partial',
    callout:
      "→ **Convert to Partial**: a prefab's separate bundle/service-defs/bootstrap lifecycle only pays off with real reuse — used once (or never), a Partial gives the same result for less overhead."
  },
  MERGEABLE_PARTIALS: {
    heading: 'Near-Identical Prefabs/Partials — Merge Into One',
    callout:
      '→ **Merge into one, parameterized**: same widget composition end-to-end, differing only in a handful of bound values — keep one, expose the difference as an input property, repoint every usage at it.'
  },
  SPLIT_CANDIDATE: {
    heading: 'Multi-Mode Prefabs/Partials — Merge (Keep) or Unmerge (Split)?',
    callout:
      '→ **Developer call, not automatic**: could be healthy parameterized reuse (keep merged, same pattern recommended above) or two diverged concerns worth unmerging into separate partials — only someone who knows how differently each mode behaves can decide.'
  },
  APP_LEVEL_VARIABLE_REUSE_CANDIDATE: {
    heading: 'Variables/Actions Redefined Per-Page — Promote to App-Level',
    callout:
      '→ **Move to an App-level Variable/Action**: identical configuration copy-pasted across many pages — one shared definition replaces every page-local copy, cutting redundant network calls and update sites.'
  }
};

/**
 * A dedicated, clearly-labeled section for every finding whose fix is "extract this into a
 * Partial" or "move this into one shared place" — the structural/architectural class of fix, as
 * opposed to per-widget nitpicks. Grouped by category so "convert to Partial" and "move to
 * App.js" recommendations aren't mixed together, with the concrete recommendation stated once per
 * group instead of buried inside each individual finding's prose.
 */
function formatDuplicationSection(items: StudioActionItem[]): string {
  let md = `### Duplication & Reuse Opportunities\n> Findings below all share the same fix shape: something is defined more than once and should be defined in exactly one place — a Partial, a Prefab-turned-Partial, a shared App.js function, or shared CSS. These are pulled out of Errors/Warnings above because they're structural fixes worth deciding on deliberately, not per-widget nitpicks.\n\n`;

  const byCategory = new Map<string, StudioActionItem[]>();
  for (const item of items) {
    if (!byCategory.has(item.category)) byCategory.set(item.category, []);
    byCategory.get(item.category)!.push(item);
  }

  for (const [category, groupItems] of byCategory) {
    const meta = DUPLICATION_GROUP_META[category];
    md += `#### ${meta ? meta.heading : category} (${groupItems.length})\n\n`;
    groupItems.forEach((item, idx) => {
      md += `**[${idx + 1}] ${item.title}**\n`;
      md += `- **Where**: \`${item.page}\`\n`;
      md += `- ${item.issueDescription}\n`;
      if (meta) md += `- ${meta.callout}\n`;
      md += `- **Studio steps**:\n`;
      item.studioFix.stepByStep.forEach(step => {
        md += `  - ${step}\n`;
      });
      md += `\n`;
    });
  }

  return md;
}

function formatStudioActionItem(item: StudioActionItem, index: number): string {
  let text = `#### [${index}] ${item.title}\n`;
  text += `- **Target Page**: \`${item.page}\` ${item.targetWidget ? `| **Widget**: \`${item.targetWidget}\`` : ''} ${item.targetVariable ? `| **Variable**: \`${item.targetVariable}\`` : ''}\n`;
  text += `- **Problem**: ${item.issueDescription}\n`;
  text += `- **WaveMaker Studio UI Fix**:\n`;
  text += `  - **Location**: \`${item.studioFix.location}\`\n`;
  item.studioFix.stepByStep.forEach(step => {
    text += `  - ${step}\n`;
  });
  if (item.studioFix.codeSnippet) {
    text += `  \`\`\`javascript\n${item.studioFix.codeSnippet}\n  \`\`\`\n`;
  }
  text += `\n`;
  return text;
}
