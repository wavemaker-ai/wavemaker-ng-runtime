import { Directive, ElementRef, Input, OnDestroy } from '@angular/core';

import { setAttr } from '@wm/core';

export const disableContextMenu = ($event: Event) => {
    $event.preventDefault();
};

@Directive({
    standalone: true,
    selector: '[wmNavigationControl]'
})
export class NavigationControlDirective implements OnDestroy {

    private nativeElement: HTMLElement;
    private _link: string;
    private boundContextMenuHandler: (event: Event) => void;

    @Input() disableMenuContext: boolean;

    @Input() set wmNavigationControl(val) {
        this._link = val;
        
        // MEMORY LEAK FIX: Remove existing listener before adding new one
        if (this.boundContextMenuHandler) {
            this.nativeElement.removeEventListener('contextmenu', this.boundContextMenuHandler);
            this.boundContextMenuHandler = null;
        }

        if (val && !this.disableMenuContext) {
            setAttr(this.nativeElement, 'href', val);
        } else {
            setAttr(this.nativeElement, 'href', 'javascript:void(0)');
            // MEMORY LEAK FIX: Store bound function reference for cleanup
            this.boundContextMenuHandler = disableContextMenu;
            this.nativeElement.addEventListener('contextmenu', this.boundContextMenuHandler);
        }
    }

    constructor(eleRef: ElementRef) {
        this.nativeElement = eleRef.nativeElement;
    }

    ngOnDestroy() {
        // MEMORY LEAK FIX: Remove event listener using stored bound function reference
        if (this.boundContextMenuHandler) {
            this.nativeElement.removeEventListener('contextmenu', this.boundContextMenuHandler);
            this.boundContextMenuHandler = null;
        }
    }
}
