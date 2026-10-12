import { Component, ViewChild } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { App } from '@wm/core';
import { compileTestComponent, mockApp } from 'projects/components/base/src/test/util/component-test-util';
import { TopNavDirective } from './top-nav.directive';

@Component({ standalone: false, template: `<div wmTopNav name="w1"><span class="projected">x</span></div>` })
class HostComponent {
    @ViewChild(TopNavDirective, { static: true }) wmComponent: TopNavDirective;
}

describe('TopNavDirective', () => {
    let fixture: any;
    let widget: any;

    beforeEach(() => {
        fixture = compileTestComponent({
            imports: [TopNavDirective],
            declarations: [HostComponent],
            providers: [{ provide: App, useValue: mockApp }]
        }, HostComponent);
        fixture.detectChanges();
        widget = fixture.componentInstance.wmComponent;
    });

    afterEach(() => TestBed.resetTestingModule());

    it('creates the wm-top-nav widget and keeps its projected content', () => {
        expect(widget.widgetType).toBe('wm-top-nav');
        expect(widget.nativeElement.querySelector('.projected')).not.toBeNull();
    });

});
