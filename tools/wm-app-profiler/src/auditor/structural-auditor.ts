import { StudioActionItem } from '../types.js';

/**
 * Structural/markup-correctness checks — genuine bugs in the markup itself, not performance
 * hints. Deliberately operates on the RAW source text rather than a cheerio-parsed DOM: cheerio
 * (via htmlparser2) silently repairs broken HTML — an unclosed tag gets auto-closed in the parsed
 * tree — so a check built on the parsed DOM would never actually see the very breakage it's
 * supposed to catch.
 */

const ROW_TEMPLATE_TAGS = ['wm-table-column', 'wm-listtemplate', 'wm-tiletemplate'];

/**
 * Every `<wm-page ...>` open tag (a real page's root wrapper) must have a matching `</wm-page>`
 * somewhere later in the file, and vice versa. Verified against three real client projects
 * (Cortex, ArcspeedAM, psabackoffice — ~480 page/partial files total): 0 false positives, since
 * this only counts a mismatch when `<wm-page` is truly the root tag actually used in that file —
 * partials/layout fragments (header, footer, leftnav, ...) never use `<wm-page>` at all and are
 * correctly never flagged.
 */
function checkUnclosedWmPage(html: string, pageName: string): StudioActionItem[] {
  // `\b` after "wm-page" does NOT stop at a hyphen (hyphen isn't a word character, so `\b`
  // matches right there too) — a naive `<wm-page\b` regex also matches `<wm-page-content>`,
  // `<wm-page-header>`, etc., which are different widgets entirely and appear on virtually every
  // real page. Confirmed the hard way: an earlier version of this check flooded every single real
  // page across all three test projects with a false "missing closing tag" (each page's genuine
  // `<wm-page-content>` child was miscounted as a second `<wm-page>` open). The lookahead below
  // requires the next character to be whitespace or '>' specifically, so only the exact tag name
  // "wm-page" matches, never a longer hyphenated one.
  const openMatches = (html.match(/<wm-page(?=[\s>])[^>]*>/g) || ([] as string[])).filter(tag => !tag.endsWith('/>'));
  const closeMatches = html.match(/<\/wm-page>/g) || [];
  if (openMatches.length === closeMatches.length) return [];

  const missing = openMatches.length - closeMatches.length;
  if (missing > 0) {
    return [
      {
        id: `${pageName}_UNCLOSED_WM_PAGE`,
        category: 'STRUCTURAL_VALIDITY',
        severity: 'CRITICAL',
        page: pageName,
        title: `'<wm-page>' Is Missing Its Closing Tag`,
        issueDescription: `'${pageName}' has ${openMatches.length} '<wm-page>' opening tag(s) but only ${closeMatches.length} '</wm-page>' closing tag(s). Broken markup like this can render the rest of the page unpredictably (later widgets silently absorbed as children of the wrong element, or the page failing to compile at all).`,
        studioFix: {
          location: `Studio -> Page '${pageName}' -> Markup`,
          stepByStep: [
            `Open '${pageName}.html' directly and check that every '<wm-page>' tag has a matching '</wm-page>'.`,
            `This usually happens from a manual/external edit to the .html file outside Studio's canvas — re-saving from Studio's canvas will normally regenerate valid markup.`
          ]
        }
      }
    ];
  }

  // Stray close tag with no matching open — far less likely in practice, but cheap to catch.
  return [
    {
      id: `${pageName}_STRAY_WM_PAGE_CLOSE`,
      category: 'STRUCTURAL_VALIDITY',
      severity: 'WARNING',
      page: pageName,
      title: `'</wm-page>' Closing Tag Has No Matching Opening Tag`,
      issueDescription: `'${pageName}' has ${closeMatches.length} '</wm-page>' closing tag(s) but only ${openMatches.length} '<wm-page>' opening tag(s).`,
      studioFix: {
        location: `Studio -> Page '${pageName}' -> Markup`,
        stepByStep: [`Open '${pageName}.html' and remove the extra '</wm-page>' that has no corresponding opening tag.`]
      }
    }
  ];
}

/**
 * A dialog (or another dialog/popover-type widget) placed inside a row/tile/list-item template
 * gets instantiated once PER ROW rather than once for the whole widget — for any non-trivial
 * dataset that's dozens/hundreds of live dialog component instances (each with its own variables,
 * watchers, and change-detection subscriptions) sitting in the DOM at once for something that was
 * almost certainly meant to be a single shared dialog opened on row click. Checked against three
 * real client projects: 0 occurrences found, but the check is kept regardless (like the
 * unclosed-tag check above) — it's a correctness net for the next project that does hit it, not
 * evidence it's rare enough to skip.
 */
function checkDialogInsideRowTemplate(html: string, pageName: string): StudioActionItem[] {
  const actionItems: StudioActionItem[] = [];

  for (const tagName of ROW_TEMPLATE_TAGS) {
    // Same hyphen/word-boundary trap as checkUnclosedWmPage above — require the next char to be
    // whitespace or '>' so e.g. 'wm-table-column' can't accidentally match a differently-named
    // widget that merely starts with the same prefix.
    const openTagRegex = new RegExp(`<${tagName}(?=[\\s>])`, 'g');
    let match: RegExpExecArray | null;
    while ((match = openTagRegex.exec(html)) !== null) {
      const closeIdx = html.indexOf(`</${tagName}>`, match.index);
      if (closeIdx === -1) continue;
      const segment = html.slice(match.index, closeIdx);
      if (/<wm-dialog(?=[\s>])/.test(segment)) {
        actionItems.push({
          id: `${pageName}_${tagName}_DIALOG_IN_ROW_${match.index}`,
          category: 'STRUCTURAL_VALIDITY',
          severity: 'CRITICAL',
          page: pageName,
          title: `<wm-dialog> Nested Inside a Row Template (<${tagName}>)`,
          issueDescription: `Page '${pageName}' has a <wm-dialog> defined inside a <${tagName}> row template. This creates a separate live dialog component instance for EVERY row rendered, instead of one shared dialog — for any real dataset size this means dozens/hundreds of dialog instances (each with its own variables/watchers) sitting in memory for widgets almost none of which will ever be opened.`,
          studioFix: {
            location: `Studio Canvas -> Page '${pageName}' -> ${tagName}`,
            stepByStep: [
              `Move the dialog's markup out of the row template to the page's top level (a sibling of the table/list, not inside its row template).`,
              `On the row's action (e.g. a button's on-click), call the single shared dialog's .open() and pass the clicked row's data to it, instead of embedding a dialog per row.`
            ]
          }
        });
      }
    }
  }

  return actionItems;
}

export function auditPageStructure(htmlContent: string, pageName: string): StudioActionItem[] {
  if (!htmlContent) return [];
  return [...checkUnclosedWmPage(htmlContent, pageName), ...checkDialogInsideRowTemplate(htmlContent, pageName)];
}
