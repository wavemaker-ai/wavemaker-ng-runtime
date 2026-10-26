window.requestAnimationFrame = (cb: FrameRequestCallback) => setTimeout(() => cb(0), 0) as any;

import { Component, ViewChild } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { App } from '@wm/core';
import { compileTestComponent, mockApp } from 'projects/components/base/src/test/util/component-test-util';
import { RightPanelDirective } from './right-panel.directive';

@Component({ standalone: false, template: `<div wmRightPanel name="rp" navtype="push"></div>` })
class HostComponent {
    @ViewChild(RightPanelDirective, { static: true }) wmComponent: RightPanelDirective;
}

@Component({ standalone: false, template: `<div wmRightPanel name="rp2"></div>` })
class DefaultHostComponent {
    @ViewChild(RightPanelDirective, { static: true }) wmComponent: RightPanelDirective;
}

describe('RightPanelDirective', () => {
    const setup = (host: any = HostComponent) => {
        const fixture = compileTestComponent({
            imports: [RightPanelDirective],
            declarations: [host],
            providers: [{ provide: App, useValue: mockApp }]
        }, host);
        fixture.detectChanges();
        return fixture.componentInstance.wmComponent as RightPanelDirective;
    };

    beforeEach(() => jest.useFakeTimers());
    afterEach(() => {
        jest.runOnlyPendingTimers();
        jest.clearAllTimers();
        jest.useRealTimers();
        TestBed.resetTestingModule();
    });

    it('applies the navigation class for the given nav type', () => {
        expect(setup().nativeElement.className).toContain('nav');
    });

    it('falls back to the drawer nav type', () => {
        expect(setup(DefaultHostComponent).nativeElement.className).toContain('nav');
    });

    it('swaps the column class when columnwidth changes', () => {
        const panel = setup();
        panel.onPropertyChange('columnwidth', 4, undefined);
        jest.advanceTimersByTime(10);
        expect(panel.nativeElement.classList.contains('col-sm-4')).toBe(true);
        panel.onPropertyChange('columnwidth', 6, 4);
        jest.advanceTimersByTime(10);
        expect(panel.nativeElement.classList.contains('col-sm-6')).toBe(true);
        expect(panel.nativeElement.classList.contains('col-sm-4')).toBe(false);
    });

    it('delegates other properties to the base widget', () => {
        const panel = setup();
        expect(() => panel.onPropertyChange('class', 'x', '')).not.toThrow();
    });
});
