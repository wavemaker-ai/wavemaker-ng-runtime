import { Component, ViewChild } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { App } from '@wm/core';
import { compileTestComponent, mockApp } from 'projects/components/base/src/test/util/component-test-util';
import { FooterDirective } from './footer.directive';

@Component({ standalone: false, template: `<div wmFooter name="w1"><span class="projected">x</span></div>` })
class HostComponent {
    @ViewChild(FooterDirective, { static: true }) wmComponent: FooterDirective;
}

describe('FooterDirective', () => {
    let fixture: any;
    let widget: any;

    beforeEach(() => {
        fixture = compileTestComponent({
            imports: [FooterDirective],
            declarations: [HostComponent],
            providers: [{ provide: App, useValue: mockApp }]
        }, HostComponent);
        fixture.detectChanges();
        widget = fixture.componentInstance.wmComponent;
    });

    afterEach(() => TestBed.resetTestingModule());

    it('creates the wm-footer widget and keeps its projected content', () => {
        expect(widget.widgetType).toBe('wm-footer');
        expect(widget.nativeElement.querySelector('.projected')).not.toBeNull();
    });

});
