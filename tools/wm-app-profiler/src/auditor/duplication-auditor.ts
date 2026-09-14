import * as cheerio from 'cheerio';
import crypto from 'crypto';
import { parse } from '@babel/parser';
import traverseModule from '@babel/traverse';
import { StudioActionItem } from '../types.js';

const traverse = (traverseModule as any).default || traverseModule;

// Widget names Studio itself auto-manages as a system feature toggle rather than markup a
// developer drops/duplicates by hand — flagging these as "extract to a partial" is misleading
// advice the developer has no real Studio UI action to take on. Confirmed on a real project:
// 'dialogPageInfo' is a `<wm-container content="pageInfoPartial">` shell Studio inserts whenever
// a page's "Show page info" setting is on; it's identical everywhere by design, not by copy-paste.
const STUDIO_SYSTEM_DIALOG_NAMES = new Set(['dialogpageinfo']);

/** Keeps report entries readable when a duplicate spans dozens/hundreds of pages. */
function joinTruncated(items: string[], max = 8): string {
  if (items.length <= max) return items.join(', ');
  return `${items.slice(0, max).join(', ')}, and ${items.length - max} more`;
}

export interface DuplicationSourceUnit {
  /** Human-readable label already used elsewhere (e.g. pageDetails.pageName, so '[Partial] X' for prefabs/partials). */
  name: string;
  html: string;
  js: string;
  css: string;
}

function hashText(text: string): string {
  return crypto.createHash('md5').update(text).digest('hex');
}

/**
 * Splits a CSS file into top-level rule blocks via brace matching (no full CSS parser
 * dependency). At-rules (@media, @keyframes, ...) are recursed into so their inner rules are
 * still compared, rather than being skipped or treated as one opaque block.
 */
function extractCssRules(css: string): { selector: string; body: string }[] {
  const rules: { selector: string; body: string }[] = [];
  let i = 0;
  let lastEnd = 0;
  while (i < css.length) {
    if (css[i] === '{') {
      const selector = css.slice(lastEnd, i).trim();
      let depth = 1;
      let j = i + 1;
      while (j < css.length && depth > 0) {
        if (css[j] === '{') depth++;
        else if (css[j] === '}') depth--;
        j++;
      }
      const body = css.slice(i + 1, j - 1);
      if (selector.startsWith('@')) {
        rules.push(...extractCssRules(body));
      } else if (selector) {
        rules.push({ selector, body });
      }
      lastEnd = j;
      i = j;
    } else {
      i++;
    }
  }
  return rules;
}

/**
 * Re-parses an isolated function-body source snippet (already includes its own `{ ... }`, which
 * parses fine standalone as a block statement) and blanks out every string/numeric literal so
 * that functions differing only in a literal value (extremely common WM pattern: five near-
 * identical event handlers whose bodies differ only in the string passed to one call) still
 * hash-match. Comments and whitespace are stripped after that so formatting differences don't
 * prevent a match either. Returns null if the snippet doesn't parse in isolation.
 */
function normalizeFunctionBody(bodySource: string): string | null {
  let ast: any;
  try {
    ast = parse(bodySource, { sourceType: 'script' });
  } catch {
    return null;
  }

  const ranges: Array<[number, number, string]> = [];
  traverse(ast, {
    StringLiteral(path: any) {
      if (typeof path.node.start === 'number') ranges.push([path.node.start, path.node.end, '"STR"']);
    },
    NumericLiteral(path: any) {
      if (typeof path.node.start === 'number') ranges.push([path.node.start, path.node.end, '0']);
    }
  });
  ranges.sort((a, b) => b[0] - a[0]);

  let code = bodySource;
  for (const [start, end, replacement] of ranges) {
    code = code.slice(0, start) + replacement + code.slice(end);
  }

  code = code.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
  code = code.replace(/\s+/g, ' ').trim();
  return code;
}

interface FunctionCandidate {
  functionName: string;
  bodySource: string;
}

/**
 * Collects every top-level `function name() {...}` declaration and every WM-style
 * `Page.someHandler = function(...) {...}` / arrow-function assignment in a page/prefab script,
 * returning each one's raw body source (pre-normalization).
 */
function collectJsFunctions(jsContent: string): FunctionCandidate[] {
  const results: FunctionCandidate[] = [];
  let ast: any;
  try {
    ast = parse(jsContent, { sourceType: 'unambiguous', plugins: ['typescript'] });
  } catch {
    return results;
  }

  traverse(ast, {
    FunctionDeclaration(path: any) {
      const node = path.node;
      if (node.body && typeof node.body.start === 'number') {
        results.push({
          functionName: node.id?.name || '(anonymous)',
          bodySource: jsContent.slice(node.body.start, node.body.end)
        });
      }
    },
    AssignmentExpression(path: any) {
      const node = path.node;
      const right = node.right;
      if (
        (right.type === 'FunctionExpression' || right.type === 'ArrowFunctionExpression') &&
        right.body &&
        right.body.type === 'BlockStatement' &&
        typeof right.body.start === 'number'
      ) {
        let fnName = '(anonymous)';
        if (node.left.type === 'MemberExpression' && node.left.property && (node.left.property as any).name) {
          fnName = (node.left.property as any).name;
        }
        results.push({
          functionName: fnName,
          bodySource: jsContent.slice(right.body.start, right.body.end)
        });
      }
    }
  });

  return results;
}

/**
 * Finds duplicated HTML dialog markup, duplicated JS handler logic, and duplicated CSS rules
 * across every page/prefab in the project — a project-wide (not per-page) check, since the
 * whole point is to compare content ACROSS sources. Only exact-after-normalization matches are
 * reported (never fuzzy/similarity-scored), so every finding here is a genuine copy-paste, not a
 * coincidental structural resemblance.
 *
 * Two distinct shapes of finding come out of this:
 *  - Duplicated across >=2 different pages/prefabs: the actionable fix is almost always
 *    "extract this into a shared Partial (markup) or a shared App-level function (script)".
 *  - Duplicated >=2 times within the SAME page only: still real (WM apps very commonly have a
 *    handful of near-identical event handlers differing only in one literal), but the fix is
 *    "parameterize into one local function", not "make it a partial" — reported as a separate,
 *    lower-severity finding so the two remediation paths aren't conflated.
 */
interface ElementShape {
  tag: string;
  /** Attribute values only (name/id already excluded by the caller) — used for the value-level
   * diff once two blocks are already known to share the same shapeKey (same tags, same attribute
   * KEYS, same order). */
  attrs: Record<string, string>;
}

/** Walks a cheerio element's subtree in document order, recording each element's tag name and
 * attributes (minus name/id, which are expected to differ per-instance and aren't a meaningful
 * "diff" for the parameterization question this feeds into). */
function collectElementShapes($: any, root: any): ElementShape[] {
  const shapes: ElementShape[] = [];
  const walk = (el: any) => {
    if (el.type !== 'tag') return;
    const attrs: Record<string, string> = { ...(el.attribs || {}) };
    delete attrs.name;
    delete attrs.id;
    shapes.push({ tag: el.tagName || el.name, attrs });
    ($(el).contents().toArray() as any[]).forEach(walk);
  };
  walk(root);
  return shapes;
}

/** A fingerprint of pure structure — tag names plus attribute KEYS (not values) in document
 * order. Two blocks sharing this key have the identical widget composition; only their attribute
 * VALUES might differ, which is exactly the "small diff, maybe just parameterize it" case this
 * exists to find (as opposed to two blocks that merely look similar but have different widgets/
 * fields — those never share a shapeKey and are correctly left alone). */
function shapeKeyOf(shapes: ElementShape[]): string {
  return shapes.map(s => `${s.tag}:${Object.keys(s.attrs).sort().join(',')}`).join('|');
}

/** Requires a and b to already share a shapeKey (so same length, same tags, same attribute keys
 * per position) — zips them position-by-position and reports every attribute whose VALUE differs. */
function diffShapeValues(a: ElementShape[], b: ElementShape[]): { locator: string; valueA: string; valueB: string }[] {
  const diffs: { locator: string; valueA: string; valueB: string }[] = [];
  for (let i = 0; i < a.length; i++) {
    for (const key of Object.keys(a[i].attrs)) {
      const valueA = a[i].attrs[key] ?? '';
      const valueB = b[i].attrs[key] ?? '';
      if (valueA !== valueB) {
        diffs.push({ locator: `<${a[i].tag}>[${key}]`, valueA, valueB });
      }
    }
  }
  return diffs;
}

// A near-duplicate is only worth flagging as "just parameterize the difference" when the diff is
// genuinely small — beyond this many differing attributes, it's more likely two blocks that
// happen to share a widget layout but serve different content (e.g. Cortex's CardMaintenanceSearch-
// ByCard/ByAccount/ByCode prefabs share a scaffold but have entirely different form fields — dozens
// of differing attributes, correctly NOT something to wave at as "just pass it as a parameter").
const MAX_SMALL_DIFF_COUNT = 4;
const MIN_SHAPE_ELEMENT_COUNT = 3;

export function auditDuplication(sources: DuplicationSourceUnit[]): { actionItems: StudioActionItem[] } {
  const actionItems: StudioActionItem[] = [];

  // ---- 1. Duplicated <wm-dialog> markup (exact matches, plus near-matches below) ----
  const htmlGroups = new Map<string, { occurrences: { source: string; widgetName: string }[] }>();
  interface ShapeEntry {
    source: string;
    widgetName: string;
    shapes: ElementShape[];
    exactHash: string;
  }
  const shapeGroups = new Map<string, ShapeEntry[]>();

  for (const src of sources) {
    if (!src.html) continue;
    let $: any;
    try {
      $ = cheerio.load(src.html, { xmlMode: false });
    } catch {
      continue;
    }
    $('wm-dialog').each((_: number, el: any) => {
      const $el = $(el);
      const widgetName = $el.attr('name') || 'unnamed';
      if (STUDIO_SYSTEM_DIALOG_NAMES.has(widgetName.toLowerCase())) return;
      const outer = $.html(el) as string;
      const normalized = outer
        .replace(/\s(name|id)="[^"]*"/gi, '')
        .replace(/>\s+</g, '><')
        .trim();
      // Skip trivially small dialogs (e.g. an almost-empty shell) — too likely to coincidentally
      // match another equally-trivial dialog without actually being a meaningful duplicate.
      if (normalized.length < 100) return;
      const hash = hashText(normalized);
      if (!htmlGroups.has(hash)) htmlGroups.set(hash, { occurrences: [] });
      htmlGroups.get(hash)!.occurrences.push({ source: src.name, widgetName });

      const shapes = collectElementShapes($, el);
      if (shapes.length < MIN_SHAPE_ELEMENT_COUNT) return;
      const shapeKey = shapeKeyOf(shapes);
      if (!shapeGroups.has(shapeKey)) shapeGroups.set(shapeKey, []);
      shapeGroups.get(shapeKey)!.push({ source: src.name, widgetName, shapes, exactHash: hash });
    });
  }
  for (const [hash, group] of htmlGroups) {
    const distinctSources = Array.from(new Set(group.occurrences.map(o => o.source)));
    if (distinctSources.length >= 2) {
      const widgetName = group.occurrences[0].widgetName;
      actionItems.push({
        id: `DUPLICATED_DIALOG_${hash.slice(0, 8)}`,
        category: 'DUPLICATED_HTML_BLOCK',
        severity: 'WARNING',
        page: 'App (Global)',
        title: `Identical Dialog Markup Duplicated Across ${distinctSources.length} Pages`,
        issueDescription: `An identical <wm-dialog> block (e.g. named '${widgetName}') is copy-pasted verbatim across: ${joinTruncated(distinctSources)}. Each copy is downloaded, parsed and compiled separately as part of its own page instead of being defined once.`,
        studioFix: {
          location: `Studio -> Pages -> ${distinctSources.slice(0, 3).join(', ')}${distinctSources.length > 3 ? ', ...' : ''}`,
          stepByStep: [
            `Extract this dialog's markup into a new Partial (Studio -> right-click the dialog -> Convert to Partial, or manually recreate its markup as one).`,
            `Replace the duplicated <wm-dialog> block on each of the ${distinctSources.length} affected pages with a reference to the shared partial.`,
            `Result: ${distinctSources.length}x duplicated markup becomes a single definition — smaller total payload and one place to update instead of ${distinctSources.length}.`
          ]
        }
      });
    }
  }

  // ---- 1b. Near-duplicate <wm-dialog> markup — same widget composition, small attribute-value
  // diff. These never got reported above: they don't hash-match exactly, so without this pass
  // they'd be invisible even though they're an even easier partial-extraction candidate (just
  // parameterize the handful of differing values as partial input properties).
  for (const [, group] of shapeGroups) {
    if (group.length < 2) continue;
    const baseline = group[0];
    const others = group.slice(1);

    // Union of every attribute that differs from the baseline, across every other member —
    // capturing all of them (not just the first pairwise diff) is what tells the developer
    // whether ALL the differences are genuinely small, not just the first one checked.
    const diffLocators = new Set<string>();
    let allWithinThreshold = true;
    const perMemberDiffs: { source: string; diffs: { locator: string; valueA: string; valueB: string }[] }[] = [];

    for (const other of others) {
      if (other.exactHash === baseline.exactHash) continue; // already covered by the exact-match finding above
      const diffs = diffShapeValues(baseline.shapes, other.shapes);
      if (diffs.length === 0) continue; // shouldn't happen if exactHash differs, but be defensive
      if (diffs.length > MAX_SMALL_DIFF_COUNT) {
        allWithinThreshold = false;
        break;
      }
      diffs.forEach(d => diffLocators.add(d.locator));
      perMemberDiffs.push({ source: other.source, diffs });
    }

    if (!allWithinThreshold || perMemberDiffs.length === 0) continue;

    const distinctSources = Array.from(new Set([baseline.source, ...perMemberDiffs.map(d => d.source)]));
    if (distinctSources.length < 2) continue;

    const exampleDiff = perMemberDiffs[0].diffs
      .map(d => `${d.locator}: '${d.valueA}' vs '${d.valueB}'`)
      .join('; ');

    actionItems.push({
      id: `NEAR_DUPLICATED_DIALOG_${hashText(distinctSources.join('|'))
        .slice(0, 8)}`,
      category: 'NEAR_DUPLICATE_HTML_BLOCK',
      severity: 'WARNING',
      page: 'App (Global)',
      title: `Near-Identical Dialog Markup Across ${distinctSources.length} Pages (${diffLocators.size} Differing Attribute${diffLocators.size === 1 ? '' : 's'})`,
      issueDescription: `A <wm-dialog> block (e.g. named '${baseline.widgetName}') with the exact same widgets/layout appears across ${distinctSources.length} pages (${joinTruncated(distinctSources)}), differing only in ${diffLocators.size} attribute value${diffLocators.size === 1 ? '' : 's'} (e.g. ${exampleDiff}). This is small enough that it's very likely the same dialog with a couple of hardcoded values, rather than genuinely different content — worth a look either way since only a developer can confirm the difference is safe to parameterize.`,
      studioFix: {
        location: `Studio -> Pages -> ${distinctSources.slice(0, 3).join(', ')}${distinctSources.length > 3 ? ', ...' : ''}`,
        stepByStep: [
          `Compare the ${distinctSources.length} copies of '${baseline.widgetName}' and confirm the only real differences are: ${exampleDiff}.`,
          `If so, extract one shared Partial and expose the differing value(s) as partial input properties (parameters passed in from each page), instead of ${distinctSources.length} separate copies.`,
          `If the difference actually reflects meaningfully different behavior per page, leave them separate — this is a candidate for review, not an automatic merge.`
        ]
      }
    });
  }

  // ---- 2. Duplicated JS handler logic ----
  interface FnEntry {
    source: string;
    name: string;
    normalized: string;
  }
  const fnEntries: FnEntry[] = [];
  for (const src of sources) {
    if (!src.js) continue;
    for (const candidate of collectJsFunctions(src.js)) {
      const normalized = normalizeFunctionBody(candidate.bodySource);
      if (!normalized) continue;
      // Skip near-empty bodies (WM scaffolds every page with an empty Page.onReady, etc.) —
      // these would "duplicate" across virtually every page in the project and are pure noise.
      if (normalized.replace(/[{}\s;]/g, '').length < 40) continue;
      fnEntries.push({ source: src.name, name: candidate.functionName, normalized });
    }
  }
  const jsGroups = new Map<string, FnEntry[]>();
  for (const entry of fnEntries) {
    const hash = hashText(entry.normalized);
    if (!jsGroups.has(hash)) jsGroups.set(hash, []);
    jsGroups.get(hash)!.push(entry);
  }
  for (const [hash, group] of jsGroups) {
    if (group.length < 2) continue;
    const distinctSources = Array.from(new Set(group.map(g => g.source)));
    const fnNames = Array.from(new Set(group.map(g => g.name)));

    if (distinctSources.length >= 2) {
      actionItems.push({
        id: `DUPLICATED_JS_${hash.slice(0, 8)}`,
        category: 'DUPLICATED_JS_LOGIC',
        severity: 'WARNING',
        page: 'App (Global)',
        title: `Identical Handler Logic Duplicated Across ${distinctSources.length} Pages`,
        issueDescription: `${group.length} function(s) (${fnNames.slice(0, 4).join(', ')}${fnNames.length > 4 ? ', ...' : ''}) spread across ${distinctSources.length} pages/prefabs (${joinTruncated(distinctSources)}) have functionally identical bodies, differing only in literal values. The same logic is being maintained in ${distinctSources.length} separate places.`,
        studioFix: {
          location: `Studio -> Pages -> ${distinctSources.slice(0, 3).join(', ')}${distinctSources.length > 3 ? ', ...' : ''}`,
          stepByStep: [
            `Move this logic into one shared function in App.js (App-level script), parameterized on whatever literal currently differs between the copies.`,
            `Replace each page's local copy with a call to the shared App-level function.`,
            `If these pages also share the same markup (e.g. the same dialog/section), consider extracting both into a single shared Partial instead of just the script.`
          ]
        }
      });
    } else {
      const onlySource = distinctSources[0];
      actionItems.push({
        id: `DUPLICATED_JS_LOCAL_${hash.slice(0, 8)}`,
        category: 'DUPLICATED_JS_LOGIC',
        severity: 'INFO',
        page: onlySource,
        title: `Near-Identical Handler Logic Repeated ${group.length}x On This Page`,
        issueDescription: `${group.length} functions on '${onlySource}' (${fnNames.slice(0, 5).join(', ')}) share functionally identical bodies, differing only in a literal value (e.g. one string argument). Each is written and maintained separately for what is really one piece of logic.`,
        studioFix: {
          location: `Studio -> Page '${onlySource}' -> Script`,
          stepByStep: [
            `Replace these ${group.length} near-identical functions with one shared function that takes the differing value as a parameter.`,
            `Update each event binding to call the shared function with its own specific argument instead of using a dedicated copy.`
          ]
        }
      });
    }
  }

  // ---- 3. Duplicated CSS rules ----
  interface CssEntry {
    source: string;
    selector: string;
    normalized: string;
  }
  const cssEntries: CssEntry[] = [];
  for (const src of sources) {
    if (!src.css || !src.css.trim()) continue;
    for (const rule of extractCssRules(src.css)) {
      const normalized = rule.body
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/\s+/g, ' ')
        .trim();
      if (normalized.length < 20) continue;
      cssEntries.push({ source: src.name, selector: rule.selector, normalized });
    }
  }
  const cssGroups = new Map<string, CssEntry[]>();
  for (const entry of cssEntries) {
    const hash = hashText(entry.normalized);
    if (!cssGroups.has(hash)) cssGroups.set(hash, []);
    cssGroups.get(hash)!.push(entry);
  }
  for (const [hash, group] of cssGroups) {
    const distinctSources = Array.from(new Set(group.map(g => g.source)));
    if (distinctSources.length >= 2) {
      const selectors = Array.from(new Set(group.map(g => g.selector)));
      actionItems.push({
        id: `DUPLICATED_CSS_${hash.slice(0, 8)}`,
        category: 'DUPLICATED_CSS_RULE',
        severity: 'INFO',
        page: 'App (Global)',
        title: `Identical CSS Rule Duplicated Across ${distinctSources.length} Pages`,
        issueDescription: `The same CSS rule (selector(s): ${selectors.slice(0, 3).join(', ')}) appears identically in ${distinctSources.length} separate page stylesheets: ${joinTruncated(distinctSources)}.`,
        studioFix: {
          location: `Studio -> Pages -> ${distinctSources.slice(0, 3).join(', ')}${distinctSources.length > 3 ? ', ...' : ''}`,
          stepByStep: [
            `Move this rule into the app's global/theme CSS (or a shared Partial's CSS if it's tied to shared markup) so it's defined once.`,
            `Remove the duplicated copy from each individual page's CSS file.`
          ]
        }
      });
    }
  }

  // ---- 4. Whole prefabs/partials that are near-identical to EACH OTHER (not just a dialog
  // inside them) — a much stronger, narrower signal than the dialog-level check above: two
  // entire partials/prefabs with the exact same widget composition, differing only in a tiny
  // fraction of attribute values (bound variable/service names, essentially). Confirmed for real
  // on Cortex: 'AddIssuerRiskRuleDetail' vs 'IssRiskAggrRuleDetailAdd' — 23 elements each,
  // differing in exactly ONE bound dataset expression — these are the same prefab in every
  // meaningful sense except which service they call.
  //
  // Deliberately does NOT flag Cortex's 'CardMaintenanceSearchBy*' family or similar same-shape-
  // different-domain pairs (Fee vs Commission rule details, etc.) found during validation — those
  // differ in 25-30% of their attributes (different bound entities throughout), which is a
  // legitimately different business object sharing a UI shape, not the same thing duplicated.
  // The ratio+absolute caps below exist specifically to keep those out.
  const MAX_MERGEABLE_DIFF_COUNT = 3;
  const MAX_MERGEABLE_DIFF_RATIO = 0.1;

  const partialSources = sources.filter(s => s.name.startsWith('[Partial] ') && s.html);
  const partialShapeGroups = new Map<string, { source: string; shapes: ElementShape[] }[]>();
  for (const src of partialSources) {
    let $: any;
    try {
      $ = cheerio.load(src.html, { xmlMode: false });
    } catch {
      continue;
    }
    const roots = $.root().children().toArray() as any[];
    const shapes = roots.flatMap(root => collectElementShapes($, root));
    if (shapes.length < MIN_SHAPE_ELEMENT_COUNT) continue;
    const shapeKey = shapeKeyOf(shapes);
    if (!partialShapeGroups.has(shapeKey)) partialShapeGroups.set(shapeKey, []);
    partialShapeGroups.get(shapeKey)!.push({ source: src.name, shapes });
  }

  for (const [, group] of partialShapeGroups) {
    if (group.length < 2) continue;
    const baseline = group[0];
    for (const other of group.slice(1)) {
      const diffs = diffShapeValues(baseline.shapes, other.shapes);
      const ratio = diffs.length / baseline.shapes.length;
      if (diffs.length === 0 || diffs.length > MAX_MERGEABLE_DIFF_COUNT || ratio > MAX_MERGEABLE_DIFF_RATIO) continue;

      const exampleDiff = diffs.map(d => `${d.locator}: '${d.valueA}' vs '${d.valueB}'`).join('; ');
      actionItems.push({
        id: `MERGEABLE_PARTIALS_${hashText(baseline.source + '|' + other.source).slice(0, 8)}`,
        category: 'MERGEABLE_PARTIALS',
        severity: 'WARNING',
        page: 'App (Global)',
        title: `'${baseline.source}' and '${other.source}' Are Near-Identical Prefabs/Partials`,
        issueDescription: `${baseline.source} and ${other.source} have the exact same widget composition (${baseline.shapes.length} elements each) and differ in only ${diffs.length} attribute value${diffs.length === 1 ? '' : 's'} (e.g. ${exampleDiff}). This looks like the same prefab/partial built twice for two different bound services/variables rather than genuinely different content.`,
        studioFix: {
          location: `Studio -> Prefabs/Partials -> '${baseline.source}' and '${other.source}'`,
          stepByStep: [
            `Confirm the only real difference between the two is: ${exampleDiff}.`,
            `If so, keep one of them and parameterize the differing value(s) as an input property, then repoint every usage of the other one at it.`,
            `Delete the redundant copy once nothing references it — this halves the maintenance/bundle cost for what was always one piece of functionality.`
          ]
        }
      });
    }
  }

  // ---- 5. Split candidates — the reverse question from every check above. A prefab/partial
  // whose markup branches into multiple mutually-exclusive modes (show="bind:X==='A'" vs
  // show="bind:X==='B'" on the SAME bound variable) is doing double duty. Confirmed for real on
  // Cortex: 'CardMaintenanceSearchByCard' shows different sections depending on whether
  // 'accessitem' is 'cardSelection' or 'cardMaintSearch'.
  //
  // Deliberately reported as neutral information, NOT a directive to split: the exact same shape
  // — one shared component, behavior toggled by an input — is the SUCCESS case for every merge
  // recommendation elsewhere in this file. Whether a given instance is "healthy parameterized
  // reuse" or "two things that have grown apart and should be unmerged" depends on how much the
  // modes' actual logic diverges, which static analysis can't judge — only a developer who knows
  // what each mode does can call it. Flagging it either way (as a bug, or silently) would be
  // overstepping; showing it and stating both outcomes explicitly is what actually helps here.
  const MIN_ELEMENTS_FOR_SPLIT_CANDIDATE = 15;
  const MODE_BRANCH_RE = /show="bind:([a-zA-Z0-9_.]+)\s*===?\s*['"]?([a-zA-Z0-9_]+)/g;

  for (const src of partialSources) {
    const elementCount = (src.html.match(/<[a-zA-Z][a-zA-Z0-9-]*(?=[\s>])/g) || []).length;
    if (elementCount < MIN_ELEMENTS_FOR_SPLIT_CANDIDATE) continue;

    const byVar = new Map<string, Set<string>>();
    for (const m of src.html.matchAll(MODE_BRANCH_RE)) {
      const [, varName, value] = m;
      if (!byVar.has(varName)) byVar.set(varName, new Set());
      byVar.get(varName)!.add(value);
    }

    for (const [varName, values] of byVar) {
      if (values.size < 2) continue;
      const valueList = Array.from(values);
      actionItems.push({
        id: `SPLIT_CANDIDATE_${hashText(src.name + '|' + varName).slice(0, 8)}`,
        category: 'SPLIT_CANDIDATE',
        severity: 'INFO',
        page: src.name,
        title: `'${src.name}' Branches Into ${values.size} Modes Based On '${varName}'`,
        issueDescription: `'${src.name}' shows/hides different sections depending on '${varName}' (seen values: ${valueList.join(', ')}) — one shared component serving multiple usage modes. This is either (a) healthy parameterized reuse, the same pattern recommended by the merge findings above — keep it as one, or (b) the modes have diverged enough in complexity that they'd be clearer split into separate partials (unmerge). Static analysis can't tell which; only a developer who knows how differently each mode behaves can call it.`,
        studioFix: {
          location: `Studio -> Prefabs/Partials -> '${src.name}'`,
          stepByStep: [
            `Review how much '${valueList.join(`' and '`)}' actually diverge in behavior, not just which sections they show/hide.`,
            `MERGE/keep-as-one if the modes mostly share logic and just toggle small sections — no action needed, this is the pattern the checks above are pushing everything else toward.`,
            `UNMERGE/split into '${src.name}For${valueList[0]}' and '${src.name}For${valueList[1]}'-style separate partials if the modes' logic has grown different enough that the shared version is genuinely harder to follow than two focused ones.`
          ]
        }
      });
    }
  }

  return { actionItems };
}
