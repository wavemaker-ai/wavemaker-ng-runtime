declare const $;
($ as any).fn.swipeAnimation = ($ as any).fn.swipeAnimation || {};

jest.mock('@wm/transpiler', () => ({ transpile: jest.fn(), scopeComponentStyles: jest.fn() }));
jest.mock('@wm/build-task', () => ({ initComponentsBuildTask: jest.fn() }));
jest.mock('@wavemaker-ai/custom-widgets-m3', () => ({}), { virtual: true });

import { TestBed } from '@angular/core/testing';
import { APP_INITIALIZER, LOCALE_ID, RendererFactory2 } from '@angular/core';
import { HTTP_INTERCEPTORS, HttpXhrBackend } from '@angular/common/http';
import { XhrFactory } from '@angular/common';

import { _WM_APP_PROJECT, App } from '@wm/core';
import { HttpCallInterceptor, WMDomRendererFactory2 } from '@wm/runtime/base';
import { InitializeApp, appConfig, initializeProjectDetails, setAngularLocale, xsrfHeaderName } from './app.config';

const setMeta = (name: string, content: string) => {
    const meta = document.createElement('meta');
    meta.setAttribute('name', name);
    meta.setAttribute('content', content);
    document.head.appendChild(meta);
};

describe('app.config', () => {
    const original = { ..._WM_APP_PROJECT };

    afterEach(() => {
        document.head.querySelectorAll('meta').forEach(m => m.remove());
        Object.keys(_WM_APP_PROJECT).forEach(k => delete (_WM_APP_PROJECT as any)[k]);
        Object.assign(_WM_APP_PROJECT, original);
    });

    it('uses the default xsrf header name', () => {
        expect(xsrfHeaderName).toBe('X-WM-XSRF-TOKEN');
    });

    describe('initializeProjectDetails', () => {
        it('treats a deploy url as a deployed (non-preview) app', () => {
            setMeta('deployUrl', 'https://cdn/');
            setMeta('apiUrl', 'https://api/');
            initializeProjectDetails();
            expect(_WM_APP_PROJECT.isPreview).toBe(false);
            expect(_WM_APP_PROJECT.cdnUrl).toBe('https://cdn/');
            expect(_WM_APP_PROJECT.apiUrl).toBe('https://api/');
            expect(_WM_APP_PROJECT.ngDest).toBe('ng-bundle/');
            expect(_WM_APP_PROJECT.id).toBe(location.href.split('/')[3]);
        });

        it('uses the preview cdn url when there is no deploy url', () => {
            setMeta('cdnUrl', 'https://preview/');
            initializeProjectDetails();
            expect(_WM_APP_PROJECT.isPreview).toBe(true);
            expect(_WM_APP_PROJECT.cdnUrl).toBe('https://preview/');
        });

        it('falls back to defaults without meta tags', () => {
            initializeProjectDetails();
            expect(_WM_APP_PROJECT.apiUrl).toBe('./');
            expect(_WM_APP_PROJECT.cdnUrl).toBe('ng-bundle/');
        });
    });

    describe('InitializeApp', () => {
        it('runs the resolvers in order and finishes with the before-load resolve', async () => {
            const order: string[] = [];
            const step = (name: string, result?: any) => ({ resolve: jest.fn(async () => { order.push(name); return result; }) });
            const appJs = step('appJs');
            const vars = step('vars');
            const ext = step('ext');
            const before = step('before', 'done');
            const i18n = { loadDefaultLocale: jest.fn(async () => { order.push('i18n'); }) };

            await expect(InitializeApp(i18n, appJs, before, vars, ext, {})()).resolves.toBe('done');
            expect(order).toEqual(['appJs', 'vars', 'ext', 'i18n', 'before']);
            expect(_WM_APP_PROJECT.cdnUrl).toBe('ng-bundle/');
        });
    });

    describe('setAngularLocale', () => {
        it('returns the deduced app locale', () => {
            expect(setAngularLocale({ deduceAppLocale: () => 'de' })).toBe('de');
        });
    });

    describe('appConfig', () => {
        const providers = appConfig.providers as any[];
        const find = (token: any) => providers.find(p => p && p.provide === token);

        it('wires the renderer, app, interceptor, initializer and locale providers', () => {
            expect(providers.length).toBeGreaterThan(40);
            expect(find(RendererFactory2).useClass).toBe(WMDomRendererFactory2);
            expect(find(App)).toBeDefined();
            expect(find(HTTP_INTERCEPTORS)).toEqual(expect.objectContaining({ useClass: HttpCallInterceptor, multi: true }));
            expect(find(APP_INITIALIZER)).toEqual(expect.objectContaining({ useFactory: InitializeApp, multi: true }));
            expect(find(LOCALE_ID)).toEqual(expect.objectContaining({ useFactory: setAngularLocale }));
        });

        it('builds an XHR backend from the WM xhr factory', () => {
            const backendProvider = find(HttpXhrBackend);
            expect(TestBed.runInInjectionContext(() => backendProvider.useFactory())).toBeInstanceOf(HttpXhrBackend);
            expect(find(XhrFactory).useValue.build()).toBeInstanceOf(XMLHttpRequest);
        });
    });
});
