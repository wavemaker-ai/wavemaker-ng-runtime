import { TestBed } from '@angular/core/testing';

const mockRegisterFn = jest.fn();
const mockInvokeWatchers = jest.fn();

jest.mock('@wm/core', () => ({
    ...jest.requireActual('@wm/core'),
    registerFnByExpr: (...a) => mockRegisterFn(...a),
    $invokeWatchers: (...a) => mockInvokeWatchers(...a)
}));
jest.mock('@wm/components/base', () => ({
    PartialDirective: class PartialDirective {},
    WidgetRef: class WidgetRef {}
}));
jest.mock('@wm/components/page', () => ({
    PageDirective: class PageDirective {},
    SpaPageDirective: class SpaPageDirective {}
}));
jest.mock('@wm/components/prefab', () => ({ PrefabDirective: class PrefabDirective {} }));

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
import { BasePartialComponent, commonPartialWidgets } from './base-partial.component';

class TestPartial extends BasePartialComponent {
    partialName = 'Part';
    evalUserScript = jest.fn();
    getVariables = jest.fn(() => ({ vars: 1 }));
    getExpressions = jest.fn((): any => ({ 'a+b': [() => 1, 'x'] }));
}

describe('BasePartialComponent', () => {
    let partial: TestPartial;
    let deps: Map<any, any>;
    let app: any, container: any, viewParent: any, i18n: any, scriptLoader: any, variablesService: any;
    let variableCollection: any, pageDirective: any;
    const injector = { get: jest.fn((t, fallback?) => (deps.has(t) ? deps.get(t) : fallback)) };
    const wait = (ms = 5) => new Promise(r => setTimeout(r, ms));

    beforeEach(() => {
        jest.clearAllMocks();
        Object.keys(commonPartialWidgets).forEach(k => delete commonPartialWidgets[k]);

        app = { Variables: { av: {} }, Actions: { aa: {} }, activePageName: 'Pg' };
        viewParent = { registerFragment: jest.fn(), resolveFragment: jest.fn() };
        container = { viewParent, partialParams: { p: 1 }, inj: { i: 1 } };
        i18n = { getAppLocale: jest.fn(() => ({ L: 1 })) };
        scriptLoader = { load: jest.fn(() => Promise.resolve()) };
        variableCollection = { Variables: { pv: { n: 1 } }, Actions: { pa: { n: 2 } }, callback: jest.fn(() => Promise.resolve()) };
        variablesService = { register: jest.fn(() => variableCollection) };
        const handlers: Record<string, Function> = {};
        pageDirective = {
            handlers,
            subscribe: jest.fn((evt, fn) => { handlers[evt] = fn; return jest.fn(); })
        };

        deps = new Map<any, any>([
            [App, app],
            [WidgetRef, container],
            [AbstractI18nService, i18n],
            [ScriptLoaderService, scriptLoader],
            [Viewport, { v: 1 }],
            [UtilsService, { u: 1 }],
            [VariablesService, variablesService],
            [PageDirective, pageDirective],
            [SpaPageDirective, pageDirective]
        ]);

        partial = new TestPartial();
        partial.injector = injector as any;
    });

    afterEach(() => jest.restoreAllMocks());

    describe('init', () => {
        it('wires dependencies via the injector', () => {
            partial.init();
            expect(partial.App).toBe(app);
            expect(partial.containerWidget).toBe(container);
            expect(partial.i18nService).toBe(i18n);
            expect(viewParent.registerFragment).toHaveBeenCalled();
            expect(mockRegisterFn).toHaveBeenCalledWith('a+b', expect.any(Function), 'x');
            expect(partial.evalUserScript).toHaveBeenCalledWith(partial, app, { u: 1 });
            expect(partial.activePageName).toBe('Pg');
            expect(partial.pageParams).toEqual({ p: 1 });
            expect(partial.appLocale).toEqual({ L: 1 });
            expect(container.Widgets).toBe(partial.Widgets);
            expect(container.Variables).toBe(partial.Variables);
            expect(container.Actions).toBe(partial.Actions);
            expect(partial.Variables.pv).toEqual({ n: 1 });
            expect(partial.Variables.av).toEqual({});
            expect(partial.Actions.pa).toEqual({ n: 2 });
            expect(partial.getContainerWidgetInjector()).toEqual({ i: 1 });
        });

        it('getContainerWidgetInjector falls back to injector', () => {
            partial.containerWidget = { injector: 'inj2' };
            expect(partial.getContainerWidgetInjector()).toBe('inj2');
        });

        it('tolerates a view parent without fragment hooks', () => {
            container.viewParent = {};
            expect(() => partial.init()).not.toThrow();
            partial.invokeOnReady();
        });

        it('uses inject() when no injector is set (page directive present)', () => {
            TestBed.configureTestingModule({
                providers: Array.from(deps.entries()).map(([provide, useValue]) => ({ provide, useValue }))
            });
            const p = new TestPartial();
            TestBed.runInInjectionContext(() => p.init());
            expect(p.App).toBe(app);
            expect(p.pageDirective).toBe(pageDirective);
        });

        it('uses inject() for the SPA page directive; optional when absent', () => {
            deps.delete(SpaPageDirective);
            TestBed.configureTestingModule({
                providers: Array.from(deps.entries()).map(([provide, useValue]) => ({ provide, useValue }))
            });
            const p = new TestPartial();
            p.spa = true;
            TestBed.runInInjectionContext(() => p.init());
            expect(p.pageDirective).toBeNull();
        });

        it('resolves SPA vs regular page directive from the injector', () => {
            partial.spa = true;
            partial.init();
            expect(injector.get).toHaveBeenCalledWith(SpaPageDirective, null);
            const p2 = new TestPartial();
            p2.injector = injector as any;
            p2.init();
            expect(injector.get).toHaveBeenCalledWith(PageDirective, null);
        });

        it('works without a page directive', () => {
            deps.delete(PageDirective);
            expect(() => partial.init()).not.toThrow();
            expect(partial.pageDirective).toBeNull();
        });

        it('wires attach/detach events of the page directive', () => {
            partial.init();
            const attach = jest.spyOn(partial, 'ngOnAttach').mockImplementation(() => {});
            const detach = jest.spyOn(partial, 'ngOnDetach').mockImplementation(() => {});
            pageDirective.handlers['attach']({ refreshData: true });
            pageDirective.handlers['detach']();
            expect(attach).toHaveBeenCalledWith(true);
            expect(detach).toHaveBeenCalled();
        });

        it('logs user script errors without failing', () => {
            const err = jest.spyOn(console, 'error').mockImplementation(() => {});
            partial.evalUserScript.mockImplementation(() => { throw new Error('bad'); });
            expect(() => partial.init()).not.toThrow();
            expect(err).toHaveBeenCalled();
        });
    });

    describe('registerWidgets', () => {
        it('Common partial shares commonPartialWidgets directly', () => {
            partial.partialName = 'Common';
            partial.containerWidget = container;
            partial.registerWidgets();
            expect(partial.Widgets).toBe(commonPartialWidgets);
        });

        it('other partials inherit from commonPartialWidgets', () => {
            partial.containerWidget = container;
            partial.registerWidgets();
            expect(partial.Widgets).not.toBe(commonPartialWidgets);
            expect(Object.getPrototypeOf(partial.Widgets)).toBe(commonPartialWidgets);
        });
    });

    describe('prefab handling in initUserScript', () => {
        it('uses the view parent as Prefab when it is a prefab', () => {
            viewParent.prefabName = 'pf';
            partial.init();
            expect(partial.Prefab).toBe(viewParent);
        });

        it('inherits the Prefab from a parent partial inside a prefab', () => {
            const pf = { pf: 1 };
            viewParent.prefabName = 'pf';
            viewParent.Prefab = pf;
            partial.init();
            expect(partial.Prefab).toBe(pf);
        });

        it('leaves Prefab unset outside prefabs', () => {
            partial.init();
            expect(partial.Prefab).toBeUndefined();
        });
    });

    describe('view init', () => {
        it('updates params, triggers watchers and loads variables when the view is initialised', () => {
            partial.init();
            container.partialParams = { p: 2 };
            partial.viewInit$.complete();
            expect(partial.pageParams).toEqual({ p: 2 });
            expect(mockInvokeWatchers).toHaveBeenCalledWith(true, true);
            expect(variableCollection.callback).toHaveBeenCalledWith(variableCollection.Variables);
            expect(variableCollection.callback).toHaveBeenCalledWith(variableCollection.Actions);
        });

        it('tolerates failing variable loads', async () => {
            variableCollection.callback.mockImplementationOnce(() => Promise.reject('x'));
            partial.init();
            partial.viewInit$.complete();
            await wait();
            expect(variableCollection.callback).toHaveBeenCalledWith(variableCollection.Actions);
        });
    });

    describe('registerDestroyListener', () => {
        it('runs on destroy$ completion', () => {
            partial.init();
            const fn = jest.fn();
            partial.registerDestroyListener(fn);
            partial.destroy$.complete();
            expect(fn).toHaveBeenCalledTimes(1);
        });
    });

    describe('invokeOnReady', () => {
        beforeEach(() => partial.init());

        it('passes user component params and resolves the fragment', () => {
            container.userComponentParams = { u: 1 };
            const onReady = jest.spyOn(partial, 'onReady');
            partial.invokeOnReady();
            expect(onReady).toHaveBeenCalledWith({ u: 1 });
            expect(viewParent.resolveFragment).toHaveBeenCalled();
        });

        it('passes undefined without user params', () => {
            const onReady = jest.spyOn(partial, 'onReady');
            partial.invokeOnReady();
            expect(onReady).toHaveBeenCalledWith(undefined);
        });

        it('default onReady is a no-op', () => {
            expect(partial.onReady()).toBeUndefined();
        });
    });

    describe('ngAfterViewInit', () => {
        beforeEach(() => partial.init());

        it('compiles content, completes view init and invokes onReady when fragments are loaded', async () => {
            jest.useFakeTimers();
            const ready = jest.spyOn(partial, 'invokeOnReady').mockImplementation(() => {});
            partial.ngAfterViewInit();
            await Promise.resolve();
            await Promise.resolve();
            expect(partial.compileContent).toBe(true);
            jest.advanceTimersByTime(100);
            jest.useRealTimers();
            partial.fragmentsLoaded$.complete();
            expect(ready).toHaveBeenCalled();
        });

        it('loads required scripts first', async () => {
            partial.partialDirective = { $element: { attr: () => 'a.js,b.js' } };
            partial.ngAfterViewInit();
            await wait();
            expect(scriptLoader.load).toHaveBeenCalledWith('a.js', 'b.js');
            expect(partial.compileContent).toBe(true);
        });

        it('skips loading when the directive declares no scripts', async () => {
            partial.partialDirective = { $element: { attr: () => undefined } };
            partial.ngAfterViewInit();
            await wait();
            expect(scriptLoader.load).not.toHaveBeenCalled();
            expect(partial.compileContent).toBe(true);
        });
    });

    describe('mute / unmute / attach / detach', () => {
        beforeEach(() => {
            partial.init();
            partial.Widgets = { w: { mute: jest.fn(), unmute: jest.fn(), ngOnAttach: jest.fn(), ngOnDetach: jest.fn() }, n: null };
        });

        it('mute and unmute call handlers where present', () => {
            const v = { mute: jest.fn(), unmute: jest.fn() };
            partial.Variables = { v, x: null, y: {} };
            partial.Actions = { a: {} };
            partial.mute();
            partial.unmute();
            expect(partial.Widgets.w.mute).toHaveBeenCalledTimes(1);
            expect(partial.Widgets.w.unmute).toHaveBeenCalledTimes(1);
            expect(v.mute).toHaveBeenCalledTimes(1);
            expect(v.unmute).toHaveBeenCalledTimes(1);
        });

        it('ngOnAttach unmutes, refreshes startUpdate variables when asked, and notifies widgets', () => {
            const invoke = jest.fn();
            partial.Variables = { v: { startUpdate: true, invoke }, skip: { startUpdate: false, invoke }, noInvoke: { startUpdate: true }, nul: null };
            partial.Actions = { a: { startUpdate: true, invoke } };
            partial.ngOnAttach(true);
            expect(partial.Widgets.w.unmute).toHaveBeenCalledTimes(1);
            expect(invoke).toHaveBeenCalledTimes(2);
            expect(partial.Widgets.w.ngOnAttach).toHaveBeenCalledTimes(1);
        });

        it('ngOnAttach without refresh leaves variables alone', () => {
            const invoke = jest.fn();
            partial.Variables = { v: { startUpdate: true, invoke } };
            partial.ngOnAttach(false);
            expect(invoke).not.toHaveBeenCalled();
        });

        it('ngOnDetach mutes and notifies widgets', () => {
            partial.ngOnDetach();
            expect(partial.Widgets.w.mute).toHaveBeenCalledTimes(1);
            expect(partial.Widgets.w.ngOnDetach).toHaveBeenCalledTimes(1);
        });
    });

    describe('ngOnDestroy', () => {
        it('releases references', () => {
            partial.init();
            partial.ngOnDestroy();
            expect(partial.destroy$).toBeNull();
            expect(partial.viewInit$).toBeNull();
            expect(partial.fragmentsLoaded$).toBeNull();
            expect(partial.App).toBeNull();
            expect(partial.containerWidget).toBeNull();
            expect(partial.pageDirective).toBeNull();
            expect(partial.Prefab).toBeNull();
        });

        it('is safe when subjects are already released/closed', () => {
            partial.init();
            partial.destroy$ = null;
            partial.viewInit$.unsubscribe();
            expect(() => partial.ngOnDestroy()).not.toThrow();
        });
    });
});
