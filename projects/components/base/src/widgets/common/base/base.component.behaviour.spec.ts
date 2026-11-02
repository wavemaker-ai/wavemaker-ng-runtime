import { Component, Directive, Injector, Optional, Inject, ViewChild } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { App, setPipeProvider } from '@wm/core';
import * as core from '@wm/core';
import { mockApp } from '../../../test/util/component-test-util';
import { register as registerProps, PROP_BOOLEAN, PROP_STRING } from '../../framework/widget-props';
import { BaseComponent } from './base.component';

jest.mock('@wm/core', () => ({
    ...jest.requireActual('@wm/core'),
    $watch: jest.fn(() => jest.fn()),
    $unwatch: jest.fn(),
    $invokeWatchers: jest.fn(),
}));

registerProps('wm-test-base', new Map<string, any>([
    ['name', { ...PROP_STRING }],
    ['show', { ...PROP_BOOLEAN, value: true }],
    ['hint', { ...PROP_STRING }],
    ['title', { ...PROP_STRING, value: 'dflt' }],
]));
registerProps('wm-custom-sample', new Map<string, any>([['extra', { ...PROP_STRING, value: 'e' }]]));

@Directive({
    standalone: true,
    selector: '[wmTestBase]',
})
class TestBaseDirective extends BaseComponent {
    changes: any[] = [];

    constructor(inj: Injector, @Inject('EXPLICIT_CONTEXT') @Optional() explicitContext: any) {
        super(inj, { widgetType: 'wm-test-base', hostClass: 'test-host' } as any, explicitContext);
    }

    expose() {
        return this as any;
    }
}

@Component({
    standalone: true,
    imports: [TestBaseDirective],
    template: `<div wmTestBase name="tb1" class="user-class" tabindex="3" hint="hello" show.bind="visible" click.event="onClick()"></div>`,
})
class HostComponent {
    @ViewChild(TestBaseDirective, { static: true }) widget: TestBaseDirective;
    visible = true;
    onClick = jest.fn();
}

const flush = () => new Promise<void>((resolve) => requestAnimationFrame(() => setTimeout(resolve, 0)));

describe('BaseComponent - behaviour', () => {
    let fixture: ComponentFixture<HostComponent>;
    let base: any;
    const watchMock = core.$watch as unknown as jest.Mock;

    beforeEach(() => {
        TestBed.configureTestingModule({
            imports: [HostComponent],
            providers: [{ provide: App, useValue: { ...mockApp, appLocale: { LABEL: 'x' } } }],
        });
        setPipeProvider({ getPipeNameVsIsPureMap: () => new Map(), meta: () => undefined, getInstance: () => ({}) } as any);
        fixture = TestBed.createComponent(HostComponent);
        base = fixture.componentInstance.widget;
        fixture.detectChanges();
        watchMock.mockClear();
    });

    afterEach(() => {
        jest.restoreAllMocks();
        fixture.destroy();
    });

    describe('construction', () => {
        it('exposes the identity of the widget', async () => {
            await flush();
            expect(base.getWidgetType()).toBe('wm-test-base');
            expect(base.getWidgetSubType()).toBe('wm-test-base');
            expect(base.getNativeElement()).toBe(base.nativeElement);
            expect(base.getWidget()).toBe(base.widget);
            expect(base.getDisplayType()).toBeDefined();
            expect(base.getViewParent()).toBe(base.viewParent);
            expect(base.widgetId).toMatch(/^widget-id/);
            expect(base.nativeElement.getAttribute('widget-id')).toBe(base.widgetId);
            expect(base.nativeElement.classList.contains('test-host')).toBe(true);
            expect(base.appLocale).toEqual({ LABEL: 'x' });
            expect(base.getAppInstance()).toBeDefined();
            expect(base.$element[0]).toBe(base.nativeElement);
        });

        it('applies the markup properties to the widget', async () => {
            await flush();
            expect(base.widget.name).toBe('tb1');
            expect(base.widget.hint).toBe('hello');
            expect(base.nativeElement.getAttribute('title')).toBe('hello');
            expect(base.getAttr('hint')).toBe('hello');
        });

        it('moves the user supplied class and tabindex to the component', async () => {
            await flush();
            expect(base.nativeElement.classList.contains('user-class')).toBe(false);
        });

        it('sets properties through the proxy', async () => {
            base.setProperty('hint', 'changed');
            await flush();
            expect(base.nativeElement.getAttribute('title')).toBe('changed');
            base.setWidgetProperty('hint', 'again');
            await flush();
            expect(base.nativeElement.getAttribute('title')).toBe('again');
        });
    });

    describe('property changes', () => {
        it('shows and hides the element', () => {
            base.onPropertyChange('show', false);
            expect(base.nativeElement.hidden).toBe(true);
            base.onPropertyChange('show', true);
            expect(base.nativeElement.hidden).toBe(false);
        });

        it('sets hint and aria label', async () => {
            base.onPropertyChange('hint', 'tip');
            base.onPropertyChange('arialabel', 'label');
            await flush();
            expect(base.nativeElement.getAttribute('title')).toBe('tip');
            expect(base.nativeElement.getAttribute('aria-label')).toBe('label');
        });

        it('switches classes and names', async () => {
            base.onPropertyChange('class', 'new', 'old');
            base.onPropertyChange('name', 'renamed', 'tb1');
            base.onPropertyChange('tabindex', 5);
            await flush();
            expect(base.nativeElement.classList.contains('new')).toBe(true);
            expect(base.nativeElement.getAttribute('tabindex')).toBe('5');
        });

        it('disables and enables the element', () => {
            base.onPropertyChange('disabled', true);
            expect(base.nativeElement.getAttribute('disabled')).toBe('true');
            base.onPropertyChange('disabled', false);
            expect(base.nativeElement.hasAttribute('disabled')).toBe(false);
        });

        it('applies conditional classes and styles', async () => {
            base.onPropertyChange('conditionalclass', { toAdd: ['a b'], toRemove: [] });
            base.onPropertyChange('conditionalstyle', { color: 'red' }, { background: 'blue' });
            base.onPropertyChange('conditionalstyle', undefined, { color: 'red' });
            base.onPropertyChange('animation', 'bounce');
            await new Promise<void>((resolve) => requestAnimationFrame(() => setTimeout(resolve, 0)));
            expect(base.nativeElement.classList.contains('a')).toBe(true);
            expect(base.nativeElement.classList.contains('animated')).toBe(true);
            expect(base.nativeElement.classList.contains('bounce')).toBe(true);
        });

        it('reloads the media element when autoplay changes', () => {
            const media = document.createElement('video');
            const load = jest.fn();
            (media as any).load = load;
            base.nativeElement.appendChild(media);
            base.widgetType = 'wm-video';
            base.onPropertyChange('autoplay', true);
            expect(load).toHaveBeenCalledTimes(1);
        });

        it('focuses the widget for autofocus', () => {
            const focus = jest.spyOn(base, 'focus').mockImplementation(() => undefined);
            base.onPropertyChange('autofocus', false);
            expect(focus).not.toHaveBeenCalled();
            base.onPropertyChange('autofocus', true);
            expect(focus).toHaveBeenCalledTimes(1);
        });

        it('notifies property and style listeners', () => {
            const propertyListener = jest.fn();
            const styleListener = jest.fn();
            base.registerPropertyChangeListener(propertyListener);
            base.registerStyleChangeListener(styleListener);
            base.notifyPropertyChange('hint', 'a', 'b');
            base.notifyStyleChange('color', 'red', 'blue');
            expect(propertyListener).toHaveBeenCalledWith('hint', 'a', 'b');
            expect(styleListener).toHaveBeenCalledWith('color', 'red', 'blue');
        });

        it('binds listeners to a context', () => {
            const ctx = { tag: 'ctx' };
            let seen: any;
            base.registerPropertyChangeListener(function (this: any) { seen = this; }, ctx);
            base.registerStyleChangeListener(function (this: any) { seen = this; }, ctx);
            base.notifyPropertyChange('a', 1, 0);
            expect(seen).toBe(ctx);
            seen = undefined;
            base.notifyStyleChange('b', 1, 0);
            expect(seen).toBe(ctx);
        });
    });

    describe('events', () => {
        it('invokes the event callbacks of the markup', () => {
            base.invokeEventCallback('click');
            expect(fixture.componentInstance.onClick).toHaveBeenCalled();
            expect(base.hasEventCallback('click')).toBe(true);
            expect(base.hasEventCallback('unknown')).toBe(false);
            expect(base.invokeEventCallback('unknown')).toBeUndefined();
        });

        it('maps event names', () => {
            expect(base.getMappedEventName('unknown-event')).toBe('unknown-event');
        });

        it('logs and swallows errors of event callbacks', () => {
            const error = jest.spyOn(console, 'error').mockImplementation(() => undefined);
            fixture.componentInstance.onClick.mockImplementation(() => { throw new Error('boom'); });
            expect(base.invokeEventCallback('click')).toBeUndefined();
            expect(error).toHaveBeenCalled();
        });

        it('returns the result of promise returning handlers and logs rejections', async () => {
            const error = jest.spyOn(console, 'error').mockImplementation(() => undefined);
            fixture.componentInstance.onClick.mockReturnValue(Promise.reject('failed'));
            const result = await base.invokeEventCallback('click');
            expect(result).toBe('failed');
            expect(error).toHaveBeenCalled();
            fixture.componentInstance.onClick.mockReturnValue(Promise.resolve('ok'));
            await expect(base.invokeEventCallback('click')).resolves.toBe('ok');
        });

        it('returns the handler result for synchronous handlers', () => {
            fixture.componentInstance.onClick.mockReturnValue('sync');
            expect(base.invokeEventCallback('click')).toBe('sync');
        });

        it('passes extra locals to the handler', () => {
            const spy = jest.fn();
            base.eventHandlers.set('custom', { callback: spy, locals: { a: 1 } });
            base.invokeEventCallback('custom', { b: 2 });
            expect(spy).toHaveBeenCalledWith({ a: 1, b: 2 });
        });

        it('adds listeners for events through the event manager, optionally delayed', () => {
            jest.useFakeTimers();
            const callbacks: Function[] = [];
            jest.spyOn(base.eventManager, 'addEventListener').mockImplementation((_node: any, _name: any, fn: any) => { callbacks.push(fn); return () => undefined; });
            const handler = jest.fn().mockReturnValue('r');
            const locals: any = {};
            base.handleEvent(base.nativeElement, 'click', handler, locals);
            base.handleEvent(base.nativeElement, 'click', handler, locals, 'delayed');
            expect(callbacks[0]({ type: 'click' })).toBe('r');
            expect(locals.$event).toEqual({ type: 'click' });
            callbacks[1]({ type: 'click' });
            expect(handler).toHaveBeenCalledTimes(1);
            jest.advanceTimersByTime(200);
            expect(handler).toHaveBeenCalledTimes(2);
            jest.useRealTimers();
        });

        it('builds handlers for children widgets', () => {
            const child: any = { widget: { name: 'child', widgetId: 'c1' }, nativeElement: document.createElement('div') };
            base.viewParent = { viewParent: { child: true } };
            base.processEventAttr('click', 'noop()', undefined, child);
            expect(child.widget.eventHandlers.has('click')).toBe(true);
            expect(typeof child.widget.onClick).toBe('function');
        });
    });

    describe('attributes', () => {
        it('processes bound attributes by registering watchers', () => {
            base.initState = new Map([['x', 1]]);
            base.processAttr('title.bind', 'a.b');
            expect(watchMock).toHaveBeenCalled();
            expect(base.initState.has('title')).toBe(false);
            expect(watchMock.mock.calls[0][0]).toBe('a.b');
            watchMock.mock.calls[0][3]('value');
            expect(base.widget.title).toBe('value');
        });

        it('hides widgets whose show property is bound', () => {
            base.initState = new Map();
            base.nativeElement.hidden = false;
            base.processAttr('show.bind', 'flag');
            expect(base.nativeElement.hidden).toBe(true);
        });

        it('keeps the widget visible for bound show properties of custom widgets', () => {
            base.initState = new Map();
            base.widgetSubType = 'wm-custom-x';
            base.nativeElement.hidden = false;
            base.processAttr('show.bind', 'flag');
            expect(base.nativeElement.hidden).toBe(false);
        });

        it('does not register events for widget containers', () => {
            base.nativeElement.setAttribute('wmwidgetcontainer', '');
            const process = jest.spyOn(base, 'processEventAttr').mockImplementation(() => undefined);
            base.processAttr('click.event', 'x()');
            expect(process).not.toHaveBeenCalled();
            base.nativeElement.removeAttribute('wmwidgetcontainer');
            base.processAttr('click.event', 'x()');
            expect(process).toHaveBeenCalledTimes(1);
        });

        it('stores plain attributes and strips class, name and tabindex from the element', async () => {
            base.initState = new Map();
            base.nativeElement.setAttribute('name', 'n');
            base.nativeElement.setAttribute('tabindex', '1');
            base.nativeElement.classList.add('strip');
            base.processAttr('hint', 'tip');
            base.processAttr('class', 'strip');
            base.processAttr('name', 'n');
            base.processAttr('tabindex', '1');
            await flush();
            expect(base.initState.get('hint')).toBe('tip');
            expect(base.nativeElement.classList.contains('strip')).toBe(false);
            expect(base.initState.get('name')).toBe('n');
        });

        it('ignores custom attribute forms', () => {
            base.initState = new Map();
            base.processAttr('a.b.c.d', 'x');
            expect(base.initState.size).toBe(0);
        });

        it('applies throttling to style like bound properties', () => {
            base.initState = new Map();
            base.processBindAttr('class', 'expr');
            expect(watchMock.mock.calls[0][6]).toEqual(expect.objectContaining({ throttle: 100 }));
        });

        it('updates data of base prefixed bound properties', () => {
            base.initState = new Map();
            const updates: any[] = [];
            base.widget.updateData = (...args: any[]) => updates.push(args);
            base.processBindAttr('base-prop', 'expr');
            watchMock.mock.calls[0][3]('nv');
            expect(updates).toEqual([['base-prop', 'nv']]);
        });

        it('watches the datasource without cloning and reports the muted state', () => {
            base.initState = new Map();
            base.processBindAttr('datasource', 'expr');
            expect(watchMock.mock.calls[0][5]).toBe(true);
            expect(watchMock.mock.calls[0][7]()).toBe(false);
        });

        it('removes the watcher of a property', () => {
            base.removePropertyBinding('title');
            expect(core.$unwatch).toHaveBeenCalledWith(`${base.widgetId}_title`);
        });

        it('reads the attributes using their original case', () => {
            base.inj = { ...base.inj, _tNode: { attrs: ['customAttr', 'x', 3, 'other', 'y'] }, get: base.inj.get.bind(base.inj) };
            base.nativeElement.setAttribute('customattr', 'x');
            const attrs = base.getAttributes();
            expect(attrs).toContain('customAttr');
        });

        it('sorts the attributes when the template node has none', () => {
            base.inj = { _tNode: { attrs: null }, get: base.inj.get.bind(base.inj) };
            base.nativeElement.setAttribute('b-attr', '1');
            base.nativeElement.setAttribute('a-attr', '1');
            const attrs = base.getAttributes();
            expect(attrs.indexOf('a-attr')).toBeLessThan(attrs.indexOf('b-attr'));
        });
    });

    describe('lifecycle', () => {
        it('notifies ready state listeners, also late ones', () => {
            const fn = jest.fn();
            base.registerReadyStateListener(fn);
            expect(fn).toHaveBeenCalledTimes(1);
            const bound = jest.fn();
            base.registerReadyStateListener(function (this: any) { bound(this); }, { ctx: true });
            expect(bound).toHaveBeenCalledWith({ ctx: true });
        });

        it('runs destroy listeners and survives errors in them', () => {
            const ok = jest.fn();
            base.registerDestroyListener(() => { throw new Error('cleanup'); });
            base.registerDestroyListener(ok);
            base.registerDestroyListener(undefined);
            base.registerDestroyListener(function (this: any) { ok(this); }, { ctx: 1 });
            base.ngOnDestroy();
            expect(ok).toHaveBeenCalledTimes(2);
            expect(base.isDestroyed).toBe(true);
        });

        it('mutes and unmutes', () => {
            base.mute();
            expect(base.isMuted).toBe(true);
            base.unmute();
            expect(base.isMuted).toBe(false);
        });

        it('tracks the attached state', () => {
            base.ngOnDetach();
            expect(base.isAttached).toBe(false);
            base.ngOnAttach();
            expect(base.isAttached).toBe(true);
            expect(() => base.ngAfterContentInit()).not.toThrow();
        });

        it('creates and caches custom injectors for explicit contexts', () => {
            const injector = base.createCustomInjector('key', { a: 1 });
            expect(injector.get('EXPLICIT_CONTEXT')).toEqual({ a: 1 });
            expect(base.createCustomInjector('key', { a: 2 })).toBe(injector);
        });

        it('focuses the focus target or the element itself', () => {
            const target = document.createElement('input');
            target.setAttribute('focus-target', '');
            document.body.appendChild(base.nativeElement);
            base.nativeElement.appendChild(target);
            const focusTarget = jest.spyOn(target, 'focus');
            base.focus();
            expect(focusTarget).toHaveBeenCalledTimes(1);
            target.remove();
            base.nativeElement.tabIndex = 0;
            const focusSelf = jest.spyOn(base.nativeElement, 'focus');
            base.focus();
            expect(focusSelf).toHaveBeenCalledTimes(1);
        });

        it('executes nothing by default', () => {
            expect(base.execute('op', {})).toBeUndefined();
        });
    });

    describe('delayed initialization', () => {
        it('waits for the init promise before initialising the widget', async () => {
            jest.spyOn(console, 'error').mockImplementation(() => undefined);
            let resolveInit: Function;
            const initPromise = new Promise<any>((resolve) => { resolveInit = resolve; });

            @Directive({ standalone: true, selector: '[wmDelayed]' })
            class DelayedDirective extends BaseComponent {
                constructor(inj: Injector) {
                    super(inj, { widgetType: 'wm-test-base' } as any, undefined, initPromise);
                }
            }

            @Component({ standalone: true, imports: [DelayedDirective], template: '<div wmDelayed name="late"></div>' })
            class DelayedHost {
                @ViewChild(DelayedDirective, { static: true }) widget: DelayedDirective;
            }

            const delayedFixture = TestBed.createComponent(DelayedHost);
            const delayed: any = delayedFixture.componentInstance.widget;
            delayedFixture.detectChanges();
            expect(delayed.initState).toBeUndefined();
            const done = jest.fn();
            resolveInit!(done);
            await initPromise;
            await Promise.resolve();
            expect(delayed.widgetProps).toBeDefined();
            expect(done).toHaveBeenCalled();
        });
    });

    describe('custom widgets', () => {
        it('merges the properties of the custom widget type', () => {
            base.customWidgetSubType = 'wm-custom-sample';
            base.initWidget();
            expect(base.initState.get('extra')).toBe('e');
            expect(base.initState.get('title')).toBe('dflt');
        });
    });
});
