import {Component, HostBinding, Inject, Injector, Optional, ChangeDetectionStrategy} from '@angular/core';

import {IWidgetConfig, provideAsWidgetRef, StylableComponent, styler, TextContentDirective, WmAppIconComponent} from '@wm/components/base';
import {registerProps} from './icon.props';

const DEFAULT_CLS = 'app-icon-wrapper';
const WIDGET_CONFIG: IWidgetConfig = {
    widgetType: 'wm-icon',
    hostClass: DEFAULT_CLS
};

@Component({
    changeDetection: ChangeDetectionStrategy.Eager,
    standalone: true,
    imports: [TextContentDirective, WmAppIconComponent],
    selector: '[wmIcon]',
    templateUrl: './icon.component.html',
    providers: [
        provideAsWidgetRef(IconComponent)
    ]
})
export class IconComponent extends StylableComponent {
    static readonly initializeProps = registerProps();

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
}
