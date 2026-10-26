import { DataSource } from '../types/types';
import {
    createCSSRule,
    defer,
    executePromiseChain,
    fetchContent,
    getAbortableDefer,
    getNavClass,
    getRouteNameFromLink,
    getSheetPositionClass,
    getUrlParams,
    isDataSourceEqual,
    isElementInViewport,
    isEmptyObject,
    loadScript,
    loadScripts,
    loadStyleSheet,
    loadStyleSheets,
    openLink,
    retryIfFails,
    toBoolean,
    toPromise,
    validateDataSourceCtx,
} from './utils';

describe('core utils - class name helpers', () => {
    it('getNavClass prefixes the suffix', () => {
        expect(getNavClass('left')).toBe('app-nav-left');
    });

    it('getSheetPositionClass prefixes the suffix', () => {
        expect(getSheetPositionClass('bottom')).toBe('sheet-position-bottom');
    });
});

describe('core utils - toBoolean', () => {
    it('treats truthy values other than the string "false" as true', () => {
        expect(toBoolean('yes')).toBe(true);
        expect(toBoolean(1)).toBe(true);
    });

    it('treats falsy values and "false" as false', () => {
        expect(toBoolean('false')).toBe(false);
        expect(toBoolean('')).toBe(false);
        expect(toBoolean(undefined)).toBe(false);
    });

    it('compares against the identity when one is given', () => {
        expect(toBoolean('false', 'false')).toBe(true);
        expect(toBoolean('', 'x')).toBe(false);
    });
});

describe('core utils - isEmptyObject', () => {
    it('is true only for an object without keys', () => {
        expect(isEmptyObject({})).toBe(true);
        expect(isEmptyObject({ a: 1 })).toBe(false);
    });

    it('is false for arrays and non objects', () => {
        expect(isEmptyObject([])).toBe(false);
        expect(isEmptyObject(null)).toBe(false);
        expect(isEmptyObject('a')).toBe(false);
    });
});

describe('core utils - isElementInViewport', () => {
    const element = (rect: any) => ({ getBoundingClientRect: () => rect }) as any;

    it('is true when the element lies inside the window', () => {
        const rect = { top: 0, left: 0, bottom: window.innerHeight, right: window.innerWidth };
        expect(isElementInViewport(element(rect))).toBe(true);
    });

    it('is false when the element is above, left of, below or right of the window', () => {
        expect(isElementInViewport(element({ top: -1, left: 0, bottom: 10, right: 10 }))).toBe(false);
        expect(isElementInViewport(element({ top: 0, left: -1, bottom: 10, right: 10 }))).toBe(false);
        expect(isElementInViewport(element({ top: 0, left: 0, bottom: window.innerHeight + 1, right: 10 }))).toBe(false);
        expect(isElementInViewport(element({ top: 0, left: 0, bottom: 10, right: window.innerWidth + 1 }))).toBe(false);
    });
});

describe('core utils - url helpers', () => {
    it('getUrlParams parses the query string into an object', () => {
        expect(getUrlParams('#/page?a=1&b=two')).toEqual({ a: '1', b: 'two' });
    });

    it('getUrlParams returns an empty object without a query string', () => {
        expect(getUrlParams('#/page')).toEqual({});
    });

    it('getRouteNameFromLink strips the hash prefix and the query string', () => {
        expect(getRouteNameFromLink('#/home?x=1')).toBe('/home');
        expect(getRouteNameFromLink('#/home')).toBe('/home');
    });

    it('openLink opens the link in the given target, defaulting to _self', () => {
        const open = jest.spyOn(window, 'open').mockImplementation(() => null);
        openLink('http://x.com');
        openLink('http://y.com', '_blank');
        expect(open).toHaveBeenNthCalledWith(1, 'http://x.com', '_self');
        expect(open).toHaveBeenNthCalledWith(2, 'http://y.com', '_blank');
        open.mockRestore();
    });
});

describe('core utils - stylesheet and script loading', () => {
    afterEach(() => {
        document.head.innerHTML = '';
    });

    it('loadStyleSheet appends a link element with the given attribute', () => {
        const link = loadStyleSheet('/a.css', { name: 'data-theme', value: 'dark' }) as HTMLLinkElement;
        expect(link.getAttribute('rel')).toBe('stylesheet');
        expect(link.getAttribute('type')).toBe('text/css');
        expect(link.getAttribute('data-theme')).toBe('dark');
        expect(document.head.contains(link)).toBe(true);
    });

    it('loadStyleSheet does nothing when the stylesheet is already loaded', () => {
        loadStyleSheet('/a.css', null);
        expect(loadStyleSheet('/a.css', null)).toBeUndefined();
        expect(document.querySelectorAll('link[href="/a.css"]').length).toBe(1);
    });

    it('loadStyleSheets accepts a list or a single url', () => {
        loadStyleSheets(['/one.css', '/two.css'] as any);
        loadStyleSheets('/three.css' as any);
        expect(document.querySelectorAll('link').length).toBe(3);
    });

    it('loadScript resolves immediately for an empty or already loaded url', async () => {
        const existing = document.createElement('script');
        existing.src = '/loaded.js';
        document.head.appendChild(existing);
        await expect(loadScript('  ', true)).resolves.toBeUndefined();
        await expect(loadScript('/loaded.js', true)).resolves.toBeUndefined();
        expect(document.querySelectorAll('script').length).toBe(1);
    });

    it('loadScript via a script tag resolves when the script loads', async () => {
        const promise = loadScript('/new.js', true);
        const script = document.querySelector('script[src="/new.js"]') as HTMLScriptElement;
        expect(script.async).toBe(false);
        script.onload(new Event('load'));
        await expect(promise).resolves.toBe(true);
    });

    it('loadScript via a script tag rejects when the script fails to load', async () => {
        const promise = loadScript('/bad.js', true);
        const script = document.querySelector('script[src="/bad.js"]') as HTMLScriptElement;
        script.onerror('boom');
        await expect(promise).rejects.toBe('boom');
    });

    it('loadScript uses $.ajax with caching for cacheable scripts', async () => {
        const ajax = jest.spyOn($, 'ajax').mockReturnValue($.Deferred().resolve('ok') as any);
        await loadScript('/cache.js', false, true);
        expect(ajax).toHaveBeenCalledWith({ dataType: 'script', cache: true, url: '/cache.js' });
        ajax.mockRestore();
    });

    it('loadScript uses $.getScript for non cacheable scripts', async () => {
        const getScript = jest.spyOn($, 'getScript').mockReturnValue($.Deferred().resolve('ok') as any);
        await loadScript('/plain.js', false);
        expect(getScript).toHaveBeenCalledWith('/plain.js');
        getScript.mockRestore();
    });

    it('loadScripts loads every script in order', async () => {
        const getScript = jest.spyOn($, 'getScript').mockReturnValue($.Deferred().resolve('ok') as any);
        await loadScripts(['/a.js', '/b.js'], false);
        expect(getScript.mock.calls.map((c) => c[0])).toEqual(['/a.js', '/b.js']);
        getScript.mockRestore();
    });
});

describe('core utils - fetchContent', () => {
    it('requests the url and calls the success callback', () => {
        const ajax = jest.spyOn($, 'ajax').mockReturnValue($.Deferred().resolve('data') as any);
        const success = jest.fn();
        fetchContent('json', '/x', true, success);
        expect(ajax).toHaveBeenCalledWith({ type: 'get', dataType: 'json', url: '/x', async: false });
        expect(success).toHaveBeenCalledWith('data');
        ajax.mockRestore();
    });

    it('calls the error callback when the request fails', () => {
        const ajax = jest.spyOn($, 'ajax').mockReturnValue($.Deferred().reject('bad') as any);
        const error = jest.fn();
        fetchContent('json', '/x', false, undefined, error);
        expect(error).toHaveBeenCalledWith('bad');
        ajax.mockRestore();
    });
});

describe('core utils - createCSSRule', () => {
    it('inserts a rule in the first stylesheet', () => {
        const style = document.createElement('style');
        document.head.appendChild(style);
        createCSSRule('.wm-test', 'color: red;');
        expect(document.styleSheets[0].cssRules.length).toBeGreaterThan(0);
        style.remove();
    });
});

describe('core utils - promise helpers', () => {
    it('toPromise returns promises untouched and wraps other values', async () => {
        const promise = Promise.resolve(1);
        expect(toPromise(promise)).toBe(promise);
        await expect(toPromise(2)).resolves.toBe(2);
    });

    it('defer exposes a promise with resolve and reject', async () => {
        const resolved = defer();
        resolved.resolve('ok');
        await expect(resolved.promise).resolves.toBe('ok');

        const rejected = defer();
        rejected.reject('no');
        await expect(rejected.promise).rejects.toBe('no');
    });

    describe('getAbortableDefer', () => {
        it('rejects with "aborted", flags the defer and calls onAbort', async () => {
            const d = getAbortableDefer();
            d.onAbort = jest.fn();
            d.promise.abort();
            await expect(d.promise).rejects.toBe('aborted');
            expect(d.isAborted).toBe(true);
            expect(d.onAbort).toHaveBeenCalled();
        });

        it('can be resolved normally', async () => {
            const d = getAbortableDefer();
            d.resolve('done');
            await expect(d.promise).resolves.toBe('done');
            expect(d.isAborted).toBe(false);
        });
    });

    describe('executePromiseChain', () => {
        it('runs the functions in order with the given args, skipping null entries', async () => {
            const order: string[] = [];
            const a = jest.fn(() => { order.push('a'); });
            const b = jest.fn(() => new Promise<void>((resolve) => setTimeout(() => { order.push('b'); resolve(); }, 5)));
            await executePromiseChain([a, null, undefined, b], [1, 2]);
            expect(order).toEqual(['a', 'b']);
            expect(a).toHaveBeenCalledWith(1, 2);
        });

        it('resolves for an empty chain', async () => {
            await expect(executePromiseChain([], [])).resolves.toBeUndefined();
        });

        it('rejects when a function returns a rejected promise and stops the chain', async () => {
            const next = jest.fn();
            await expect(executePromiseChain([() => Promise.reject('fail'), next], [])).rejects.toBe('fail');
            expect(next).not.toHaveBeenCalled();
        });

        it('rejects when a function throws synchronously', async () => {
            await expect(executePromiseChain([() => { throw 'sync'; }], [])).rejects.toBe('sync');
        });
    });

    describe('retryIfFails', () => {
        beforeEach(() => {
            jest.useFakeTimers();
        });

        afterEach(() => {
            jest.useRealTimers();
        });

        it('resolves straight away when the function succeeds', async () => {
            const fn = jest.fn().mockResolvedValue('ok');
            await expect(retryIfFails(fn, 10, 3)).resolves.toBe('ok');
            expect(fn).toHaveBeenCalledTimes(1);
        });

        it('retries a failing function until it succeeds', async () => {
            const fn = jest.fn()
                .mockRejectedValueOnce('e1')
                .mockRejectedValueOnce('e2')
                .mockResolvedValue('ok');
            const promise = retryIfFails(fn, 10, 5, () => Promise.resolve(true));
            await jest.advanceTimersByTimeAsync(100);
            await expect(promise).resolves.toBe('ok');
            expect(fn).toHaveBeenCalledTimes(3);
        });

        it('rejects with the last error arguments when onBeforeRetry declines to retry', async () => {
            const fn = jest.fn().mockRejectedValue('bad');
            const promise = retryIfFails(fn, 10, 5);
            const assertion = expect(promise).rejects.toEqual(expect.objectContaining({ 0: 'bad' }));
            await jest.advanceTimersByTimeAsync(20);
            await assertion;
            expect(fn).toHaveBeenCalledTimes(1);
        });

        it('stops after the maximum number of retries', async () => {
            const fn = jest.fn().mockRejectedValue('bad');
            const promise = retryIfFails(fn, 0, 2, () => Promise.resolve(true));
            const assertion = expect(promise).rejects.toBeDefined();
            await jest.advanceTimersByTimeAsync(50);
            await assertion;
            expect(fn).toHaveBeenCalledTimes(3);
        });

        it('rejects when onBeforeRetry itself rejects', async () => {
            const fn = jest.fn().mockRejectedValue('bad');
            const promise = retryIfFails(fn, 0, 2, () => Promise.reject('stop'));
            const assertion = expect(promise).rejects.toBeDefined();
            await jest.advanceTimersByTimeAsync(10);
            await assertion;
            expect(fn).toHaveBeenCalledTimes(1);
        });
    });
});

describe('core utils - data source helpers', () => {
    const dataSource = (uid: string, ctx: any) => ({
        execute: (op: any) => (op === DataSource.Operation.GET_UNIQUE_IDENTIFIER ? uid : ctx),
    });

    it('isDataSourceEqual compares both the unique id and the context', () => {
        expect(isDataSourceEqual(dataSource('a', { p: 1 }), dataSource('a', { p: 1 }))).toBe(true);
        expect(isDataSourceEqual(dataSource('a', { p: 1 }), dataSource('b', { p: 1 }))).toBe(false);
        expect(isDataSourceEqual(dataSource('a', { p: 1 }), dataSource('a', { p: 2 }))).toBe(false);
    });

    it('validateDataSourceCtx checks the context identity', () => {
        const ctx = {};
        expect(validateDataSourceCtx(dataSource('a', ctx), ctx)).toBe(true);
        expect(validateDataSourceCtx(dataSource('a', ctx), {})).toBe(false);
    });
});
