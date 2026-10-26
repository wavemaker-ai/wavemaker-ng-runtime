import { NavigationCancel, NavigationEnd, NavigationError, NavigationStart } from '@angular/router';
import { Subject } from 'rxjs';

const mockProps: any = {};
const mockInvokeWatchers = jest.fn();
const mockSetPipeProvider = jest.fn();
const mockSetNgZone = jest.fn();
const mockSetAppRef = jest.fn();
const mockAddClass = jest.fn();
const mockRemoveClass = jest.fn();
const mockSetTheme = jest.fn();

jest.mock('@wm/core', () => ({
    ...jest.requireActual('@wm/core'),
    getWmProjectProperties: () => mockProps,
    $invokeWatchers: (...a) => mockInvokeWatchers(...a),
    setPipeProvider: (...a) => mockSetPipeProvider(...a),
    setNgZone: (...a) => mockSetNgZone(...a),
    setAppRef: (...a) => mockSetAppRef(...a),
    addClass: (...a) => mockAddClass(...a),
    removeClass: (...a) => mockRemoveClass(...a)
}));
jest.mock('ngx-bootstrap/utils', () => ({ setTheme: (...a) => mockSetTheme(...a) }));
jest.mock('@wm/components/dialogs/alert-dialog', () => ({ AlertDialogComponent: class AlertDialogComponent {} }));
jest.mock('@wm/components/dialogs/confirm-dialog', () => ({ ConfirmDialogComponent: class ConfirmDialogComponent {} }));
jest.mock('@wm/components/dialogs/design-dialog', () => ({ DialogComponent: class DialogComponent {} }));
jest.mock('@wm/components/base', () => ({
    ContainerDirective: class ContainerDirective {},
    PartialContainerDirective: class PartialContainerDirective {},
    PartialParamHandlerDirective: class PartialParamHandlerDirective {}
}));
jest.mock('@wm/oAuth', () => ({ OAuthService: class OAuthService {} }));
jest.mock('../../services/app.manager.service', () => ({ AppManagerService: class AppManagerService {} }));
jest.mock('../../services/pipe-provider.service', () => ({ PipeProvider: class PipeProvider {} }));
jest.mock('../app-spinner.component', () => ({ AppSpinnerComponent: class AppSpinnerComponent {} }));

import { AppComponent } from './app.component';

describe('AppComponent', () => {
    let comp: any;
    let routerEvents: Subject<any>;
    let providers$: Subject<any>;
    let spinnerSource$: Subject<any>;
    let customIcons: any, dialog: any, spinner: any, appManager: any, app: any, router: any, oAuth: any;
    let managerHandlers: Record<string, Function>;

    const create = () =>
        new AppComponent({} as any, { a: 1 } as any, {} as any, oAuth, dialog, spinner, { z: 1 } as any, router, app, appManager, customIcons);

    beforeEach(() => {
        jest.useFakeTimers();
        jest.clearAllMocks();
        Object.keys(mockProps).forEach(k => delete mockProps[k]);
        Object.assign(mockProps, { type: 'APPLICATION', defaultLanguage: 'fr' });

        routerEvents = new Subject();
        providers$ = new Subject();
        spinnerSource$ = new Subject();
        managerHandlers = {};
        customIcons = { load: jest.fn() };
        dialog = { open: jest.fn(), close: jest.fn() };
        spinner = {
            getMessageSource: () => ({ asObservable: () => spinnerSource$.asObservable() }),
            show: jest.fn(() => 'sid'),
            hide: jest.fn()
        };
        appManager = { subscribe: jest.fn((name, fn) => { managerHandlers[name] = fn; }) };
        app = { appLocale: { L: 1 } };
        router = { events: routerEvents };
        oAuth = { getOAuthProvidersAsObservable: () => providers$.asObservable() };
        document.body.innerHTML = '';
        comp = create();
    });

    afterEach(() => {
        jest.clearAllTimers();
        jest.useRealTimers();
        document.body.innerHTML = '';
        document.documentElement.removeAttribute('lang');
    });

    describe('construction', () => {
        it('registers global providers and basic state', () => {
            expect(mockSetPipeProvider).toHaveBeenCalledWith({});
            expect(mockSetNgZone).toHaveBeenCalledWith({ z: 1 });
            expect(mockSetAppRef).toHaveBeenCalledWith({ a: 1 });
            expect(mockSetTheme).toHaveBeenCalledWith('bs5');
            expect(comp.appLocale).toEqual({ L: 1 });
            expect(comp.isApplicationType).toBe(true);
            expect(customIcons.load).toHaveBeenCalled();
            expect(comp.enableSkipToMainContent).toBe(false);
        });

        it('does not load custom icons for non-application projects', () => {
            mockProps.type = 'PREFAB';
            customIcons.load.mockClear();
            const c = create();
            expect(c.isApplicationType).toBe(false);
            expect(customIcons.load).not.toHaveBeenCalled();
        });

        it('reads enableSkipToMainContent as "true" or true', () => {
            mockProps.enableSkipToMainContent = 'true';
            expect(create().enableSkipToMainContent).toBe(true);
            mockProps.enableSkipToMainContent = true;
            expect(create().enableSkipToMainContent).toBe(true);
        });
    });

    describe('OAuth dialog', () => {
        it('opens once when providers arrive and closes when they are gone', () => {
            providers$.next([{ p: 1 }]);
            providers$.next([{ p: 1 }, { p: 2 }]);
            expect(dialog.open).toHaveBeenCalledTimes(1);
            expect(dialog.open).toHaveBeenCalledWith('oAuthLoginDialog', comp);
            expect(comp.providersConfig).toHaveLength(2);
            providers$.next([]);
            providers$.next([]);
            expect(dialog.close).toHaveBeenCalledTimes(1);
            expect(dialog.close).toHaveBeenCalledWith('oAuthLoginDialog', comp);
        });
    });

    describe('spinner', () => {
        it('mirrors spinner messages asynchronously', () => {
            spinnerSource$.next({ show: true, messages: ['a', 'b'] });
            expect(comp.spinner.show).toBe(false);
            jest.runOnlyPendingTimers();
            expect(comp.spinner).toEqual({ show: true, messages: ['a', 'b'], arialabel: 'a,b' });
        });
    });

    describe('navigation spinner', () => {
        const outlet = () => {
            const el = document.createElement('app-page-outlet');
            document.body.appendChild(el);
            return el;
        };

        it('shows the global spinner and marks the outlet as loading', () => {
            const el = outlet();
            routerEvents.next(new NavigationStart(1, '/Page?x=1'));
            expect(spinner.show).toHaveBeenCalledWith('', 'globalSpinner');
            expect(mockAddClass).toHaveBeenCalledWith(el, 'page-load-in-progress');
        });

        it('shows the router-outlet spinner for pages of the active layout', () => {
            app.activeLayoutName = 'L';
            app.layoutPages = ['Page'];
            routerEvents.next(new NavigationStart(1, '/Page'));
            expect(spinner.show).toHaveBeenCalledWith('', 'wmRouterOutlet', '', 'wmRouterOutlet');
        });

        it('uses the global spinner when the page is not in the layout / layout has no pages', () => {
            app.activeLayoutName = 'L';
            app.layoutPages = ['Other'];
            routerEvents.next(new NavigationStart(1, '/Page'));
            expect(spinner.show).toHaveBeenLastCalledWith('', 'globalSpinner');
            app.layoutPages = [];
            routerEvents.next(new NavigationStart(1, '/Page'));
            expect(spinner.show).toHaveBeenLastCalledWith('', 'globalSpinner');
            app.layoutPages = undefined;
            routerEvents.next(new NavigationStart(1, '/Page'));
            expect(spinner.show).toHaveBeenLastCalledWith('', 'globalSpinner');
        });

        it('resets layout info when navigating to the root', () => {
            app.activeLayoutName = 'L';
            app.layoutPages = ['x'];
            routerEvents.next(new NavigationStart(1, '/'));
            expect(app.activeLayoutName).toBe('');
            expect(app.layoutPages).toEqual([]);
        });

        it('finishes loading when the page is ready, once', () => {
            const el = outlet();
            routerEvents.next(new NavigationStart(1, '/Page'));
            managerHandlers['pageReady']();
            expect(spinner.hide).toHaveBeenCalledWith('sid');
            expect(mockRemoveClass).toHaveBeenCalledWith(el, 'page-load-in-progress');
            expect(typeof app.activePageLoadTime).toBe('number');
            managerHandlers['pageAttach']();
            expect(spinner.hide).toHaveBeenCalledTimes(1);
        });

        it('finishes loading without an outlet element', () => {
            routerEvents.next(new NavigationStart(1, '/Page'));
            managerHandlers['pageAttach']();
            expect(spinner.hide).toHaveBeenCalled();
            expect(mockRemoveClass).not.toHaveBeenCalled();
            expect(mockAddClass).not.toHaveBeenCalled();
        });

        it.each([
            ['NavigationEnd', () => new NavigationEnd(1, '/a', '/a')],
            ['NavigationCancel', () => new NavigationCancel(1, '/a', 'reason')],
            ['NavigationError', () => new NavigationError(1, '/a', new Error('x'))]
        ])('falls back to finishing loading 1s after %s', (_name, make) => {
            routerEvents.next(new NavigationStart(1, '/Page'));
            routerEvents.next(make());
            expect(spinner.hide).not.toHaveBeenCalled();
            jest.advanceTimersByTime(1000);
            expect(spinner.hide).toHaveBeenCalledWith('sid');
        });

        it('ignores other router events and tolerates finish callbacks before any navigation', () => {
            routerEvents.next({ type: 'other' });
            managerHandlers['pageReady']();
            expect(spinner.hide).not.toHaveBeenCalled();
        });
    });

    describe('ngAfterViewInit / start', () => {
        it('sets the document language and starts the app asynchronously', () => {
            comp.dynamicComponentContainerRef = 'vcr';
            comp.ngAfterViewInit();
            expect(document.documentElement.getAttribute('lang')).toBe('fr');
            expect(comp.startApp).toBe(false);
            jest.advanceTimersByTime(0);
            expect(comp.startApp).toBe(true);
            jest.advanceTimersByTime(10);
            expect(app.dynamicComponentContainerRef).toBe('vcr');
        });

        it('focuses the start element after navigation when skip-to-content is enabled', () => {
            comp.enableSkipToMainContent = true;
            const el = document.createElement('div');
            el.id = 'app-focus-start';
            el.tabIndex = -1;
            document.body.appendChild(el);
            const focus = jest.spyOn(el, 'focus');
            comp.ngAfterViewInit();
            routerEvents.next(new NavigationStart(1, '/x'));
            expect(focus).not.toHaveBeenCalled();
            routerEvents.next(new NavigationEnd(1, '/x', '/x'));
            expect(focus).toHaveBeenCalled();
            el.remove();
            expect(() => routerEvents.next(new NavigationEnd(2, '/y', '/y'))).not.toThrow();
        });

        it('does not subscribe to navigation when skip-to-content is disabled', () => {
            comp.ngAfterViewInit();
            expect((comp as any).navigationEndSubscription).toBeUndefined();
        });
    });

    describe('skipToAppContent', () => {
        beforeEach(() => {
            (HTMLElement.prototype as any).scrollIntoView = jest.fn();
        });

        it('focuses the content element', () => {
            const el = document.createElement('div');
            el.className = 'app-page-content';
            document.body.appendChild(el);
            const focus = jest.spyOn(el, 'focus');
            const event = { preventDefault: jest.fn() } as any;
            comp.skipToAppContent(event);
            expect(event.preventDefault).toHaveBeenCalled();
            expect(el.getAttribute('tabindex')).toBe('-1');
            expect(focus).toHaveBeenCalledWith({ preventScroll: false });
            expect((el as any).scrollIntoView).toHaveBeenCalledWith({ behavior: 'smooth' });
        });

        it('retries until the content appears', () => {
            const event = { preventDefault: jest.fn() } as any;
            comp.skipToAppContent(event);
            jest.advanceTimersByTime(250);
            const el = document.createElement('div');
            el.className = 'app-page-content';
            document.body.appendChild(el);
            const focus = jest.spyOn(el, 'focus');
            jest.advanceTimersByTime(100);
            expect(focus).toHaveBeenCalled();
        });

        it('gives up after 10 retries', () => {
            const spy = jest.spyOn(comp as any, 'tryFocusContent');
            comp.skipToAppContent({ preventDefault: jest.fn() } as any);
            jest.advanceTimersByTime(5000);
            expect(spy).toHaveBeenCalledTimes(11);
        });
    });

    describe('router outlet patching', () => {
        const makeOutlet = () => {
            const o: any = {
                attach: jest.fn(),
                detach: jest.fn(() => 'ref')
            };
            o.origAttach = o.attach;
            o.origDetach = o.detach;
            return o;
        };

        it('ignores an undefined outlet', () => {
            expect(() => { comp.routerOutlet = undefined; }).not.toThrow();
        });

        it('wraps attach to notify the component instance', () => {
            const o = makeOutlet();
            comp.routerOutlet = o;
            const instance = { ngOnAttach: jest.fn() };
            o.attach({ instance }, 'route');
            expect(o.origAttach).toHaveBeenCalledWith({ instance }, 'route');
            expect(instance.ngOnAttach).toHaveBeenCalled();
            o.attach({ instance: {} }, 'route');
            o.attach(null, 'route');
            expect(o.origAttach).toHaveBeenCalledTimes(3);
        });

        it('wraps detach to notify the active page', () => {
            const o = makeOutlet();
            comp.routerOutlet = o;
            app.activePage = { ngOnDetach: jest.fn() };
            expect(o.detach()).toBe('ref');
            expect(app.activePage.ngOnDetach).toHaveBeenCalled();
            app.activePage = {};
            expect(o.detach()).toBe('ref');
            app.activePage = undefined;
            expect(o.detach()).toBe('ref');
        });

        it('patches only once', () => {
            const o = makeOutlet();
            comp.routerOutlet = o;
            const patched = o.attach;
            comp.routerOutlet = o;
            expect(o.attach).toBe(patched);
        });
    });

    describe('lifecycle', () => {
        it('ngDoCheck triggers watchers', () => {
            comp.ngDoCheck();
            expect(mockInvokeWatchers).toHaveBeenCalled();
        });

        it('ngOnDestroy unsubscribes when subscribed and is safe otherwise', () => {
            expect(() => comp.ngOnDestroy()).not.toThrow();
            comp.enableSkipToMainContent = true;
            comp.ngAfterViewInit();
            const sub = (comp as any).navigationEndSubscription;
            const unsub = jest.spyOn(sub, 'unsubscribe');
            comp.ngOnDestroy();
            expect(unsub).toHaveBeenCalled();
        });
    });
});
