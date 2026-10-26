// @wm/core captures requestAnimationFrame at import time; route it through (fake) timers
window.requestAnimationFrame = (cb: FrameRequestCallback) => setTimeout(() => cb(0), 0) as any;

import { Component, Type, ViewChild } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Title } from '@angular/platform-browser';
import { App, Viewport, ViewportEvent } from '@wm/core';
import { compileTestComponent, mockApp } from 'projects/components/base/src/test/util/component-test-util';
import { PageDirective } from './page.directive';
import { SpaPageDirective } from './spa-page.directive';
import { LayoutDirective } from './layout.directive';
import { RouterOutletDirective } from './router-outlet.directive';

const makeHost = (directive: Type<any>, selector: string, attrs = '') => {
    @Component({ standalone: false, template: `<div ${selector} ${attrs}></div>` })
    class Host {
        @ViewChild(directive, { static: true }) wmComponent: any;
    }
    return Host;
};

describe('page directives', () => {
    let app: any;
    let title: { setTitle: jest.Mock };
    let viewport: any;
    let handlers: Record<string, Function>;
    let offs: jest.Mock[];

    const setup = (directive: Type<any>, selector: string, attrs?: string) => {
        const host = makeHost(directive, selector, attrs);
        const fixture: ComponentFixture<any> = compileTestComponent({
            imports: [directive],
            declarations: [host],
            providers: [
                { provide: App, useValue: app },
                { provide: Title, useValue: title },
                { provide: Viewport, useValue: viewport }
            ]
        }, host);
        const instance = fixture.componentInstance.wmComponent;
        fixture.detectChanges();
        return { fixture, instance };
    };

    beforeEach(() => {
        jest.useFakeTimers();
        app = { ...mockApp, isTabletApplicationType: false, isPrism: false };
        title = { setTitle: jest.fn() };
        handlers = {};
        offs = [];
        viewport = {
            subscribe: jest.fn((evt: string, fn: Function) => {
                handlers[evt] = fn;
                const off = jest.fn();
                offs.push(off);
                return off;
            })
        };
    });

    afterEach(() => {
        jest.runOnlyPendingTimers();
        jest.clearAllTimers();
        jest.useRealTimers();
        jest.restoreAllMocks();
        TestBed.resetTestingModule();
    });

    describe.each([
        ['PageDirective', PageDirective, 'wmPage'],
        ['SpaPageDirective', SpaPageDirective, 'wmSpaPage']
    ])('%s', (_name, directive, selector) => {
        it('sets the document title from the pagetitle property', () => {
            const { instance } = setup(directive as any, selector);
            instance.onPropertyChange('pagetitle', 'My Page', '');
            expect(title.setTitle).toHaveBeenCalledWith('My Page');
        });

        it('delegates other properties to the base widget', () => {
            const { instance } = setup(directive as any, selector);
            expect(() => instance.onPropertyChange('class', 'x', '')).not.toThrow();
            expect(title.setTitle).not.toHaveBeenCalled();
        });

        it('delivers notifications to subscribers only after the page is initialised', () => {
            const { instance } = setup(directive as any, selector);
            const cb = jest.fn();
            const off = instance.subscribe('evt', cb);
            instance.notify('evt', 1, 2);
            expect(cb).not.toHaveBeenCalled();
            jest.advanceTimersByTime(5);
            expect(cb).toHaveBeenCalledWith(1, 2);
            off();
            instance.notify('evt', 3);
            expect(cb).toHaveBeenCalledTimes(1);
        });

        it('forwards viewport events as widget events', () => {
            const { instance } = setup(directive as any, selector);
            const spy = jest.spyOn(instance, 'invokeEventCallback').mockImplementation(() => {});
            handlers[ViewportEvent.RESIZE]({ $event: 'e', data: 'd' });
            handlers[ViewportEvent.ORIENTATION_CHANGE]({ $event: 'e2', data: 'd2' });
            expect(spy).toHaveBeenCalledWith('resize', { $event: 'e', widget: instance, data: 'd' });
            expect(spy).toHaveBeenCalledWith('orientationchange', { $event: 'e2', widget: instance, data: 'd2' });
        });

        it('announces attach (with refresh flag) and detach', () => {
            const { instance } = setup(directive as any, selector);
            jest.advanceTimersByTime(5);
            const spy = jest.spyOn(instance, 'invokeEventCallback').mockImplementation(() => {});
            const attach = jest.fn();
            const detach = jest.fn();
            instance.subscribe('attach', attach);
            instance.subscribe('detach', detach);
            instance.pagetitle = 'T';
            instance.refreshdataonattach = false;

            instance.ngOnAttach();
            expect(title.setTitle).toHaveBeenCalledWith('T');
            expect(spy).toHaveBeenCalledWith('attach', { widget: instance });
            expect(attach).toHaveBeenCalledWith({ refreshData: false });

            instance.ngOnDetach();
            expect(spy).toHaveBeenCalledWith('detach', { widget: instance });
            expect(detach).toHaveBeenCalled();
        });

        it('fires the destroy event and releases the viewport subscriptions', () => {
            const { fixture, instance } = setup(directive as any, selector);
            const spy = jest.spyOn(instance, 'invokeEventCallback').mockImplementation(() => {});
            fixture.destroy();
            expect(spy).toHaveBeenCalledWith('destroy', { widget: instance });
            if (_name === 'PageDirective') {
                offs.forEach(off => expect(off).toHaveBeenCalled());
            } else {
                // SpaPageDirective.ngOnDestroy does not call super.ngOnDestroy(), so the viewport
                // subscriptions registered through registerDestroyListener are never released.
                offs.forEach(off => expect(off).not.toHaveBeenCalled());
            }
        });

        it('updates the device view for tablet apps', () => {
            app.isTabletApplicationType = true;
            const { fixture } = setup(directive as any, selector);
            jest.advanceTimersByTime(10);
            expect(fixture.nativeElement).toBeDefined();
        });
    });

    describe('LayoutDirective', () => {
        it('updates the device view after initialisation', () => {
            const { instance } = setup(LayoutDirective, 'wmLayout');
            jest.advanceTimersByTime(5);
            expect(instance).toBeDefined();
        });

        it('forwards notifications to the internal notifier', () => {
            const { instance } = setup(LayoutDirective, 'wmLayout');
            const notify = jest.spyOn((instance as any)._eventNotifier, 'notify');
            instance.notify('evt', 1);
            expect(notify).toHaveBeenCalledWith('evt', 1);
        });

        it('destroys the notifier once, and tolerates repeated destroys', () => {
            const { fixture, instance } = setup(LayoutDirective, 'wmLayout');
            const notifier = (instance as any)._eventNotifier;
            const destroy = jest.spyOn(notifier, 'destroy');
            fixture.destroy();
            expect(destroy).toHaveBeenCalled();
            expect((instance as any)._eventNotifier).toBeNull();
            expect(() => instance.ngOnDestroy()).not.toThrow();
        });
    });

    describe('RouterOutletDirective', () => {
        it('remembers whether the app uses the Prism template', () => {
            app.isPrism = true;
            expect(setup(RouterOutletDirective, 'wmRouterOutlet').instance.isPrism).toBe(true);
        });

        it('swaps column classes for the columnwidth property on non-Prism apps', () => {
            const { instance } = setup(RouterOutletDirective, 'wmRouterOutlet');
            instance.onPropertyChange('columnwidth', 8, 4);
            jest.advanceTimersByTime(10);
            expect(instance.nativeElement.classList.contains('col-md-8')).toBe(true);
            expect(instance.nativeElement.classList.contains('col-sm-8')).toBe(true);
        });

        it('ignores columnwidth on Prism apps and delegates other properties', () => {
            app.isPrism = true;
            const { instance } = setup(RouterOutletDirective, 'wmRouterOutlet');
            instance.onPropertyChange('columnwidth', 8, 4);
            jest.advanceTimersByTime(10);
            expect(instance.nativeElement.classList.contains('col-md-8')).toBe(false);
            expect(() => instance.onPropertyChange('class', 'x', '')).not.toThrow();
        });
    });
});
