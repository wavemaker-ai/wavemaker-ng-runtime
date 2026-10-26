import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router } from '@angular/router';
import { of } from 'rxjs';

const mockMute = jest.fn();
const mockUnMute = jest.fn();
const mockRegisterFn = jest.fn();
const mockIsIos = jest.fn(() => false);
const mockIsAndroid = jest.fn(() => false);

jest.mock('@wm/core', () => ({
    ...jest.requireActual('@wm/core'),
    muteWatchers: (...a) => mockMute(...a),
    unMuteWatchers: (...a) => mockUnMute(...a),
    registerFnByExpr: (...a) => mockRegisterFn(...a),
    isIos: () => mockIsIos(),
    isAndroid: () => mockIsAndroid()
}));
jest.mock('../services/app.manager.service', () => ({ AppManagerService: class AppManagerService {} }));
jest.mock('@wm/components/page', () => ({
    LayoutDirective: class LayoutDirective {},
    SpaPageDirective: class SpaPageDirective {}
}));

import {
    AbstractI18nService,
    AbstractNavigationService,
    App,
    ScriptLoaderService,
    UtilsService,
    Viewport
} from '@wm/core';
import { LayoutDirective } from '@wm/components/page';
import { VariablesService } from '@wm/variables';
import { AppManagerService } from '../services/app.manager.service';
import { CACHE_PAGE } from '../util/wm-route-reuse-strategy';
import { BaseSpaPageComponent } from './base-spa-page.component';

class TestSpaPage extends BaseSpaPageComponent {
    pageName = 'S';
    evalUserScript = jest.fn();
    getVariables = jest.fn(() => ({ vars: 1 }));
    getExpressions = jest.fn((): any => ({ 'a+b': [() => 1, 'x'] }));
}

const makeEl = (attrs: any = {}, kids: any[] = [], scroll = { l: 0, t: 0 }) => {
    const el: any = {
        attrs,
        scroll,
        kids,
        attr: jest.fn((k, v?) => { if (v === undefined) { return el.attrs[k]; } el.attrs[k] = v; }),
        removeAttr: jest.fn(k => { delete el.attrs[k]; }),
        scrollLeft: jest.fn(v => { if (v === undefined) { return el.scroll.l; } el.scroll.l = v; }),
        scrollTop: jest.fn(v => { if (v === undefined) { return el.scroll.t; } el.scroll.t = v; }),
        children: jest.fn(() => ({ each: (fn) => el.kids.forEach((c, i) => fn(i, c)), first: () => ({ remove: el.firstRemove }) })),
        firstRemove: jest.fn(),
        addClass: jest.fn(),
        removeClass: jest.fn(),
        remove: jest.fn(),
        on: jest.fn(),
        off: jest.fn(),
        parent: jest.fn()
    };
    return el;
};

describe('BaseSpaPageComponent', () => {
    let page: TestSpaPage;
    let deps: Map<any, any>;
    let app: any, appManager: any, navigation: any, scriptLoader: any, i18n: any, variablesService: any, route: any;
    let variableCollection: any, layout: any, layoutParent: any;
    const injector = { get: (t) => deps.get(t) };
    const wait = (ms = 5) => new Promise(r => setTimeout(r, ms));
    let winEl: any;

    beforeEach(() => {
        jest.clearAllMocks();
        mockIsIos.mockReturnValue(false);
        mockIsAndroid.mockReturnValue(false);
        BaseSpaPageComponent.lastPageSnapShot = null;

        app = { Variables: { av: {} }, Actions: { aa: {} }, activePageName: 'Old' };
        appManager = { isAppVariablesFired: jest.fn(() => false), notify: jest.fn(), appVariablesReady: jest.fn() };
        navigation = { getPageTransition: jest.fn(() => 'none') };
        scriptLoader = { load: jest.fn(() => Promise.resolve()) };
        i18n = { getAppLocale: jest.fn(() => ({ L: 1 })), setTimezone: jest.fn() };
        variableCollection = { Variables: { pv: { n: 1 } }, Actions: { pa: { n: 2 } }, callback: jest.fn(() => Promise.resolve()) };
        variablesService = { register: jest.fn(() => variableCollection) };
        route = { queryParams: of({ q: 1 }), snapshot: { data: {} } };
        layoutParent = makeEl();
        layout = { $element: { parent: () => layoutParent } };

        deps = new Map<any, any>([
            [App, app],
            [ActivatedRoute, route],
            [AppManagerService, appManager],
            [AbstractNavigationService, navigation],
            [ScriptLoaderService, scriptLoader],
            [AbstractI18nService, i18n],
            [Router, { r: 1 }],
            [Viewport, { v: 1 }],
            [UtilsService, { u: 1 }],
            [VariablesService, variablesService],
            [LayoutDirective, layout]
        ]);

        page = new TestSpaPage();
        page.injector = injector as any;
        winEl = makeEl();
        (global as any).$ = (x) => (x === window ? winEl : x);
    });

    afterEach(() => {
        jest.restoreAllMocks();
        delete (global as any).$;
    });

    describe('init', () => {
        it('wires dependencies via the injector', () => {
            page.init();
            expect(mockMute).toHaveBeenCalled();
            expect(page.layoutDirective).toBe(layout);
            expect(page.App).toBe(app);
            expect(mockRegisterFn).toHaveBeenCalledWith('a+b', expect.any(Function), 'x');
            expect(page.evalUserScript).toHaveBeenCalledWith(page, app, { u: 1 });
            expect(app.lastActivePageName).toBe('Old');
            expect(app.activePageName).toBe('S');
            expect(app.activePage).toBe(page);
            expect(page.pageParams).toEqual({ q: 1 });
            expect(page.appLocale).toEqual({ L: 1 });
            expect(page.Variables.pv).toEqual({ n: 1 });
            expect(page.Actions.pa).toEqual({ n: 2 });
            expect(page.Variables.av).toEqual({});
        });

        it('uses inject() when there is no injector', () => {
            TestBed.configureTestingModule({
                providers: Array.from(deps.entries()).map(([provide, useValue]) => ({ provide, useValue }))
            });
            const p = new TestSpaPage();
            TestBed.runInInjectionContext(() => p.init());
            expect(p.layoutDirective).toBe(layout);
            expect(p.evalUserScript).toHaveBeenCalledWith(p, app, { u: 1 });
        });

        it('logs but survives user script errors', () => {
            const err = jest.spyOn(console, 'error').mockImplementation(() => {});
            page.evalUserScript.mockImplementation(() => { throw new Error('bad'); });
            expect(() => page.init()).not.toThrow();
            expect(err).toHaveBeenCalled();
        });

        it('destroy listener and timezone delegation', () => {
            page.init();
            const fn = jest.fn();
            page.registerDestroyListener(fn);
            page.destroy$.complete();
            expect(fn).toHaveBeenCalled();
            page.setTimezone({ timezone: 'UTC' });
            expect(i18n.setTimezone).toHaveBeenCalledWith({ timezone: 'UTC' }, page);
        });
    });

    describe('variable loading on view init', () => {
        it('fires app + page variables once and shows content', async () => {
            page.init();
            page.viewInit$.complete();
            expect(appManager.appVariablesReady).toHaveBeenCalled();
            expect(appManager.isAppVariablesFired).toHaveBeenCalledWith(true);
            expect(variableCollection.callback).toHaveBeenCalledTimes(4);
            await wait(120);
            expect(appManager.notify).toHaveBeenCalledWith('app-variables-data-loaded', { pageName: 'S' });
            expect(appManager.notify).toHaveBeenCalledWith('page-variables-data-loaded', { pageName: 'S' });
            expect(page.showPageContent).toBe(true);
        });

        it('skips app variables when already fired', () => {
            appManager.isAppVariablesFired.mockReturnValue(true);
            page.init();
            page.viewInit$.complete();
            expect(variableCollection.callback).toHaveBeenCalledTimes(2);
        });

        it('tolerates failing loads', async () => {
            variableCollection.callback.mockImplementation(() => Promise.reject('x'));
            page.init();
            page.viewInit$.complete();
            await wait();
            expect(appManager.notify).toHaveBeenCalledWith('page-variables-data-loaded', { pageName: 'S' });
        });
    });

    describe('runPageTransition', () => {
        beforeEach(() => page.init());

        it('resolves immediately with no snapshot (with and without $page)', async () => {
            await page.runPageTransition('slide');
            page.$page = makeEl();
            await page.runPageTransition();
            expect(navigation.getPageTransition).toHaveBeenCalled();
            expect(page.$page.removeClass).toHaveBeenCalledWith('page-entry');
            expect(page.pageTransitionCompleted).toBe(true);
        });

        it('removes the snapshot for "none" transitions', async () => {
            const last = makeEl();
            BaseSpaPageComponent.lastPageSnapShot = last;
            await page.runPageTransition('none');
            expect(last.remove).toHaveBeenCalled();
            expect(BaseSpaPageComponent.lastPageSnapShot).toBeNull();
        });

        it('animates and completes once on animationend', async () => {
            const target = makeEl();
            const last = makeEl();
            last.parent.mockReturnValue(target);
            BaseSpaPageComponent.lastPageSnapShot = last;
            page.$page = makeEl();
            const p = page.runPageTransition('slide');
            const handler = target.on.mock.calls[0][1];
            handler({ pseudoElement: '::after' });
            expect(target.off).not.toHaveBeenCalled();
            handler();
            handler();
            expect(target.off).toHaveBeenCalledTimes(1);
            expect(target.firstRemove).toHaveBeenCalled();
            await p;
            expect(last.remove).toHaveBeenCalled();
        });

        it('falls back to the 1s timeout', async () => {
            jest.useFakeTimers();
            const target = makeEl();
            const last = makeEl();
            last.parent.mockReturnValue(target);
            BaseSpaPageComponent.lastPageSnapShot = last;
            page.$page = makeEl();
            const p = page.runPageTransition('fade');
            jest.advanceTimersByTime(1000);
            jest.useRealTimers();
            await p;
            expect(target.off).toHaveBeenCalled();
        });
    });

    describe('hooks', () => {
        it('invokeOnReady notifies, with and without App.onPageReady', () => {
            page.init();
            const onReady = jest.spyOn(page, 'onReady');
            page.invokeOnReady();
            app.onPageReady = jest.fn();
            page.invokeOnReady();
            expect(onReady).toHaveBeenCalledTimes(2);
            expect(appManager.notify).toHaveBeenCalledWith('highlightActiveLink', { pageName: 'S' });
            expect(appManager.notify).toHaveBeenCalledWith('pageReady', { name: 'S', instance: page });
            expect(app.onPageReady).toHaveBeenCalledWith('S', page);
        });

        it('ngAfterContentInit and no-op hooks', () => {
            const spy = jest.spyOn(page, 'onBeforePageReady');
            page.ngAfterContentInit();
            expect(spy).toHaveBeenCalled();
            expect(page.onReady()).toBeUndefined();
            expect(page.onPageContentReady()).toBeUndefined();
        });

        it('canReuse reflects spaPageDirective.cache', () => {
            expect(page.canReuse()).toBe(false);
            page.spaPageDirective = { cache: true };
            expect(page.canReuse()).toBe(true);
        });
    });

    describe('canDeactivate', () => {
        beforeEach(() => page.init());

        it('page-level veto', () => {
            jest.spyOn(page, 'onBeforePageLeave').mockReturnValue(false as any);
            app.onBeforePageLeave = jest.fn();
            expect(page.canDeactivate()).toBe(false);
            expect(app.onBeforePageLeave).not.toHaveBeenCalled();
        });

        it('app-level hook decides', () => {
            app.onBeforePageLeave = jest.fn(() => false);
            expect(page.canDeactivate('n')).toBe(false);
            expect(app.onBeforePageLeave).toHaveBeenCalledWith('S', page, 'n');
        });

        it('defaults to true', () => {
            expect(page.canDeactivate()).toBe(true);
        });
    });

    describe('ngAfterViewInit', () => {
        beforeEach(() => page.init());

        it('without a layout directive, completes the lifecycle', async () => {
            page.layoutDirective = null;
            page.ngAfterViewInit();
            expect(route.snapshot.data[CACHE_PAGE]).toBe(false);
            await wait(20);
            expect((page as any).compilePageContent).toBe(true);

            const ready = jest.spyOn(page, 'invokeOnReady').mockImplementation(() => {});
            page.onPageContentReady();
            expect(mockUnMute).toHaveBeenCalled();
            page.fragmentsLoaded$.complete();
            expect(ready).toHaveBeenCalled();
            expect(() => page.onPageContentReady()).not.toThrow();
        });

        it('adds platform classes and loads scripts', async () => {
            mockIsIos.mockReturnValue(true);
            mockIsAndroid.mockReturnValue(true);
            page.spaPageDirective = { cache: true, $element: makeEl({ 'scripts-to-load': 'a.js,b.js' }) };
            page.ngAfterViewInit();
            expect(route.snapshot.data[CACHE_PAGE]).toBe(true);
            expect(layoutParent.addClass).toHaveBeenCalledWith('ios-page');
            expect(layoutParent.addClass).toHaveBeenCalledWith('android-page');
            await wait(20);
            expect(scriptLoader.load).toHaveBeenCalledWith('a.js', 'b.js');
        });

        it('no platform classes and no scripts otherwise', async () => {
            page.spaPageDirective = { $element: makeEl({}) };
            page.ngAfterViewInit();
            await wait(20);
            expect(layoutParent.addClass).not.toHaveBeenCalled();
            expect(scriptLoader.load).not.toHaveBeenCalled();
        });
    });

    describe('scroll position and attach/detach', () => {
        beforeEach(() => {
            page.init();
            page.Widgets = { w: { mute: jest.fn(), unmute: jest.fn(), ngOnAttach: jest.fn(), ngOnDetach: jest.fn() }, n: null };
        });

        it('ngOnDetach saves scroll, mutes and notifies', () => {
            const child = makeEl({}, [], { l: 3, t: 4 });
            const root = makeEl({}, [child]);
            page.$page = root;
            const snap = makeEl();
            BaseSpaPageComponent.lastPageSnapShot = snap;
            page.Variables = { v: { mute: jest.fn() } };
            page.Actions = {};

            page.ngOnDetach();

            expect(child.attrs['data-scroll-position']).toBe('3,4');
            expect(root.attrs['data-scroll-position']).toBeUndefined();
            expect(root.attrs['data-window-scroll-position']).toBeDefined();
            expect(snap.remove).toHaveBeenCalled();
            expect(page.Widgets.w.mute).toHaveBeenCalled();
            expect(page.Variables.v.mute).toHaveBeenCalled();
            expect(page.Widgets.w.ngOnDetach).toHaveBeenCalled();
            expect(appManager.notify).toHaveBeenCalledWith('pageDetach', { name: 'S', instance: page });
        });

        it('saves the root scroll when non-zero', () => {
            const root = makeEl({}, [], { l: 1, t: 0 });
            page.$page = root;
            page.ngOnDetach();
            expect(root.attrs['data-scroll-position']).toBe('1,0');
        });

        it('ngOnAttach restores state, refreshes variables and notifies', async () => {
            const child = makeEl({ 'data-scroll-position': '7,8' });
            const root = makeEl({ 'data-scroll-position': '1,2', 'data-window-scroll-position': '5,6' }, [child]);
            page.$page = root;
            const invoke = jest.fn();
            page.spaPageDirective = { cache: true, refreshdataonattach: true };
            page.Variables = { v: { startUpdate: true, invoke }, skip: { startUpdate: false, invoke }, nul: null };
            page.Actions = { a: { startUpdate: true } };

            page.ngOnAttach();

            expect(route.snapshot.data[CACHE_PAGE]).toBe(true);
            expect(app.activePage).toBe(page);
            expect(page.Widgets.w.unmute).toHaveBeenCalled();
            expect(invoke).toHaveBeenCalledTimes(1);
            expect(appManager.notify).toHaveBeenCalledWith('highlightActiveLink', { pageName: 'S' });
            await wait(130);
            expect(root.scroll).toEqual({ l: '1', t: '2' });
            expect(child.scroll).toEqual({ l: '7', t: '8' });
            expect(winEl.scroll).toEqual({ l: '5', t: '6' });
            expect(page.Widgets.w.ngOnAttach).toHaveBeenCalled();
            expect(appManager.notify).toHaveBeenCalledWith('pageAttach', { name: 'S', instance: page });
        });

        it('ngOnAttach without refresh flag or stored scroll', async () => {
            page.$page = makeEl();
            page.ngOnAttach();
            await wait(130);
            expect(page.$page.scrollLeft).not.toHaveBeenCalledWith(expect.anything());
        });

        it('mute/unmute tolerate entries without handlers', () => {
            page.Widgets = { a: {}, b: undefined };
            page.Variables = { a: {} };
            page.Actions = {};
            expect(() => { page.mute(); page.unmute(); }).not.toThrow();
        });
    });

    describe('static clear', () => {
        it('removes and nulls the snapshot; safe when none', () => {
            BaseSpaPageComponent.clear();
            const snap = makeEl();
            BaseSpaPageComponent.lastPageSnapShot = snap;
            BaseSpaPageComponent.clear();
            expect(snap.remove).toHaveBeenCalled();
            expect(BaseSpaPageComponent.lastPageSnapShot).toBeNull();
        });
    });

    describe('ngOnDestroy', () => {
        it('releases everything', () => {
            page.init();
            const snap = makeEl();
            BaseSpaPageComponent.lastPageSnapShot = snap;
            page.ngOnDestroy();
            expect(snap.remove).toHaveBeenCalled();
            expect(page.destroy$).toBeNull();
            expect(page.viewInit$).toBeNull();
            expect(page.fragmentsLoaded$).toBeNull();
            expect(page.App).toBeNull();
            expect(page.layoutDirective).toBeNull();
        });

        it('copes with already-closed subjects', () => {
            page.init();
            page.destroy$.unsubscribe();
            page.viewInit$.unsubscribe();
            page.fragmentsLoaded$.unsubscribe();
            expect(() => page.ngOnDestroy()).not.toThrow();
        });
    });
});
