import { Component, ViewChild } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { App } from '@wm/core';
import { compileTestComponent, mockApp } from 'projects/components/base/src/test/util/component-test-util';
import { HeaderComponent } from './header.component';

@Component({ standalone: false, template: `<div wmHeader name="w1"><span class="projected">x</span></div>` })
class HostComponent {
    @ViewChild(HeaderComponent, { static: true }) wmComponent: HeaderComponent;
}

describe('HeaderComponent', () => {
    let fixture: any;
    let widget: any;

    beforeEach(() => {
        fixture = compileTestComponent({
            imports: [HeaderComponent],
            declarations: [HostComponent],
            providers: [{ provide: App, useValue: mockApp }]
        }, HostComponent);
        fixture.detectChanges();
        widget = fixture.componentInstance.wmComponent;
    });

    afterEach(() => TestBed.resetTestingModule());

    it('creates the wm-header widget and keeps its projected content', () => {
        expect(widget.widgetType).toBe('wm-header');
        expect(widget.nativeElement.querySelector('.projected')).not.toBeNull();
    });

    it('renders the left navigation toggle and inline content container', () => {
        expect(widget.nativeElement.querySelector('.app-header-action')).not.toBeNull();
        expect(widget.nativeElement.querySelector('.app-header-container .projected')).not.toBeNull();
    });

    it('can hide inline content', () => {
        widget.isInlineContent = false;
        fixture.detectChanges();
        expect(widget.nativeElement.querySelector('.app-header-container .projected')).toBeNull();
    });
});
