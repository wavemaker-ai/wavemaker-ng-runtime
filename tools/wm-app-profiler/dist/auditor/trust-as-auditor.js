/**
 * Flags markup where a dynamically-bound value is rendered as trusted, unsanitized HTML —
 * confirmed against the actual runtime source (`label.directive.ts`, `html.directive.ts`,
 * `panel.component.html`), not guessed:
 *
 * 1. label's `caption.bind` / the html widget's `content.bind`: the runtime checks the raw bind
 *    attribute for the literal substring `trustAs:` (`label.directive.ts`'s
 *    `bindContent.includes('trustAs:')`, real markup shape confirmed via
 *    `label.wrapper.directive.spec.ts`: `caption.bind="trustAs:html:someBinding"`). When present,
 *    the bound value bypasses Angular's default HTML sanitizer entirely
 *    (`bypassSecurityTrustHtml`) instead of going through it — a developer opt-in, but Studio
 *    gives no warning that it's happening on a value that came from a Variable/expression rather
 *    than a fixed literal. This is the exact, previously-untracked gap in
 *    `UNRESOLVED_PLATFORM_FINDINGS.md` §1.6.
 * 2. `wm-panel`'s `helptext`: `panel.component.html` applies `| trustAs:'html'` to `helptext`
 *    UNCONDITIONALLY in the compiled template — no `trustAs:` marker or developer opt-in needed
 *    at all. Any `helptext.bind` on a panel is always rendered as trusted HTML, with no way to
 *    opt out from the markup.
 *
 * Both are Angular's own `bypassSecurityTrustHtml` escape hatch used exactly as designed — not an
 * ng-runtime bug — but a page that binds either of these to a user-influenced data source (an API
 * response field, a user profile value, free-text form input someone else entered, as opposed to
 * a fixed value only the app developer ever sets) has a real stored-XSS path: whatever that
 * source returns gets rendered as live HTML with no escaping. This check can't know whether a
 * given bound Variable is genuinely user-influenced — it flags every occurrence so a developer
 * can make that call themselves, the same posture as SCRIPT_LEAK/DEBUGGER_STATEMENT elsewhere in
 * this auditor (real static facts about the markup, not a judgment about intent).
 */
export function auditTrustAsUsage(htmlContent, pageName) {
    const items = [];
    const bindAttrRegex = /(\w+)\.bind\s*=\s*["']([^"']*trustAs:[^"']*)["']/g;
    let match;
    while ((match = bindAttrRegex.exec(htmlContent)) !== null) {
        const [, attrName, bindValue] = match;
        items.push({
            id: `TRUST_AS_${pageName}_${attrName}_${items.length}`,
            category: 'TRUST_AS_HTML_RISK',
            severity: 'WARNING',
            page: pageName,
            title: `Unsanitized HTML Bound via '${attrName}'`,
            issueDescription: `'${attrName}="${bindValue}"' opts a dynamically-bound value out of Angular's default HTML sanitizer (bypassSecurityTrustHtml, via the 'trustAs:' marker) — Angular's standard, intentional escape hatch, working as designed. If the bound value can ever contain attacker-influenced data (an API response field, a user profile value, free-text input someone else entered), this is a stored-XSS path: whatever it returns is rendered as live HTML with no escaping.`,
            studioFix: {
                location: `Page markup, the widget carrying '${attrName}'`,
                stepByStep: [
                    `Confirm the bound value can only ever come from a source the app itself controls (never user-entered or third-party data).`,
                    `If it might carry user-influenced content, remove the 'trustAs:' marker and let Angular's default sanitizer run, or explicitly sanitize the value server-side/in a page script before binding it.`
                ]
            }
        });
    }
    const panelRegex = /<wm-panel\b[^>]*>/gi;
    while ((match = panelRegex.exec(htmlContent)) !== null) {
        const tag = match[0];
        const helptextMatch = tag.match(/\bhelptext\.bind\s*=\s*["']([^"']+)["']/i);
        if (helptextMatch) {
            items.push({
                id: `TRUST_AS_PANEL_${pageName}_${items.length}`,
                category: 'TRUST_AS_HTML_RISK',
                severity: 'WARNING',
                page: pageName,
                title: `Panel Help Text Always Rendered as Unsanitized HTML`,
                issueDescription: `This wm-panel's 'helptext.bind="${helptextMatch[1]}"' is rendered as trusted, unsanitized HTML unconditionally — panel.component.html applies Angular's HTML-sanitizer bypass to helptext regardless of any 'trustAs:' marker, so there is no way to opt out from the markup. If the bound value can ever contain attacker-influenced data, this is a stored-XSS path.`,
                studioFix: {
                    location: `Page markup, this wm-panel's 'helptext' property`,
                    stepByStep: [
                        `Confirm the bound helptext value can only ever come from a source the app itself controls.`,
                        `If it might carry user-influenced content, don't bind helptext dynamically — use a fixed literal string instead, or sanitize the value before it reaches this binding.`
                    ]
                }
            });
        }
    }
    return items;
}
