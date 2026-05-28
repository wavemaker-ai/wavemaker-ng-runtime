import { CommonModule } from '@angular/common';
import {AfterViewInit, Component, ElementRef, Inject, Injector, Optional, ViewChild, OnDestroy} from '@angular/core';

import { APPLY_STYLES_TYPE, ImagePipe, isSvgIconUrl, styler, StylableComponent, provideAsWidgetRef, SvgIconDirective, TextContentDirective, TrustAsPipe } from '@wm/components/base';

import { registerProps } from './navbar.props';

const DEFAULT_CLS = 'navbar navbar-default app-navbar';
const WIDGET_CONFIG = {widgetType: 'wm-navbar', hostClass: DEFAULT_CLS};

declare const $;

@Component({
    standalone: true,
    imports: [CommonModule, TextContentDirective, TrustAsPipe, SvgIconDirective, ImagePipe],
    selector: '[wmNavbar]',
    templateUrl: './navbar.component.html',
    providers: [
        provideAsWidgetRef(NavbarComponent)
    ]
})
export class NavbarComponent extends StylableComponent implements AfterViewInit, OnDestroy {
    static initializeProps = registerProps();

    public menuiconclass: any;
    public menuiconurl: string;
    public title: string;
    public imgsrc: string;

    // SVG branch is taken when no `menuiconclass` is set and `menuiconurl`
    // points to an `.svg` asset. Image branch is taken for any other
    // `menuiconurl` value. Otherwise the existing font-icon flow is used.
    public get useSvgMenuIcon(): boolean {
        return !this.menuiconclass && isSvgIconUrl(this.menuiconurl);
    }

    public get useImageMenuIcon(): boolean {
        return !this.menuiconclass && !!this.menuiconurl && !isSvgIconUrl(this.menuiconurl);
    }
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
