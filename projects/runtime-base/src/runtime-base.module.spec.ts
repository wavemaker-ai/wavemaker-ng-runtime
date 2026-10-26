declare const $;
($ as any).fn.swipeAnimation = ($ as any).fn.swipeAnimation || {};

jest.mock('@wm/transpiler', () => ({ transpile: jest.fn(), scopeComponentStyles: jest.fn() }));
jest.mock('@wm/build-task', () => ({ initComponentsBuildTask: jest.fn() }));

import { APP_INITIALIZER, LOCALE_ID } from '@angular/core';
import { HTTP_INTERCEPTORS } from '@angular/common/http';

import { _WM_APP_PROJECT, App, AbstractI18nService, $parseExpr } from '@wm/core';
import {
    InitializeApp,
    REQUIRED_MODULES_FOR_DYNAMIC_COMPONENTS,
    RuntimeBaseModule,
    WM_MODULES_FOR_ROOT,
    getSettingProvider,
    setAngularLocale
} from './runtime-base.module';
import { AppJSResolve } from './resolves/app-js.resolve';
import { HttpCallInterceptor } from './services/http-interceptor.services';
import { MAX_CACHE_AGE, MAX_CACHE_SIZE } from './util/wm-route-reuse-strategy';

const setMeta = (name: string, content: string) => {
    const meta = document.createElement('meta');
    meta.setAttribute('name', name);
    meta.setAttribute('content', content);
    document.head.appendChild(meta);
};

describe('runtime-base.module', () => {
    const original = { ..._WM_APP_PROJECT };

    afterEach(() => {
        document.head.querySelectorAll('meta').forEach(m => m.remove());
        Object.keys(_WM_APP_PROJECT).forEach(k => delete (_WM_APP_PROJECT as any)[k]);
        Object.assign(_WM_APP_PROJECT, original);
    });

    it('wires $parseExpr as the swipe animation expression evaluator', () => {
        expect(($ as any).fn.swipeAnimation.expressionEvaluator).toBe($parseExpr);
    });

    it('exposes the modules required for dynamic components and an empty root list', () => {
        expect(REQUIRED_MODULES_FOR_DYNAMIC_COMPONENTS.length).toBeGreaterThan(0);
        expect(WM_MODULES_FOR_ROOT).toEqual([]);
    });

    describe('getSettingProvider', () => {
        it('builds a value provider', () => {
            expect(getSettingProvider('key', 5)).toEqual({ provide: 'key', useValue: 5 });
        });
    });

    describe('InitializeApp', () => {
        it('resolves app.js, loads the default locale and sets up project details for a deployed app', async () => {
            setMeta('deployUrl', 'https://cdn/');
            setMeta('apiUrl', 'https://api/');
            const i18n = { loadDefaultLocale: jest.fn(() => Promise.resolve('loaded')) };
            const appJs = { resolve: jest.fn(() => Promise.resolve()) };

            await expect(InitializeApp(i18n, appJs)()).resolves.toBe('loaded');

            expect(appJs.resolve).toHaveBeenCalled();
            expect(_WM_APP_PROJECT.isPreview).toBe(false);
            expect(_WM_APP_PROJECT.cdnUrl).toBe('https://cdn/');
            expect(_WM_APP_PROJECT.apiUrl).toBe('https://api/');
            expect(_WM_APP_PROJECT.ngDest).toBe('ng-bundle/');
            expect(_WM_APP_PROJECT.id).toBe(location.href.split('/')[3]);
        });

        it('uses the preview cdn url when no deploy url is present', async () => {
            setMeta('cdnUrl', 'https://preview-cdn/');
            const i18n = { loadDefaultLocale: jest.fn(() => Promise.resolve()) };
            await InitializeApp(i18n, { resolve: jest.fn(() => Promise.resolve()) })();
            expect(_WM_APP_PROJECT.isPreview).toBe(true);
            expect(_WM_APP_PROJECT.cdnUrl).toBe('https://preview-cdn/');
            expect(_WM_APP_PROJECT.apiUrl).toBe('./');
        });

        it('falls back to defaults without any meta tags', async () => {
            const i18n = { loadDefaultLocale: jest.fn(() => Promise.resolve()) };
            await InitializeApp(i18n, { resolve: jest.fn(() => Promise.resolve()) })();
            expect(_WM_APP_PROJECT.cdnUrl).toBe('ng-bundle/');
            expect(_WM_APP_PROJECT.apiUrl).toBe('./');
        });
    });

    describe('setAngularLocale', () => {
        it('initialises project details and returns the deduced locale', () => {
            const i18n = { deduceAppLocale: jest.fn(() => 'fr') };
            expect(setAngularLocale(i18n)).toBe('fr');
            expect(_WM_APP_PROJECT.cdnUrl).toBe('ng-bundle/');
        });
    });

    describe('addCustomEventPolyfill', () => {
        it('does nothing when CustomEvent is already supported', () => {
            expect(RuntimeBaseModule.addCustomEventPolyfill()).toBe(false);
        });

        it('installs a CustomEvent polyfill when it is missing', () => {
            const native = window['CustomEvent'];
            try {
                window['CustomEvent'] = undefined;
                RuntimeBaseModule.addCustomEventPolyfill();
                const polyfill = window['CustomEvent'];
                expect(typeof polyfill).toBe('function');
                expect(polyfill).not.toBe(native);
                const evt = (polyfill as any)('x', { detail: 1, bubbles: true });
                expect(evt.type).toBe('x');
                expect(evt.detail).toBe(1);
                const plain = (polyfill as any)('y');
                expect(plain.type).toBe('y');
            } finally {
                window['CustomEvent'] = native;
            }
        });
    });

    describe('forRoot', () => {
        it('provides the app services, initializer, locale and interceptor', () => {
            const mod = RuntimeBaseModule.forRoot();
            expect(mod.ngModule).toBe(RuntimeBaseModule);
            const providers = mod.providers as any[];

            const byToken = (t: any) => providers.find(p => p && p.provide === t);
            expect(byToken(App)).toBeDefined();
            expect(byToken(AbstractI18nService)).toBeDefined();
            expect(byToken(APP_INITIALIZER)).toEqual(expect.objectContaining({ multi: true, useFactory: InitializeApp, deps: [AbstractI18nService, AppJSResolve] }));
            expect(byToken(LOCALE_ID)).toEqual(expect.objectContaining({ useFactory: setAngularLocale }));
            expect(byToken(HTTP_INTERCEPTORS)).toEqual(expect.objectContaining({ useClass: HttpCallInterceptor, multi: true }));
            expect(byToken(MAX_CACHE_SIZE)).toEqual({ provide: MAX_CACHE_SIZE, useValue: 10 });
            expect(byToken(MAX_CACHE_AGE)).toEqual({ provide: MAX_CACHE_AGE, useValue: 30 * 60 });
        });
    });

    describe('constructor', () => {
        const create = async () => {
            const app: any = { notify: jest.fn() };
            const viewport: any = { update: jest.fn() };
            new RuntimeBaseModule(app, viewport);
            await new Promise(r => setTimeout(r));
            return { app, viewport };
        };

        it('defaults to Android when not on an iOS device', async () => {
            const { app, viewport } = await create();
            expect(app.selectedViewPort.os).toBe('android');
            expect(viewport.update).toHaveBeenCalledWith({ os: 'android' });
            expect(app.notify).toHaveBeenCalledWith('on-viewport-details', 'android');
        });

        it('detects iPadOS (touch-capable Mac platform)', async () => {
            Object.defineProperty(window.navigator, 'maxTouchPoints', { value: 5, configurable: true });
            const platform = jest.spyOn(window.navigator, 'platform', 'get').mockReturnValue('MacIntel');
            try {
                const { app } = await create();
                expect(app.selectedViewPort.os).toBe('ios');
            } finally {
                delete (window.navigator as any).maxTouchPoints;
                platform.mockRestore();
            }
        });
    });

    describe('getDeviceDetails', () => {
        const getDeviceDetails = (win?: any) => (RuntimeBaseModule.prototype as any).getDeviceDetails.call({}, win);

        it('reports the preview window as ready and resolves the device it switches to', async () => {
            const top = { postMessage: jest.fn() };
            const framed: any = { top };
            const promise = getDeviceDetails(framed);
            expect(top.postMessage).toHaveBeenCalledWith({ key: 'on-load' }, '*');
            framed.onmessage({ data: 'not an object' });
            framed.onmessage({ data: { key: 'other' } });
            framed.onmessage({ data: { key: 'switch-device', device: { os: 'ios' } } });
            await expect(promise).resolves.toEqual({ os: 'ios' });
        });

        it('identifies the OS when the app is not framed', async () => {
            const own: any = {};
            own.top = own;
            await expect(getDeviceDetails(own)).resolves.toEqual({ os: expect.any(String) });
        });
    });
});
