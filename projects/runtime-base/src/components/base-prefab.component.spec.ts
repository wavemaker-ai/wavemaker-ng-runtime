const mockRegisterFn = jest.fn();
const mockInvokeWatchers = jest.fn();
const mockWatch = jest.fn();
const mockIsIE = jest.fn(() => false);

jest.mock('@wm/core', () => ({
    ...jest.requireActual('@wm/core'),
    registerFnByExpr: (...a) => mockRegisterFn(...a),
    $invokeWatchers: (...a) => mockInvokeWatchers(...a),
    $watch: (...a) => mockWatch(...a),
    isIE: () => mockIsIE()
}));
jest.mock('@wm/components/base', () => ({ WidgetRef: class WidgetRef {} }));
jest.mock('@wm/components/page', () => ({
    PageDirective: class PageDirective {},
    SpaPageDirective: class SpaPageDirective {}
}));
jest.mock('@wm/components/prefab', () => ({ PrefabContainerDirective: class PrefabContainerDirective {} }));
jest.mock('../services/prefab-manager.service', () => ({ PrefabManagerService: class PrefabManagerService {} }));

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
import { PrefabManagerService } from '../services/prefab-manager.service';
import { BasePrefabComponent } from './base-prefab.component';

class TestPrefab extends BasePrefabComponent {
    prefabName = 'Pf';
    evalUserScript = jest.fn();
    getVariables = jest.fn(() => ({ vars: 1 }));
    getExpressions = jest.fn((): any => ({ 'a+b': [() => 1, 'x'] }));
}

describe('BasePrefabComponent', () => {
    let prefab: any;
    let deps: Map<any, any>;
    let app: any, container: any, viewParent: any, i18n: any, scriptLoader: any, variablesService: any, mngr: any;
    let variableCollection: any, pageDirective: any;
    const injector = { get: jest.fn((t, fallback?) => (deps.has(t) ? deps.get(t) : fallback)) };
    const wait = (ms = 5) => new Promise(r => setTimeout(r, ms));

    beforeEach(() => {
        jest.clearAllMocks();
        mockIsIE.mockReturnValue(false);

        app = { Variables: {}, Actions: {} };
        viewParent = { registerFragment: jest.fn(), resolveFragment: jest.fn() };
        container = {
            viewParent,
            widget: {},
            registerPropertyChangeListener: jest.fn(),
            registerStyleChangeListener: jest.fn(),
            invokeEventCallback: jest.fn(),
            setProps: jest.fn(),
            createProxy: jest.fn(() => 'proxy'),
            inj: { i: 1 }
        };
        i18n = { getPrefabLocaleBundle: jest.fn(() => ({ B: 1 })) };
        scriptLoader = { load: jest.fn(() => Promise.resolve()) };
        variableCollection = { Variables: { pv: { n: 1 } }, Actions: { pa: { n: 2 } }, callback: jest.fn(() => Promise.resolve()) };
        variablesService = { register: jest.fn(() => variableCollection) };
        mngr = { getConfig: jest.fn(() => Promise.resolve(null)) };
        const handlers: Record<string, Function> = {};
        pageDirective = { handlers, subscribe: jest.fn((evt, fn) => { handlers[evt] = fn; return jest.fn(); }) };

        deps = new Map<any, any>([
            [App, app],
            [WidgetRef, container],
            [PrefabManagerService, mngr],
            [AbstractI18nService, i18n],
            [ScriptLoaderService, scriptLoader],
            [Viewport, { v: 1 }],
            [UtilsService, { u: 1 }],
            [VariablesService, variablesService],
            [PageDirective, pageDirective],
            [SpaPageDirective, pageDirective]
        ]);

        prefab = new TestPrefab();
        prefab.injector = injector;
    });

    afterEach(() => jest.restoreAllMocks());

    describe('init', () => {
        it('wires dependencies and registers everything', async () => {
            prefab.init();
            expect(prefab.App).toBe(app);
            expect(prefab.containerWidget).toBe(container);
            expect(prefab.prefabMngr).toBe(mngr);
            expect(viewParent.registerFragment).toHaveBeenCalled();
            expect(mockRegisterFn).toHaveBeenCalledWith('a+b', expect.any(Function), 'x');
            expect(prefab.evalUserScript).toHaveBeenCalledWith(prefab, app, { u: 1 });
            expect(container.Widgets).toBe(prefab.Widgets);
            expect(container.Variables).toBe(prefab.Variables);
            expect(prefab.Variables.pv).toEqual({ n: 1 });
            expect(prefab.Actions.pa).toEqual({ n: 2 });
            expect(prefab.appLocale).toEqual({ B: 1 });
            expect(prefab.getContainerWidgetInjector()).toEqual({ i: 1 });
            await wait();
            expect(container.setProps).toHaveBeenCalledWith(null);
        });

        it('getContainerWidgetInjector falls back to injector', () => {
            prefab.containerWidget = { injector: 'inj2' };
            expect(prefab.getContainerWidgetInjector()).toBe('inj2');
        });

        it('tolerates a view parent without fragment hooks', () => {
            container.viewParent = {};
            expect(() => prefab.init()).not.toThrow();
            prefab.invokeOnReady();
        });

        it('picks the SPA or regular page directive and wires attach/detach', () => {
            prefab.spa = true;
            prefab.init();
            expect(injector.get).toHaveBeenCalledWith(SpaPageDirective, null);
            const attach = jest.spyOn(prefab, 'ngOnAttach').mockImplementation(() => {});
            const detach = jest.spyOn(prefab, 'ngOnDetach').mockImplementation(() => {});
            pageDirective.handlers['attach']({ refreshData: true });
            pageDirective.handlers['detach']();
            expect(attach).toHaveBeenCalledWith(true);
            expect(detach).toHaveBeenCalled();

            const p2: any = new TestPrefab();
            p2.injector = injector;
            p2.init();
            expect(injector.get).toHaveBeenCalledWith(PageDirective, null);
        });

        it('works without a page directive', () => {
            deps.delete(PageDirective);
            prefab.init();
            expect(prefab.pageDirective).toBeNull();
        });

        it('logs user script errors', () => {
            const err = jest.spyOn(console, 'error').mockImplementation(() => {});
            prefab.evalUserScript.mockImplementation(() => { throw new Error('bad'); });
            expect(() => prefab.init()).not.toThrow();
            expect(err).toHaveBeenCalled();
        });
    });

    describe('registerProps', () => {
        const config = () => ({
            displayName: 'Display',
            properties: {
                plain: { value: 'x' },
                bound: { value: '  bind:Variables.a.dataSet ' }
            },
            events: { onClick: {}, onLoadData: {} },
            methods: { doIt: {}, boom: {}, missing: {} }
        });

        it('defines properties, events and methods from the config', async () => {
            const unwatch = jest.fn();
            mockWatch.mockReturnValue(unwatch);
            mngr.getConfig.mockResolvedValue(config());
            container.plain = 'P';
            prefab.init();
            await wait();

            expect(prefab.displayName).toBe('Display');
            // getter proxies to the container, setter to the widget
            expect(prefab.plain).toBe('P');
            prefab.plain = 'Q';
            expect(container.widget.plain).toBe('Q');

            // bound property registers a watcher and writes into the widget
            expect(mockWatch).toHaveBeenCalledWith('Variables.a.dataSet', prefab, {}, expect.any(Function));
            mockWatch.mock.calls[0][3]('NV');
            expect(container.widget.bound).toBe('NV');

            // events
            prefab.onClick('e', 'd');
            expect(container.invokeEventCallback).toHaveBeenCalledWith('click', { $event: 'e', $data: 'd' });
            prefab.onLoadData('x');
            expect(container.invokeEventCallback).toHaveBeenCalledWith('loaddata', { $event: 'x', $data: undefined });

            // methods
            prefab.doIt = jest.fn(() => 'ok');
            prefab.boom = jest.fn(() => { throw new Error('x'); });
            const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
            expect(container.doIt(1)).toBe('ok');
            expect(prefab.doIt).toHaveBeenCalledWith(1);
            expect(container.boom()).toBeUndefined();
            expect(warn).toHaveBeenCalledWith(expect.stringContaining('boom'));
            expect(container.missing()).toBeUndefined();

            expect(container.setProps).toHaveBeenCalled();

            // destroying the prefab disposes the watcher
            prefab.destroy$.complete();
            expect(unwatch).toHaveBeenCalled();
        });

        it('handles configs without properties/events/methods', async () => {
            mngr.getConfig.mockResolvedValue({ displayName: 'D' });
            prefab.init();
            await wait();
            expect(prefab.displayName).toBe('D');
            expect(container.setProps).toHaveBeenCalledWith({ displayName: 'D' });
        });

        it('recreates the widget proxy on IE', async () => {
            mockIsIE.mockReturnValue(true);
            prefab.init();
            await wait();
            expect(container.widget).toBe('proxy');
        });
    });

    describe('registerChangeListeners', () => {
        it('registers property and style listeners', () => {
            prefab.containerWidget = container;
            prefab.registerChangeListeners();
            expect(container.registerPropertyChangeListener).toHaveBeenCalledTimes(1);
            expect(container.registerStyleChangeListener).toHaveBeenCalledTimes(1);
        });
    });

    describe('view init', () => {
        it('loads variables and actions when the view is initialised', async () => {
            prefab.init();
            prefab.viewInit$.complete();
            expect(variableCollection.callback).toHaveBeenCalledWith(variableCollection.Variables);
            expect(variableCollection.callback).toHaveBeenCalledWith(variableCollection.Actions);
        });

        it('tolerates failing loads', async () => {
            variableCollection.callback.mockImplementationOnce(() => Promise.reject('x'));
            prefab.init();
            prefab.viewInit$.complete();
            await wait();
            expect(variableCollection.callback).toHaveBeenCalledWith(variableCollection.Actions);
        });
    });

    describe('invokeOnReady', () => {
        it('triggers watchers, onReady, resolves fragment and fires the load event', () => {
            prefab.init();
            const onReady = jest.spyOn(prefab, 'onReady');
            prefab.invokeOnReady();
            expect(mockInvokeWatchers).toHaveBeenCalledWith(true, true);
            expect(onReady).toHaveBeenCalled();
            expect(viewParent.resolveFragment).toHaveBeenCalled();
            expect(container.invokeEventCallback).toHaveBeenCalledWith('load');
        });

        it('default hooks are no-ops', () => {
            expect(prefab.onReady()).toBeUndefined();
            expect(prefab.onPropertyChange()).toBeUndefined();
        });
    });

    describe('ngAfterViewChecked', () => {
        beforeEach(() => prefab.init());

        it('does nothing without a container directive', async () => {
            prefab.ngAfterViewChecked();
            await wait();
            expect(prefab.compileContent).toBe(false);
        });

        it('loads scripts, compiles content, completes view init and invokes onReady once', async () => {
            jest.useFakeTimers();
            prefab.prefabContainerDirective = { $element: { attr: () => 'a.js,b.js' } };
            const ready = jest.spyOn(prefab, 'invokeOnReady').mockImplementation(() => {});
            prefab.ngAfterViewChecked();
            prefab.ngAfterViewChecked(); // second call is ignored
            await Promise.resolve();
            await Promise.resolve();
            expect(scriptLoader.load).toHaveBeenCalledTimes(1);
            expect(scriptLoader.load).toHaveBeenCalledWith('a.js', 'b.js');
            expect(prefab.compileContent).toBe(true);
            expect(container.registerPropertyChangeListener).toHaveBeenCalled();
            jest.advanceTimersByTime(100);
            jest.useRealTimers();
            prefab.fragmentsLoaded$.complete();
            expect(ready).toHaveBeenCalled();
        });

        it('skips loading when no scripts are declared', async () => {
            prefab.prefabContainerDirective = { $element: { attr: () => undefined } };
            prefab.ngAfterViewChecked();
            await wait();
            expect(scriptLoader.load).not.toHaveBeenCalled();
            expect(prefab.compileContent).toBe(true);
        });

        it('loadScripts resolves immediately when the directive disappears', async () => {
            await expect((prefab as any).loadScripts()).resolves.toBeUndefined();
        });
    });

    describe('mute / unmute / attach / detach', () => {
        beforeEach(() => {
            prefab.init();
            prefab.Widgets = { w: { mute: jest.fn(), unmute: jest.fn(), ngOnAttach: jest.fn(), ngOnDetach: jest.fn() }, n: null };
        });

        it('mute/unmute call handlers where present', () => {
            const v = { mute: jest.fn(), unmute: jest.fn() };
            prefab.Variables = { v, x: null, y: {} };
            prefab.Actions = { a: {} };
            prefab.mute();
            prefab.unmute();
            expect(prefab.Widgets.w.mute).toHaveBeenCalledTimes(1);
            expect(prefab.Widgets.w.unmute).toHaveBeenCalledTimes(1);
            expect(v.mute).toHaveBeenCalledTimes(1);
            expect(v.unmute).toHaveBeenCalledTimes(1);
        });

        it('ngOnAttach refreshes startUpdate variables only when asked', () => {
            const invoke = jest.fn();
            prefab.Variables = { v: { startUpdate: true, invoke }, skip: { startUpdate: false, invoke }, noInvoke: { startUpdate: true }, nul: null };
            prefab.Actions = { a: { startUpdate: true, invoke } };
            prefab.ngOnAttach(true);
            expect(invoke).toHaveBeenCalledTimes(2);
            expect(prefab.Widgets.w.ngOnAttach).toHaveBeenCalledTimes(1);
            invoke.mockClear();
            prefab.ngOnAttach(false);
            expect(invoke).not.toHaveBeenCalled();
        });

        it('ngOnDetach mutes and notifies widgets', () => {
            prefab.ngOnDetach();
            expect(prefab.Widgets.w.mute).toHaveBeenCalledTimes(1);
            expect(prefab.Widgets.w.ngOnDetach).toHaveBeenCalledTimes(1);
        });
    });

    describe('ngOnDestroy', () => {
        it('releases references', () => {
            prefab.init();
            prefab.ngOnDestroy();
            expect(prefab.destroy$).toBeNull();
            expect(prefab.viewInit$).toBeNull();
            expect(prefab.App).toBeNull();
            expect(prefab.containerWidget).toBeNull();
            expect(prefab.prefabMngr).toBeNull();
            expect(prefab.pageDirective).toBeNull();
        });

        it('is safe when subjects are already released/closed', () => {
            prefab.init();
            prefab.destroy$ = null;
            prefab.viewInit$.unsubscribe();
            expect(() => prefab.ngOnDestroy()).not.toThrow();
        });
    });
});
