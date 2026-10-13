import { TestBed } from '@angular/core/testing';
import { Subject } from 'rxjs';

const mockInvokeWatchers = jest.fn();
const mockWatch = jest.fn();
const mockIsIE = jest.fn(() => false);

jest.mock('@wm/core', () => ({
    ...jest.requireActual('@wm/core'),
    $invokeWatchers: (...a) => mockInvokeWatchers(...a),
    $watch: (...a) => mockWatch(...a),
    isIE: () => mockIsIE()
}));
jest.mock('@wm/components/base', () => ({ WidgetRef: class WidgetRef {} }));
jest.mock('@wm/components/page', () => ({
    PageDirective: class PageDirective {},
    SpaPageDirective: class SpaPageDirective {}
}));
jest.mock('@wm/components/prefab', () => ({ PrefabDirective: class PrefabDirective {} }));
jest.mock('@wm/components/input/checkboxset', () => ({
    CheckboxsetComponent: class CheckboxsetComponent {
        datasetItems: any[] = [];
        triggerInvokeOnChange = jest.fn();
        initDatasetItems = jest.fn();
        constructor(public inj, public x) {}
    }
}));
jest.mock('@wm/components/input/radioset', () => ({
    RadiosetComponent: class RadiosetComponent {
        triggerInvokeOnChange = jest.fn();
        initDatasetItems = jest.fn();
        constructor(public inj, public x) {}
    }
}));

import {
    AbstractI18nService,
    App,
    ScriptLoaderService,
    UtilsService,
    Viewport
} from '@wm/core';
import { WidgetRef } from '@wm/components/base';
import { PageDirective, SpaPageDirective } from '@wm/components/page';
import { VariablesService } from '@wm/variables';
import { CustomwidgetConfigProvider } from '../types/types';
import { commonPartialWidgets } from './base-partial.component';
import { BaseCustomWidgetComponent } from './base-custom-widget.component';

class TestWidget extends BaseCustomWidgetComponent {
    customWidgetName = 'CW';
    evalUserScript = jest.fn();
    getVariables = jest.fn(() => ({ vars: 1 }));
}

describe('BaseCustomWidgetComponent', () => {
    let widget: any;
    let deps: Map<any, any>;
    let app: any, container: any, viewParent: any, i18n: any, variablesService: any, cfgProvider: any;
    let variableCollection: any, pageDirective: any;
    const injector = { get: jest.fn((t, fallback?) => (deps.has(t) ? deps.get(t) : fallback)) };
    const wait = (ms = 5) => new Promise(r => setTimeout(r, ms));

    beforeEach(() => {
        jest.clearAllMocks();
        mockIsIE.mockReturnValue(false);
        Object.keys(commonPartialWidgets).forEach(k => delete commonPartialWidgets[k]);

        app = { Variables: { av: {} }, Actions: { aa: {} }, activePageName: 'Pg' };
        viewParent = { registerFragment: jest.fn(), resolveFragment: jest.fn() };
        container = {
            viewParent,
            widget: {},
            props: { p: 1 },
            eventHandlers: new Map<string, any>([['onTap', () => {}], ['onDone', () => {}]]),
            onErroSubject: new Subject(),
            setProps: jest.fn((cfg, resolve) => resolve()),
            createProxy: jest.fn(() => 'proxy'),
            invokeEventCallback: jest.fn(),
            registerPropertyChangeListener: jest.fn(),
            registerStyleChangeListener: jest.fn(),
            nativeElement: document.createElement('div'),
            $attrs: new Map(),
            inj: { i: 1 }
        };
        i18n = { getAppLocale: jest.fn(() => ({ L: 1 })) };
        variableCollection = { Variables: { pv: { n: 1 } }, Actions: { pa: { n: 2 } }, callback: jest.fn(() => Promise.resolve()) };
        variablesService = { register: jest.fn(() => variableCollection) };
        cfgProvider = { getConfig: jest.fn(() => Promise.resolve(null)) };
        const handlers: Record<string, Function> = {};
        pageDirective = { handlers, subscribe: jest.fn((evt, fn) => { handlers[evt] = fn; return jest.fn(); }) };

        deps = new Map<any, any>([
            [App, app],
            [WidgetRef, container],
            [AbstractI18nService, i18n],
            [ScriptLoaderService, { s: 1 }],
            [Viewport, { v: 1 }],
            [CustomwidgetConfigProvider, cfgProvider],
            [UtilsService, { u: 1 }],
            [VariablesService, variablesService],
            [PageDirective, pageDirective],
            [SpaPageDirective, pageDirective]
        ]);

        widget = new TestWidget();
        widget.injector = injector;
    });

    afterEach(() => jest.restoreAllMocks());

    describe('init', () => {
        it('wires dependencies via the injector', async () => {
            widget.init();
            expect(widget.App).toBe(app);
            expect(widget.containerWidget).toBe(container);
            expect(widget.customwidgetConfigProvider).toBe(cfgProvider);
            expect(viewParent.registerFragment).toHaveBeenCalled();
            expect(widget.evalUserScript).toHaveBeenCalledWith(widget, app, { u: 1 });
            expect(widget.activePageName).toBe('Pg');
            expect(widget.props).toEqual({ p: 1 });
            expect(widget.appLocale).toEqual({ L: 1 });
            expect(container.Variables).toBe(widget.Variables);
            expect(widget.Variables.pv).toEqual({ n: 1 });
            expect(widget.Variables.av).toEqual({});
            expect(widget.Actions.pa).toEqual({ n: 2 });
            expect(app.Widgets).toBeDefined();
            expect(widget.getContainerWidgetInjector()).toEqual({ i: 1 });
            expect(widget.registerExpressions()).toBeUndefined();

            // events are registered after props are registered in the container
            await wait();
            expect(Object.keys(widget.events)).toEqual(['onTap', 'onDone']);
            widget.events.onTap('e', 'd');
            expect(container.invokeEventCallback).toHaveBeenCalledWith('onTap', { $event: 'e', $data: 'd' });
            const spy = jest.spyOn(widget.events, 'onDone');
            widget.invokeEvent('onDone');
            expect(spy).toHaveBeenCalled();
        });

        it('getContainerWidgetInjector falls back to injector', () => {
            widget.containerWidget = { injector: 'inj2' };
            expect(widget.getContainerWidgetInjector()).toBe('inj2');
        });

        it('uses inject() when there is no injector', () => {
            TestBed.configureTestingModule({
                providers: Array.from(deps.entries()).map(([provide, useValue]) => ({ provide, useValue }))
            });
            const w: any = new TestWidget();
            TestBed.runInInjectionContext(() => w.init());
            expect(w.App).toBe(app);
            expect(w.pageDirective).toBe(pageDirective);
            expect(w.evalUserScript).toHaveBeenCalledWith(w, app, { u: 1 });
        });

        it('uses inject() for the SPA directive (optional when missing)', () => {
            deps.delete(SpaPageDirective);
            TestBed.configureTestingModule({
                providers: Array.from(deps.entries()).map(([provide, useValue]) => ({ provide, useValue }))
            });
            const w: any = new TestWidget();
            w.spa = true;
            TestBed.runInInjectionContext(() => w.init());
            expect(w.pageDirective).toBeNull();
        });

        it('picks SPA vs regular page directive and wires attach/detach', () => {
            widget.spa = true;
            widget.init();
            expect(injector.get).toHaveBeenCalledWith(SpaPageDirective, null);
            const attach = jest.spyOn(widget, 'ngOnAttach').mockImplementation(() => {});
            const detach = jest.spyOn(widget, 'ngOnDetach').mockImplementation(() => {});
            pageDirective.handlers['attach']({ refreshData: true });
            pageDirective.handlers['detach']();
            expect(attach).toHaveBeenCalledWith(true);
            expect(detach).toHaveBeenCalled();

            const w2: any = new TestWidget();
            w2.injector = injector;
            w2.init();
            expect(injector.get).toHaveBeenCalledWith(PageDirective, null);
        });

        it('works without a page directive and without fragment hooks on the view parent', () => {
            deps.delete(PageDirective);
            container.viewParent = {};
            widget.init();
            expect(widget.pageDirective).toBeNull();
            expect(() => widget.invokeOnReady()).not.toThrow();
        });

        it('onErroSubject calls onValidStatusChange only when defined', () => {
            widget.init();
            container.onErroSubject.next(undefined);
            widget.onValidStatusChange = jest.fn(() => 'v');
            container.onErroSubject.next(undefined);
            expect(widget.onValidStatusChange).toHaveBeenCalledTimes(1);
        });

        it('view init copies props from the container', () => {
            widget.init();
            container.props = { p: 2 };
            widget.viewInit$.complete();
            expect(widget.props).toEqual({ p: 2 });
        });
    });

    describe('initUserScript', () => {
        it('uses the view parent as Prefab when it is a prefab', () => {
            viewParent.prefabName = 'pf';
            widget.init();
            expect(widget.Prefab).toBe(viewParent);
        });

        it('inherits Prefab from a parent partial inside a prefab', () => {
            const pf = {};
            viewParent.prefabName = 'pf';
            viewParent.Prefab = pf;
            widget.init();
            expect(widget.Prefab).toBe(pf);
        });

        it('logs script errors', () => {
            const err = jest.spyOn(console, 'error').mockImplementation(() => {});
            widget.evalUserScript.mockImplementation(() => { throw new Error('x'); });
            expect(() => widget.init()).not.toThrow();
            expect(err).toHaveBeenCalled();
        });
    });

    describe('registerPropsInContainerWidget', () => {
        it('defines properties (plain and bound) from the config', async () => {
            const unwatch = jest.fn();
            mockWatch.mockReturnValue(unwatch);
            cfgProvider.getConfig.mockResolvedValue({
                properties: { plain: { value: 'x' }, bound: { value: ' bind:Variables.a.dataSet' } }
            });
            container.plain = 'P';
            widget.init();
            await wait();

            expect(widget.plain).toBe('P');
            widget.plain = 'Q';
            expect(container.widget.plain).toBe('Q');
            expect(mockWatch).toHaveBeenCalledWith('Variables.a.dataSet', widget, {}, expect.any(Function));
            mockWatch.mock.calls[0][3]('NV');
            expect(container.widget.bound).toBe('NV');
            widget.destroy$.complete();
            expect(unwatch).toHaveBeenCalled();
            expect(container.setProps).toHaveBeenCalledWith(expect.anything(), expect.any(Function));
        });

        it('copes with a config without properties', async () => {
            cfgProvider.getConfig.mockResolvedValue({});
            widget.init();
            await wait();
            expect(container.setProps).toHaveBeenCalled();
        });

        it('recreates the proxy on IE', async () => {
            mockIsIE.mockReturnValue(true);
            widget.init();
            await wait();
            expect(container.widget).toBe('proxy');
        });
    });

    describe('invokeOnReady', () => {
        beforeEach(() => widget.init());

        it('passes user component params and resolves the fragment', () => {
            container.userComponentParams = { u: 1 };
            const onReady = jest.spyOn(widget, 'onReady');
            widget.invokeOnReady();
            expect(onReady).toHaveBeenCalledWith({ u: 1 });
            expect(viewParent.resolveFragment).toHaveBeenCalled();
        });

        it('passes undefined without params; default hooks are no-ops', () => {
            const onReady = jest.spyOn(widget, 'onReady');
            widget.invokeOnReady();
            expect(onReady).toHaveBeenCalledWith(undefined);
            expect(widget.onPropertyChange()).toBeUndefined();
        });
    });

    describe('variables on view init', () => {
        it('triggers watchers and loads variables/actions', () => {
            widget.init();
            widget.viewInit$.complete();
            expect(mockInvokeWatchers).toHaveBeenCalledWith(true, true);
            expect(variableCollection.callback).toHaveBeenCalledWith(variableCollection.Variables);
            expect(variableCollection.callback).toHaveBeenCalledWith(variableCollection.Actions);
        });

        it('tolerates failing loads', async () => {
            variableCollection.callback.mockImplementationOnce(() => Promise.reject('x'));
            widget.init();
            widget.viewInit$.complete();
            await wait();
        });
    });

    describe('change listeners and datavalue', () => {
        it('registerChangeListeners registers both listeners', () => {
            widget.containerWidget = container;
            widget.registerChangeListeners();
            expect(container.registerPropertyChangeListener).toHaveBeenCalled();
            expect(container.registerStyleChangeListener).toHaveBeenCalled();
        });

        it('datavalue getter delegates to getDatavalue when present', () => {
            expect(widget.datavalue).toBeUndefined();
            widget.getDatavalue = jest.fn(() => 'dv');
            expect(widget.datavalue).toBe('dv');
        });
    });

    describe('registerBaseWidget / initializeComponentData', () => {
        const build = (html: string) => {
            container.nativeElement.innerHTML = html;
            widget.containerWidget = container;
            widget.injector = injector;
        };

        it('creates a checkboxset base widget, applies base- attrs and wires _select', () => {
            container.formControl = {};
            container.updateDataValue = jest.fn();
            container.$attrs = new Map([['base-datavalue', 'v'], ['base-caption', 'c'], ['other', 'o']]);
            build('<div><section wmcustomwidget as="wm-checkboxset"></section></div>');

            widget.registerBaseWidget();

            const cb = widget.wmCheckboxset;
            expect(cb).toBeDefined();
            expect(cb.datavalue).toBe('v');
            expect(cb.caption).toBe('c');
            expect(cb.other).toBeUndefined();
            expect(container.updateDataValue).toHaveBeenCalledWith('v');
            expect(cb.initDatasetItems).toHaveBeenCalled();
            expect(container.wmCheckboxset).toBe(cb);

            cb.datasetItems = [{ key: 'a', selected: false }, { key: 'b', selected: true }];
            cb._select({ key: 'a' }, 'ev');
            expect(cb.triggerInvokeOnChange).toHaveBeenLastCalledWith(['a', 'b'], 'ev');
            cb._select({ key: 'b' }, 'ev2');
            expect(cb.triggerInvokeOnChange).toHaveBeenLastCalledWith(['a'], 'ev2');
        });

        it('does not update data value without a form control', () => {
            container.updateDataValue = jest.fn();
            container.$attrs = new Map([['base-datavalue', 'v']]);
            build('<section wmcustomwidget as="wm-radioset"></section>');
            widget.registerBaseWidget();
            expect(container.updateDataValue).not.toHaveBeenCalled();
        });

        it('creates a radioset base widget with a _select that reports the key', () => {
            build('<section wmcustomwidget as="wm-radioset"></section>');
            widget.registerBaseWidget();
            const rs = widget.wmRadioset;
            rs._select({ key: 'k' }, 'ev');
            expect(rs.triggerInvokeOnChange).toHaveBeenCalledWith('k', 'ev');
            expect(container.wmRadioset).toBe(rs);
        });

        it('skips custom widgets without an "as" attribute and recurses into other elements', () => {
            build('<div><div><section wmcustomwidget></section></div></div>');
            expect(() => widget.registerBaseWidget()).not.toThrow();
            expect(widget.wmCheckboxset).toBeUndefined();
        });

        it('fails for unsupported base widget types', () => {
            build('<section wmcustomwidget as="wm-unknown"></section>');
            expect(() => widget.registerBaseWidget()).toThrow(TypeError);
        });
    });

    describe('ngAfterViewInit', () => {
        it('registers listeners, completes view init and invokes onReady after fragments load', () => {
            jest.useFakeTimers();
            widget.init();
            container.nativeElement = document.createElement('div');
            const ready = jest.spyOn(widget, 'invokeOnReady').mockImplementation(() => {});
            widget.ngAfterViewInit();
            expect(container.registerPropertyChangeListener).toHaveBeenCalled();
            jest.advanceTimersByTime(100);
            jest.useRealTimers();
            widget.fragmentsLoaded$.complete();
            expect(ready).toHaveBeenCalled();
        });
    });

    describe('mute / unmute / attach / detach', () => {
        beforeEach(() => {
            widget.init();
            widget.Widgets = { w: { mute: jest.fn(), unmute: jest.fn(), ngOnAttach: jest.fn(), ngOnDetach: jest.fn() }, n: null };
        });

        it('mute and unmute call handlers where present', () => {
            const v = { mute: jest.fn(), unmute: jest.fn() };
            widget.Variables = { v, x: null, y: {} };
            widget.Actions = { a: {} };
            widget.mute();
            widget.unmute();
            expect(widget.Widgets.w.mute).toHaveBeenCalled();
            expect(v.unmute).toHaveBeenCalled();
        });

        it('ngOnAttach refreshes startUpdate variables only when asked', () => {
            const invoke = jest.fn();
            widget.Variables = { v: { startUpdate: true, invoke }, skip: { startUpdate: false, invoke }, noInvoke: { startUpdate: true }, nul: null };
            widget.Actions = { a: { startUpdate: true, invoke } };
            widget.ngOnAttach(true);
            expect(invoke).toHaveBeenCalledTimes(2);
            expect(widget.Widgets.w.ngOnAttach).toHaveBeenCalled();
            invoke.mockClear();
            widget.ngOnAttach(false);
            expect(invoke).not.toHaveBeenCalled();
        });

        it('ngOnDetach mutes and notifies widgets', () => {
            widget.ngOnDetach();
            expect(widget.Widgets.w.mute).toHaveBeenCalled();
            expect(widget.Widgets.w.ngOnDetach).toHaveBeenCalled();
        });
    });

    describe('ngOnDestroy', () => {
        it('releases references', () => {
            widget.init();
            widget.ngOnDestroy();
            expect(widget.destroy$).toBeNull();
            expect(widget.viewInit$).toBeNull();
            expect(widget.fragmentsLoaded$).toBeNull();
            expect(widget.App).toBeNull();
            expect(widget.containerWidget).toBeNull();
            expect(widget.props).toBeNull();
            expect(widget.events).toBeNull();
        });

        it('is safe when subjects are already closed', () => {
            widget.init();
            widget.destroy$.unsubscribe();
            widget.viewInit$.unsubscribe();
            widget.fragmentsLoaded$.unsubscribe();
            expect(() => widget.ngOnDestroy()).not.toThrow();
        });
    });
});
