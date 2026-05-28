import { Component, Input, ViewEncapsulation } from '@angular/core';
import { NgClass, NgStyle } from '@angular/common';
import { ImagePipe } from '../../../pipes/image.pipe';
import { SvgIconDirective, isSvgIconUrl } from '../../../directives/svg-icon.directive';

/**
 * Single, reusable renderer for the SVG / image / font 3-way icon branch
 * that used to be duplicated across every widget that accepts an
 * `iconclass` + `iconurl` pair (anchor, button, panel header, card,
 * dialog-header, form, list, table, chart, accordion, file-upload,
 * rating, switch, menu, navbar, search, tabs, ...).
 *
 * Decision order:
 *   1. `iconurl` ending in `.svg`   -> inline SVG via `[iconUrl]` directive
 *   2. `iconurl` (anything else)    -> `<img [src]="url | image">`
 *   3. `iconclass`                  -> `<i class="app-icon {{iconclass}}">`
 *   4. `defaultIconClass` (if set)  -> same as #3 with the fallback class
 *   5. otherwise                    -> nothing
 *
 * Notes:
 * - `iconurl` wins over `iconclass` when both are set: a widget owner that
 *   bothered to configure a URL almost certainly wants it visible. Where the
 *   old behavior was "render both" (anchor, button), use TWO `<wm-app-icon>`
 *   elements - one with only `iconurl`, one with only `iconclass`.
 * - The host is `display: contents` so existing CSS selectors targeting
 *   `.app-icon` directly inside the parent (e.g. `.btn .app-icon`) keep
 *   working - the wrapper element is layout-transparent.
 * - All three branches receive the same `iconClasses` (extra space-separated
 *   CSS classes) and `iconStyle` (forwarded to `ngStyle`), so callers can
 *   port their `panel-icon`, `button-image-icon`, custom widths, etc.
 *   without per-branch repetition.
 */
@Component({
    standalone: true,
    selector: 'wm-app-icon',
    imports: [NgClass, NgStyle, SvgIconDirective, ImagePipe],
    encapsulation: ViewEncapsulation.None,
    host: {
        '[style.display]': '"contents"'
    },
    template: `
        @if (_isSvg) {
            <i [ngClass]="_svgClasses"
               role="img"
               aria-hidden="true"
               data-identifier="svg"
               [ngStyle]="iconStyle"
               [iconUrl]="iconurl"></i>
        } @else if (_isImage) {
            <img [ngClass]="_imageClasses"
                 data-identifier="img"
                 [attr.alt]="alt || 'icon-image'"
                 [src]="iconurl | image"
                 [ngStyle]="iconStyle"/>
        } @else if (_fontClass) {
            <i [ngClass]="_fontClasses"
               aria-hidden="true"
               [ngStyle]="iconStyle"></i>
        }
    `
})
export class WmAppIconComponent {
    /** Font-icon CSS class (e.g. `wi wi-user`). Lowest priority. */
    @Input() iconclass: string | null | undefined;
    /** Icon URL. `.svg` -> inline SVG, anything else -> `<img>`. Wins over `iconclass`. */
    @Input() iconurl: string | null | undefined;
    /** Fallback font-icon class used when both `iconclass` and `iconurl` are empty. */
    @Input() defaultIconClass: string | null | undefined;
    /** Extra classes appended to the rendered icon element on every branch (e.g. `'panel-icon'`). */
    @Input() iconClasses: string | string[] | null | undefined;
    /** Forwarded to `ngStyle` on the rendered icon element. */
    @Input() iconStyle: { [k: string]: any } | null | undefined;
    /** `alt` text for the `<img>` branch. */
    @Input() alt: string | null | undefined;

    get _isSvg(): boolean {
        return isSvgIconUrl(this.iconurl);
    }
    get _isImage(): boolean {
        return !!this.iconurl && !this._isSvg;
    }
    get _fontClass(): string {
        return (this.iconclass && this.iconclass.trim()) || (this.defaultIconClass && this.defaultIconClass.trim()) || '';
    }

    private _extras(): string[] {
        const extras = this.iconClasses;
        if (!extras) {
            return [];
        }
        if (Array.isArray(extras)) {
            return extras;
        }
        return extras.split(/\s+/).filter(Boolean);
    }

    get _svgClasses(): string[] {
        return ['app-icon', 'app-icon-svg', ...this._extras()];
    }
    get _imageClasses(): string[] {
        return [...this._extras()];
    }
    get _fontClasses(): string[] {
        return ['app-icon', ...this._extras(), ...this._fontClass.split(/\s+/).filter(Boolean)];
    }
}
