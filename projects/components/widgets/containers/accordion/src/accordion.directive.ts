import { AfterContentInit, ContentChildren, Directive, forwardRef, Inject, Injector, OnDestroy, Optional, QueryList } from '@angular/core';
import { DynamicComponentRefProvider, noop, StatePersistence } from '@wm/core';
import {
    APPLY_STYLES_TYPE,
    createArrayFrom,
    IWidgetConfig,
    provideAsWidgetRef,
    StylableComponent,
    styler
} from '@wm/components/base';

import { registerProps } from './accordion.props';
import { AccordionPaneComponent } from './accordion-pane/accordion-pane.component';
import { find, forEach, get, indexOf, isArray, isNumber } from "lodash-es";

const DEFAULT_CLS = 'app-accordion panel-group';
const WIDGET_CONFIG: IWidgetConfig = {
    widgetType: 'wm-accordion',
    hostClass: DEFAULT_CLS
};

@Directive({
    standalone: true,
    selector: 'div[wmAccordion]',
    exportAs: 'wmAccordion',
    providers: [
        provideAsWidgetRef(AccordionDirective)
    ]
})
export class AccordionDirective extends StylableComponent implements AfterContentInit, OnDestroy {
    static initializeProps = registerProps();

    public defaultpaneindex: number;
    public closeothers: boolean;
    public statehandler: any;
    public renderwhenvisible: any;
    private statePersistence: StatePersistence;

    private activePaneIndex: number;
    private activePane: AccordionPaneComponent;
    private promiseResolverFn: Function;
    private dynamicComponentProvider;
    private _dynamicContext;
    private dynamicPaneIndex;
    private dynamicPanes;
    public fieldDefs;
    private panesChangesSubscription;
    private lazyVisibilityObservers: IntersectionObserver[] = [];
    private lazyRenderActivated = false;
    private lazyInitExecuted = false;
    private pendingDatasetValue: any;
    private hasPendingDatasetValue = false;

    @ContentChildren(forwardRef(() => AccordionPaneComponent)) panes: QueryList<AccordionPaneComponent>;

    constructor(inj: Injector, statePersistence: StatePersistence, dynamicComponentProvider: DynamicComponentRefProvider, @Inject('EXPLICIT_CONTEXT') @Optional() explicitContext: any) {
        let resolveFn: Function = noop;
        super(inj, WIDGET_CONFIG, explicitContext, new Promise(res => resolveFn = res));
        this.promiseResolverFn = resolveFn;
        this.statePersistence = statePersistence;
        this.dynamicComponentProvider = dynamicComponentProvider;
        this.dynamicPanes = [];
        this.dynamicPaneIndex = 0;
        styler(this.nativeElement, this, APPLY_STYLES_TYPE.SCROLLABLE_CONTAINER);
    }

    /**
     * AccordionPane children components invoke this method to communicate with the parent
     * if isExpand is true and when closeothers is true, all the other panes are collapsed
     * if the evt argument is defined on-change callback will be invoked.
     * updates the activePane index property
     * @param {AccordionPaneComponent} paneRef
     * @param {boolean} isExpand
     * @param {Event} evt
     */
    public notifyChange(paneRef: AccordionPaneComponent, isExpand: boolean, evt: Event) {
        if (isExpand) {
            this.closePanesExcept(paneRef);
            const index = this.getPaneIndexByRef(paneRef);
            this.activePane = paneRef.getWidget();
            // if the event is defined invoke the change callback.
            // programmatic invocations of expand/collapse on accordion-pane will not trigger change event
            if (evt) {
                this.invokeEventCallback('change', {
                    $event: evt,
                    newPaneIndex: index,
                    oldPaneIndex: this.activePaneIndex
                });
            }
            this.activePaneIndex = index;
        }
        const mode = this.statePersistence.computeMode(this.statehandler);
        if (evt && mode && mode.toLowerCase() !== 'none') {
            const activePanes = [];
            this.panes.forEach(function (pane) {
                if (pane.isActive) {
                    activePanes.push(pane.name);
                }
            });
            if (activePanes.length) {
                this.statePersistence.setWidgetState(this, activePanes);
            } else {
                this.statePersistence.removeWidgetState(this);
            }
        }
    }

    /**
     * This method is used to register the dynamic panes.
     * After all panes are initialzed, update the querylist manually based on index.
     * @param paneRef - refrence of the tabpane
     */
    public registerDynamicPane(paneRef) {
        this.dynamicPanes.push(paneRef);
        const isLastPane = this.dynamicPanes.length === this.dynamicPaneIndex;
        if (isLastPane) {
            for (let i = 0; i < this.dynamicPanes.length; i++) {
                const newPaneRef = find(this.dynamicPanes, pane => pane.dynamicPaneIndex === i);
                const isDuplicatePane = find(this.panes.toArray(), newPaneRef);
                if (!isDuplicatePane) {
                    this.panes.reset([...this.panes.toArray(), newPaneRef]);
                    if (newPaneRef.active) {
                        newPaneRef.expand();
                    }
                }
            }
        }
    }

    /**
     * This method is to add the tabpane dynamically
     * @param tabpanes - list of tabpanes
     */
    public addPane(tabpanes) {
        if (!isArray(tabpanes)) {
            tabpanes = [tabpanes];
        }
        const paneNamesList = [];
        forEach(tabpanes, (pane, index) => {
            const isPaneAlreadyCreated = find(this.panes.toArray(), { name: pane.name });
            const isPaneNameExist = indexOf(paneNamesList, pane.name);
            // If user tries to add tabpane with the same name which is already exists then do not create the pane
            if (isPaneAlreadyCreated || isPaneNameExist > 0) {
                console.warn(`The tab pane with name ${pane.name} already exists`);
                return;
            }

            let paramMarkup = '';
            let propsTmpl = '';
            this.dynamicPaneIndex++;
            const name = pane.name ? pane.name : `accordionpane${this.panes.toArray().length + (index + 1)}`;
            paneNamesList.push(name);
            const partialParams = get(pane, 'params');

            forEach(pane, (value, key) => {
                if (key !== 'params') {
                    propsTmpl = `${propsTmpl} ${key}="${value}"`;
                }
            });
            forEach(partialParams, (value, key) => {
                paramMarkup = `${paramMarkup} <wm-param name="${key}" value="${value}"></wm-param>`;
            });
            const markup = `<wm-accordionpane dynamicPaneIndex="${this.dynamicPaneIndex - 1}" isdynamic="true" name="${name}" ${propsTmpl}>
                            ${paramMarkup}
                        </wm-accordionpane>`;

            if (!this._dynamicContext) {
                this._dynamicContext = Object.create(this.viewParent);
                this._dynamicContext[this.getAttr('wmAccordian')] = this;
            }

            this.dynamicComponentProvider.addComponent(this.getNativeElement(), markup, this._dynamicContext, { inj: this.inj });
        });
        return paneNamesList;
    }

    /**
     * This method is to remove the tabpane
     * @param paneName - name of the pane
     */
    public removePane(paneName) {
        const paneRef = this.getPaneRefByName(paneName);
        if (paneRef) {
            paneRef.remove();
        }
    }

    private isValidPaneIndex(index: number): boolean {
        return (index >= 0 && index < this.panes.length);
    }

    private getPaneRefByName(name: string): AccordionPaneComponent {
        return find(this.panes.toArray(), { name: name });
    }

    private getPaneIndexByRef(paneRef: AccordionPaneComponent): number {
        return this.panes.toArray().indexOf(paneRef);
    }

    private getPaneRefByIndex(index: number): AccordionPaneComponent {
        return this.panes.toArray()[index];
    }

    // Except the pane provided close all other panes
    private closePanesExcept(paneRef: AccordionPaneComponent | number) {
        if (isNumber(paneRef)) {
            paneRef = this.getPaneRefByIndex(paneRef as number);
        }
        if (this.closeothers) {
            this.panes.forEach(pane => {
                if (pane !== paneRef) {
                    pane.collapse();
                }
            });
        }
    }

    private expandPane(index: number) {
        this.closePanesExcept(index);
        this.panes.toArray()[index].expand();
    }
    private onDataChange(newVal) {
        if (this.shouldDeferDataRender()) {
            this.pendingDatasetValue = newVal;
            this.hasPendingDatasetValue = true;
            return;
        }
        this.fieldDefs = createArrayFrom(newVal);
    }

    onPropertyChange(key: string, nv: any, ov?: any) {
        if (key === 'defaultpaneindex') {
            this.defaultpaneindex = nv;
        } else if (key === 'dataset') {
            this.onDataChange(nv);
        } else if (key === 'statehandler') {
            const widgetState = this.statePersistence.getWidgetState(this);
            let paneToSelect: any = [];
            if (nv !== 'none' && isArray(widgetState)) {
                widgetState.forEach(paneName => {
                    paneToSelect = this.panes.filter(function (pane) {
                        return paneName === pane.name;
                    });
                    if (!paneToSelect.length) {
                        console.warn('Accordion pane name ' + paneName + ' in State is incorrect.');
                    } else {
                        this.expandPane(this.getPaneIndexByRef(paneToSelect[0]));
                    }
                });
            } else {
                if (this.isValidPaneIndex(this.defaultpaneindex)) {
                    this.expandPane(this.defaultpaneindex);
                }
            }
        } else if (key === 'tabindex') {
            return;
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

    ngAfterContentInit() {
        if (this.shouldLazyRender()) {
            this.bootstrapWhenVisible();
        } else {
            this.activateLazyRender();
        }
    }

    ngOnDestroy() {
        this.disconnectLazyVisibilityObservers();
        this.pendingDatasetValue = null;
        this.hasPendingDatasetValue = false;
        // Unsubscribe from panes.changes to prevent memory leak
        if (this.panesChangesSubscription) {
            this.panesChangesSubscription.unsubscribe();
        }
        super.ngOnDestroy();
    }

    private ensureInitialized() {
        if (this.lazyInitExecuted) {
            return;
        }
        this.lazyInitExecuted = true;
        super.ngAfterContentInit();
        this.promiseResolverFn();
        this.panesChangesSubscription = this.panes.changes.subscribe(slides => {
            if (this.panes.length) {
                this.expandPane(this.defaultpaneindex);
            }
        });
        if (this.panes.length) {
            this.expandPane(this.defaultpaneindex);
        }
    }

    private activateLazyRender() {
        if (this.lazyRenderActivated) {
            this.ensureInitialized();
            return;
        }
        this.lazyRenderActivated = true;
        this.disconnectLazyVisibilityObservers();
        this.ensureInitialized();
        if (this.hasPendingDatasetValue) {
            const pending = this.pendingDatasetValue;
            this.pendingDatasetValue = undefined;
            this.hasPendingDatasetValue = false;
            this.onDataChange(pending);
        }
    }

    private shouldLazyRender(): boolean {
        const flag = this.renderwhenvisible as unknown;
        const enabled = typeof flag === 'string' ? flag === 'true' : !!flag;
        return enabled && !this.lazyRenderActivated;
    }

    private shouldDeferDataRender(): boolean {
        return this.shouldLazyRender();
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
