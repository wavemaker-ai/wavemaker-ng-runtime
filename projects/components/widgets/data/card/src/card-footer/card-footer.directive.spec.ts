import { Component, ViewChild } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { App } from '@wm/core';
import { compileTestComponent, mockApp } from 'projects/components/base/src/test/util/component-test-util';
import { CardFooterDirective } from './card-footer.directive';

@Component({ standalone: false, template: `<div wmCardFooter name="w1"></div>` })
class HostComponent {
    @ViewChild(CardFooterDirective, { static: true }) wmComponent: CardFooterDirective;
}

describe('CardFooterDirective', () => {
    afterEach(() => TestBed.resetTestingModule());

    it('creates the widget on its host element', () => {
        const fixture = compileTestComponent({
            imports: [CardFooterDirective],
            declarations: [HostComponent],
            providers: [{ provide: App, useValue: mockApp }]
        }, HostComponent);
        fixture.detectChanges();
        const widget: any = fixture.componentInstance.wmComponent;
        expect(widget).toBeTruthy();
        expect(widget.nativeElement).toBeInstanceOf(HTMLElement);
    });
});
