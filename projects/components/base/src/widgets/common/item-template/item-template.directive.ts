/**
 * This directive is used to set custom template partial for an item and maintains separate scope for each item.
 * This takes two inputs
 *      1) template partial name as wmItemTemplate
 *      2) item object as userComponentParams
 * Example: Providing a custom template for the search/autocomplete widget (customized UI in the dropdown for each item)
 * Add this directive to the li tag and provide item object and partial name like below. And also provide partialContainer and partial-container-target to render the partial.
 * <li #liElements *ngFor="let match of matches" [wmItemTemplate]="content" [userComponentParams]="match.item" partialContainer>
 *      <a partial-container-target></a>
 * </li>
 */

import {Directive, ElementRef, Inject, Injector, Input, OnDestroy, OnInit, Optional, ViewContainerRef} from '@angular/core';

import {App} from '@wm/core';

import { provideAsWidgetRef } from '../../../utils/widget-utils';
import { registerProps } from './item-template.props';
import { StylableComponent } from '../base/stylable.component';

const WIDGET_CONFIG = {widgetType: 'wm-item-template'};

@Directive({
  standalone: true,
    selector: '[wmItemTemplate]',
    exportAs: 'itemTemplateRef',
    providers: [
        provideAsWidgetRef(ItemTemplateDirective)
    ]
})
export class ItemTemplateDirective extends StylableComponent implements OnInit, OnDestroy {
    static initializeProps = registerProps();
    public context;
    public content;
    public partialParams;
    public nativeElement: HTMLElement;
    public viewContainerRef: ViewContainerRef;
    get $index() {
        return this.context.index;
    }

    @Input() userComponentParams;

    @Input() set wmItemTemplate(value) {
        this.widget.content = value;
    }

    constructor(inj: Injector, elRef: ElementRef, private app: App, @Inject('EXPLICIT_CONTEXT') @Optional() explicitContext: any) {
        super(inj, WIDGET_CONFIG, explicitContext);
        this.nativeElement = elRef.nativeElement;
        // this.context = (<NgForOfContext<ItemTemplateDirective>>(<any>inj).view.context);
        this.context = (this.inj as any)._lView[8];
    }
    ngOnInit() {
        super.ngOnInit();
        this.partialParams.item = this.userComponentParams.dataObject;
    }

    ngOnDestroy() {
        // MEMORY LEAK FIX: Clear context to release references to ngFor context
        // The context holds references to the parent LView and loop variables
        if (this.context) {
            Object.keys(this.context).forEach(key => {
                delete this.context[key];
            });
            this.context = null;
        }

        // MEMORY LEAK FIX: Clear partial params
        if (this.partialParams) {
            Object.keys(this.partialParams).forEach(key => {
                delete this.partialParams[key];
            });
            this.partialParams = null;
        }

        // MEMORY LEAK FIX: Clear user component params reference
        this.userComponentParams = null;

        // MEMORY LEAK FIX: Clear content reference
        this.content = null;

        // MEMORY LEAK FIX: Clear ViewContainerRef reference
        this.viewContainerRef = null;

        // Call parent ngOnDestroy (StylableComponent → BaseComponent)
        super.ngOnDestroy();
    }
}
