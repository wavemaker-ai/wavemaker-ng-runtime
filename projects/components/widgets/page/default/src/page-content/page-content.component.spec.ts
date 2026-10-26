window.requestAnimationFrame = (cb: FrameRequestCallback) => setTimeout(() => cb(0), 0) as any;

import { Component, ViewChild } from '@angular/core';
import { TestBed } from '@angular/core/testing';

const mockPullToRefresh = jest.fn();
jest.mock('@wm/components/base', () => ({
    ...jest.requireActual('@wm/components/base'),
    PullToRefresh: function (...args: any[]) { return mockPullToRefresh(...args); }
}));

import { App } from '@wm/core';
import { compileTestComponent, mockApp } from 'projects/components/base/src/test/util/component-test-util';
import { PageContentComponent } from './page-content.component';

@Component({ standalone: false, template: `<div wmPageContent name="pc"></div>` })
class HostComponent {
    @ViewChild(PageContentComponent, { static: true }) wmComponent: PageContentComponent;
}

describe('PageContentComponent', () => {
    let app: any;
    let handlers: Record<string, Function>;
    let content: any;
    let fixture: any;
    let ptrInstance: any;

    beforeEach(() => {
        jest.useFakeTimers();
        mockPullToRefresh.mockReset();
        ptrInstance = { destroy: jest.fn() };
        mockPullToRefresh.mockImplementation(() => ptrInstance);
        handlers = {};
        app = { ...mockApp, notify: jest.fn(), subscribe: jest.fn((evt: string, fn: Function) => { handlers[evt] = fn; return jest.fn(); }) };
        fixture = compileTestComponent({
            imports: [PageContentComponent],
            declarations: [HostComponent],
            providers: [{ provide: App, useValue: app }]
        }, HostComponent);
        fixture.detectChanges();
        content = fixture.componentInstance.wmComponent;
    });

    afterEach(() => {
        jest.runOnlyPendingTimers();
        jest.clearAllTimers();
        jest.useRealTimers();
        TestBed.resetTestingModule();
    });

    it('swaps the column classes for the columnwidth property', () => {
        content.onPropertyChange('columnwidth', 8, 4);
        jest.advanceTimersByTime(10);
        expect(content.nativeElement.classList.contains('col-md-8')).toBe(true);
        expect(content.nativeElement.classList.contains('col-sm-8')).toBe(true);
    });

    it('delegates other properties to the base widget', () => {
        expect(() => content.onPropertyChange('class', 'x', '')).not.toThrow();
    });

    describe('pull to refresh', () => {
        it('is created after a timeout when enabled and an event handler exists', () => {
            content.pulltorefresh = true;
            jest.spyOn(content, 'hasEventCallback').mockReturnValue(true);
            content.onPropertyChange('pulltorefresh', true, false);
            expect(mockPullToRefresh).not.toHaveBeenCalled();
            jest.advanceTimersByTime(5);
            expect(mockPullToRefresh).toHaveBeenCalledTimes(1);

            const spy = jest.spyOn(content, 'invokeEventCallback').mockImplementation(() => {});
            mockPullToRefresh.mock.calls[0][2]();
            expect(spy).toHaveBeenCalledWith('pulltorefresh');
        });

        it('notifies the app when there is no event handler but a child list requested it', () => {
            content.pulltorefresh = true;
            jest.spyOn(content, 'hasEventCallback').mockReturnValue(false);
            handlers['pullToRefresh:enable']();
            expect(mockPullToRefresh).toHaveBeenCalledTimes(1);
            mockPullToRefresh.mock.calls[0][2]();
            expect(app.notify).toHaveBeenCalledWith('pulltorefresh');
        });

        it('is not created without a trigger, when disabled, or twice', () => {
            content.pulltorefresh = true;
            jest.spyOn(content, 'hasEventCallback').mockReturnValue(false);
            content.onPropertyChange('pulltorefresh', true, false);
            jest.advanceTimersByTime(5);
            expect(mockPullToRefresh).not.toHaveBeenCalled();

            content.pulltorefresh = false;
            handlers['pullToRefresh:enable']();
            expect(mockPullToRefresh).not.toHaveBeenCalled();

            content.pulltorefresh = true;
            handlers['pullToRefresh:enable']();
            handlers['pullToRefresh:enable']();
            expect(mockPullToRefresh).toHaveBeenCalledTimes(1);
        });

        it('does nothing when the property is switched off', () => {
            content.onPropertyChange('pulltorefresh', false, true);
            jest.advanceTimersByTime(5);
            expect(mockPullToRefresh).not.toHaveBeenCalled();
        });

        it('destroys the instance through the destroy listener and on component destroy', () => {
            content.pulltorefresh = true;
            handlers['pullToRefresh:enable']();
            fixture.destroy();
            expect(ptrInstance.destroy).toHaveBeenCalled();
            expect(content.pullToRefreshIns).toBeNull();
        });

        it('tolerates instances without a destroy method', () => {
            content.pullToRefreshIns = {};
            expect(() => content.ngOnDestroy()).not.toThrow();
        });
    });
});
