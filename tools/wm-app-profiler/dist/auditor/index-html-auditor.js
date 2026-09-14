/**
 * Finds `<script src="...">` tags in the project's `index.html` that have neither `defer` nor
 * `async` — i.e. classic render-blocking scripts that halt HTML parsing (and therefore painting)
 * until each one downloads AND executes, one at a time, in document order.
 *
 * Confirmed real and severe on a live client deployment: 7 third-party export/document-generation
 * scripts (jspdf, html2canvas, xlsx, dom-to-image, pdf.min, exceljs, crypto-js) had no `defer`,
 * each taking ~1.8-1.9 SECONDS to download+execute — directly measured via a live browser trace,
 * with LCP/FCP landing at ~2.1s largely because of this. The fix already existed in the SAME file:
 * every other script (the platform runtime's own wm-libs.min.js/wm-loader.min.js, print.js,
 * wmProperties.js) already had `defer` — these 7 were just missed, not evidence `defer` is unsafe
 * here. `defer` preserves execution order (scripts still run in document order, just right before
 * DOMContentLoaded instead of blocking the parser first), so nothing about *when* these libraries
 * become usable changes — export/PDF features are only ever triggered by a later user action, not
 * during initial page load.
 *
 * Scoped specifically to `<script src="...">` tags with neither attribute — an inline `<script>`
 * with no `src` can't take `defer`/`async` at all (browsers ignore those attributes on inline
 * scripts), so this deliberately never touches those.
 */
export function auditIndexHtml(htmlContent) {
    const actionItems = [];
    if (!htmlContent)
        return actionItems;
    const scriptTagRegex = /<script\b([^>]*)>/gi;
    const blockingScripts = [];
    let match;
    while ((match = scriptTagRegex.exec(htmlContent)) !== null) {
        const attrs = match[1];
        const srcMatch = attrs.match(/\bsrc\s*=\s*["']([^"']+)["']/i);
        if (!srcMatch)
            continue; // inline script — defer/async don't apply
        const hasDeferOrAsync = /\bdefer\b|\basync\b/i.test(attrs);
        if (!hasDeferOrAsync) {
            blockingScripts.push(srcMatch[1]);
        }
    }
    if (blockingScripts.length > 0) {
        actionItems.push({
            id: `INDEX_HTML_RENDER_BLOCKING_SCRIPTS`,
            category: 'RENDER_BLOCKING_SCRIPT',
            severity: 'CRITICAL',
            page: 'App (Global)',
            title: `${blockingScripts.length} Render-Blocking Script(s) in index.html`,
            issueDescription: `index.html loads ${blockingScripts.length} script(s) with neither 'defer' nor 'async' (${blockingScripts.slice(0, 5).join(', ')}${blockingScripts.length > 5 ? ', ...' : ''}). Each one halts HTML parsing — and therefore painting — until it fully downloads and executes, one at a time. Every other script in this same file already uses 'defer'; these were simply missed, not a case where blocking is required.`,
            studioFix: {
                location: `Project -> index.html`,
                stepByStep: [
                    `Add 'defer' to each script tag listed above (matching the other scripts already in this file).`,
                    `Confirm none of these libraries are referenced by an inline <script> earlier in the file that expects them to already be loaded synchronously — 'defer' still runs them in document order, just after parsing completes instead of blocking it.`
                ]
            }
        });
    }
    return actionItems;
}
function extractStylesheetLinks(htmlContent) {
    const links = [];
    const linkTagRegex = /<link\b([^>]*)>/gi;
    let match;
    while ((match = linkTagRegex.exec(htmlContent)) !== null) {
        const attrs = match[1];
        if (!/\brel\s*=\s*["']stylesheet["']/i.test(attrs))
            continue;
        const hrefMatch = attrs.match(/\bhref\s*=\s*["']([^"']+)["']/i);
        if (!hrefMatch)
            continue;
        const mediaMatch = attrs.match(/\bmedia\s*=\s*["']([^"']+)["']/i);
        links.push({ href: hrefMatch[1], media: mediaMatch ? mediaMatch[1] : null });
    }
    return links;
}
/**
 * Audit-only (no corresponding auto-patch, unlike the script check above) — flags render-blocking
 * `<link rel="stylesheet">` tags in index.html. Deliberately more conservative than the script
 * check: unlike `defer` on a script (always safe, never changes visual output), removing a
 * stylesheet from the render-blocking path requires the preload+onload-swap technique
 * (`<link rel="preload" as="style" onload="this.rel='stylesheet'">`), which carries a real risk
 * of a visible flash of unstyled content if applied to something that's actually needed for
 * above-the-fold render, and an inline `onload` handler can be blocked by a strict CSP. Verified
 * on a real project (WMSRMWorkbenchFinal): every non-print stylesheet there (wm-style.css,
 * wm-responsive.css, the active theme, app.css) is genuinely needed before first paint — so this
 * only asserts a clear bug for the one safe, narrow case (a print-only stylesheet not scoped to
 * print media, exactly mirroring the same project's own already-correct `print.js`/`defer`
 * pattern) and otherwise just surfaces the count for a developer to review, rather than guessing
 * which stylesheets are safe to deprioritize.
 */
export function auditRenderBlockingCss(htmlContent) {
    const actionItems = [];
    if (!htmlContent)
        return actionItems;
    const links = extractStylesheetLinks(htmlContent);
    const isBlocking = (media) => !media || /\ball\b|\bscreen\b/i.test(media);
    const misscopedPrintSheets = links.filter(l => /print/i.test(l.href) && (!l.media || !/\bprint\b/i.test(l.media)));
    if (misscopedPrintSheets.length > 0) {
        actionItems.push({
            id: `INDEX_HTML_PRINT_CSS_NOT_SCOPED`,
            category: 'RENDER_BLOCKING_CSS',
            severity: 'WARNING',
            page: 'App (Global)',
            title: `Print Stylesheet(s) Not Scoped to Print Media`,
            issueDescription: `index.html links ${misscopedPrintSheets.length} print-named stylesheet(s) (${misscopedPrintSheets.map(l => l.href).join(', ')}) without 'media="print"'. Without it, the browser treats this as a normal render-blocking stylesheet on every page load, even though it's only ever needed when the user prints.`,
            studioFix: {
                location: `Project -> index.html`,
                stepByStep: [`Add media="print" to each stylesheet link listed above (matching how this project's own print.js is already correctly deferred).`]
            }
        });
    }
    const otherBlocking = links.filter(l => isBlocking(l.media) && !misscopedPrintSheets.includes(l));
    if (otherBlocking.length > 0) {
        actionItems.push({
            id: `INDEX_HTML_RENDER_BLOCKING_CSS`,
            category: 'RENDER_BLOCKING_CSS',
            severity: 'INFO',
            page: 'App (Global)',
            title: `${otherBlocking.length} Render-Blocking Stylesheet(s) in index.html`,
            issueDescription: `index.html links ${otherBlocking.length} stylesheet(s) that block rendering until they download (${otherBlocking.map(l => l.href).join(', ')}). This is often correct (core theme/app CSS genuinely needs to apply before first paint to avoid a flash of unstyled content) — reported for review, not asserted as a bug, since telling which of these are safe to deprioritize requires knowing what's actually needed above the fold.`,
            studioFix: {
                location: `Project -> index.html`,
                stepByStep: [
                    `Review whether every stylesheet listed is genuinely needed before first paint.`,
                    `For any that aren't (e.g. below-the-fold-only styling), consider the preload+swap pattern: <link rel="preload" href="..." as="style" onload="this.onload=null;this.rel='stylesheet'"> with a <noscript> fallback — but confirm this doesn't cause a visible flash of unstyled content and isn't blocked by CSP before adopting it.`
                ]
            }
        });
    }
    return actionItems;
}
