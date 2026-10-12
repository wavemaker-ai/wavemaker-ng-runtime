import { Component, ViewChild } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { App, Viewport, ViewportEvent } from '@wm/core';
import { compileTestComponent, mockApp } from 'projects/components/base/src/test/util/component-test-util';
import { CustomWidgetDirective } from './custom-widget.directive';

@Component({
    standalone: false,
    template: `
        <div customwidgetcontainer foo="1" title="Hello" empty="" name="skipMe" class="skipClass" click.event="go()" caption.bind="Variables.x">
            <section wmCustomWidget base="baseW">
                <div class="level1"><div name="baseW" id="base-el"></div></div>
                <div name="other"><div name="deeper"></div></div>
            </section>
        </div>`
})
class HostComponent {
    @ViewChild(CustomWidgetDirective, { static: true }) wmComponent: CustomWidgetDirective;
}

@Component({
    standalone: false,
    template: `<div wmWidgetContainer><section wmCustomWidget base="baseW"><div name="baseW"></div></section></div>`
})
class ContainerHostComponent {
    @ViewChild(CustomWidgetDirective, { static: true }) wmComponent: CustomWidgetDirective;
}

describe('CustomWidgetDirective', () => {
    let viewport: any;
    let handlers: Record<string, Function>;
    let unsubscribers: jest.Mock[];

    const setup = (host: any = HostComponent) => {
        const fixture: ComponentFixture<any> = compileTestComponent({
            imports: [CustomWidgetDirective],
            declarations: [host],
            providers: [
                { provide: App, useValue: mockApp },
                { provide: Viewport, useValue: viewport }
            ]
        }, host);
        const directive: any = fixture.componentInstance.wmComponent;
        return { fixture, directive };
    };

    beforeEach(() => {
        handlers = {};
        unsubscribers = [];
        viewport = {
            subscribe: jest.fn((evt: string, fn: Function) => {
                handlers[evt] = fn;
                const off = jest.fn();
                unsubscribers.push(off);
                return off;
            })
        };
    });

    afterEach(() => {
        jest.restoreAllMocks();
        TestBed.resetTestingModule();
    });

    it('subscribes to viewport resize and orientation events and forwards them as widget events', () => {
        const { directive } = setup();
        const spy = jest.spyOn(directive, 'invokeEventCallback').mockImplementation(() => {});
        handlers[ViewportEvent.RESIZE]({ w: 1 });
        handlers[ViewportEvent.ORIENTATION_CHANGE]({ o: 'x' });
        expect(spy).toHaveBeenCalledWith('resize', expect.objectContaining({ widget: directive, w: 1 }));
        expect(spy).toHaveBeenCalledWith('orientationchange', expect.objectContaining({ o: 'x' }));
    });

    it('passes inherited container attributes to the base widget (plain, event and bound attributes)', () => {
        const { fixture, directive } = setup();
        const processAttr = jest.spyOn(directive, 'processAttr').mockImplementation(() => {});
        const baseEl: any = fixture.nativeElement.querySelector('#base-el');
        baseEl.widget = {};
        directive.ngAfterContentInit();

        expect(baseEl.widget.foo).toBe('1');
        expect(baseEl.widget.title).toBe('Hello');
        expect(baseEl.widget.empty).toBeUndefined();
        expect(baseEl.widget.name).toBeUndefined();
        expect(baseEl.widget.class).toBeUndefined();
        expect(processAttr).toHaveBeenCalledWith('click.event', 'go()', { widget: baseEl.widget, nativeElement: baseEl });
        expect(processAttr).toHaveBeenCalledWith('caption.bind', 'Variables.x', { widget: baseEl.widget, nativeElement: baseEl });
    });

    it('finds a wmWidgetContainer ancestor as well', () => {
        const { fixture, directive } = setup(ContainerHostComponent);
        fixture.nativeElement.querySelector('[name="baseW"]').widget = {};
        expect(() => directive.ngAfterContentInit()).not.toThrow();
    });

    it('fires attach and detach events', () => {
        const { directive } = setup();
        const spy = jest.spyOn(directive, 'invokeEventCallback').mockImplementation(() => {});
        directive.ngOnAttach();
        directive.ngOnDetach();
        expect(spy).toHaveBeenCalledWith('attach', expect.objectContaining({ widget: directive }));
        expect(spy).toHaveBeenCalledWith('detach', expect.objectContaining({ widget: directive }));
    });

    it('fires the destroy event and releases the viewport subscriptions', () => {
        const { fixture, directive } = setup();
        const spy = jest.spyOn(directive, 'invokeEventCallback').mockImplementation(() => {});
        fixture.destroy();
        expect(spy).toHaveBeenCalledWith('destroy', expect.objectContaining({ widget: directive }));
        unsubscribers.forEach(off => expect(off).toHaveBeenCalled());
    });
});
