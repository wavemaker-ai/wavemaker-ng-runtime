import {Directive, Inject, Injector, Optional} from '@angular/core';

import {addClass, App} from '@wm/core';

import { APPLY_STYLES_TYPE, styler } from '../../framework/styler';
import { IWidgetConfig } from '../../framework/types';
import { registerProps } from './container.props';
import { provideAsWidgetRef } from '../../../utils/widget-utils';
import {BaseContainerComponent} from "../base/base-container.component";
import { AutoLayoutUtils } from '../../../utils/autolayout-utils';

const DEFAULT_CLS = 'app-container';
const WIDGET_CONFIG: IWidgetConfig = {
    widgetType: 'wm-container',
    hostClass: DEFAULT_CLS
};

@Directive({
  standalone: true,
    selector: '[wmContainer]',
    providers: [
        provideAsWidgetRef(ContainerDirective)
    ]
})
export class ContainerDirective extends BaseContainerComponent {
    static initializeProps = registerProps();
    isPrism: boolean = false;
    private autoLayoutUtils: AutoLayoutUtils;

    constructor(inj: Injector, @Inject('EXPLICIT_CONTEXT') @Optional() explicitContext?: any, public app?: App) {
        super(inj, WIDGET_CONFIG, explicitContext);

        addClass(this.nativeElement, DEFAULT_CLS);
        styler(this.nativeElement, this, APPLY_STYLES_TYPE.CONTAINER);
        this.isPrism = this.app.isPrism;
        if (this.isPrism) {
            this.initializeAutoLayout();
        }
    }

    private initializeAutoLayout() {
        const self = this;
        this.autoLayoutUtils = new class extends AutoLayoutUtils {
            protected nativeElement = self.nativeElement;
            protected $element = self.$element;
            protected parentElement = self.nativeElement.parentElement ?? null
        }();
    }


    onPropertyChange(key: string, nv: any, ov?: any) {
        if (this.isPrism && this.autoLayoutUtils) {
            this.autoLayoutUtils.onPropertyChange(key, nv, ov)
        }
        super.onPropertyChange(key, nv, ov);
    }

    protected onStyleChange(key: string, nv: any, ov?: any) {
        if (this.isPrism && this.autoLayoutUtils) {
            this.autoLayoutUtils.applyStyleChange(key, nv);
        }
        super.onStyleChange(key, nv, ov);
    }
}
