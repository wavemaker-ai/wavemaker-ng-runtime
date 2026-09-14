import fs from 'fs';
import path from 'path';
import { parse } from '@babel/parser';
import traverseModule from '@babel/traverse';
import { isGeneratedAngularWorkspace } from '../auditor/app-auditor.js';

const traverse = (traverseModule as any).default || traverseModule;

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
 * Scans `index.html`'s raw source for `<script src="...">` tags with neither `defer` nor `async`
 * and adds `defer` to each. Same left-to-right string-splice approach as the other patches here —
 * never reparsed through an HTML parser, so nothing else in the file is touched.
 *
 * Confirmed real and high-impact on a live client deployment: 7 render-blocking third-party
 * scripts (export/PDF/Excel libraries) with no defer, each measured at ~1.8-1.9s to download and
 * execute, directly inflating LCP/FCP. `defer` preserves execution order — see
 * index-html-auditor.ts for the full reasoning — so this is safe to apply automatically.
 * Deliberately does not touch inline `<script>` blocks (no `src`): `defer`/`async` have no effect
 * on those, and this only ever matches tags that already have a `src` attribute.
 */
function patchRenderBlockingScripts(html: string): { html: string; patchedCount: number } {
  const tagRegex = /<script\b[^>]*>/gi;

  let patchedCount = 0;
  let result = '';
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = tagRegex.exec(html)) !== null) {
    let tag = match[0];
    const hasSrc = /\bsrc\s*=\s*["'][^"']+["']/i.test(tag);
    const hasDeferOrAsync = /\bdefer\b|\basync\b/i.test(tag);

    if (hasSrc && !hasDeferOrAsync) {
      tag = tag.replace(/>$/, ' defer>');
      patchedCount++;
    }

    result += html.slice(lastIndex, match.index) + tag;
    lastIndex = match.index + match[0].length;
  }
  result += html.slice(lastIndex);

  return { html: result, patchedCount };
}

/**
 * Scans raw HTML source text for `<wm-table>`/`<wm-grid>`/`<wm-list>` opening tags with
 * `navigation="None"` (and no `scrollmode="virtual"`), patching each to `navigation="Pager"`
 * (adding `pagesize="15"` if absent) via a single left-to-right pass of targeted string splices.
 *
 * This deliberately never reparses/re-serializes the file through an HTML parser (that would
 * silently rewrite casing, whitespace and entity-encoding across the whole document just to
 * add two attributes) and scans tag-by-tag rather than looking widgets up by name, so it
 * patches every qualifying tag in document order even when two widgets share the same
 * `name`/`id` (which happens in real projects) or a widget has no name at all.
 */
function patchUnpaginatedWidgetTags(html: string, tagNames: string[]): { html: string; patchedCount: number } {
  const tagPattern = tagNames.join('|');
  const openTagRegex = new RegExp(`<(?:${tagPattern})\\b[^>]*>`, 'gi');

  let patchedCount = 0;
  let result = '';
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = openTagRegex.exec(html)) !== null) {
    let tag = match[0];

    const hasUnboundedNav = /\bnavigation\s*=\s*["']none["']/i.test(tag);
    const isVirtualScroll = /\bscrollmode\s*=\s*["']virtual["']/i.test(tag);

    if (hasUnboundedNav && !isVirtualScroll) {
      tag = tag.replace(/\bnavigation\s*=\s*["']none["']/i, 'navigation="Pager"');
      if (!/\bpagesize\s*=\s*["']/i.test(tag)) {
        tag = tag.replace(/(\/?)>$/, (_m, selfClosingSlash) => ` pagesize="15"${selfClosingSlash}>`);
      }
      patchedCount++;
    }

    result += html.slice(lastIndex, match.index) + tag;
    lastIndex = match.index + match[0].length;
  }
  result += html.slice(lastIndex);

  return { html: result, patchedCount };
}

/**
 * Scans raw HTML source text for `<wm-prefab>` opening tags that already carry a
 * `show`/`show.bind` condition but are missing `deferload="true"` (or carry a non-'true' value),
 * patching each in place via the same targeted string-splice approach as
 * `patchUnpaginatedWidgetTags` above — never reparsed through an HTML parser, so the rest of the
 * document is untouched byte-for-byte.
 *
 * Deliberately narrower than it used to be (previously any `<wm-dialog>`/`<wm-prefab>`,
 * unconditionally): verified against the real transpiler (transpilation-web.cjs.js) that
 * `deferload="true"` only becomes a real deferred-render wrapper when the SAME tag also has a
 * `show.bind`/`show="bind:..."` expression — the transpiler reuses that expression as the
 * lazy-load trigger. Without it, the attribute is silently a no-op. `<wm-dialog>` is excluded
 * entirely: dialogs' content sits in an `<ng-template>` and is never compiled until `.open()`
 * regardless of `deferload` (verified against dialog.component.html), so there's nothing to patch.
 * Confirmed empirically on a real project: 0/188 real `<wm-dialog>` tags and only 5/211 real
 * `<wm-prefab>` tags had `show.bind` at all — patching the rest would have written an attribute
 * that does nothing.
 */
function patchMissingDeferload(html: string): { html: string; patchedCount: number } {
  // `\b` after "wm-prefab" does NOT stop at a hyphen (hyphen isn't a word character), so a naive
  // `<wm-prefab\b` also matches `<wm-prefab-container>` — the internal root wrapper inside every
  // prefab's OWN Main.html — which is a completely different element, not a `<wm-prefab>` usage
  // site. Confirmed real and dangerous: a real Cortex prefab's own `<wm-prefab-container>` tag
  // carries `show="bind:...` and would have been (wrongly) patched with `deferload="true"` had
  // this matched. The lookahead below requires the next character to be whitespace or '>'.
  const tagRegex = /<wm-prefab(?=[\s>])[^>]*>/gi;

  let patchedCount = 0;
  let result = '';
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = tagRegex.exec(html)) !== null) {
    let tag = match[0];
    const hasShowBind = /\bshow\.bind\s*=\s*["']/i.test(tag) || /\bshow\s*=\s*["']bind:/i.test(tag);

    if (hasShowBind) {
      const deferloadMatch = tag.match(/\bdeferload\s*=\s*["']([^"']*)["']/i);
      if (!deferloadMatch) {
        tag = tag.replace(/(\/?)>$/, (_m, selfClosingSlash) => ` deferload="true"${selfClosingSlash}>`);
        patchedCount++;
      } else if (deferloadMatch[1].toLowerCase() !== 'true') {
        tag = tag.replace(/\bdeferload\s*=\s*["'][^"']*["']/i, 'deferload="true"');
        patchedCount++;
      }
    }

    result += html.slice(lastIndex, match.index) + tag;
    lastIndex = match.index + match[0].length;
  }
  result += html.slice(lastIndex);

  return { html: result, patchedCount };
}

/**
 * Parses page-script JS with Babel and removes every `debugger;` statement by splicing out its
 * exact source range (highest offset first, so earlier removals never shift later ones). A
 * `debugger;` statement has zero effect on program behavior unless DevTools is attached, so
 * removing it anywhere it's found is always behavior-preserving.
 */
function stripDebuggerStatements(jsContent: string): { code: string; removedCount: number } {
  let ast: any;
  try {
    ast = parse(jsContent, { sourceType: 'unambiguous', plugins: ['typescript'] });
  } catch {
    return { code: jsContent, removedCount: 0 };
  }

  const ranges: Array<[number, number]> = [];
  traverse(ast, {
    DebuggerStatement(path: any) {
      if (typeof path.node.start === 'number' && typeof path.node.end === 'number') {
        ranges.push([path.node.start, path.node.end]);
      }
    }
  });

  if (ranges.length === 0) {
    return { code: jsContent, removedCount: 0 };
  }

  ranges.sort((a, b) => b[0] - a[0]);
  let code = jsContent;
  for (const [start, end] of ranges) {
    code = code.slice(0, start) + code.slice(end);
  }
  return { code, removedCount: ranges.length };
}

/**
 * Automatically patches WaveMaker Source project files (HTML markup & variables.json)
 */
export function patchWaveMakerSourceProject(projectRoot: string): SourcePatchResult {
  let patchedVariablesCount = 0;
  let patchedWidgetsCount = 0;
  let patchedDeferloadCount = 0;
  let patchedDebuggerStatementsCount = 0;
  const modifiedFiles: string[] = [];

  // Helper to find all files matching an extension
  function findFiles(dir: string, extension: string, depth = 0): string[] {
    if (depth > 5) return [];
    const results: string[] = [];
    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules' && entry.name !== 'dist') {
          const sub = path.join(dir, entry.name);
          // A real client export commonly ships a stale generated Angular workspace (e.g.
          // generated-angular-app/) sitting right next to the WM Source project. Patching inside
          // it is pure waste (it's build output, about to be regenerated) and actively harmful:
          // its .component.script.js files are real enough to have their own 'debugger;'
          // statements stripped and get double-counted against the same fix already applied to
          // the real source file, and its .html uses a different markup dialect that the
          // pagination patch can't touch anyway. Skip it outright, same as node_modules/dist.
          if (isGeneratedAngularWorkspace(sub)) continue;
          results.push(...findFiles(sub, extension, depth + 1));
        } else if (entry.isFile() && entry.name.endsWith(extension)) {
          results.push(path.join(dir, entry.name));
        }
      }
    } catch {}
    return results;
  }

  // 1. Patch Variables (*.variables.json) to enforce pagination caps
  const varFiles = findFiles(projectRoot, '.variables.json');
  for (const varFile of varFiles) {
    try {
      let content = fs.readFileSync(varFile, 'utf8');
      const json = JSON.parse(content);
      let fileModified = false;

      for (const [varName, def] of Object.entries<any>(json)) {
        if (def && typeof def === 'object') {
          // Check LiveVariable/ServiceVariable with a missing OR already-too-high maxResults.
          // Must mirror the audit's own QUERY_OVERFETCH threshold (variable-auditor.ts: missing
          // OR > 100) exactly — on a real client project (psabackoffice), every single one of its
          // 108 QUERY_OVERFETCH findings was a variable with maxResults already set to 125, not
          // missing. The original undefined-only check here silently patched none of them.
          if (def.category === 'wm.LiveVariable' || def.category === 'wm.ServiceVariable') {
            const maxResults = def.maxResults;
            const isUnbounded = maxResults === undefined || maxResults === null || maxResults === '' || Number(maxResults) > 100;
            if (isUnbounded) {
              def.maxResults = 20;
              fileModified = true;
              patchedVariablesCount++;
            }
          }
        }
      }

      if (fileModified) {
        fs.writeFileSync(varFile, JSON.stringify(json, null, 2), 'utf8');
        modifiedFiles.push(path.relative(projectRoot, varFile));
      }
    } catch {}
  }

  // 2. Patch HTML Markup (*.html) to enable pagination on unpaginated tables & lists.
  // See patchUnpaginatedWidgetTags() for why this never reparses/re-serializes the file.
  //
  // This only recognizes WM Source's <wm-table>/<wm-grid>/<wm-list> tag-name markup. A
  // *generated* Angular workspace (ng-codegen output) instead renders standard HTML tags
  // carrying camelCase attribute directives (e.g. wmTable="" on a <div>), which this scan
  // cannot see — patching it here would touch only a handful of stray widgets and give a
  // false impression that pagination was fixed project-wide. Skip it entirely and let the
  // caller know, rather than silently under-patching.
  let skippedWidgetPatchReason: string | undefined;
  if (isGeneratedAngularWorkspace(projectRoot)) {
    skippedWidgetPatchReason =
      'Target looks like a generated Angular workspace; widget-tag-based HTML pagination patching only supports the WM Source project markup dialect and was skipped.';
  } else {
    const htmlFiles = findFiles(projectRoot, '.html');
    for (const htmlFile of htmlFiles) {
      try {
        const html = fs.readFileSync(htmlFile, 'utf8');
        const { html: paginationHtml, patchedCount } = patchUnpaginatedWidgetTags(html, [
          'wm-table',
          'wm-grid',
          'wm-list'
        ]);
        const { html: patchedHtml, patchedCount: deferloadCount } = patchMissingDeferload(paginationHtml);

        if (patchedCount > 0 || deferloadCount > 0) {
          fs.writeFileSync(htmlFile, patchedHtml, 'utf8');
          modifiedFiles.push(path.relative(projectRoot, htmlFile));
          patchedWidgetsCount += patchedCount;
          patchedDeferloadCount += deferloadCount;
        }
      } catch {}
    }
  }

  // 3. Strip 'debugger;' statements from page/prefab scripts (*.js). Unlike the widget-tag and
  // deferload patches above, this is plain JS AST analysis with no markup-dialect dependency, so
  // it applies the same way whether projectRoot is WM Source or a generated Angular workspace.
  const jsFiles = findFiles(projectRoot, '.js');
  for (const jsFile of jsFiles) {
    try {
      const jsContent = fs.readFileSync(jsFile, 'utf8');
      const { code, removedCount } = stripDebuggerStatements(jsContent);
      if (removedCount > 0) {
        fs.writeFileSync(jsFile, code, 'utf8');
        modifiedFiles.push(path.relative(projectRoot, jsFile));
        patchedDebuggerStatementsCount += removedCount;
      }
    } catch {}
  }

  // 4. Add 'defer' to render-blocking <script src="..."> tags in the project-level index.html —
  // a completely separate file from any page's own markup, so this never touches page widget code.
  // See patchRenderBlockingScripts() above for why 'defer' is safe here.
  let patchedRenderBlockingScriptsCount = 0;
  const indexHtmlCandidates = [path.join(projectRoot, 'src/main/webapp/index.html'), path.join(projectRoot, 'index.html')];
  for (const indexHtmlPath of indexHtmlCandidates) {
    if (!fs.existsSync(indexHtmlPath)) continue;
    try {
      const html = fs.readFileSync(indexHtmlPath, 'utf8');
      const { html: patchedHtml, patchedCount } = patchRenderBlockingScripts(html);
      if (patchedCount > 0) {
        fs.writeFileSync(indexHtmlPath, patchedHtml, 'utf8');
        modifiedFiles.push(path.relative(projectRoot, indexHtmlPath));
        patchedRenderBlockingScriptsCount += patchedCount;
      }
    } catch {}
    break;
  }

  return {
    patchedVariablesCount,
    patchedWidgetsCount,
    patchedDeferloadCount,
    patchedDebuggerStatementsCount,
    patchedRenderBlockingScriptsCount,
    modifiedFiles,
    skippedWidgetPatchReason
  };
}
