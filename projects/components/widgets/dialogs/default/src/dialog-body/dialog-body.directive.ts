import { Directive, ElementRef, HostBinding, Inject, OnDestroy, Renderer2 } from '@angular/core';
import { Subscription } from 'rxjs';

import { BsModalService } from 'ngx-bootstrap/modal';

import { addClass, getSheetPositionClass, setAttr, setCSS } from '@wm/core';

import { DialogRef } from '@wm/components/base';

declare const $;

const DEFAULT_CLS = 'app-dialog-body modal-body';

@Directive({
  standalone: true,
    selector: 'div[wmDialogBody]',
})
export class DialogBodyDirective implements OnDestroy {
    @HostBinding('style.height') height;
    private bsModalShownSubscription: Subscription;

    constructor(
        elRef: ElementRef,
        @Inject(DialogRef) private dialogRef,
        bsModal: BsModalService,
         private readonly renderer: Renderer2
    ) {
        addClass(elRef.nativeElement, DEFAULT_CLS);

        this.bsModalShownSubscription = bsModal.onShown.subscribe(() => {
            const dialogRoot = $(elRef.nativeElement).closest('.app-dialog')[0];
            const dialogContent = $(elRef.nativeElement).closest('.modal-content')[0];
            let dialogRootContainer = $('body.wm-app')[0];
            // To identify the microfrontend, if body tag doesn't have wm-app class then app loading as micro-frontend
            if(!dialogRootContainer) {
                const dialogBackrop = $('body > .modal-backdrop')[0];
                const parentContainer = $('body > modal-container')[0];
                dialogRootContainer = $('.wm-app')[0];
                if(dialogRootContainer  && parentContainer ){
                    if(dialogBackrop){
                        this.renderer.appendChild(dialogRootContainer, dialogBackrop);
                    }
                    this.renderer.appendChild(dialogRootContainer, parentContainer);

               }
            }
            const isSheet = this.dialogRef.sheet;
            const sheetPosition = this.dialogRef.sheetPosition;
            if(isSheet) {
                $(dialogRoot).addClass('modal-sheet');
                $(dialogRoot).addClass(getSheetPositionClass(sheetPosition));
            }
            const animation = this.dialogRef.animation;
            if(animation) {
                $(dialogContent).addClass('animated');
                $(dialogContent).addClass(animation);
            }
            const width = this.dialogRef.width;
            const height = this.dialogRef.height;
            if(height){
               setTimeout(e=>{
                    setCSS($(elRef.nativeElement)[0], 'height', height);
                });
            }
            if (dialogRoot) {
                if (width) {
                    setCSS(dialogRoot, 'width', width);
                }
                setAttr(dialogRoot, 'tabindex', this.dialogRef.tabindex);
                setAttr(dialogRoot, 'name', this.dialogRef.name);

            }
            // Clean up subscription after first use
            if (this.bsModalShownSubscription) {
                this.bsModalShownSubscription.unsubscribe();
                this.bsModalShownSubscription = null;
            }
        });
    }

    ngOnDestroy() {
        // MEMORY LEAK FIX: Unsubscribe from bsModal.onShown if not already unsubscribed
        if (this.bsModalShownSubscription) {
            this.bsModalShownSubscription.unsubscribe();
            this.bsModalShownSubscription = null;
        }

        // MEMORY LEAK FIX: Clear dialogRef reference
        this.dialogRef = null;
    }
}
