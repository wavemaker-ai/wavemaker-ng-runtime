import { Component, ViewChild } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { App } from '@wm/core';
import { compileTestComponent, mockApp } from 'projects/components/base/src/test/util/component-test-util';
import { CarouselTemplateDirective } from './carousel-template.directive';

@Component({ standalone: false, template: `<div wmCarouselTemplate name="w1"><span class="projected">x</span></div>` })
class HostComponent {
    @ViewChild(CarouselTemplateDirective, { static: true }) wmComponent: CarouselTemplateDirective;
}

describe('CarouselTemplateDirective', () => {
    let fixture: any;
    let widget: any;

    beforeEach(() => {
        fixture = compileTestComponent({
            imports: [CarouselTemplateDirective],
            declarations: [HostComponent],
            providers: [{ provide: App, useValue: mockApp }]
        }, HostComponent);
        fixture.detectChanges();
        widget = fixture.componentInstance.wmComponent;
    });

    afterEach(() => TestBed.resetTestingModule());

    it('creates the wm-carousel-template widget and keeps its projected content', () => {
        expect(widget.widgetType).toBe('wm-carousel-template');
        expect(widget.nativeElement.querySelector('.projected')).not.toBeNull();
    });

});
