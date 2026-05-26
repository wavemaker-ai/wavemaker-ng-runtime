import { CommonModule } from '@angular/common';
import {Component, HostBinding, Inject, Injector, Optional} from '@angular/core';

import {ImagePipe, isSvgIconUrl, IWidgetConfig, provideAsWidgetRef, StylableComponent, styler, SvgIconDirective, TextContentDirective} from '@wm/components/base';
import {registerProps} from './icon.props';

const DEFAULT_CLS = 'app-icon-wrapper';
const WIDGET_CONFIG: IWidgetConfig = {
    widgetType: 'wm-icon',
    hostClass: DEFAULT_CLS
};

@Component({
    standalone: true,
    imports: [CommonModule, TextContentDirective, SvgIconDirective, ImagePipe],
    selector: '[wmIcon]',
    templateUrl: './icon.component.html',
    providers: [
        provideAsWidgetRef(IconComponent)
    ]
})
export class IconComponent extends StylableComponent {
    static initializeProps = registerProps();

    public iconclass: any;
    public caption: string;
    public hint: string;
    public arialabel: string;
    public iconurl: string;

    @HostBinding('attr.icon-position') iconposition: string;
    @HostBinding('style.fontSize') iconsize: string;

    constructor(inj: Injector, @Inject('EXPLICIT_CONTEXT') @Optional() explicitContext: any) {
        super(inj, WIDGET_CONFIG, explicitContext);

        styler(this.nativeElement, this);
    }

    /**
     * SVG branch is taken when no `iconclass` is configured and `iconurl`
     * points to an `.svg` asset (query string / fragment ignored).
     */
    public get useSvgIcon(): boolean {
        return !this.iconclass && isSvgIconUrl(this.iconurl);
    }

    /**
     * Image branch is taken when no `iconclass` is configured and `iconurl`
     * points to an image asset (query string / fragment ignored).
     */
    public get useImageIcon(): boolean {
        return !this.iconclass && !!this.iconurl && !isSvgIconUrl(this.iconurl);
    }

    // This method is used to resolve the icon class.
    public get resolvedIconClass(): string {
        if (this.iconclass) {
            return this.iconclass;
        }
        return this.iconurl ? '' : 'wm-sl-l sl-user';
    }
}
