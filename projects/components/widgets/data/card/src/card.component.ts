import { CommonModule } from '@angular/common';
import { TextContentDirective } from "@wm/components/base";
import { PictureDirective } from '@wm/components/basic/picture';
import { MenuComponent } from '@wm/components/navigation/menu';
import {
    AfterViewInit,
    Component,
    ElementRef,
    Injector,
    OnDestroy,
    OnInit,
    Renderer2,
    Optional,
    ViewChild,
    Inject
} from '@angular/core';

import { APPLY_STYLES_TYPE, IWidgetConfig, provideAsWidgetRef, styler } from '@wm/components/base';
import { MenuAdapterComponent } from '@wm/components/navigation/menu';

import { registerProps } from './card.props';
import {removeAttr, setAttr} from '@wm/core';

const DEFAULT_CLS = 'app-card card app-panel';
const WIDGET_CONFIG: IWidgetConfig = {
    widgetType: 'wm-card',
    hostClass: DEFAULT_CLS
};

@Component({
    standalone: true,
    imports: [CommonModule, TextContentDirective, PictureDirective, MenuComponent],
    selector: '[wmCard]',
    templateUrl: './card.component.html',
    providers: [
        provideAsWidgetRef(CardComponent)
    ]
})
export class CardComponent extends MenuAdapterComponent implements OnInit, AfterViewInit, OnDestroy {
    static initializeProps = registerProps();

    public showHeader: boolean;
    public title: string;
    public subheading: string;
    public iconclass: string;
    public iconurl: string;
    public actions: string;
    public picturesource;
    public renderwhenvisible: any;
    public imageheight: string;
    public autoclose: string;

    @ViewChild('cardContainerWrapper', { static: true }) private cardContainerElRef: ElementRef;

    private removeKeydownListener: (() => void) | null = null;
    private lazyVisibilityObservers: IntersectionObserver[] = [];
    private lazyRenderActivated = false;

    constructor(inj: Injector, private render2: Renderer2, @Inject('EXPLICIT_CONTEXT') @Optional() explicitContext: any) {
        super(inj, WIDGET_CONFIG, explicitContext);
        styler(this.nativeElement, this, APPLY_STYLES_TYPE.SHELL);
    }

    ngAfterViewInit() {
        if (this.shouldLazyRender()) {
            this.bootstrapWhenVisible();
        } else {
            this.activateLazyRender();
        }
    }
    ngOnInit() {
        super.ngOnInit();
        removeAttr(this.nativeElement.parentElement, 'tabindex');
        setAttr(this.nativeElement, 'tabindex', 0);
        this.removeKeydownListener = this.render2.listen(this.nativeElement, 'keydown.Enter', (e) => {
            e.preventDefault();
            this.nativeElement.click();
        });
    }

    onPropertyChange(key: string, nv: any, ov?: any) {
        if (key === 'title' || key === 'subheading' || key === 'iconclass' || key === 'iconurl' || key === 'actions') {
            this.showHeader = !!(this.title || this.subheading || this.iconclass || this.iconurl || this.actions);
        } else if (key === 'renderwhenvisible') {
            if (this.shouldLazyRender()) {
                this.bootstrapWhenVisible();
            } else {
                this.activateLazyRender();
            }
        } else {
            super.onPropertyChange(key, nv, ov);
        }
    }

    ngOnDestroy() {
        this.disconnectLazyVisibilityObservers();
        if (this.removeKeydownListener) {
            this.removeKeydownListener();
            this.removeKeydownListener = null;
        }
        super.ngOnDestroy();
    }

    private shouldLazyRender(): boolean {
        const flag = this.renderwhenvisible as unknown;
        const enabled = typeof flag === 'string' ? flag === 'true' : !!flag;
        return enabled && !this.lazyRenderActivated;
    }

    private activateLazyRender() {
        if (this.lazyRenderActivated) {
            return;
        }
        this.lazyRenderActivated = true;
        this.disconnectLazyVisibilityObservers();
        super.ngAfterViewInit();
        styler(this.cardContainerElRef.nativeElement, this, APPLY_STYLES_TYPE.INNER_SHELL);
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
        const scrollRoots = this.getScrollableAncestors(this.nativeElement);

        if (this.isElementVisibleWithinRoot(this.nativeElement, null, buffer) ||
            scrollRoots.some(root => this.isElementVisibleWithinRoot(this.nativeElement, root, buffer))) {
            this.activateLazyRender();
            return;
        }

        this.disconnectLazyVisibilityObservers();

        const observerCallback: IntersectionObserverCallback = (entries) => {
            if (entries.some(entry => entry.isIntersecting)) {
                this.disconnectLazyVisibilityObservers();
                this.activateLazyRender();
            }
        };

        const createObserver = (root: Element | null) => {
            const observer = new IntersectionObserver(observerCallback, {
                root,
                rootMargin: '200px'
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
}

// Todo(swathi) - menu
