import { StudioActionItem } from '../types.js';
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
export declare function auditTrustAsUsage(htmlContent: string, pageName: string): StudioActionItem[];
