import { CommonModule } from '@angular/common';
import {Component, HostBinding, Inject, Injector, Optional} from '@angular/core';

import {IWidgetConfig, provideAsWidgetRef, StylableComponent, styler, SvgIconDirective, TextContentDirective} from '@wm/components/base';
import {registerProps} from './icon.props';

const DEFAULT_CLS = 'app-icon-wrapper';
const WIDGET_CONFIG: IWidgetConfig = {
    widgetType: 'wm-icon',
    hostClass: DEFAULT_CLS
};

@Component({
    standalone: true,
    imports: [CommonModule, TextContentDirective, SvgIconDirective],
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

    ngAfterViewInit(): void {
        if (!this.iconclass && !this.iconurl) {
            this.iconclass = 'wm-sl-l sl-user';
        }
    }

    /** SVG branch is taken only when no `iconclass` is configured and a `url` is provided. */
    public get useSvgIcon(): boolean {
        return !this.iconclass && !!this.iconurl;
    }
}
