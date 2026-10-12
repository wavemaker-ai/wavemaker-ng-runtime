import { Component, ViewChild } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { App } from '@wm/core';
import { compileTestComponent, mockApp } from 'projects/components/base/src/test/util/component-test-util';
import { LinearLayoutItemDirective } from './linear-layout-item.directive';

@Component({ standalone: false, template: `<div wmLinearLayoutItem name="w1"><span class="projected">x</span></div>` })
class HostComponent {
    @ViewChild(LinearLayoutItemDirective, { static: true }) wmComponent: LinearLayoutItemDirective;
}

describe('LinearLayoutItemDirective', () => {
    let fixture: any;
    let widget: any;

    beforeEach(() => {
        fixture = compileTestComponent({
            imports: [LinearLayoutItemDirective],
            declarations: [HostComponent],
            providers: [{ provide: App, useValue: mockApp }]
        }, HostComponent);
        fixture.detectChanges();
        widget = fixture.componentInstance.wmComponent;
    });

    afterEach(() => TestBed.resetTestingModule());

    it('creates the wm-linearlayoutitem widget and keeps its projected content', () => {
        expect(widget.widgetType).toBe('wm-linearlayoutitem');
        expect(widget.nativeElement.querySelector('.projected')).not.toBeNull();
    });

    it('applies flex-grow for the flexgrow property and delegates other properties', () => {
        widget.onPropertyChange('flexgrow', 2, 1);
        expect(widget.nativeElement.style.flexGrow).toBe('2');
        expect(() => widget.onPropertyChange('class', 'x', '')).not.toThrow();
    });
});
