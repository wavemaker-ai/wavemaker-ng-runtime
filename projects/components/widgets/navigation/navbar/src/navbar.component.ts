import { CommonModule } from '@angular/common';
import {AfterViewInit, Component, ElementRef, Inject, Injector, Optional, ViewChild, OnDestroy, ChangeDetectionStrategy} from '@angular/core';

import { APPLY_STYLES_TYPE, ImagePipe, styler, StylableComponent, provideAsWidgetRef, TextContentDirective, TrustAsPipe, WmAppIconComponent } from '@wm/components/base';

import { registerProps } from './navbar.props';

const DEFAULT_CLS = 'navbar navbar-default app-navbar';
const WIDGET_CONFIG = {widgetType: 'wm-navbar', hostClass: DEFAULT_CLS};

declare const $;

@Component({
    changeDetection: ChangeDetectionStrategy.Eager,
    standalone: true,
    imports: [CommonModule, TextContentDirective, TrustAsPipe, ImagePipe, WmAppIconComponent],
    selector: '[wmNavbar]',
    templateUrl: './navbar.component.html',
    providers: [
        provideAsWidgetRef(NavbarComponent)
    ]
})
export class NavbarComponent extends StylableComponent implements AfterViewInit, OnDestroy {
    static readonly initializeProps = registerProps();

    public menuiconclass: any;
    public menuiconurl: string;
    public title: string;
    public imgsrc: string;
    @ViewChild('navContent', {static: true}) private navContent: ElementRef;

    constructor(inj: Injector, @Inject('EXPLICIT_CONTEXT') @Optional() explicitContext: any) {
        super(inj, WIDGET_CONFIG, explicitContext);
        styler(this.nativeElement, this, APPLY_STYLES_TYPE.CONTAINER);
    }

    public toggleCollapse() {
        const $navContent = $(this.navContent.nativeElement);
        $navContent.animate({ 'height': 'toggle'});
        if ($navContent.hasClass('in')) {
            setTimeout(() => this.toggleNavCollapse(), 500);
        } else {
            this.toggleNavCollapse();
        }
    }

    private toggleNavCollapse() {
        this.navContent.nativeElement.classList.toggle('in');
    }

    ngOnDestroy() {
        // MEMORY LEAK FIX: Clear ViewChild reference
        this.navContent = null;

        super.ngOnDestroy();
    }
}
