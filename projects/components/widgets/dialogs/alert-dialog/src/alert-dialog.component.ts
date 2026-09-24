import { ChangeDetectionStrategy,
    Attribute,
    Component,
    Inject,
    Injector,
    OnInit,
    OnDestroy,
    Optional,
    TemplateRef,
    ViewChild
} from '@angular/core';

import { App, toBoolean } from '@wm/core';
import { IWidgetConfig, provideAsDialogRef, provideAsWidgetRef, TextContentDirective } from '@wm/components/base';
import { BaseDialog, DialogBodyDirective, DialogFooterDirective, DialogHeaderComponent } from '@wm/components/dialogs';

import { registerProps } from './alert-dialog.props';
import { ButtonComponent } from "@wm/components/input/button";

const DIALOG_CLS = 'app-dialog modal-dialog app-alert-dialog';

const WIDGET_INFO: IWidgetConfig = { widgetType: 'wm-alertdialog' };

const alertMap: Record<string, string> = {
  information: 'info',
  error: 'danger',
  success: 'success',
  warning: 'warning'
};

@Component({
    changeDetection: ChangeDetectionStrategy.Eager,
    standalone: true,
    imports: [TextContentDirective, DialogBodyDirective, DialogFooterDirective, DialogHeaderComponent, ButtonComponent],
    selector: 'div[wmAlertDialog]',
    templateUrl: './alert-dialog.component.html',
    providers: [
        provideAsWidgetRef(AlertDialogComponent),
        provideAsDialogRef(AlertDialogComponent)
    ]
})
export class AlertDialogComponent extends BaseDialog implements OnInit, OnDestroy {
    static initializeProps = registerProps();
    isPrism: boolean;
    alerttype: any;

    @ViewChild('dialogTemplate', { static: true }) dialogTemplate: TemplateRef<any>;

    constructor(
        inj: Injector,
        @Attribute('class') dialogClass: string,
        @Attribute('modal') modal: string | boolean,
        @Attribute('closable') closable: string | boolean,
        @Inject('EXPLICIT_CONTEXT') @Optional() explicitContext: any,
        public app: App
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
     this.isPrism = this.app.isPrism;
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
        this.invokeEventCallback('ok', { $event });
    }

    ngOnInit() {
        super.ngOnInit();
        this.alerttype = alertMap[this.alerttype] ?? this.alerttype;
        this.register(this.viewParent);
    }

    ngOnDestroy() {
        // MEMORY LEAK FIX: Clear ViewChild reference
        this.dialogTemplate = null;

        super.ngOnDestroy();
    }
}
