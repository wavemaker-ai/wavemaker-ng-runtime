const mockRegisterFn = jest.fn();

jest.mock('@wm/core', () => ({
    ...jest.requireActual('@wm/core'),
    registerFnByExpr: (...a) => mockRegisterFn(...a)
}));
jest.mock('@wm/components/page', () => ({ PageDirective: class PageDirective {} }));

import { App } from '@wm/core';
import { BaseLayoutComponent } from './base-layout.component';

class TestLayout extends BaseLayoutComponent {
    getExpressions = jest.fn((): any => ({ 'a+b': [() => 1, 'x'] }));
}

describe('BaseLayoutComponent', () => {
    let layout: any;
    let app: any;

    beforeEach(() => {
        jest.useFakeTimers();
        jest.clearAllMocks();
        app = {};
        layout = new TestLayout();
        layout.injector = { get: jest.fn(t => (t === App ? app : null)) };
        layout.layoutName = 'Main';
        layout.layoutPages = ['A', 'B'];
    });

    afterEach(() => {
        jest.clearAllTimers();
        jest.useRealTimers();
    });

    it('init publishes the active layout on the app and registers expressions', () => {
        layout.init();
        expect(layout.App).toBe(app);
        expect(app.activeLayoutName).toBe('Main');
        expect(app.layoutPages).toEqual(['A', 'B']);
        expect(mockRegisterFn).toHaveBeenCalledWith('a+b', expect.any(Function), 'x');
    });

    describe('router outlet override', () => {
        let outlet: any;
        beforeEach(() => {
            outlet = { attach: jest.fn(), detach: jest.fn(() => 'ref') };
            outlet.origAttach = outlet.attach;
            outlet.origDetach = outlet.detach;
            layout.routerOutlet = outlet;
        });

        it('patches attach/detach after a short delay', () => {
            layout.ngAfterViewInit();
            const original = outlet.attach;
            expect(original).toBe(outlet.origAttach);
            jest.advanceTimersByTime(10);
            expect(outlet.attach).not.toBe(outlet.origAttach);
        });

        it('attach calls the original and notifies the component; detach returns the original ref', () => {
            layout.ngAfterViewInit();
            jest.advanceTimersByTime(10);
            const instance = { ngOnAttach: jest.fn() };
            outlet.attach({ instance }, 'route');
            expect(outlet.origAttach).toHaveBeenCalledWith({ instance }, 'route');
            expect(instance.ngOnAttach).toHaveBeenCalled();
            expect(outlet.detach()).toBe('ref');
            expect(outlet.origDetach).toHaveBeenCalled();
        });
    });

    it('onActivate copies the page component onto the layout', () => {
        layout.onActivate({ pageValue: 42 });
        expect(layout.pageValue).toBe(42);
    });

    it('no-op hooks do nothing', () => {
        expect(layout.canReuse()).toBeUndefined();
        expect(layout.ngOnAttach()).toBeUndefined();
        expect(layout.ngOnDetach()).toBeUndefined();
    });

    it('ngOnDestroy releases references', () => {
        layout.routerOutlet = {};
        layout.pageDirective = {};
        layout.init();
        layout.ngOnDestroy();
        expect(layout.App).toBeNull();
        expect(layout.routerOutlet).toBeNull();
        expect(layout.pageDirective).toBeNull();
        expect(layout.layoutPages).toBeNull();
        expect(layout.layoutName).toBeNull();
    });
});
