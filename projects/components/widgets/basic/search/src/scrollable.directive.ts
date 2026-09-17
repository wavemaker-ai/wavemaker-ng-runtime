import { AfterContentInit, AfterViewInit, Directive, ElementRef, inject, Injector, OnDestroy } from '@angular/core';

import {SearchComponent} from './search.component';

declare const $;

@Directive({
  standalone: true,
    selector: '[scrollableHandler]'
})
export class ScrollableDirective implements AfterContentInit, AfterViewInit, OnDestroy {
    private readonly elementRef: ElementRef;
    private readonly searchRef = inject( SearchComponent );
    private boundNotifyParent: (evt: Event) => void; // MEMORY LEAK FIX: Store bound function
    
    constructor(inj: Injector) {
        this.elementRef = inj.get(ElementRef);
    }

    ngAfterContentInit() {
        // MEMORY LEAK FIX: Store bound function reference for proper removal
        this.boundNotifyParent = this.notifyParent.bind(this);
        
        // add the scroll event listener on the ul element.
        this.elementRef.nativeElement.addEventListener('scroll', this.boundNotifyParent);
        this.searchRef.dropdownEl = $(this.elementRef.nativeElement);
        (this.searchRef as any).onDropdownOpen();
    }

    ngAfterViewInit() {
        if (!this.searchRef.isMobileAutoComplete()) {
            // assigning width for the dropdown.
            const typeAheadInput = this.searchRef.$element.find('input').first();
            this.searchRef.dropdownEl.width(typeAheadInput.outerWidth());
        }
    }

    private notifyParent(evt: Event) {
        this.searchRef.onScroll(this.elementRef.nativeElement, evt);
    }
    
    ngOnDestroy() {
        // MEMORY LEAK FIX: Remove scroll event listener using stored bound function reference
        if (this.elementRef?.nativeElement && this.boundNotifyParent) {
            this.elementRef.nativeElement.removeEventListener('scroll', this.boundNotifyParent);
            this.boundNotifyParent = null;
        }
    }
}
