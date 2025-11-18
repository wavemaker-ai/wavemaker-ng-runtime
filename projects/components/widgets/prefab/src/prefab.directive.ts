import {
    AfterViewInit,
    Attribute,
    Directive,
    ElementRef,
    Inject,
    Injector,
    OnDestroy,
    Optional
} from '@angular/core';

import {setCSS, noop} from '@wm/core';

import { PROP_TYPE, register, provideAsWidgetRef, StylableComponent, styler } from '@wm/components/base';
import { prefabProps } from './prefab.props';
import {startsWith} from "lodash-es";

const DEFAULT_CLS = 'app-prefab';

const registeredPropsSet = new Set<string>();

@Directive({
  standalone: true,
    selector: 'section[wmPrefab]',
    providers: [
        provideAsWidgetRef(PrefabDirective)
    ]
})
export class PrefabDirective extends StylableComponent implements OnDestroy, AfterViewInit {

    widgetType: string;
    prefabName: string;
    name: string;
    propsReady: Function;
    public renderwhenvisible: any;

    private lazyVisibilityObservers: IntersectionObserver[] = [];
    private lazyRenderActivated = false;
    private contentInitExecuted = false;
    private deferredPropsReady = false;

    constructor(inj: Injector, elRef: ElementRef, @Attribute('prefabname') prefabName, @Inject('EXPLICIT_CONTEXT') @Optional() explicitContext: any) {
        const widgetType = `wm-prefab-${prefabName}`;
        const WIDGET_CONFIG = {widgetType, hostClass: DEFAULT_CLS};
        let resolveFn: Function = noop;

        super(inj, WIDGET_CONFIG, explicitContext, new Promise(res => resolveFn = res));
        this.propsReady = resolveFn;
        this.prefabName = prefabName;
        this.widgetType = widgetType;
        this.name = elRef.nativeElement.getAttribute('name');

    }

    ngAfterViewInit() {
        if (this.shouldLazyRender()) {
            this.bootstrapWhenVisible();
        } else {
            this.activateLazyRender();
        }
    }

    onStyleChange(key: string, nv: any, ov: any) {
        if (key === 'height') {
            setCSS(this.nativeElement, 'overflow', 'auto');
        }
    }

    public setProps(config) {
        if (!config || !config.properties) {
            return;
        }

        if (!registeredPropsSet.has(this.widgetType)) {
            register(this.widgetType, this.prepareProps(config.properties));
        }

        if (this.shouldDeferPropsResolution()) {
            this.deferredPropsReady = true;
            return;
        }

        this.ensureContentInitialization();
        this.propsReady();
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

    protected handleEvent() {
        // do not call the super;
        // prevent events from getting registered
        return () => {};
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

    private shouldDeferPropsResolution(): boolean {
        return this.isRenderWhenVisibleEnabled() && !this.lazyRenderActivated;
    }

    private activateLazyRender() {
        if (this.lazyRenderActivated) {
            this.ensureContentInitialization();
            this.flushDeferredPropsReady();
            return;
        }
        this.lazyRenderActivated = true;
        this.disconnectLazyVisibilityObservers();
        this.ensureContentInitialization();
        this.flushDeferredPropsReady();
    }

    private ensureContentInitialization() {
        if (this.contentInitExecuted) {
            return;
        }
        this.contentInitExecuted = true;
        styler(this.nativeElement, this);
        this.registerReadyStateListener(() => {
            super.onPropertyChange('name', this.name);
        });
    }

    private flushDeferredPropsReady() {
        if (!this.deferredPropsReady) {
            return;
        }
        this.deferredPropsReady = false;
        this.propsReady();
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

    private prepareProps(props = {}) {
        const propsMap = new Map(prefabProps);
        Object.entries(props).forEach(([k, v]: [string, any]) => {
            let type = PROP_TYPE.STRING;

            if (v.type === 'boolean') {
                type = PROP_TYPE.BOOLEAN;
            } else if (v.type === 'number') {
                type = PROP_TYPE.NUMBER;
            } else if (v.type !== 'string') {
                type = v.type;
            }

            // Do not set the 'bind:*' values
            propsMap.set(k, {type, value: startsWith(v.value, 'bind:') ? undefined : v.value});
        });

        registeredPropsSet.add(this.widgetType);

        return propsMap;
    }

    ngOnDestroy() {
        this.disconnectLazyVisibilityObservers();
        this.invokeEventCallback('destroy', { widget: this });
        
        // CRITICAL FIX: Call super.ngOnDestroy() to unwatch all watchers
        // Without this, all watchers in prefabs remain in memory
        super.ngOnDestroy();
    }
}
