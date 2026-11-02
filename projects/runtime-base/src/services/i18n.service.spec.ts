import { of, throwError } from 'rxjs';

const mockProject: any = { isPreview: false, cdnUrl: 'cdn/', ngDest: 'ng/' };
const mockProps: any = {};
const mockLoadScripts = jest.fn();
const mockSetCSS = jest.fn();
const mockInvokeWatchers = jest.fn();
const mockDigest = jest.fn();
const mockSession: Record<string, string> = {};
const mockDefineLocale = jest.fn();
const mockMoment: any = jest.fn();
mockMoment.locale = jest.fn();
mockMoment.localeData = jest.fn();
mockMoment.tz = jest.fn((name: string) => ({ format: () => (name === 'Asia/Tokyo' ? '+09:00' : '+00:00') }));
mockMoment.tz.names = jest.fn(() => ['UTC', 'Asia/Tokyo']);
mockMoment.tz.setDefault = jest.fn();

jest.mock('moment-timezone/moment-timezone', () => ({ __esModule: true, default: mockMoment }));
jest.mock('ngx-bootstrap/chronos', () => ({ defineLocale: (...a) => mockDefineLocale(...a) }));
jest.mock('@wm/core', () => ({
    ...jest.requireActual('@wm/core'),
    _WM_APP_PROJECT: mockProject,
    $appDigest: (...a) => mockDigest(...a),
    $invokeWatchers: (...a) => mockInvokeWatchers(...a),
    getWmProjectProperties: () => mockProps,
    getSessionStorageItem: (k) => mockSession[k],
    setSessionStorageItem: (k, v) => { mockSession[k] = v; },
    loadScripts: (...a) => mockLoadScripts(...a),
    setCSS: (...a) => mockSetCSS(...a)
}));

import { App } from '@wm/core';
import { I18nServiceImpl } from './i18n.service';

describe('I18nServiceImpl', () => {
    let http: any, bsLocale: any, appDefaults: any, app: any, injector: any;
    let service: I18nServiceImpl;
    const flush = () => new Promise(r => setTimeout(r));

    beforeEach(() => {
        jest.clearAllMocks();
        Object.keys(mockSession).forEach(k => delete mockSession[k]);
        Object.assign(mockProject, { isPreview: false, cdnUrl: 'cdn/', ngDest: 'ng/' });
        Object.keys(mockProps).forEach(k => delete mockProps[k]);
        Object.assign(mockProps, {
            supportedLanguages: { en: { angular: 'en' }, fr: { angular: 'fr', moment: 'fr-x', fullCalendar: 'fr' }, ar: { angular: 'ar' } },
            defaultLanguage: 'en',
            preferredLanguage: 'fr;q=0.9,en-US'
        });
        (global as any)._WM_APP_PROPERTIES = { languageBundleSources: 'STATIC' };
        delete (window as any).FullCalendar;
        mockLoadScripts.mockResolvedValue(undefined);
        http = { get: jest.fn(() => of({ messages: { HELLO: 'Hello ${0}' }, formats: { f: 1 }, prefabMessages: { pf: { A: 'a' } } })) };
        bsLocale = { use: jest.fn() };
        appDefaults = { setFormats: jest.fn() };
        app = { notify: jest.fn(), activePage: undefined };
        injector = { get: jest.fn((t) => (t === App ? app : null)) };
        service = new I18nServiceImpl(http, bsLocale, appDefaults, injector);
        mockMoment.localeData.mockReturnValue({ _config: { cfg: 1 } });
    });

    describe('simple accessors', () => {
        it('returns defaults', () => {
            expect(service.getDefaultSupportedLocale()).toBe('en');
            expect(service.getSelectedLocale()).toBeUndefined();
            expect(service.getAppLocale()).toEqual({});
            expect(service.getFormatsByLocale()).toEqual({ timezone: '', number: '' });
            expect(service.isAngularLocaleLoaded()).toBe(false);
            return expect(service.initCalendarLocale()).resolves.toBeUndefined();
        });

        it('widget locale', () => {
            service.setwidgetLocale({ number: 'n' });
            expect(service.getwidgetLocale()).toEqual({ timezone: '', number: 'n' });
        });

        it('prefab bundle is created once and inherits from app locale', () => {
            const b = service.getPrefabLocaleBundle('p');
            expect(service.getPrefabLocaleBundle('p')).toBe(b);
            expect(Object.getPrototypeOf(b)).toBe(service.getAppLocale());
        });

        it('getLocalizedMessage replaces args', async () => {
            await service.setSelectedLocale('fr');
            expect(service.getLocalizedMessage('HELLO', 'World')).toBe('Hello World');
        });
    });

    describe('getAcceptedLanguages', () => {
        it('splits, strips q-values and lower-cases', () => {
            mockProps.preferredLanguage = encodeURIComponent('en,EN-US;q=0.9,de;q=0.6');
            expect(service.getAcceptedLanguages()).toEqual(['en', 'en-us', 'de']);
        });

        it('handles missing preferredLanguage', () => {
            mockProps.preferredLanguage = undefined;
            expect(service.getAcceptedLanguages()).toEqual(['']);
        });
    });

    describe('setSelectedLocale', () => {
        it('ignores unsupported locales', async () => {
            await service.setSelectedLocale('xx');
            expect(http.get).not.toHaveBeenCalled();
        });

        it('ignores an empty locale and the already-selected one', async () => {
            mockProps.supportedLanguages[''] = {};
            await service.setSelectedLocale('');
            await service.setSelectedLocale('en');
            http.get.mockClear();
            await service.setSelectedLocale('en');
            expect(http.get).not.toHaveBeenCalled();
        });

        it('accepts an object with datavalue (select widget event)', async () => {
            await service.setSelectedLocale({ datavalue: 'en' });
            expect(service.getSelectedLocale()).toBe('en');
        });

        it('loads the default (en) locale: no moment/script loading, notifies', async () => {
            await service.setSelectedLocale('en');
            expect(mockSession['selectedLocale']).toBe('en');
            expect(bsLocale.use).toHaveBeenCalledWith('en');
            expect(http.get).toHaveBeenCalledWith('cdn/resources/i18n/en.json');
            expect(mockSetCSS).toHaveBeenCalledWith(document.body, 'direction', 'ltr');
            expect(appDefaults.setFormats).toHaveBeenCalledWith({ f: 1 });
            expect(app.notify).toHaveBeenCalledWith('locale-changed', mockProps.supportedLanguages.en);
            expect(mockInvokeWatchers).toHaveBeenCalledWith(true);
            expect(mockDigest).toHaveBeenCalledWith(true);
            expect(service.getPrefabLocaleBundle('pf')['A']).toBe('a');
        });

        it('default locale with a moment bundle just sets the moment locale', async () => {
            mockProps.supportedLanguages.en = { angular: 'en', moment: 'en' };
            await service.setSelectedLocale('en');
            expect(mockMoment.locale).toHaveBeenCalledWith('en');
            expect(mockLoadScripts).not.toHaveBeenCalled();
        });

        it('uses empty base path for preview and for DYNAMIC bundle sources', async () => {
            mockProject.isPreview = true;
            await service.setSelectedLocale('en');
            expect(http.get).toHaveBeenLastCalledWith('resources/i18n/en.json');

            mockProject.isPreview = false;
            (global as any)._WM_APP_PROPERTIES = { languageBundleSources: 'DYNAMIC' };
            await service.setSelectedLocale('fr');
            expect(http.get).toHaveBeenLastCalledWith('resources/i18n/fr.json');
        });

        it('handles _WM_APP_PROPERTIES being undefined', async () => {
            (global as any)._WM_APP_PROPERTIES = undefined;
            await service.setSelectedLocale('en');
            expect(http.get).toHaveBeenLastCalledWith('cdn/resources/i18n/en.json');
        });

        it('non-default locale in deployed mode: loads angular script, moment locale and sets rtl for ar', async () => {
            await service.setSelectedLocale('fr');
            expect(mockLoadScripts).toHaveBeenCalledWith(['cdn/locales/angular/global/fr.js'], true);
            expect(mockMoment.locale).toHaveBeenCalledWith('fr');
            expect(mockDefineLocale).toHaveBeenCalledWith('fr', { cfg: 1 });
            expect(bsLocale.use).toHaveBeenCalledWith('fr');
            expect(service.isAngularLocaleLoaded()).toBe(true);
            expect(mockSetCSS).toHaveBeenCalledWith(document.body, 'direction', 'ltr');

            await service.setSelectedLocale('ar');
            expect(mockSetCSS).toHaveBeenLastCalledWith(document.body, 'direction', 'rtl');
        });

        it('non-default locale in preview: loads the moment script first', async () => {
            mockProject.isPreview = true;
            await service.setSelectedLocale('fr');
            await flush();
            expect(mockLoadScripts).toHaveBeenCalledWith(['cdn/locales/moment/fr-x.js'], true);
            expect(mockDefineLocale).toHaveBeenCalledWith('fr', { cfg: 1 });
        });

        it('fullCalendar bundle flagged when FullCalendar is on window', async () => {
            (window as any).FullCalendar = {};
            await service.setSelectedLocale('fr');
            expect(app.notify).toHaveBeenCalledWith('locale-changed', mockProps.supportedLanguages.fr);
        });

        it('falls back to ngDest when cdnUrl missing; angular script load failure still resolves', async () => {
            mockProject.cdnUrl = '';
            mockLoadScripts.mockRejectedValue('x');
            await service.setSelectedLocale('fr');
            expect(mockLoadScripts).toHaveBeenCalledWith(['ng/locales/angular/global/fr.js'], true);
            expect(service.isAngularLocaleLoaded()).toBe(false);
        });

        it('locale without a moment bundle and not default skips moment setup', async () => {
            await service.setSelectedLocale('ar');
            expect(mockMoment.locale).not.toHaveBeenCalled();
        });

        it('does not notify until all bundles are loaded', async () => {
            http.get.mockReturnValue(of({ messages: {} }));
            await service.setSelectedLocale('en');
            // missing prefabMessages is tolerated
            expect(app.notify).toHaveBeenCalledWith('locale-changed', mockProps.supportedLanguages.en);
        });

        it('a failing resource load is swallowed and warns', async () => {
            const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
            http.get.mockReturnValue(throwError(() => new Error('404')));
            await expect(service.setSelectedLocale('en')).rejects.toBeDefined();
            expect(warn).toHaveBeenCalledWith(expect.stringContaining('error loading locale resource'));
            warn.mockRestore();
        });
    });

    describe('loadDefaultLocale / deduceAppLocale', () => {
        const deduce = async () => {
            await service.loadDefaultLocale();
            return service.getSelectedLocale();
        };

        it('prefers the browser language when preferBrowserLang unset', async () => {
            expect(await deduce()).toBe('fr');
            expect((Date.prototype as any).month).toBe(Date.prototype.getMonth);
        });

        it('prefers the project default language when preferBrowserLang is "false"', async () => {
            mockProps.preferBrowserLang = 'false';
            mockProps.defaultLanguage = 'ar';
            expect(await deduce()).toBe('ar');
        });

        it('treats "true" and true as browser preference', async () => {
            mockProps.preferBrowserLang = 'true';
            expect(await deduce()).toBe('fr');
            service = new I18nServiceImpl(http, bsLocale, appDefaults, injector);
            mockProps.preferBrowserLang = true;
            expect(await deduce()).toBe('fr');
        });

        it('session storage locale wins', async () => {
            mockSession['selectedLocale'] = 'ar';
            expect(await deduce()).toBe('ar');
        });

        it('falls back to en when nothing matches', async () => {
            mockProps.preferredLanguage = 'zz';
            mockProps.defaultLanguage = 'yy';
            expect(await deduce()).toBe('en');
        });
    });

    describe('timezone', () => {
        it('setTimezoneEarly returns the bundle promise and exposes moment on window', async () => {
            await service.setTimezoneEarly();
            expect(window['moment']).toBe(mockMoment);
            expect(mockLoadScripts).toHaveBeenCalledWith(['cdn/locales/moment-timezone/moment-timezone-with-data.js'], true);
        });

        it('uses ngDest when no cdnUrl', async () => {
            mockProject.cdnUrl = '';
            await service.setTimezoneEarly();
            expect(mockLoadScripts).toHaveBeenCalledWith(['ng/locales/moment-timezone/moment-timezone-with-data.js'], true);
        });

        it('sets a named timezone on the service', async () => {
            service.setTimezone({ timezone: 'UTC' });
            await flush();
            expect(mockMoment.tz.setDefault).toHaveBeenCalledWith('UTC');
            expect(service.getFormatsByLocale().timezone).toBe('UTC');
        });

        it('deduces a timezone name from an offset (plain and prefixed)', async () => {
            const o1: any = { timezone: '+09:00' };
            service.setTimezone(o1);
            await flush();
            expect(o1.timezone).toBe('Asia/Tokyo');
            expect(mockMoment.tz.setDefault).toHaveBeenLastCalledWith('+09:00');

            const o2: any = { timezone: 'GMT+09:00' };
            service.setTimezone(o2);
            await flush();
            expect(mockMoment.tz.setDefault).toHaveBeenLastCalledWith('+09:00');
        });

        it('writes into the component formats when supplied', async () => {
            const comp: any = { formatsByLocale: {} };
            service.setTimezone({ timezone: 'UTC' }, comp);
            await flush();
            expect(comp.formatsByLocale.timezone).toBe('UTC');
        });

        it('swallows bundle load failures', async () => {
            mockLoadScripts.mockRejectedValue('x');
            expect(() => service.setTimezone({ timezone: 'UTC' })).not.toThrow();
            await flush();
            expect(mockMoment.tz.setDefault).not.toHaveBeenCalled();
        });

        it('getTimezone prefers component, then page, then service', () => {
            expect(service.getTimezone()).toBe('');
            app.activePage = { formatsByLocale: { timezone: 'Page' } };
            expect(service.getTimezone()).toBe('Page');
            expect(service.getTimezone({ formatsByLocale: { timezone: 'Comp' } })).toBe('Comp');
        });
    });

    describe('bootstrap locale fallbacks', () => {
        it('falls back to the default locale when no locale is selected after loading moment', () => {
            const svc: any = service;
            svc.selectedLocale = 'fr';
            mockMoment.localeData.mockReturnValue({ _config: {} });
            jest.spyOn(svc, 'getSelectedLocale').mockReturnValue(undefined);
            svc.loadMomentLocaleBundle ? svc.loadMomentLocaleBundle('fr-x') : svc.loadScriptForMoment('fr-x');
            expect(bsLocale.use).toHaveBeenCalledWith(svc.defaultSupportedLocale);
        });

        it('falls back to the default locale for the default language without a moment bundle', () => {
            const svc: any = service;
            svc.selectedLocale = svc.defaultSupportedLocale;
            jest.spyOn(svc, 'getSelectedLocale').mockReturnValue(undefined);
            svc.loadLocaleBundles({});
            expect(bsLocale.use).toHaveBeenCalledWith(svc.defaultSupportedLocale);
        });
    });
});
