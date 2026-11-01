const mockProps: any = {};
const mockRegisterFn = jest.fn();
const mockMoment: any = { m: 1 };

jest.mock('moment-timezone/moment-timezone', () => ({ __esModule: true, default: mockMoment }));
jest.mock('@wm/core', () => ({
    ...jest.requireActual('@wm/core'),
    getWmProjectProperties: () => mockProps,
    registerFnByExpr: (...a) => mockRegisterFn(...a)
}));
jest.mock('@wm/security', () => ({ SecurityService: class SecurityService {} }));
jest.mock('./pipe.service', () => ({ PipeService: class PipeService {} }));
jest.mock('../util/wm-route-reuse-strategy', () => ({
    WmDefaultRouteReuseStrategy: class WmDefaultRouteReuseStrategy {
        reset = jest.fn();
    }
}));

import { AbstractDialogService, AbstractI18nService, Viewport } from '@wm/core';
import { MODE_CONSTANTS } from '@wm/variables';
import { WmDefaultRouteReuseStrategy } from '../util/wm-route-reuse-strategy';
import { AppRef } from './app.service';

describe('AppRef', () => {
    let inj: any, i18n: any, statePersistence: any, http: any, security: any;
    let routeReuse: any;
    let tokens: Map<any, any>;
    let unsub: jest.Mock;
    let app: AppRef;

    beforeEach(() => {
        jest.clearAllMocks();
        Object.keys(mockProps).forEach(k => delete mockProps[k]);
        Object.assign(mockProps, { name: 'Proj', type: 'APPLICATION', platformType: 'WEB', template: 'PRISM', homePage: 'Main' });

        tokens = new Map();
        inj = { get: jest.fn(t => tokens.get(t)) };
        i18n = {
            setSelectedLocale: jest.fn(),
            getSelectedLocale: jest.fn(() => 'en'),
            setTimezone: jest.fn(),
            setwidgetLocale: jest.fn(),
            getAppLocale: jest.fn(() => ({ L: 1 })),
            setTimezoneEarly: jest.fn(() => Promise.resolve('tz'))
        };
        statePersistence = {};
        unsub = jest.fn();
        http = {
            registerOnSessionTimeout: jest.fn(() => unsub),
            setLocale: jest.fn(),
            send: jest.fn(() => 'sent'),
            get: jest.fn(() => 'got'),
            post: jest.fn(() => 'posted')
        };
        security = { get: jest.fn(() => ({ userInfo: { userName: 'u' } })) };
        routeReuse = new (WmDefaultRouteReuseStrategy as any)();
        app = new AppRef(inj, i18n, statePersistence, http, security, routeReuse);
        document.documentElement.removeAttribute('data-theme');
        localStorage.clear();
    });

    afterEach(() => jest.restoreAllMocks());

    describe('construction', () => {
        it('reads project properties', () => {
            expect(app.projectName).toBe('Proj');
            expect(app.isApplicationType).toBe(true);
            expect(app.isPrefabType).toBe(false);
            expect(app.isTemplateBundleType).toBe(false);
            expect(app.targetPlatform).toBe('WEB');
            expect(app.isPrism).toBe(true);
            expect(app.landingPageName).toBe('Main');
            expect(app.appLocale).toEqual({ L: 1 });
            expect(http.setLocale).toHaveBeenCalledWith({ L: 1 });
        });

        it('detects prefab and template bundle types and non-PRISM templates', () => {
            Object.assign(mockProps, { type: 'PREFAB', template: 'OTHER' });
            let a = new AppRef(inj, i18n, statePersistence, http, security, routeReuse);
            expect(a.isPrefabType).toBe(true);
            expect(a.isPrism).toBe(false);
            mockProps.type = 'TEMPLATEBUNDLE';
            a = new AppRef(inj, i18n, statePersistence, http, security, routeReuse);
            expect(a.isTemplateBundleType).toBe(true);
        });

        it('binds i18n helpers', () => {
            app.changeLocale('fr');
            expect(i18n.setSelectedLocale).toHaveBeenCalledWith('fr');
            expect(app.getSelectedLocale()).toBe('en');
            app.setTimezone({ t: 1 });
            expect(i18n.setTimezone).toHaveBeenCalledWith({ t: 1 });
            app.setwidgetLocale({ n: 1 });
            expect(i18n.setwidgetLocale).toHaveBeenCalledWith({ n: 1 });
        });

        it('default lifecycle callbacks are no-ops', () => {
            [app.onAppVariablesReady, app.onBeforeAppReady, app.onSessionTimeout, app.onPageReady,
                app.onBeforePageLeave, app.onBeforeServiceCall, app.onServiceSuccess, app.onServiceError]
                .forEach(fn => expect((fn as any)(1, 2)).toBeUndefined());
        });

        it('reload delegates to window.location.reload (not implemented in jsdom)', () => {
            jest.spyOn(console, 'error').mockImplementation(() => {});
            expect(() => app.reload()).not.toThrow();
        });
    });

    describe('clearPageCache', () => {
        it('resets the default reuse strategy', () => {
            app.clearPageCache('P');
            expect(routeReuse.reset).toHaveBeenCalledWith('P');
        });

        it('ignores other reuse strategies', () => {
            const other: any = { reset: jest.fn() };
            const a = new AppRef(inj, i18n, statePersistence, http, security, other);
            a.clearPageCache();
            expect(other.reset).not.toHaveBeenCalled();
        });
    });

    describe('events', () => {
        it('notify and subscribe go through the event notifier', () => {
            const cb = jest.fn();
            const off = app.subscribe('evt', cb);
            app.notify('evt', 1, 2);
            expect(cb).toHaveBeenCalledWith(1, 2);
            off();
            app.notify('evt', 3);
            expect(cb).toHaveBeenCalledTimes(1);
        });
    });

    describe('importModule', () => {
        it('returns moment, loads moment tz data, or undefined', async () => {
            expect(app.importModule('moment')).toBe(mockMoment);
            await expect(app.importModule('moment-tz-data')).resolves.toBe('tz');
            expect(app.importModule('other')).toBeUndefined();
        });
    });

    describe('getDependency', () => {
        it('maps known string tokens to injector lookups', () => {
            const dialog = { d: 1 };
            const vp = { v: 1 };
            tokens.set(AbstractDialogService, dialog);
            tokens.set(Viewport, vp);
            expect(app.getDependency('DialogService')).toBe(dialog);
            expect(app.getDependency('Viewport')).toBe(vp);
        });

        it('returns non-string tokens straight from the injector', () => {
            const t = class T {};
            tokens.set(t, 'inst');
            expect(app.getDependency(t)).toBe('inst');
        });

        it('wraps the http service for "HttpService"', async () => {
            const $http: any = app.getDependency('HttpService');
            await expect($http({ url: 'x' })).resolves.toBe('sent');
            expect(http.send).toHaveBeenCalledWith({ url: 'x' });
            await expect($http.get('/u', { o: 1 })).resolves.toBe('got');
            expect(http.get).toHaveBeenCalledWith('/u', { o: 1 });
            await expect($http.post('/u', 'd')).resolves.toBe('posted');
            ['head', 'put', 'delete', 'jsonp', 'patch'].forEach(k => expect(typeof $http[k]).toBe('function'));
        });

        it('finds services by SERVICE_NAME in the injector records', () => {
            class Svc { static readonly SERVICE_NAME = 'MySvc'; }
            class Other { static readonly SERVICE_NAME = 'Other'; }
            const svc = new Svc();
            inj.records = new Map<any, any>([
                ['a', { value: null }],
                ['b', undefined],
                ['c', { value: new Other() }],
                ['d', { value: svc }]
            ]);
            expect(app.getDependency('MySvc')).toBe(svc);
        });

        it('returns undefined when records do not contain the service', () => {
            inj.records = new Map<any, any>([['a', { value: {} }]]);
            expect(app.getDependency('Nope')).toBeUndefined();
        });

        it('returns undefined when the injector has no records', () => {
            expect(app.getDependency('Nope')).toBeUndefined();
            inj.records = {};
            expect(app.getDependency('Nope')).toBeUndefined();
        });

        it('returns the resolved provider when the token is mapped', () => {
            tokens.set(AbstractI18nService, i18n);
            expect(app.getDependency('i18nService')).toBe(i18n);
        });
    });

    describe('on401', () => {
        it('fires onSessionTimeout only when a previous user exists', () => {
            const cb = jest.fn();
            app.onSessionTimeout = cb;
            app.on401();
            expect(cb).toHaveBeenCalledTimes(1);
            security.get.mockReturnValue({ userInfo: {} });
            app.on401();
            security.get.mockReturnValue(undefined);
            app.on401();
            expect(cb).toHaveBeenCalledTimes(1);
        });

        it('is registered with the http service', () => {
            const cb = jest.fn();
            app.onSessionTimeout = cb;
            http.registerOnSessionTimeout.mock.calls[0][0]();
            expect(cb).toHaveBeenCalledTimes(1);
        });
    });

    describe('notifyApp', () => {
        let action: any;
        beforeEach(() => {
            action = { getMessage: jest.fn(() => ''), invoke: jest.fn() };
            app.Actions.appNotification = action;
            jest.spyOn(console, 'warn').mockImplementation(() => {});
        });

        it('warns when the appNotification action is missing', () => {
            delete app.Actions.appNotification;
            app.notifyApp('m', 'error', 't');
            expect(console.warn).toHaveBeenCalledWith('The default Action "appNotification" doesn\'t exist in the app. App notified following error:\n', 'm');
        });

        it('skips excluded messages with a console warning', () => {
            app.notifyApp('PROCESS_REJECTED_IN_QUEUE', 'error', undefined);
            expect(action.invoke).not.toHaveBeenCalled();
            expect(console.warn).toHaveBeenCalledWith('App Error', 'PROCESS_REJECTED_IN_QUEUE');
        });

        it('defaults to a success notification and upper-cased title', () => {
            app.notifyApp('hello', undefined, undefined);
            expect(action.invoke).toHaveBeenCalledWith({ message: 'hello', title: 'SUCCESS', class: 'success', duration: undefined });
        });

        it('uses the action message, a given title, and a sticky duration for errors', () => {
            action.getMessage.mockReturnValue('custom');
            app.notifyApp('hello', 'error', 'Title');
            expect(action.invoke).toHaveBeenCalledWith({ message: 'custom', title: 'Title', class: 'error', duration: 0 });
        });
    });

    describe('registerExpressions / hasOwnObjectProperty', () => {
        it('registers each expression function', () => {
            const fn = () => 1;
            app.registerExpressions({ 'a+b': [fn, 'x'] });
            expect(mockRegisterFn).toHaveBeenCalledWith('a+b', fn, 'x');
        });

        it('checks own properties safely', () => {
            expect(app.hasOwnObjectProperty({ a: 1 }, 'a')).toBe(true);
            expect(app.hasOwnObjectProperty({ a: 1 }, 'b')).toBe(false);
            expect(app.hasOwnObjectProperty(null, 'a')).toBe(false);
            expect(app.hasOwnObjectProperty('str' as any, 'length')).toBe(false);
        });
    });

    describe('setMode', () => {
        const html = () => document.documentElement;

        it('sets non-default modes and removes default/light ones', () => {
            html().setAttribute('data-old', 'x');
            app.setMode({ 'data-theme': 'dark', 'data-old': MODE_CONSTANTS.LIGHT, 'data-other': MODE_CONSTANTS.DEFAULT });
            expect(html().getAttribute('data-theme')).toBe('dark');
            expect(html().hasAttribute('data-old')).toBe(false);
            expect(html().hasAttribute('data-other')).toBe(false);
            expect(localStorage.getItem('wm-app-modes')).toBeNull();
            html().removeAttribute('data-theme');
        });

        it('persists modes when requested', () => {
            app.setMode({ 'data-theme': 'dark' }, true);
            expect(JSON.parse(localStorage.getItem('wm-app-modes'))).toEqual({ 'data-theme': 'dark' });
            html().removeAttribute('data-theme');
        });

        it('does nothing for invalid or empty modes', () => {
            app.setMode(null, true);
            app.setMode({}, true);
            app.setMode('str' as any, true);
            expect(localStorage.getItem('wm-app-modes')).toBeNull();
        });

        it('does nothing when there is no html element', () => {
            jest.spyOn(document, 'getElementsByTagName').mockReturnValue([] as any);
            app.setMode({ 'data-theme': 'dark' }, true);
            expect(localStorage.getItem('wm-app-modes')).toBeNull();
        });
    });

    describe('ngOnDestroy', () => {
        it('releases everything', () => {
            app.ngOnDestroy();
            expect(unsub).toHaveBeenCalled();
            expect(app.Variables).toBeNull();
            expect(app.Actions).toBeNull();
            expect(app.appLocale).toBeNull();
            expect(app.modes).toBeNull();
            expect(app.dynamicComponentContainerRef).toBeNull();
        });

        it('is safe to call twice', () => {
            app.ngOnDestroy();
            expect(() => app.ngOnDestroy()).not.toThrow();
        });
    });
});
