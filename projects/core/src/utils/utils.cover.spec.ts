/**
 * @jest-environment-options {"url": "https://localhost/"}
 */
import * as utils from './utils';

const setUA = (ua: string) => Object.defineProperty(window.navigator, 'userAgent', { value: ua, configurable: true });
const origUA = window.navigator.userAgent;
const loadWithUA = (ua: string): any => {
    setUA(ua);
    let m: any;
    jest.isolateModules(() => { m = require('./utils'); });
    return m;
};

describe('utils cover', () => {
    afterEach(() => {
        setUA(origUA);
        jest.restoreAllMocks();
    });

    describe('device checks', () => {
        it('isAndroidTablet respects the Tablet PC 2.0 exclusion', () => {
            const tablet = loadWithUA('Mozilla/5.0 (Linux; Android 9; SM-T510) Safari');
            expect(tablet.isAndroid()).toBe(true);
            expect(tablet.isAndroidTablet()).toBe(true);
            const pc = loadWithUA('Mozilla/5.0 (Windows; Tablet PC 2.0; android)');
            expect(pc.isAndroidTablet()).toBe(false);
        });

        it('isKitkatDevice identifies Android 4', () => {
            expect(loadWithUA('Mozilla/5.0 (Linux; Android 4.4.2; Nexus 5)').isKitkatDevice()).toBe(true);
            expect(loadWithUA('Mozilla/5.0 (Linux; Android 9; Pixel)').isKitkatDevice()).toBe(false);
        });

        it('isIpad detects iPadOS reporting a Mac platform with touch support', () => {
            const nav: any = window.navigator;
            const def = (k, v) => Object.defineProperty(nav, k, { value: v, configurable: true });
            def('maxTouchPoints', 5); def('platform', 'MacIntel');
            expect(utils.isIpad()).toBeTruthy();
            def('platform', 'Win32');
            expect(utils.isIpad()).toBeFalsy();
            def('maxTouchPoints', 1);
            expect(utils.isIpad()).toBeFalsy();
            delete nav.maxTouchPoints; delete nav.platform;
        });

        it('isSafari checks the live user agent', () => {
            setUA('Mozilla/5.0 Version/16 Safari/605.1');
            expect(utils.isSafari()).toBe(true);
            setUA('Mozilla/5.0 Chrome/100 Safari/537');
            expect(utils.isSafari()).toBe(false);
        });

        it('isLargeTabletLandscape/Portrait use the supplied or default sizes', () => {
            const mm = jest.fn().mockReturnValue({ matches: true });
            (window as any).matchMedia = mm;
            expect(utils.isLargeTabletLandscape(undefined, undefined)).toBe(true);
            expect(mm.mock.calls[0][0]).toContain('1366px');
            expect(mm.mock.calls[0][0]).toContain('1024px');
            utils.isLargeTabletLandscape('800px', '600px');
            expect(mm.mock.calls[1][0]).toContain('800px');
            expect(utils.isLargeTabletPortrait(undefined, undefined)).toBe(true);
            expect(mm.mock.calls[2][0]).toContain('(min-device-width : 1024px)');
            utils.isLargeTabletPortrait('800px', '600px');
            expect(mm.mock.calls[3][0]).toContain('(min-device-width : 600px)');
        });
    });

    describe('isInsecureContentRequest', () => {
        it('treats urls with an empty protocol as secure', () => {
            const real = document.createElement.bind(document);
            jest.spyOn(document, 'createElement').mockImplementation((tag: string) => {
                if (tag === 'a') { return { protocol: '', set href(_v) { } } as any; }
                return real(tag);
            });
            expect(utils.isInsecureContentRequest('relative/path')).toBe(false);
        });

        it('flags non-https content on an https page', () => {
            expect(utils.isInsecureContentRequest('http://example.com/a')).toBe(true);
            expect(utils.isInsecureContentRequest('https://example.com/a')).toBe(false);
            expect(utils.isInsecureContentRequest('wss://example.com/a')).toBe(false);
            expect(utils.isInsecureContentRequest('data:image/png;base64,AAAA')).toBe(false);
        });
    });

    describe('getDateObj', () => {
        it('uses the explicit isNativePicker option', () => {
            const d = utils.getDateObj('2024/03/05 10:20:30', { pattern: 'yyyy-MM-dd', isNativePicker: true });
            expect(d.getFullYear()).toBe(2024);
            expect(d.getHours()).toBe(10);
            const d2 = utils.getDateObj('2024-03-05', { pattern: 'yyyy-MM-dd', isNativePicker: false });
            expect(d2.getMonth()).toBe(2);
        });

        it('falls back to isMobile when isNativePicker is not provided', () => {
            const d = utils.getDateObj('2024-03-05', { pattern: 'yyyy-MM-dd' });
            expect(d.getDate()).toBe(5);
        });

        it('returns now when a valid moment input yields an invalid Date', () => {
            const before = Date.now();
            const d = utils.getDateObj({ year: 2024, month: 1 });
            expect(Math.abs(d.getTime() - before)).toBeLessThan(5000);
        });
    });

    describe('getValidDateObject', () => {
        it('handles values that do not match the pattern', () => {
            const r: any = utils.getValidDateObject('abc', { pattern: 'yyyy', isNativePicker: false });
            expect(r instanceof Date).toBe(true);
        });

        it('parses natural language strings without options via Date', () => {
            const r: any = utils.getValidDateObject('Jan 5 2024');
            expect(new Date(r).getFullYear()).toBe(2024);
        });
    });

    describe('isElementInViewport', () => {
        it('falls back to document client size when window size is 0', () => {
            const w: any = window;
            const oh = w.innerHeight, ow = w.innerWidth;
            Object.defineProperty(w, 'innerHeight', { value: 0, configurable: true, writable: true });
            Object.defineProperty(w, 'innerWidth', { value: 0, configurable: true, writable: true });
            jest.spyOn(document.documentElement, 'clientHeight', 'get').mockReturnValue(500);
            jest.spyOn(document.documentElement, 'clientWidth', 'get').mockReturnValue(400);
            const el: any = { getBoundingClientRect: () => ({ top: 0, left: 0, bottom: 300, right: 200 }) };
            expect(utils.isElementInViewport(el)).toBe(true);
            el.getBoundingClientRect = () => ({ top: 0, left: 0, bottom: 600, right: 200 });
            expect(utils.isElementInViewport(el)).toBe(false);
            w.innerHeight = oh; w.innerWidth = ow;
        });
    });

    describe('stylesheets', () => {
        afterEach(() => { document.head.querySelectorAll('link').forEach(l => l.remove()); });

        it('loadStyleSheets accepts no args, a single url or an array', () => {
            utils.loadStyleSheets();
            expect(document.head.querySelectorAll('link').length).toBe(0);
            utils.loadStyleSheets('a.css' as any);
            expect(document.head.querySelectorAll('link[href="a.css"]').length).toBe(1);
            utils.loadStyleSheets(['b.css', 'a.css']);
            expect(document.head.querySelectorAll('link').length).toBe(2);
        });
    });

    it('noop returns undefined', () => {
        expect((utils.noop as any)(1, 2)).toBeUndefined();
    });

    it('abortable defer invokes onAbort and rejects', async () => {
        const defer = utils.getAbortableDefer();
        const spy = jest.fn();
        defer.onAbort = spy;
        defer.promise.catch(() => { });
        (defer.promise as any).abort();
        await expect(defer.promise).rejects.toBe('aborted');
        expect(spy).toHaveBeenCalled();
        expect(defer.isAborted).toBe(true);
    });

    it('falls back to window.moment when the moment module has no default export', () => {
        const sentinel = new Date(1999, 1, 1);
        (window as any).moment = jest.fn(() => ({ toDate: () => sentinel }));
        let m: any;
        jest.isolateModules(() => {
            jest.doMock('moment-timezone/moment-timezone', () => ({ __esModule: true }));
            m = require('./utils');
        });
        expect(m.getDateObj('x', { pattern: 'yyyy', isNativePicker: true })).toBe(sentinel);
        delete (window as any).moment;
        jest.dontMock('moment-timezone/moment-timezone');
    });

    describe('misc branches', () => {
        it('getValidDateObject uses Date when moment rejects an overflowing date string', () => {
            const r: any = utils.getValidDateObject('2024-02-30');
            expect(r instanceof Date).toBe(true);
            expect(isNaN(r.getTime())).toBe(true);
        });

        it('fetchContent defaults to async requests', async () => {
            const chain: any = { done: (cb) => { chain._d = cb; return chain; }, fail: () => chain };
            const spy = jest.fn(() => chain);
            ($ as any).ajax = spy;
            utils.fetchContent('json', '/x');
            expect(spy).toHaveBeenCalledWith({ type: 'get', dataType: 'json', url: '/x', async: true });
        });

        it('abort works with the default onAbort', async () => {
            const defer = utils.getAbortableDefer();
            const p = defer.promise.catch(e => e);
            (defer.promise as any).abort();
            expect(await p).toBe('aborted');
        });

        it('encodeUrlParams handles an empty query string', () => {
            expect(utils.encodeUrlParams('http://x.com/a?')).toBe('http://x.com/a?');
        });

        it('xmlToJson returns a falsy value for empty xml', () => {
            expect(utils.xmlToJson('')).toBeFalsy();
        });

        it('findValueOf with create keeps existing objects and parses JSON strings', () => {
            const o: any = { a: { x: 1 }, s: '{"k":2}' };
            utils.findValueOf(o, 'a.b', true);
            expect(o.a.x).toBe(1);
            expect(o.a.b).toEqual({});
            utils.findValueOf(o, 's.t', true);
            expect(o.s.k).toBe(2);
        });

        it('loadScripts works without arguments', async () => {
            await expect(utils.loadScripts()).resolves.toBeUndefined();
        });

        it('openLink defaults target to _self', () => {
            const open = jest.spyOn(window, 'open').mockImplementation(() => null);
            utils.openLink('http://x.com');
            expect(open).toHaveBeenCalledWith('http://x.com', '_self');
        });

        it('retryIfFails tolerates a non function fn and invalid numeric args', async () => {
            await expect(utils.retryIfFails(undefined as any, 'a' as any, 'b' as any)).resolves.toBeUndefined();
        });
    });
});
