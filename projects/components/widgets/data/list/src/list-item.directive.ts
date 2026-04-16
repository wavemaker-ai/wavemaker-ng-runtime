import {
    AfterViewInit,
    Directive,
    ElementRef,
    HostBinding,
    HostListener,
    Inject,
    inject,
    Injector,
    Input,
    OnDestroy,
    OnInit,
    Optional,
    Renderer2,
    ViewContainerRef
} from '@angular/core';

import {Observable, Subject} from 'rxjs';

import {$watch, addClass, App} from '@wm/core';

import {ListComponent} from './list.component';
import {APPLY_STYLES_TYPE, AutoLayout, StylableComponent, styler, widgetIdGenerator} from "@wm/components/base";
import {BaseFormComponent} from "@wm/components/input/base-form";
import { registerProps } from './list-item.props';

declare const $;
/********* Will come to this later for listtemplate = container variant **********/
// const DEFAULT_CLS = 'app-container';
// const WIDGET_CONFIG = { widgetType: 'wm-listtemplate', hostClass: DEFAULT_CLS};

const WIDGET_CONFIG = { widgetType: 'wm-listtemplate'};

@AutoLayout({ bindParent: 'listComponent.viewParent' })
@Directive({
  standalone: true,
    selector: '[wmListItem]',
    exportAs: 'listItemRef'
})
export class ListItemDirective  extends StylableComponent implements OnInit, AfterViewInit, OnDestroy {

    static initializeProps = registerProps();

    public item;
    public context;
    public destroySub: Subject<any> = new Subject();
    public destroy$: Observable<any> = this.destroySub.asObservable();
    public nativeElement: HTMLElement;
    public readonly listComponent: ListComponent;

    private itemClass = '';
    private _currentItemWidgets = {};
    viewContainerRef: ViewContainerRef;
    /**
     * To avoid re-rendering of widget, passing unique id as contextKey to createCustomInjector
     */
    trackId = widgetIdGenerator.nextUid();

    // Store event listener references for cleanup
    private editClickHandler;
    private deleteClickHandler;
    private mouseEnterHandler;
    private mouseLeaveHandler;

    @HostBinding('class.active') isActive = false;
    @HostBinding('class.disable-item') disableItem = false;

    @HostListener('focus')
    onFocus() {
        // maintains which element is focused/selected most recently.
        this.listComponent.lastSelectedItem = this;
    }

    get $index() {
        return this.context.$index;
    }

    get $even() {
        return this.context.even;
    }

    get $odd() {
        return this.context.odd;
    }

    get $first() {
        return this.context.first;
    }

    get $last() {
        return this.context.last;
    }

    get currentItemWidgets () {
        const componentElements = Array.from(this.nativeElement.querySelectorAll('[widget-id]'));
        return Object.assign(this._currentItemWidgets, componentElements.reduce((result, comp: any) => {
            result[comp.widget.name] = comp.widget;
            return result;
        }, {}));
    }

    @Input() set wmListItem(val) {
        this.item = val;
    }
    private _viewParent = inject(ListComponent, {optional: true});
    constructor(inj: Injector, elRef: ElementRef, public app: App, private renderer: Renderer2, @Inject('EXPLICIT_CONTEXT') @Optional() explicitContext: any) {
        super(inj, WIDGET_CONFIG, explicitContext);
        // addClass(this.nativeElement, DEFAULT_CLS); // Will come to this later for listtemplate = container variant
        styler(this.nativeElement, this, APPLY_STYLES_TYPE.CONTAINER);

        this.viewContainerRef = inj.get(ViewContainerRef);
        this.nativeElement = elRef.nativeElement;
        this.listComponent = this._viewParent;
        // this.context = (<NgForOfContext<ListItemDirective>>(<any>inj).view.context);
        this.context = (this.inj as any)._lView[8];
        //this.context = (this.viewContainerRef as any)._hostLView.find(t => t && !!t.$implicit);
        this.itemClassWatcher(this.listComponent);
        this.disableItemWatcher(this.listComponent);

        this.itemAttrsHandler();

        $(this.nativeElement).data('listItemContext', this);
    }

    /**
    * Applies all the list item attributes and adds a watch on postion attribute
    */
    private itemAttrsHandler() {
        const attrsMap = this.listComponent.itemAttrsMap;
        
        if (!attrsMap) {
            return;
        }

        Object.keys(attrsMap).forEach(key => {
            const value = attrsMap[key];
            this.setProperty(key, value);
        });
    }

    private registerWatch(expression: string, callback: Function) {
        // Removing ngFor context as the same properties are availble on listitem scope.
        // passing viewparent context for accessing varibales and widgets.
        //[CSP]: expression will be generated in the component as e.g. 'item.className'
        this.destroy$.subscribe($watch(expression, (this.listComponent as any).viewParent, this, callback));
    }

    private itemClassWatcher(listComponent: ListComponent) {
        if (listComponent.binditemclass) {
            this.registerWatch(listComponent.binditemclass, nv => this.itemClass = nv || '');
        } else {
            this.itemClass = listComponent.itemclass;
        }
    }

    private disableItemWatcher($list: ListComponent) {
        if ($list.binddisableitem) {
            this.registerWatch($list.binddisableitem, nv => this.disableItem = nv || false);
        } else {
            this.disableItem = $list.disableitem || false;
        }
    }

    private boundEditHandler: (event: Event) => void;
    private boundDeleteHandler: (event: Event) => void;
    private boundMouseEnterHandler: (event: Event) => void;
    private boundMouseLeaveHandler: (event: Event) => void;

    private setUpCUDHandlers() {
        const $editItem = this.nativeElement.querySelector('.edit-list-item');
        const $deleteItem = this.nativeElement.querySelector('.delete-list-item');

        if ($editItem) {
            // MEMORY LEAK FIX: Store bound handler for cleanup
            this.boundEditHandler = (evt: Event) => {
                this.listComponent.update();
            };
            // Triggered on click of edit action
            $editItem.addEventListener('click', this.boundEditHandler);
        }

        if ($deleteItem) {
            // MEMORY LEAK FIX: Store bound handler for cleanup
            this.boundDeleteHandler = (evt: Event) => {
                this.listComponent.delete();
            };
            // Triggered on click of delete action
            $deleteItem.addEventListener('click', this.boundDeleteHandler);
        }
    }
    ngOnInit() {
        super.ngOnInit();
        if (this.listComponent.mouseEnterCB) {
            // MEMORY LEAK FIX: Store bound handler for cleanup
            this.boundMouseEnterHandler = ($event: Event) => {
                this.listComponent.invokeEventCallback('mouseenter', {widget: this, $event});
            };
            this.nativeElement.addEventListener('mouseenter', this.boundMouseEnterHandler);
        }
        if (this.listComponent.mouseLeaveCB) {
            // MEMORY LEAK FIX: Store bound handler for cleanup
            this.boundMouseLeaveHandler = ($event: Event) => {
                this.listComponent.invokeEventCallback('mouseleave', {widget: this, $event});
            };
            this.nativeElement.addEventListener('mouseleave', this.boundMouseLeaveHandler);
        }
        // adding item attribute on every list item
        $(this.nativeElement).attr('listitemindex', this.$index);
    }

    ngAfterViewInit() {
        super.ngAfterViewInit();
        this.setUpCUDHandlers();
        const componentElements = Array.from(this.nativeElement.querySelectorAll('[widget-id]'));
        componentElements.forEach((component: any) => {
            if(component.widget instanceof BaseFormComponent) {
                if(!component.widget.$attrs.get('datavaluesource.bind')) {
                    component.widget.datavaluesource = this.listComponent['datasource'];
                }
            }
        });
    }

    ngOnDestroy() {
        // MEMORY LEAK FIX: Remove event listeners
        if (this.boundMouseEnterHandler && this.nativeElement) {
            try {
                this.nativeElement.removeEventListener('mouseenter', this.boundMouseEnterHandler);
            } catch (e) {
                // Silently handle cleanup errors
            }
            this.boundMouseEnterHandler = null;
        }
        if (this.boundMouseLeaveHandler && this.nativeElement) {
            try {
                this.nativeElement.removeEventListener('mouseleave', this.boundMouseLeaveHandler);
            } catch (e) {
                // Silently handle cleanup errors
            }
            this.boundMouseLeaveHandler = null;
        }

        if (this.nativeElement) {
            const $editItem = this.nativeElement.querySelector('.edit-list-item');
            if ($editItem && this.boundEditHandler) {
                try {
                    $editItem.removeEventListener('click', this.boundEditHandler);
                } catch (e) {
                    // Silently handle cleanup errors
                }
                this.boundEditHandler = null;
            }

            const $deleteItem = this.nativeElement.querySelector('.delete-list-item');
            if ($deleteItem && this.boundDeleteHandler) {
                try {
                    $deleteItem.removeEventListener('click', this.boundDeleteHandler);
                } catch (e) {
                    // Silently handle cleanup errors
                }
                this.boundDeleteHandler = null;
            }
        }

        // MEMORY LEAK FIX: Clear context to release references
        if (this.context) {
            Object.keys(this.context).forEach(key => {
                delete this.context[key];
            });
            this.context = null;
        }

        // MEMORY LEAK FIX: Clear ViewContainerRef reference
        if (this.viewContainerRef) {
            this.viewContainerRef = null;
        }

        // MEMORY LEAK FIX: Complete the destroy subject
        if (this.destroySub) {
            try {
                if (!this.destroySub.closed) {
                    this.destroySub.next(null);
                    this.destroySub.complete();
                }
            } catch (e) {
                // Silently handle cleanup errors
            }
            this.destroySub = null;
        }

        super.ngOnDestroy();
    }
}
