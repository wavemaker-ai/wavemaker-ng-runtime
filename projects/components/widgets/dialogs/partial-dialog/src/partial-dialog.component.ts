import {
    Attribute,
    Component,
    ContentChild,
    Inject,
    Injector,
    OnDestroy,
    OnInit,
    Optional,
    TemplateRef,
    ViewChild
} from '@angular/core';

import { App, toBoolean } from '@wm/core';
import { provideAsDialogRef, provideAsWidgetRef } from '@wm/components/base';
import { BaseDialog, DialogBodyDirective, DialogFooterDirective, DialogHeaderComponent } from '@wm/components/dialogs';

import { registerProps } from './partial-dialog.props';
import { ButtonComponent } from '@wm/components/input/button';
import { NgTemplateOutlet } from '@angular/common';

const DIALOG_CLS = 'app-dialog modal-dialog app-page-dialog';
const WIDGET_INFO = { widgetType: 'wm-partialdialog' };

@Component({
    standalone: true,
    imports: [DialogBodyDirective, DialogFooterDirective, DialogHeaderComponent, ButtonComponent, NgTemplateOutlet],
    selector: 'div[wmPartialDialog]',
    templateUrl: './partial-dialog.component.html',
    providers: [
        provideAsWidgetRef(PartialDialogComponent),
        provideAsDialogRef(PartialDialogComponent)
    ]
})
export class PartialDialogComponent extends BaseDialog implements OnInit, OnDestroy {
    static initializeProps = registerProps();
    // TypeScript fix: Explicitly declare inherited properties
    protected viewParent: any;
    protected register: (parent: any) => void;
    // invokeEventCallback is a public method inherited from BaseComponent, no need to redeclare
    @ViewChild('dialogTemplate', { static: true }) dialogTemplate: TemplateRef<any>;
    @ContentChild(TemplateRef) dialogContent: TemplateRef<any>;
    @ContentChild('partial') partialRef;

    protected app;
    protected Widgets;
    protected Variables;
    protected Actions;
    private partialLoadSubscription: () => void;

    constructor(
        inj: Injector,
        app: App,
        @Attribute('class') dialogClass: string,
        @Attribute('modal') modal: string | boolean,
        @Attribute('closable') closable: string | boolean,
        @Inject('EXPLICIT_CONTEXT') @Optional() explicitContext: any
    ) {
        if (modal === null || modal === undefined) {
            modal = false;
        }

        if (closable === null || closable === undefined) {
            closable = true;
        }

        // setting the backdrop to 'static' will not close the dialog on backdrop click
        const backdrop: boolean | 'static' = toBoolean(modal) ? 'static' : true;

        super(
            inj,
            WIDGET_INFO,
            {
                class: `${DIALOG_CLS} ${dialogClass || ''}`,
                backdrop,
                keyboard: !toBoolean(modal)
            },
            explicitContext
        );
        this.app = app;
    }

    protected getTemplateRef(): TemplateRef<any> {
        return this.dialogTemplate;
    }

    /**
     * Click event handler for the ok button
     * invokes on-ok event callback
     * @param {Event} $event
     */
    onOk($event: Event) {
        (this as any).invokeEventCallback('ok', { $event });
    }

    ngOnInit() {
        super.ngOnInit();
        (this as any).register((this as any).viewParent);
    }

    private setPartialLoadListener() {
        // MEMORY LEAK FIX: Store subscription for cleanup
        this.partialLoadSubscription = this.app.subscribe('partialLoaded', () => {
            const parEle = this.partialRef.nativeElement;
            let partialScope;
            if (parEle) {
                partialScope = parEle.widget;
                this.Widgets = partialScope.Widgets;
                this.Variables = partialScope.Variables;
                this.Actions = partialScope.Actions;
            }
            // Clean up subscription after it fires
            if (this.partialLoadSubscription) {
                this.partialLoadSubscription();
                this.partialLoadSubscription = null;
            }
        });
    }

    ngOnDestroy() {
        // MEMORY LEAK FIX: Clean up subscription if it still exists
        if (this.partialLoadSubscription) {
            this.partialLoadSubscription();
            this.partialLoadSubscription = null;
        }
        super.ngOnDestroy();
    }

    public open(initState?: any) {
        super.open(initState);
        // WMS-19410 - Set the partial load listener to access widgets, variables and actions of page dialog
        this.setPartialLoadListener();
    }
}
