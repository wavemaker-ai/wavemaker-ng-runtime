import { StudioActionItem } from '../types.js';
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
export declare function auditIndexHtml(htmlContent: string): StudioActionItem[];
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
export declare function auditRenderBlockingCss(htmlContent: string): StudioActionItem[];
