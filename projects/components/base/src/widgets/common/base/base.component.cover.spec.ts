import { Component, Directive, Inject, Injector, Optional } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { App, setPipeProvider } from '@wm/core';
import * as core from '@wm/core';
import { mockApp } from '../../../test/util/component-test-util';
import { register as registerProps, PROP_STRING } from '../../framework/widget-props';
import { BaseComponent } from './base.component';

jest.mock('@wm/core', () => {
    const actual = jest.requireActual('@wm/core');
    return {
        ...actual,
        $watch: jest.fn(() => jest.fn()),
        $unwatch: jest.fn(),
        $invokeWatchers: jest.fn(),
        $parseEvent: jest.fn((...args: any[]) => actual.$parseEvent(...args)),
    };
});

['wm-cover-base', 'wm-custom-cover', 'wm-custom-cover-type', 'wm-form-field-input', 'wm-form-field-custom-widget', 'wm-audio'].forEach((type) => {
    registerProps(type, new Map<string, any>([['name', { ...PROP_STRING }], ['hint', { ...PROP_STRING }]]));
});

// per test configuration of the directive under test
const setup: { config: any; promise?: Promise<any>; formWidget?: any; widgetConfig?: any } = { config: {} };

@Directive({
    standalone: true,
    selector: '[wmCoverBase]',
})
class CoverBaseDirective extends BaseComponent {
    constructor(inj: Injector, @Inject('EXPLICIT_CONTEXT') @Optional() explicitContext: any) {
        super(inj, setup.config, explicitContext, setup.promise);
        if (setup.formWidget) {
            this['formWidget'] = setup.formWidget;
        }
        if (setup.widgetConfig) {
            this['config'] = setup.widgetConfig;
        }
    }
}

@Component({
    standalone: true,
    imports: [CoverBaseDirective],
    template: `<div wmCoverBase><audio></audio></div>`,
})
class CoverHostComponent { }

const flush = () => new Promise<void>((resolve) => requestAnimationFrame(() => setTimeout(resolve, 0)));

describe('BaseComponent - remaining branches', () => {
    let fixture: ComponentFixture<CoverHostComponent>;
    let base: any;

    const create = (providers: any[] = []) => {
        TestBed.configureTestingModule({
            imports: [CoverHostComponent],
            providers: [{ provide: App, useValue: { ...mockApp, appLocale: {} } }, ...providers],
        });
        setPipeProvider({ getPipeNameVsIsPureMap: () => new Map(), meta: () => undefined, getInstance: () => ({}) } as any);
        fixture = TestBed.createComponent(CoverHostComponent);
        fixture.detectChanges();
        base = fixture.debugElement.children[0].injector.get(CoverBaseDirective);
    };

    beforeEach(() => {
        setup.config = { widgetType: 'wm-cover-base' };
        setup.promise = undefined;
        setup.formWidget = undefined;
        setup.widgetConfig = undefined;
        (core.$parseEvent as jest.Mock).mockClear();
    });

    afterEach(() => {
        jest.restoreAllMocks();
        fixture?.destroy();
    });

    describe('construction', () => {
        it('merges an explicit context into the widget context', () => {
            create([{ provide: 'EXPLICIT_CONTEXT', useValue: { fromParent: 42 } }]);
            expect(base.context.fromParent).toBe(42);
        });

        it('leaves the widget unnamed when the markup has no name', () => {
            create();
            expect(base.widget.name).toBeUndefined();
            expect(base.nativeElement.hasAttribute('name')).toBe(false);
        });
    });

    describe('delayed initialisation', () => {
        it('waits for the init promise before the ready listeners run and calls the resolver', async () => {
            let release: (fn?: any) => void;
            setup.promise = new Promise((res) => { release = res; });
            create();
            const ready = jest.fn();
            base.registerReadyStateListener(ready);
            expect(ready).not.toHaveBeenCalled();
            expect(base.delayedInit).toBe(true);
            const resolver = jest.fn();
            release(resolver);
            await Promise.resolve();
            await Promise.resolve();
            expect(ready).toHaveBeenCalledTimes(1);
            expect(resolver).toHaveBeenCalledTimes(1);
        });

        it('resolves the sub type of custom widgets from their own configuration', async () => {
            setup.config = { widgetType: 'wm-custom-cover' };
            setup.widgetConfig = { widgetType: 'wm-custom-cover-type' };
            let release: (fn?: any) => void;
            setup.promise = new Promise((res) => { release = res; });
            create();
            release();
            await Promise.resolve();
            await Promise.resolve();
            expect(base.customWidgetSubType).toBe('wm-custom-cover-type');
        });

        it('derives the sub type of form field custom widgets from the form widget', async () => {
            setup.config = { widgetType: 'wm-form-field-custom-widget' };
            setup.formWidget = { config: { widgetType: 'wm-custom-my-input' } };
            let release: (fn?: any) => void;
            setup.promise = new Promise((res) => { release = res; });
            create();
            release();
            await Promise.resolve();
            await Promise.resolve();
            expect(base.customWidgetSubType).toBe('wm-form-field-input');
        });
    });

    describe('property changes', () => {
        it('removes classes without adding any', async () => {
            create();
            base.nativeElement.classList.add('x1', 'x2', 'keep');
            base.onPropertyChange('conditionalclass', { toAdd: [], toRemove: ['x1', 'x2'] });
            base.onPropertyChange('conditionalclass', { toAdd: undefined, toRemove: undefined });
            await flush();
            expect(base.nativeElement.classList.contains('x1')).toBe(false);
            expect(base.nativeElement.classList.contains('x2')).toBe(false);
            expect(base.nativeElement.classList.contains('keep')).toBe(true);
        });

        it('applies conditional styles and clears the old ones', async () => {
            create();
            base.onPropertyChange('conditionalstyle', { color: 'red' }, undefined);
            await flush();
            expect(base.nativeElement.style.color).toBe('red');
            base.onPropertyChange('conditionalstyle', null, { color: 'red' });
            await flush();
            expect(base.nativeElement.style.color).toBe('');
            // non object values on either side are ignored
            base.onPropertyChange('conditionalstyle', 'red', 'blue');
            await flush();
            expect(base.nativeElement.style.color).toBe('');
        });

        it('reloads the audio element when autoplay changes for audio widgets', () => {
            setup.config = { widgetType: 'wm-audio' };
            create();
            const load = jest.spyOn(HTMLMediaElement.prototype, 'load').mockImplementation(() => undefined);
            base.onPropertyChange('autoplay', true);
            expect(load).toHaveBeenCalledTimes(1);
        });
    });

    describe('lifecycle listeners', () => {
        it('ignores destroy notifications that are not completions and non function listeners', () => {
            create();
            const fn = jest.fn();
            base.registerDestroyListener(fn);
            base.registerDestroyListener('not a function');
            base.destroy.next(1);
            expect(fn).not.toHaveBeenCalled();
            base.destroy.complete();
            expect(fn).toHaveBeenCalledTimes(1);
        });

        it('swallows destroy errors', () => {
            create();
            const fn = jest.fn();
            base.registerDestroyListener(fn);
            expect(() => base.destroy.error(new Error('x'))).not.toThrow();
            expect(fn).not.toHaveBeenCalled();
        });
    });

    describe('event callbacks', () => {
        const child = (widget: any = {}) => ({
            widget: { viewParent: { viewParent: {} }, context: {}, widgetProps: new Map(), ...widget },
            nativeElement: document.createElement('div'),
        });

        const run = (c: any, impl: () => any) => {
            (core.$parseEvent as jest.Mock).mockReturnValueOnce(impl);
            base.viewParent = { viewParent: {} };
            base.processEventAttr('click', 'x()', undefined, c);
            return c.widget.eventHandlers.get('click').callback();
        };

        it('reports synchronous errors thrown as plain values for anonymous widgets', () => {
            create();
            const error = jest.spyOn(console, 'error').mockImplementation(() => undefined);
            expect(run(child(), () => { throw 'plain failure'; })).toBeUndefined();
            expect(error).toHaveBeenCalledWith('Error executing event callback "click" on widget "unknown":', 'plain failure');
        });

        it('names the widget by its id when it has no name', () => {
            create();
            const error = jest.spyOn(console, 'error').mockImplementation(() => undefined);
            run(child({ widgetId: 'w-7' }), () => { throw new Error('boom'); });
            expect(error).toHaveBeenCalledWith('Error executing event callback "click" on widget "w-7":', 'boom');
        });

        it('reports rejected promises for anonymous widgets and for widgets with an id', async () => {
            create();
            const error = jest.spyOn(console, 'error').mockImplementation(() => undefined);
            await expect(run(child(), () => Promise.reject('nope'))).resolves.toBe('nope');
            expect(error).toHaveBeenCalledWith('Error in promise returned by event callback "click" on widget "unknown":', 'nope');
            await run(child({ widgetId: 'w-9' }), () => Promise.reject('nope2'));
            expect(error).toHaveBeenCalledWith('Error in promise returned by event callback "click" on widget "w-9":', 'nope2');
        });

        it('invokes handlers without locals and ignores handlers without a callback', () => {
            create();
            const spy = jest.fn().mockReturnValue('done');
            base.eventHandlers.set('plain', { callback: spy, locals: undefined });
            expect(base.invokeEventCallback('plain', { a: 1 })).toBe('done');
            expect(spy).toHaveBeenCalledWith({ a: 1 });
            base.eventHandlers.set('empty', { callback: undefined, locals: {} });
            expect(base.invokeEventCallback('empty')).toBeUndefined();
        });

        it('logs errors escaping the callback, also when they are not Error objects', () => {
            create();
            const error = jest.spyOn(console, 'error').mockImplementation(() => undefined);
            base.eventHandlers.set('bad', { callback: () => { throw null; }, locals: {} });
            base.widgetId = undefined;
            expect(base.invokeEventCallback('bad')).toBeUndefined();
            expect(error).toHaveBeenCalledWith('Error executing event callback "bad" on widget "unknown":', 'null');
            base.widgetId = 'wid';
            base.eventHandlers.set('bad2', { callback: () => { throw new Error('real'); }, locals: {} });
            base.invokeEventCallback('bad2');
            expect(error).toHaveBeenCalledWith('Error executing event callback "bad2" on widget "wid":', 'real');
        });
    });

    describe('bound attributes of children', () => {
        it('watches the expression in the scope of the child widget', () => {
            create();
            const widget: any = { viewParent: { viewParent: { vp: 1 } }, context: { c: 1 }, isMuted: true, widgetProps: new Map(), widgetId: 'child-1' };
            (core.$watch as jest.Mock).mockClear();
            base.processBindAttr('caption', 'Widgets.x.value', { widget, nativeElement: document.createElement('div') });
            const args = (core.$watch as jest.Mock).mock.calls[0];
            expect(args[0]).toBe('Widgets.x.value');
            expect(args[1]).toBe(widget.viewParent.viewParent);
            expect(args[2]).toBe(widget.context);
            expect(args[4]).toBe('child-1_caption');
            expect(args[7]()).toBe(true);
            args[3]('value');
            expect(widget.caption).toBe('value');
        });
    });

    describe('focus', () => {
        it('does nothing without a rendered element', () => {
            create();
            Object.defineProperty(base, 'nativeElement', { value: null, configurable: true });
            expect(() => base.focus()).not.toThrow();
        });
    });
});
