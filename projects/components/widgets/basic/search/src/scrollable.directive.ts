import { AfterContentInit, AfterViewInit, Directive, ElementRef, inject, Injector, OnDestroy } from '@angular/core';

import { SearchComponent } from './search.component';

declare const $;

@Directive({
  standalone: true,
    selector: '[scrollable]'
})
export class ScrollableDirective implements AfterContentInit, AfterViewInit, OnDestroy {
    private elementRef: ElementRef;
    private scrollHandler;
    private searchRef = inject(SearchComponent);

    constructor(inj: Injector) {
        this.elementRef = inj.get(ElementRef);
    }

    ngAfterContentInit() {
        // add the scroll event listener on the ul element.
        this.scrollHandler = this.notifyParent.bind(this);
        this.elementRef.nativeElement.addEventListener('scroll', this.scrollHandler);
        this.searchRef.dropdownEl = $(this.elementRef.nativeElement);
        (this.searchRef as any).onDropdownOpen();
    }

    ngAfterViewInit() {
        if (!this.searchRef.isMobileAutoComplete()) {
            // assigning width for the dropdown.
            // Access inherited $element getter from SearchComponent
            const typeAheadInput = (this.searchRef as any).$element.find('input').first();
            this.searchRef.dropdownEl.width(typeAheadInput.outerWidth());
        }
    }

    private notifyParent(evt: Event) {
        this.searchRef.onScroll(this.elementRef.nativeElement, evt);
    }

    ngOnDestroy() {
        // Remove scroll event listener to prevent memory leak
        if (this.scrollHandler) {
            this.elementRef.nativeElement.removeEventListener('scroll', this.scrollHandler);
        }
    }
}
