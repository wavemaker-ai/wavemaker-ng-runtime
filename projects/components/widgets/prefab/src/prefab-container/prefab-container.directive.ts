import {Directive, Inject, Injector, OnDestroy, Optional} from '@angular/core';

import { AutoLayout, IWidgetConfig, provideAsWidgetRef, StylableComponent, styler } from '@wm/components/base';
import {App, Viewport, ViewportEvent} from '@wm/core';
import { registerProps } from './prefab-container.props';
import {assign} from "lodash-es";

const DEFAULT_CLS = 'app-prefab-container full-height';
const WIDGET_CONFIG: IWidgetConfig = {
    widgetType: 'wm-prefab-container',
    hostClass: DEFAULT_CLS
};

@AutoLayout()
@Directive({
  standalone: true,
    selector: '[wmPrefabContainer]',
    providers: [
        provideAsWidgetRef(PrefabContainerDirective)
    ]
})
export class PrefabContainerDirective extends StylableComponent  implements OnDestroy {
    static readonly initializeProps = registerProps();

    constructor(inj: Injector, private readonly app: App, private readonly viewport: Viewport, @Inject('EXPLICIT_CONTEXT') @Optional() explicitContext: any) {
        super(inj, WIDGET_CONFIG, explicitContext);
        styler(this.nativeElement, this);

        this.registerDestroyListener(this.viewport.subscribe(ViewportEvent.RESIZE, data => this.callback('resize', data)));
        this.registerDestroyListener(this.viewport.subscribe(ViewportEvent.ORIENTATION_CHANGE, data => this.callback('orientationchange', data)));
    }

    private callback(eventName, locals?: object) {
        locals = assign({widget: this}, locals);
        this.invokeEventCallback(eventName, locals);
    }

    public ngOnAttach() {
        this.callback('attach');
    }

    public ngOnDetach() {
        this.callback('detach');
    }

    public ngOnDestroy() {
        this.callback('destroy');
        super.ngOnDestroy();
    }
}
