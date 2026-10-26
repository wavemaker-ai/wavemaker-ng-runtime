import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router } from '@angular/router';
import { of } from 'rxjs';

const mockMute = jest.fn();
const mockUnMute = jest.fn();
const mockRegisterFn = jest.fn();
const mockProps: any = { homePage: 'Home' };
const mockIsIos = jest.fn(() => false);
const mockIsAndroid = jest.fn(() => false);

jest.mock('@wm/core', () => ({
    ...jest.requireActual('@wm/core'),
    muteWatchers: (...a) => mockMute(...a),
    unMuteWatchers: (...a) => mockUnMute(...a),
    registerFnByExpr: (...a) => mockRegisterFn(...a),
    getWmProjectProperties: () => mockProps,
    isIos: () => mockIsIos(),
    isAndroid: () => mockIsAndroid()
}));
jest.mock('../services/app.manager.service', () => ({ AppManagerService: class AppManagerService {} }));
jest.mock('@wm/components/page', () => ({ PageDirective: class PageDirective {} }));

import {
    AbstractI18nService,
    AbstractNavigationService,
    App,
    ScriptLoaderService,
    UtilsService,
    Viewport
} from '@wm/core';
import { VariablesService } from '@wm/variables';
import { AppManagerService } from '../services/app.manager.service';
import { CACHE_PAGE } from '../util/wm-route-reuse-strategy';
import { BasePageComponent } from './base-page.component';

class TestPage extends BasePageComponent {
    pageName = 'P';
    evalUserScript = jest.fn();
    getVariables = jest.fn(() => ({ vars: 1 }));
    getExpressions = jest.fn((): any => ({ 'a+b': [() => 1, 'x'] }));
}

// minimal jQuery-like element
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

describe('BasePageComponent', () => {
    let page: TestPage;
    let deps: Map<any, any>;
    let app: any, appManager: any, navigation: any, scriptLoader: any, i18n: any, variablesService: any, route: any;
    let variableCollection: any;
    const injector = { get: (t) => deps.get(t) };
    const wait = (ms = 5) => new Promise(r => setTimeout(r, ms));
    let winEl: any;

    beforeEach(() => {
        jest.clearAllMocks();
        mockIsIos.mockReturnValue(false);
        mockIsAndroid.mockReturnValue(false);
        BasePageComponent.lastPageSnapShot = null;

        app = { Variables: { av: {} }, Actions: { aa: {} }, activePageName: 'Old' };
        appManager = {
            isAppVariablesFired: jest.fn(() => false),
            notify: jest.fn(),
            appVariablesReady: jest.fn()
        };
        navigation = { getPageTransition: jest.fn(() => 'none') };
        scriptLoader = { load: jest.fn(() => Promise.resolve()) };
        i18n = { getAppLocale: jest.fn(() => ({ L: 1 })), setTimezone: jest.fn() };
        variableCollection = {
            Variables: { pv: { n: 1 } },
            Actions: { pa: { n: 2 } },
            callback: jest.fn(() => Promise.resolve())
        };
        variablesService = { register: jest.fn(() => variableCollection) };
        route = { queryParams: of({ q: 1 }), snapshot: { data: {} } };

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
            [VariablesService, variablesService]
        ]);

        page = new TestPage();
        page.injector = injector as any;

        winEl = makeEl();
        (global as any).$ = (x) => (x === window ? winEl : x);
    });

    afterEach(() => {
        jest.restoreAllMocks();
        delete (global as any).$;
        delete (global as any).html2canvas;
        localStorage.clear();
    });

    describe('init', () => {
        it('wires dependencies via the injector and registers everything', () => {
            page.init();
            expect(mockMute).toHaveBeenCalled();
            expect(page.App).toBe(app);
            expect(page.appManager).toBe(appManager);
            expect(page.i18nService).toBe(i18n);
            expect(mockRegisterFn).toHaveBeenCalledWith('a+b', expect.any(Function), 'x');
            expect(page.evalUserScript).toHaveBeenCalledWith(page, app, { u: 1 });
            expect(app.lastActivePageName).toBe('Old');
            expect(app.activePageName).toBe('P');
            expect(app.activePage).toBe(page);
            expect(page.activePageName).toBe('P');
            expect(page.pageParams).toEqual({ q: 1 });
            expect(app.pageParams).toEqual({ q: 1 });
            expect(page.appLocale).toEqual({ L: 1 });
            expect(variablesService.register).toHaveBeenCalledWith('P', { vars: 1 }, page);
            expect(page.Variables.pv).toEqual({ n: 1 });
            expect(page.Variables.av).toEqual({});
            expect(page.Actions.pa).toEqual({ n: 2 });
            expect(app.Widgets).toBeDefined();
        });

        it('uses inject() when no injector is set', () => {
            TestBed.configureTestingModule({
                providers: Array.from(deps.entries()).map(([provide, useValue]) => ({ provide, useValue }))
            });
            const p = new TestPage();
            TestBed.runInInjectionContext(() => p.init());
            expect(p.App).toBe(app);
            expect(p.evalUserScript).toHaveBeenCalledWith(p, app, { u: 1 });
            expect(p.Variables.pv).toEqual({ n: 1 });
        });

        it('logs but survives errors from the user script', () => {
            const err = jest.spyOn(console, 'error').mockImplementation(() => {});
            page.evalUserScript.mockImplementation(() => { throw new Error('bad'); });
            expect(() => page.init()).not.toThrow();
            expect(err).toHaveBeenCalled();
        });

        it('registerDestroyListener runs on destroy$ completion; params subscription is cleaned', () => {
            page.init();
            const fn = jest.fn();
            page.registerDestroyListener(fn);
            page.destroy$.complete();
            expect(fn).toHaveBeenCalled();
        });

        it('setTimezone delegates to the i18n service', () => {
            page.init();
            page.setTimezone({ timezone: 'UTC' });
            expect(i18n.setTimezone).toHaveBeenCalledWith({ timezone: 'UTC' }, page);
        });
    });

    describe('variable loading on view init', () => {
        it('fires app and page variables once, then shows content', async () => {
            page.init();
            page.viewInit$.complete();
            expect(variableCollection.callback).toHaveBeenCalledWith(app.Variables);
            expect(variableCollection.callback).toHaveBeenCalledWith(app.Actions);
            expect(variableCollection.callback).toHaveBeenCalledWith(variableCollection.Variables);
            expect(variableCollection.callback).toHaveBeenCalledWith(variableCollection.Actions);
            expect(appManager.appVariablesReady).toHaveBeenCalled();
            expect(appManager.isAppVariablesFired).toHaveBeenCalledWith(true);
            await wait(120);
            expect(appManager.notify).toHaveBeenCalledWith('app-variables-data-loaded', { pageName: 'P' });
            expect(appManager.notify).toHaveBeenCalledWith('page-variables-data-loaded', { pageName: 'P' });
            expect(page.startupVariablesLoaded).toBe(true);
            expect(page.showPageContent).toBe(true);
            expect(page.isViewInitialized).toBe(true);
        });

        it('skips app variables when already fired', () => {
            appManager.isAppVariablesFired.mockReturnValue(true);
            page.init();
            page.viewInit$.complete();
            expect(appManager.appVariablesReady).not.toHaveBeenCalled();
            expect(variableCollection.callback).toHaveBeenCalledTimes(2);
        });

        it('tolerates failing variable loads', async () => {
            variableCollection.callback.mockImplementation(() => Promise.reject('x'));
            page.init();
            page.viewInit$.complete();
            await wait();
            expect(appManager.notify).toHaveBeenCalledWith('page-variables-data-loaded', { pageName: 'P' });
        });
    });

    describe('runPageTransition', () => {
        beforeEach(() => {
            page.init();
        });

        it('resolves immediately without a snapshot and marks completion', async () => {
            page.$page = makeEl();
            await page.runPageTransition();
            expect(navigation.getPageTransition).toHaveBeenCalled();
            expect(page.$page.removeClass).toHaveBeenCalledWith('page-entry');
            expect(page.pageTransitionCompleted).toBe(true);
        });

        it('works without $page', async () => {
            await page.runPageTransition('slide');
            expect(page.pageTransitionCompleted).toBe(true);
        });

        it('removes the old snapshot when transition is "none"', async () => {
            const last = makeEl();
            BasePageComponent.lastPageSnapShot = last;
            await page.runPageTransition('none-x');
            expect(last.remove).toHaveBeenCalled();
            expect(BasePageComponent.lastPageSnapShot).toBeNull();
        });

        it('animates, ignores pseudo-element events, finishes once on animationend', async () => {
            const target = makeEl();
            const last = makeEl();
            last.parent.mockReturnValue(target);
            BasePageComponent.lastPageSnapShot = last;
            page.$page = makeEl();

            const p = page.runPageTransition('slide');
            expect(last.addClass).toHaveBeenCalledWith('page-exit');
            expect(page.$page.addClass).toHaveBeenCalledWith('page-entry');
            expect(target.addClass).toHaveBeenCalledWith('page-transition page-transition-slide');
            const handler = target.on.mock.calls[0][1];

            handler({ pseudoElement: '::before' });
            expect(target.off).not.toHaveBeenCalled();
            handler();
            expect(target.off).toHaveBeenCalledWith('animationend', handler);
            expect(target.removeClass).toHaveBeenCalledWith('page-transition page-transition-slide');
            expect(target.firstRemove).toHaveBeenCalled();
            handler(); // second call is a no-op
            expect(target.off).toHaveBeenCalledTimes(1);
            await p;
            expect(last.remove).toHaveBeenCalled();
        });

        it('falls back to a 1s timeout when animationend never fires', async () => {
            jest.useFakeTimers();
            const target = makeEl();
            const last = makeEl();
            last.parent.mockReturnValue(target);
            BasePageComponent.lastPageSnapShot = last;
            page.$page = makeEl();
            const p = page.runPageTransition('fade');
            jest.advanceTimersByTime(1000);
            jest.useRealTimers();
            await p;
            expect(target.off).toHaveBeenCalled();
        });
    });

    describe('invokeOnReady', () => {
        it('notifies and calls App.onPageReady for non-home pages', () => {
            page.init();
            const onReady = jest.spyOn(page, 'onReady');
            app.onPageReady = jest.fn();
            page.invokeOnReady();
            expect(onReady).toHaveBeenCalled();
            expect(appManager.notify).toHaveBeenCalledWith('pageReady', { name: 'P', instance: page });
            expect(app.onPageReady).toHaveBeenCalledWith('P', page);
        });

        it('tells the embedding window when the home page is ready in a frame', () => {
            page.init();
            mockProps.homePage = 'P';
            const original = Object.getOwnPropertyDescriptor(window, 'name');
            let reads = 0;
            Object.defineProperty(window, 'name', { configurable: true, get: () => (reads++ % 2 === 0 ? 'top-window' : 'frame-window'), set: () => undefined });
            const post = jest.spyOn(window, 'postMessage').mockImplementation(() => undefined);
            try {
                page.invokeOnReady();
                expect(post).toHaveBeenCalledWith({ key: 'onHomepageLoad' }, '*');
                reads = 0;
                mockProps.homePage = 'Other';
                post.mockClear();
                page.invokeOnReady();
                expect(post).not.toHaveBeenCalled();
            } finally {
                if (original) {
                    Object.defineProperty(window, 'name', original);
                } else {
                    delete (window as any).name;
                }
                mockProps.homePage = 'Home';
            }
        });

        it('works without App.onPageReady and for the home page', () => {
            page.init();
            mockProps.homePage = 'P';
            expect(() => page.invokeOnReady()).not.toThrow();
            mockProps.homePage = 'Home';
        });
    });

    describe('ngAfterContentInit / hooks / canReuse', () => {
        it('calls onBeforePageReady', () => {
            const spy = jest.spyOn(page, 'onBeforePageReady');
            page.ngAfterContentInit();
            expect(spy).toHaveBeenCalled();
        });

        it('no-op hooks', () => {
            expect(page.onReady()).toBeUndefined();
            expect(page.onPageContentReady()).toBeUndefined();
        });

        it('canReuse reflects pageDirective.cache', () => {
            expect(page.canReuse()).toBe(false);
            page.pageDirective = { cache: true };
            expect(page.canReuse()).toBe(true);
        });
    });

    describe('canDeactivate', () => {
        beforeEach(() => page.init());

        it('returns false when the page-level hook vetoes', () => {
            jest.spyOn(page, 'onBeforePageLeave').mockReturnValue(false as any);
            app.onBeforePageLeave = jest.fn();
            expect(page.canDeactivate()).toBe(false);
            expect(app.onBeforePageLeave).not.toHaveBeenCalled();
        });

        it('defers to App.onBeforePageLeave', () => {
            app.onBeforePageLeave = jest.fn(() => false);
            expect(page.canDeactivate('next')).toBe(false);
            expect(app.onBeforePageLeave).toHaveBeenCalledWith('P', page, 'next');
        });

        it('defaults to true when nothing returns a value', () => {
            expect(page.canDeactivate()).toBe(true);
        });
    });

    describe('ngAfterViewInit', () => {
        const makeDirective = (scripts?: string, cache = false) => {
            const $page = makeEl();
            const $element = makeEl({ 'scripts-to-load': scripts });
            $element.parent.mockReturnValue($page);
            return { $element, $page, cache };
        };

        beforeEach(() => page.init());

        it('works without a page directive and completes lifecycle', async () => {
            page.ngAfterViewInit();
            expect(route.snapshot.data[CACHE_PAGE]).toBe(false);
            await wait(20);
            expect((page as any).compilePageContent).toBe(true);

            const ready = jest.spyOn(page, 'invokeOnReady').mockImplementation(() => {});
            page.onPageContentReady();
            expect(mockUnMute).toHaveBeenCalled();
            page.fragmentsLoaded$.complete();
            expect(ready).toHaveBeenCalled();
            // replaced by a noop afterwards
            expect(() => page.onPageContentReady()).not.toThrow();
        });

        it('adds platform classes and loads required scripts', async () => {
            mockIsIos.mockReturnValue(true);
            mockIsAndroid.mockReturnValue(true);
            const d = makeDirective('a.js,b.js', true);
            page.pageDirective = d;
            page.ngAfterViewInit();
            expect(route.snapshot.data[CACHE_PAGE]).toBe(true);
            expect(d.$page.addClass).toHaveBeenCalledWith('ios-page');
            expect(d.$page.addClass).toHaveBeenCalledWith('android-page');
            await wait(20);
            expect(scriptLoader.load).toHaveBeenCalledWith('a.js', 'b.js');
        });

        it('skips platform classes on other platforms and when no scripts are needed', async () => {
            const d = makeDirective(undefined);
            page.pageDirective = d;
            page.ngAfterViewInit();
            await wait(20);
            expect(d.$page.addClass).not.toHaveBeenCalled();
            expect(scriptLoader.load).not.toHaveBeenCalled();
        });
    });

    describe('scroll position and attach/detach', () => {
        const withTree = () => {
            const child = makeEl({}, [], { l: 3, t: 4 });
            const root = makeEl({}, [child], { l: 0, t: 0 });
            return { child, root };
        };

        beforeEach(() => {
            page.init();
            page.Widgets = { w: { mute: jest.fn(), unmute: jest.fn(), ngOnAttach: jest.fn(), ngOnDetach: jest.fn() }, n: null };
        });

        it('ngOnDetach saves scroll, mutes everything and notifies', () => {
            const { child, root } = withTree();
            page.$page = root;
            const v = { mute: jest.fn() };
            page.Variables = { v, x: null };
            page.Actions = { a: {} };
            BasePageComponent.lastPageSnapShot = makeEl();
            const snap = BasePageComponent.lastPageSnapShot;
            window.scrollTo = jest.fn() as any;

            page.ngOnDetach();

            expect(child.attrs['data-scroll-position']).toBe('3,4');
            expect(root.attrs['data-scroll-position']).toBeUndefined();
            expect(root.attrs['data-window-scroll-position']).toBe(`${window.scrollX},${window.scrollY}`);
            expect(snap.remove).toHaveBeenCalled();
            expect(page.Widgets.w.mute).toHaveBeenCalled();
            expect(v.mute).toHaveBeenCalled();
            expect(page.Widgets.w.ngOnDetach).toHaveBeenCalled();
            expect(appManager.notify).toHaveBeenCalledWith('pageDetach', { name: 'P', instance: page });
        });

        it('saveScrollPosition records root scroll when non-zero', () => {
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
            page.pageDirective = { cache: true, refreshdataonattach: true };
            page.Variables = { v: { startUpdate: true, invoke, unmute: jest.fn() }, skip: { startUpdate: false, invoke }, nul: null };
            page.Actions = { a: { startUpdate: true } };

            page.ngOnAttach();

            expect(route.snapshot.data[CACHE_PAGE]).toBe(true);
            expect(app.activePage).toBe(page);
            expect(page.Widgets.w.unmute).toHaveBeenCalled();
            expect(invoke).toHaveBeenCalledTimes(1);
            await wait(130);
            expect(root.scroll).toEqual({ l: '1', t: '2' });
            expect(child.scroll).toEqual({ l: '7', t: '8' });
            expect(winEl.scroll).toEqual({ l: '5', t: '6' });
            expect(root.removeAttr).toHaveBeenCalledWith('data-scroll-position');
            expect(page.Widgets.w.ngOnAttach).toHaveBeenCalled();
            expect(appManager.notify).toHaveBeenCalledWith('pageAttach', { name: 'P', instance: page });
        });

        it('ngOnAttach without refresh flag and with nothing to restore', async () => {
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

    describe('captureApplicationThumbnail', () => {
        beforeEach(() => {
            page.init();
            app.landingPageName = 'P';
            jest.spyOn(console, 'log').mockImplementation(() => {});
            jest.spyOn(console, 'error').mockImplementation(() => {});
        });

        it('does nothing when the flag is off or conditions fail', () => {
            (global as any).html2canvas = jest.fn();
            page.captureApplicationThumbnail();
            localStorage.setItem('captureApplicationThumbnail', 'true');
            app.isApplicationThumbnailCaptured = true;
            page.captureApplicationThumbnail();
            app.isApplicationThumbnailCaptured = false;
            app.landingPageName = 'Other';
            page.captureApplicationThumbnail();
            expect((global as any).html2canvas).not.toHaveBeenCalled();
        });

        it('captures and downloads a screenshot', async () => {
            localStorage.setItem('captureApplicationThumbnail', 'true');
            (global as any).html2canvas = jest.fn(() => Promise.resolve({ toDataURL: () => 'data:x' }));
            const click = jest.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
            page.captureApplicationThumbnail();
            await wait();
            expect(app.isApplicationThumbnailCaptured).toBe(true);
            expect(click).toHaveBeenCalled();
        });

        it('logs errors thrown while processing the canvas', async () => {
            localStorage.setItem('captureApplicationThumbnail', 'true');
            (global as any).html2canvas = jest.fn(() => Promise.resolve({ toDataURL: () => { throw new Error('x'); } }));
            page.captureApplicationThumbnail();
            await wait();
            expect(console.error).toHaveBeenCalledWith('Error in html2canvas then block:', expect.anything());
        });

        it('logs html2canvas rejections', async () => {
            localStorage.setItem('captureApplicationThumbnail', 'true');
            (global as any).html2canvas = jest.fn(() => Promise.reject('nope'));
            page.captureApplicationThumbnail();
            await wait();
            expect(console.error).toHaveBeenCalledWith('Error in html2canvas promise:', 'nope');
        });
    });

    describe('static clear', () => {
        it('removes and nulls the snapshot, and is safe when none', () => {
            BasePageComponent.clear();
            const snap = makeEl();
            BasePageComponent.lastPageSnapShot = snap;
            BasePageComponent.clear();
            expect(snap.remove).toHaveBeenCalled();
            expect(BasePageComponent.lastPageSnapShot).toBeNull();
        });
    });

    describe('ngOnDestroy', () => {
        it('releases everything', () => {
            page.init();
            const snap = makeEl();
            BasePageComponent.lastPageSnapShot = snap;
            page.ngOnDestroy();
            expect(snap.remove).toHaveBeenCalled();
            expect(page.destroy$).toBeNull();
            expect(page.viewInit$).toBeNull();
            expect(page.App).toBeNull();
            expect(page.route).toBeNull();
            expect(page.fragmentsLoaded$).toBeNull();
        });

        it('copes with already-released subjects', () => {
            page.init();
            page.destroy$ = null;
            page.viewInit$.unsubscribe();
            expect(() => page.ngOnDestroy()).not.toThrow();
        });
    });
});
