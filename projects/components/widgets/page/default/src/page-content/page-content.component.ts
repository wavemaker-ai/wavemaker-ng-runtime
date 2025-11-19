import {Component, Inject, Injector, Optional} from '@angular/core';

import {App, switchClass} from '@wm/core';
import { APPLY_STYLES_TYPE, PullToRefresh, provideAsWidgetRef, StylableComponent, styler } from '@wm/components/base';

import { registerProps } from './page-content.props';

const DEFAULT_CLS = 'app-page-content app-content-column';
const WIDGET_CONFIG = {widgetType: 'wm-page-content', hostClass: DEFAULT_CLS};

@Component({
    standalone: true,
    selector: '[wmPageContent]',
    templateUrl: './page-content.component.html',
    providers: [
        provideAsWidgetRef(PageContentComponent)
    ]
})
export class PageContentComponent extends StylableComponent {
    static initializeProps = registerProps();

    public pullToRefreshIns: PullToRefresh;
    private pulltorefresh: boolean;
    private childPullToRefresh: boolean;

    constructor(inj: Injector, private app: App, @Inject('EXPLICIT_CONTEXT') @Optional() explicitContext: any) {
        super(inj, WIDGET_CONFIG, explicitContext);

        // Access inherited nativeElement property from BaseComponent
        styler((this as any).nativeElement, this, APPLY_STYLES_TYPE.CONTAINER);

        // Access inherited registerDestroyListener method from BaseComponent
        (this as any).registerDestroyListener(this.app.subscribe('pullToRefresh:enable', () => {
            this.childPullToRefresh = true;
            this.initPullToRefresh();
        }));
    }

    onPropertyChange(key: string, nv: any, ov?: any) {
        if (key === 'columnwidth') {
            // Access inherited nativeElement property from BaseComponent
            switchClass((this as any).nativeElement, `col-md-${nv} col-sm-${nv}`, `col-md-${ov} col-sm-${ov}`);
        } else if (key === 'pulltorefresh' && nv) {
            // creating instance after timeout as the smoothscroll styles where getting added on pull refresh-container
            setTimeout(() => {
                this.initPullToRefresh();
            });
        } else {
            super.onPropertyChange(key, nv, ov);
        }
    }

    // when list component is ready, pulltorefresh instance is created and this appends pullToRefresh element on the page content.
    private initPullToRefresh() {
        // Access inherited hasEventCallback method from BaseComponent
        const hasPullToRefreshEvent = (this as any).hasEventCallback('pulltorefresh');
        if (!this.pullToRefreshIns && (this.childPullToRefresh || hasPullToRefreshEvent) && this.pulltorefresh) {
            // Access inherited nativeElement property from BaseComponent
            this.pullToRefreshIns = new PullToRefresh($((this as any).nativeElement), this.app, () => {
                if (hasPullToRefreshEvent) {
                    (this as any).invokeEventCallback('pulltorefresh');
                } else {
                    this.app.notify('pulltorefresh');
                }
            });
            // Access inherited registerDestroyListener method from BaseComponent
            (this as any).registerDestroyListener(() => {
                if (this.pullToRefreshIns.cancelSubscription) {
                    this.pullToRefreshIns.cancelSubscription();
                }
            });
        }
    }
}
