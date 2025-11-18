import {AfterViewInit, Directive, Inject, Injector, OnDestroy, Optional} from '@angular/core';

import {Viewport, ViewportEvent} from '@wm/core';
import { StylableComponent } from '../base/stylable.component';
import { registerProps } from './partial.props';
import { provideAsWidgetRef } from '../../../utils/widget-utils';
import {assign} from "lodash-es";

const DEFAULT_CLS = 'app-partial clearfix';
const WIDGET_CONFIG = {widgetType: 'wm-partial', hostClass: DEFAULT_CLS};

@Directive({
  standalone: true,
    selector: '[wmPartial]',
    providers: [
        provideAsWidgetRef(PartialDirective)
    ]
})
export class PartialDirective extends StylableComponent implements OnDestroy, AfterViewInit {
    static initializeProps = registerProps();
    public renderwhenvisible: any;

    private lazyVisibilityObservers: IntersectionObserver[] = [];
    private lazyRenderActivated = false;
    private contentInitExecuted = false;
    constructor(inj: Injector, private viewport: Viewport, @Inject('EXPLICIT_CONTEXT') @Optional() explicitContext: any) {
        super(inj, WIDGET_CONFIG, explicitContext);
    }

    ngAfterViewInit() {
        if (this.shouldLazyRender()) {
            this.bootstrapWhenVisible();
        } else {
            this.activateLazyRender();
        }
    }

    onPropertyChange(key: string, nv: any, ov?: any) {
        if (key === 'renderwhenvisible') {
            if (this.shouldLazyRender()) {
                this.bootstrapWhenVisible();
            } else {
                this.activateLazyRender();
            }
            return;
        }
        super.onPropertyChange(key, nv, ov);
    }

    private callback(eventName, locals?: object) {
        locals = assign({widget: this}, locals);
        this.invokeEventCallback(eventName, locals);
    }

    private shouldLazyRender(): boolean {
        return this.isRenderWhenVisibleEnabled() && !this.lazyRenderActivated;
    }

    private isRenderWhenVisibleEnabled(): boolean {
        const flag = this.renderwhenvisible as unknown;
        if (typeof flag === 'string') {
            return flag === 'true';
        }
        if (flag !== undefined && flag !== null) {
            return !!flag;
        }
        const attrValue = (this.nativeElement as HTMLElement)?.getAttribute?.('renderwhenvisible');
        if (attrValue === null || attrValue === undefined) {
            return false;
        }
        return attrValue === '' || attrValue === 'true';
    }

    private activateLazyRender() {
        if (this.lazyRenderActivated) {
            this.ensureContentInitialization();
            return;
        }
        this.lazyRenderActivated = true;
        this.disconnectLazyVisibilityObservers();
        this.ensureContentInitialization();
    }

    private ensureContentInitialization() {
        if (this.contentInitExecuted) {
            return;
        }
        this.contentInitExecuted = true;
        this.registerDestroyListener(this.viewport.subscribe(ViewportEvent.RESIZE, data => this.callback('resize', data)));
        this.registerDestroyListener(this.viewport.subscribe(ViewportEvent.ORIENTATION_CHANGE, data => this.callback('orientationchange', data)));
    }

    private bootstrapWhenVisible() {
        if (!this.shouldLazyRender()) {
            this.activateLazyRender();
            return;
        }

        if (typeof IntersectionObserver === 'undefined' || !this.nativeElement) {
            this.activateLazyRender();
            return;
        }

        const buffer = 200;
        const scrollRoots = this.getScrollableAncestors(this.nativeElement as HTMLElement);
        const isVisibleWithinViewport = this.isElementVisibleWithinRoot(this.nativeElement as HTMLElement, null, buffer);
        const isVisibleWithinScrollParent = scrollRoots.some(root => this.isElementVisibleWithinRoot(this.nativeElement as HTMLElement, root, buffer));

        if (isVisibleWithinViewport || isVisibleWithinScrollParent) {
            this.activateLazyRender();
            return;
        }

        this.disconnectLazyVisibilityObservers();

        const observerCallback: IntersectionObserverCallback = (entries) => {
            if (entries.some(entry => entry.isIntersecting || entry.intersectionRatio > 0)) {
                this.disconnectLazyVisibilityObservers();
                this.activateLazyRender();
            }
        };

        const createObserver = (root: Element | null) => {
            const observer = new IntersectionObserver(observerCallback, {
                root,
                rootMargin: `${buffer}px`
            });
            this.lazyVisibilityObservers.push(observer);
            observer.observe(this.nativeElement);
        };

        createObserver(null);
        scrollRoots.forEach(root => createObserver(root));
    }

    private disconnectLazyVisibilityObservers() {
        if (!this.lazyVisibilityObservers.length) {
            return;
        }
        this.lazyVisibilityObservers.forEach(observer => observer.disconnect());
        this.lazyVisibilityObservers = [];
    }

    private getScrollableAncestors(element: HTMLElement | null): HTMLElement[] {
        if (typeof window === 'undefined' || !element) {
            return [];
        }
        const ancestors: HTMLElement[] = [];
        let parent: HTMLElement | null = element.parentElement;
        const scrollRegex = /(auto|scroll|overlay)/;

        while (parent) {
            const style = window.getComputedStyle(parent);
            const overflowValues = [style.overflow, style.overflowY, style.overflowX].join(' ');
            if (scrollRegex.test(overflowValues)) {
                ancestors.push(parent);
            }
            parent = parent.parentElement;
        }

        return ancestors;
    }

    private isElementVisibleWithinRoot(element: HTMLElement | null, root: Element | null, buffer = 200): boolean {
        if (typeof window === 'undefined' || !element) {
            return false;
        }
        const rect = element.getBoundingClientRect();
        if (!rect) {
            return false;
        }
        if (!root) {
            const viewportHeight = window.innerHeight || document.documentElement?.clientHeight || 0;
            if (!viewportHeight) {
                return false;
            }
            return rect.top < viewportHeight + buffer && rect.bottom > -buffer;
        }

        const rootRect = (root as HTMLElement).getBoundingClientRect();
        return rect.top < rootRect.bottom + buffer && rect.bottom > rootRect.top - buffer;
    }

    public ngOnAttach() {
        this.callback('attach');
    }

    public ngOnDetach() {
        this.callback('detach');
    }

    public ngOnDestroy() {
        this.disconnectLazyVisibilityObservers();
        this.callback('destroy');
        super.ngOnDestroy();
    }

}
