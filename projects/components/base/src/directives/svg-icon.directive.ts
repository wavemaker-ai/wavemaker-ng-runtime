import { HttpClient } from '@angular/common/http';
import { Directive, inject, Input, OnChanges, OnDestroy, SimpleChanges, HostBinding } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { Observable, Subscription } from 'rxjs';
import { shareReplay, tap } from 'rxjs/operators';
import { ImagePipe } from '../pipes/image.pipe';

// check if the url is a svg icon url
export function isSvgIconUrl(url: string | null | undefined): boolean {
    if (!url) {
        return false;
    }
    const path = url.split(/[?#]/)[0];
    return /\.svg$/i.test(path);
}

/**
 * Module-level cache for already-normalized SVG markup, keyed by the
 * pipe-transformed URL. Shared across every directive instance so repeated
 * usage of the same icon resolves synchronously without another network hit.
 */
const svgCache = new Map<string, string>();

/**
 * In-flight request cache. Multiple directives mounted at the same time and
 * pointing at the same URL share a single HTTP request.
 */
const inFlightRequests = new Map<string, Observable<string>>();

/**
 * Renders the SVG fetched from `iconUrl` inline on the host element so the
 * markup behaves like a font icon - it can be sized via `font-size`, supports
 * `:hover` / transitions on the host, and (for SVGs authored with
 * `currentColor`) inherits `color` from CSS.
 *
 * Usage:
 *   <i class="wm-icon" [iconUrl]="url"></i>
 *
 * The incoming URL is first run through `ImagePipe` (so relative project
 * paths, CDN rewrites, etc. work the same way as `<img [src]>`), then fetched
 * as text via `HttpClient`. The fetched markup is normalized so the root
 * `<svg>` gets `width="1em"` / `height="1em"` if not already specified (so
 * the icon scales with the host's `font-size`) and a root `fill="currentColor"`
 * fallback when no `fill` attribute is declared.
 *
 * Original `fill` / `stroke` values inside the SVG are preserved verbatim so
 * a multi-color SVG renders with its source colors. To make an SVG themeable
 * via the host's CSS `color`, author the source with `fill="currentColor"`
 * (the convention used by Material Icons, Heroicons, Font Awesome, etc.).
 */
@Directive({
    standalone: true,
    selector: '[iconUrl]',
    exportAs: 'svgIcon'
})
export class SvgIconDirective implements OnChanges, OnDestroy {
    @Input() iconUrl: string;

    /**
     * Bound to the host's `innerHTML`. Set to a `SafeHtml` value produced by
     * `DomSanitizer.bypassSecurityTrustHtml` so Angular's renderer skips
     * re-sanitization and inlines the SVG as-is.
     */
    @HostBinding('innerHTML') hostInnerHtml: SafeHtml | null = null;

    private readonly http = inject(HttpClient);
    private readonly sanitizer = inject(DomSanitizer);
    private readonly imagePipe = inject(ImagePipe);

    private sub?: Subscription;
    private lastResolvedUrl: string | null = null;

    ngOnChanges(changes: SimpleChanges): void {
        if (changes['iconUrl']) {
            this.loadSvg(this.iconUrl);
        }
    }

    ngOnDestroy(): void {
        this.cancelInflight();
    }

    private loadSvg(rawUrl: string | null | undefined): void {
        this.cancelInflight();

        if (!rawUrl) {
            this.hostInnerHtml = null;
            this.lastResolvedUrl = null;
            return;
        }

        const url = this.imagePipe.transform(rawUrl);
        if (!url) {
            this.hostInnerHtml = null;
            this.lastResolvedUrl = null;
            return;
        }

        if (this.lastResolvedUrl === url && this.hostInnerHtml) {
            return;
        }

        const cached = svgCache.get(url);
        if (cached !== undefined) {
            this.applySvg(url, cached);
            return;
        }

        let request$ = inFlightRequests.get(url);
        if (!request$) {
            request$ = this.http.get(url, { responseType: 'text' }).pipe(
                tap(svg => {
                    svgCache.set(url, this.normalizeSvg(svg));
                    inFlightRequests.delete(url);
                }),
                shareReplay(1)
            );
            inFlightRequests.set(url, request$);
        }

        this.sub = request$.subscribe({
            next: () => {
                const normalized = svgCache.get(url);
                if (normalized !== undefined) {
                    this.applySvg(url, normalized);
                }
            },
            error: () => {
                inFlightRequests.delete(url);
                this.hostInnerHtml = null;
                this.lastResolvedUrl = null;
            }
        });
    }

    private applySvg(url: string, svg: string): void {
        this.lastResolvedUrl = url;
        this.hostInnerHtml = this.sanitizer.bypassSecurityTrustHtml(svg);
    }

    private cancelInflight(): void {
        if (this.sub) {
            this.sub.unsubscribe();
            this.sub = undefined;
        }
    }

    /**
     * Make the fetched SVG behave like a font icon:
     *  - replace any non-"none" fill/stroke attributes (single- or
     *    double-quoted) with currentColor so CSS `color` controls the icon
     *  - replace any non-"none" inline `fill:` / `stroke:` style values with
     *    currentColor
     *  - on the root <svg> tag, add `width="1em"`, `height="1em"`, and a
     *    default `fill="currentColor"` if missing so the icon scales with
     *    the host element's `font-size`
     */
    private normalizeSvg(svg: string): string {
        if (!svg) {
            return '';
        }
        let out = svg
            .replace(/fill\s*=\s*"(?!\s*none\s*")[^"]*"/gi, 'fill="currentColor"')
            .replace(/fill\s*=\s*'(?!\s*none\s*')[^']*'/gi, "fill='currentColor'")
            .replace(/stroke\s*=\s*"(?!\s*none\s*")[^"]*"/gi, 'stroke="currentColor"')
            .replace(/stroke\s*=\s*'(?!\s*none\s*')[^']*'/gi, "stroke='currentColor'")
            .replace(/(fill|stroke)\s*:\s*(?!\s*none\b)[^;"']+/gi, '$1: currentColor');

        out = out.replace(/<svg\b([^>]*)>/i, (_match, attrs: string) => {
            let updated = attrs;
            if (!/\swidth\s*=/i.test(updated)) {
                updated += ' width="1em"';
            }
            if (!/\sheight\s*=/i.test(updated)) {
                updated += ' height="1em"';
            }
            if (!/\sfill\s*=/i.test(updated)) {
                updated += ' fill="currentColor"';
            }
            return `<svg${updated}>`;
        });
        return out;
    }
}