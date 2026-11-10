import { Subject } from 'rxjs';

const mockWatch = jest.fn();
jest.mock('./watcher', () => ({
    ...jest.requireActual('./watcher'),
    $watch: (...args: any[]) => mockWatch(...args)
}));

import {
    addForIdAttributes,
    adjustContainerPosition,
    adjustContainerRightEdges,
    adjustVerticalPosition,
    appendScriptToHead,
    closePopover,
    detectChanges,
    encodeUrlParams,
    extendProto,
    extractCurrentItemExpr,
    findParent,
    findRootContainer,
    findValueOf,
    findViewParent,
    getAppSetting,
    getDatasourceFromExpr,
    getDisplayDateTimeFormat,
    getEvaluatedExprValue,
    getFiles,
    getFontConfig,
    getValidDateObject,
    getWebkitTraslationMatrix,
    isElementInViewport,
    isInsecureContentRequest,
    isIE,
    isObject,
    isDefined,
    isPageable,
    isValidImageUrl,
    processFilterExpBindNode,
    removeExtraSlashes,
    scrollToElement,
    setListClass,
    setTranslation3dPosition,
    transformFileURI,
    triggerItemAction,
    getFormattedDate,
    fetchContent,
    loadScript,
    getDateObj
} from './utils';
import { getPreviewProperties } from './wm-project-properties';
import * as momentTz from 'moment-timezone/moment-timezone';

(momentTz as any).tz.load(require('moment-timezone/data/packed/latest.json'));

const raf = () => new Promise(r => requestAnimationFrame(() => r(null)));

describe('utils.more - simple helpers', () => {
    it('isDefined / isObject', () => {
        expect(isDefined(undefined)).toBe(false);
        expect(isDefined(0)).toBe(true);
        expect(isObject(null)).toBe(false);
        expect(isObject({})).toBe(true);
        expect(isObject('x')).toBe(false);
    });

    it('isIE detects Trident and MSIE', () => {
        const nav = jest.spyOn(window.navigator, 'appVersion', 'get');
        nav.mockReturnValue('5.0 Trident/7.0');
        expect(isIE()).toBe(true);
        nav.mockReturnValue('5.0 Chrome');
        const ua = jest.spyOn(window.navigator, 'userAgent', 'get').mockReturnValue('Mozilla MSIE 10');
        expect(isIE()).toBe(true);
        ua.mockReturnValue('Mozilla Chrome');
        expect(isIE()).toBe(false);
        nav.mockRestore();
        ua.mockRestore();
    });

    it('encodeUrlParams keeps malformed percent sequences and encodes the rest', () => {
        const out = encodeUrlParams('http://x/y?a=%E0%A4%A&b=hello world&c=&d');
        expect(out).toContain('a=%25E0%25A4%25A');
        expect(out).toContain('b=hello%20world');
        expect(out).toContain('c=');
        expect(out).toContain('d');
    });

    it('isInsecureContentRequest handles relative, data and protocol-mismatch urls', () => {
        expect(isInsecureContentRequest('data:image/png;base64,AAAA')).toBe(false);
        // jsdom location is http://localhost -> https/http not mismatch
        expect(isInsecureContentRequest('http://example.com/x')).toBe(false);
        const orig = Object.getOwnPropertyDescriptor(window, 'location');
        expect(typeof isInsecureContentRequest('/relative')).toBe('boolean');
        if (orig) { /* location untouched */ }
    });

    it('getEvaluatedExprValue evaluates expression over object fields', () => {
        expect(getEvaluatedExprValue({ a: 'x', b: 'y' }, "a + ' ' + b")).toBe('x y');
    });

    it('isValidImageUrl tests against trimmed url', () => {
        expect(isValidImageUrl('  http://a.com/x.png  ')).toBe(true);
        expect(isValidImageUrl('not a url')).toBe(false);
    });

    it('getFiles returns list or first file', () => {
        const form = document.createElement('form');
        form.name = 'frm1';
        const input = document.createElement('input');
        input.type = 'file';
        input.name = 'fld';
        form.appendChild(input);
        document.body.appendChild(form);
        const f1 = new File(['a'], 'a.txt');
        const f2 = new File(['b'], 'b.txt');
        // jsdom does not expose named form controls as properties of the form, so define it explicitly
        Object.defineProperty(form, 'fld', { value: { files: [f1, f2] } });
        expect(getFiles('frm1', 'fld', true)).toEqual([f1, f2]);
        expect(getFiles('frm1', 'fld', false)).toBe(f1);
        form.remove();
    });

    it('findValueOf returns undefined without obj/key and creates nested path when create=true', () => {
        expect(findValueOf(null, 'a')).toBeUndefined();
        expect(findValueOf({}, '')).toBeUndefined();
        const obj: any = {};
        findValueOf(obj, 'a.b[0].c', true);
        expect(obj.a.b[0]).toBeDefined();
    });

    it('scrollToElement scrolls window to the element offset', () => {
        const el = document.createElement('div');
        document.body.appendChild(el);
        const scroll = jest.fn();
        (window as any).scroll = scroll;
        scrollToElement(el);
        expect(scroll).toHaveBeenCalledWith({ top: 0, left: 0, behavior: 'smooth' });
        el.remove();
    });

    it('isElementInViewport reflects bounding rect', () => {
        const el = document.createElement('div');
        el.getBoundingClientRect = () => ({ top: 0, left: 0, bottom: 10, right: 10 } as any);
        expect(isElementInViewport(el)).toBe(true);
        el.getBoundingClientRect = () => ({ top: -5, left: 0, bottom: 10, right: 10 } as any);
        expect(isElementInViewport(el)).toBe(false);
    });

    it('isPageable', () => {
        const p = { content: [], first: true, last: true, number: 0, numberOfElements: 1, size: 1, sort: null, totalElements: 1, totalPages: 1, empty: false };
        expect(isPageable(p)).toBe(true);
        expect(isPageable({ a: 1 })).toBe(false);
    });

    it('removeExtraSlashes', () => {
        expect(removeExtraSlashes('http://a.com//b///c')).toBe('http://a.com/b/c');
        expect(removeExtraSlashes('file:///a//b')).toBe('file:///a//b');
        expect(removeExtraSlashes('data:image/png;base64,AA//BB')).toBe('data:image/png;base64,AA//BB');
        expect(removeExtraSlashes(5 as any)).toBeUndefined();
    });

    it('getDisplayDateTimeFormat', () => {
        expect(getDisplayDateTimeFormat('date')).toBe('yyyy-MM-dd');
        expect(getDisplayDateTimeFormat('Time')).toBe('hh:mm a');
        expect(getDisplayDateTimeFormat('nope')).toBeUndefined();
    });

    it('transformFileURI is identity', () => {
        expect(transformFileURI('x')).toBe('x');
    });

    it('detectChanges is exported callable', () => {
        expect(typeof detectChanges).toBe('function');
    });

    it('getAppSetting reads extra_settings with default', () => {
        (globalThis as any)._WM_APP_PROPERTIES = { extra_settings: { a: { b: 'v' } } };
        expect(getAppSetting('a.b', 'd')).toBe('v');
        expect(getAppSetting('a.c', 'd')).toBe('d');
        (globalThis as any)._WM_APP_PROPERTIES = {};
        expect(getAppSetting('a.b', 'd')).toBe('d');
    });

    it('getFontConfig prefers project fontConfig', () => {
        (globalThis as any)._WM_APP_PROPERTIES = { fontConfig: { x: 1 } };
        expect(getFontConfig()).toEqual({ x: 1 });
        (globalThis as any)._WM_APP_PROPERTIES = {};
        expect(getFontConfig()).toEqual(getPreviewProperties());
    });
});

describe('utils.more - getValidDateObject / getFormattedDate', () => {
    it('handles pattern with native picker option and localized meridians', () => {
        const d = getValidDateObject('2020/01/02 03:04:05', { isNativePicker: true, pattern: 'YYYY/MM/DD HH:mm:ss' });
        expect(d instanceof Date).toBe(true);
        expect((d as Date).getFullYear()).toBe(2020);
        const d2 = getValidDateObject('2020-01-02 03:04 PM', { isNativePicker: false, pattern: 'yyyy-MM-dd hh:mm A', meridians: ['AM', 'PM'] });
        expect((d2 as Date).getHours()).toBe(15);
    });

    it('getFormattedDate with timezone and interval datetime', () => {
        const datePipe = { transform: jest.fn(() => 'piped') };
        const date = new Date(2020, 0, 2, 12, 4, 5);
        const r1 = getFormattedDate(datePipe, date, 'yyyy-MM-dd', 'America/New_York', 'datetimestamp', false);
        expect(r1).toBe('2020-01-02');
        const r2 = getFormattedDate(datePipe, date, 'yyyy-MM-dd', 'America/New_York', 'x', true);
        expect(r2).toBe('2020-01-02');
    });
});

describe('utils.more - processFilterExpBindNode', () => {
    beforeEach(() => mockWatch.mockReset());

    it('registers watchers for bound nodes, incl. between secondvalue, and nested rules', () => {
        const destroy = jest.fn();
        const ctx: any = { registerDestroyListener: destroy };
        const exps: any = {
            rules: [
                { target: 'a', matchMode: 'between', value: 'bind:Widgets.w1.datavalue', secondvalue: 'bind:Widgets.w2.datavalue' },
                { rules: [{ target: 'b', value: 'bind:Variables.v.x', matchMode: 'in' }] },
                { target: 'c', value: 'static' }
            ]
        };
        const stream = processFilterExpBindNode(ctx, exps);
        expect(stream instanceof Subject).toBe(true);
        expect(mockWatch).toHaveBeenCalledTimes(3);
        expect(mockWatch.mock.calls[0][0]).toBe('Widgets.w2.datavalue');
        expect(mockWatch.mock.calls[1][0]).toBe('Widgets.w1.datavalue');
        expect(mockWatch.mock.calls[2][6]).toEqual({ arrayType: true });
        expect(destroy).toHaveBeenCalledTimes(3);
    });

    it('listener sets value on node, ignores undefined transitions and handles dataBinding', () => {
        const ctx: any = {};
        const rule1: any = { target: 'a', value: 'bind:x' };
        const rule2: any = { target: 'dataBinding', value: 'bind:y', matchMode: 'exact' };
        const rule3: any = { target: 'f', type: 'blob', value: 'bind:z' };
        const exps: any = { rules: [rule1, rule2, rule3] };
        const emitted: any[] = [];
        processFilterExpBindNode(ctx, exps).subscribe(v => emitted.push(v));
        const l1 = mockWatch.mock.calls[0][3];
        const l2 = mockWatch.mock.calls[1][3];
        const l3 = mockWatch.mock.calls[2][3];

        l1(undefined, undefined);
        l1(undefined, 'old');
        expect(emitted.length).toBe(0);

        l1({ k: 1 }, null);
        expect(rule1.value).toEqual({ k: 1 });
        expect(emitted.length).toBe(1);

        l2({ p: 'q' }, null);
        expect(exps.rules).toEqual([{ target: 'p', value: 'q', matchMode: 'exact', required: false, type: '' }]);

        const blob = { b: 1 };
        l3(blob, null);
        expect(rule3.value).toBe(blob);
    });

    it('uses variable.invokeOnFiltertExpressionChange when variable provided', () => {
        const variable = { invokeOnFiltertExpressionChange: jest.fn() };
        processFilterExpBindNode({}, { rules: [{ value: 'bind:x', matchMode: 'in' }] }, variable);
        mockWatch.mock.calls[0][3]('n', 'o');
        expect(variable.invokeOnFiltertExpressionChange).toHaveBeenCalledWith(expect.anything(), 'value', 'n', 'o');
    });
});

describe('utils.more - prototype / datasource helpers', () => {
    it('extendProto returns early when proto already in chain, else sets proto', () => {
        class Base {}
        class Mid extends Base {}
        class Leaf extends Mid {}
        const t = new Leaf();
        extendProto(t, Mid.prototype);
        expect(Object.getPrototypeOf(Mid.prototype)).toBe(Base.prototype);

        const protoObj = { hello: () => 'hi' };
        extendProto(t, protoObj);
        expect((t as any).hello()).toBe('hi');
    });

    it('getDatasourceFromExpr resolves variables and widgets (recursively)', () => {
        const v1 = { name: 'v1' };
        const scope: any = {
            viewParent: {
                Variables: { staticVar1: v1 },
                Widgets: {
                    list1: { binddataset: 'Variables.staticVar1.dataSet', datasource: 'x', $attrs: new Map(), viewParent: null as any },
                    list2: { binddataset: undefined, viewParent: null as any, $attrs: new Map([['datasetboundexpr', 'Widgets.list1.dataset']]) }
                }
            }
        };
        scope.viewParent.Widgets.list1.viewParent = scope.viewParent;
        scope.viewParent.Widgets.list2.viewParent = scope.viewParent;
        expect(getDatasourceFromExpr('Variables.staticVar1.dataSet.a', scope)).toBe(v1);
        expect(getDatasourceFromExpr('Widgets.list1.currentItem', scope)).toBe(v1);
        expect(getDatasourceFromExpr('Widgets.list2.currentItem', scope)).toBe(v1);
        expect(getDatasourceFromExpr('Other.x', scope)).toBeUndefined();
    });

    it('extractCurrentItemExpr rewrites currentItem exprs', () => {
        const scope: any = {
            viewParent: {
                Widgets: {
                    list1: { binddataset: 'Variables.sv.dataSet', datasource: 'ds', $attrs: new Map() },
                    list2: { datasource: undefined, $attrs: new Map([['datasetboundexpr', 'Widgets.list1.currentItem.items']]) }
                }
            }
        };
        expect(extractCurrentItemExpr('Widgets.list1.currentItem.details', scope)).toBe('Variables.sv.dataSet[$i].details');
        expect(extractCurrentItemExpr('Widgets.list2.currentItem.z', scope)).toBe('Variables.sv.dataSet[$i].items[$i].z');
        expect(extractCurrentItemExpr('Variables.a', scope)).toBe('Variables.a');
    });
});

describe('utils.more - DOM helpers', () => {
    afterEach(() => { document.body.innerHTML = ''; jest.useRealTimers(); });

    it('addForIdAttributes links label and input via widget-id and labels radiogroup', async () => {
        const host = document.createElement('div');
        host.innerHTML = '<div widget-id="w1"><label class="control-label">L</label><input type="text"/></div>';
        addForIdAttributes(host);
        await raf();
        expect(host.querySelector('input').id).toBe('w1');
        expect(host.querySelector('label').getAttribute('for')).toBe('w1');

        const host2 = document.createElement('div');
        host2.innerHTML = '<label class="control-label">L</label><ul role="radiogroup"><li focus-target></li></ul>';
        addForIdAttributes(host2);
        await raf();
        const ul = host2.querySelector('ul');
        const lbl = host2.querySelector('label');
        expect(ul.getAttribute('aria-labelledby')).toMatch(/^wm-group-label-/);
        expect(lbl.id).toBe(ul.getAttribute('aria-labelledby'));
    });

    it('closePopover closes open popover widgets unless inside a popover', () => {
        const w = document.createElement('div');
        w.className = 'app-popover-wrapper';
        (w as any).widget = { isOpen: true };
        document.body.appendChild(w);
        closePopover($(document.body));
        expect((w as any).widget.isOpen).toBe(false);

        (w as any).widget.isOpen = true;
        const inner = $('<div class="app-popover"><span></span></div>').appendTo(document.body);
        closePopover(inner.find('span'));
        expect((w as any).widget.isOpen).toBe(true);
    });

    it('getWebkitTraslationMatrix returns null for empty and identity for none', () => {
        expect(getWebkitTraslationMatrix(null)).toBeNull();
        expect(getWebkitTraslationMatrix($())).toBeNull();
        (window as any).WebKitCSSMatrix = class { m41: number; m42: number; constructor(public v: string) { this.m41 = 0; this.m42 = 0; } };
        const m: any = getWebkitTraslationMatrix($('<div></div>'));
        expect(m.v).toBe('matrix(1, 0, 0, 1, 0, 0)');
    });

    it('getWebkitTraslationMatrix falls back to MSCSSMatrix when WebKitCSSMatrix missing', () => {
        const saved = (window as any).WebKitCSSMatrix;
        delete (window as any).WebKitCSSMatrix;
        (globalThis as any).MSCSSMatrix = class { constructor(public v: string) {} };
        const el = $('<div></div>');
        el[0].style.transform = 'translate(3px, 4px)';
        const m: any = getWebkitTraslationMatrix(el);
        expect(m.v).toBeDefined();
        (window as any).WebKitCSSMatrix = saved;
        delete (globalThis as any).MSCSSMatrix;
    });

    it('setTranslation3dPosition writes transform', () => {
        const el = $('<div></div>');
        setTranslation3dPosition(el, { m41: 5, m42: 7 });
        expect(el[0].style.transform).toBe('translate3d(5px, 7px, 0px)');
    });

    describe('position adjusters', () => {
        let matrix: any;
        beforeEach(() => {
            matrix = { m41: -10, m42: 20 };
            (window as any).WebKitCSSMatrix = class { m41 = matrix.m41; m42 = matrix.m42; };
        });

        it('adjustContainerPosition resets negative left translation (sync when no zone)', () => {
            const el = $('<div></div>');
            adjustContainerPosition(el, document.body, {});
            expect(el[0].style.transform).toBe('translate3d(0px, 20px, 0px)');
        });

        it('adjustContainerPosition waits for zone onStable', () => {
            const el = $('<div></div>');
            const onStable = new Subject<void>();
            adjustContainerPosition(el, document.body, { _ngZone: { onStable } });
            expect(el[0].style.transform).toBe('');
            onStable.next();
            expect(el[0].style.transform).toBe('translate3d(0px, 20px, 0px)');
        });

        it('adjustContainerPosition does nothing when m41 >= 0', () => {
            matrix.m41 = 5;
            const el = $('<div></div>');
            adjustContainerPosition(el, document.body, {});
            expect(el[0].style.transform).toBe('');
        });

        it('adjustContainerRightEdges shifts container left when it would overflow', () => {
            const el = $('<div style="width:500px"></div>');
            const parent: any = { getBoundingClientRect: () => ({ right: 900, width: 100 }) };
            adjustContainerRightEdges(el, parent, {});
            // viewport 1024 - (900+100) = 24 < 500 => newLeft = 400
            expect(el[0].style.transform).toBe('translate3d(400px, 20px, 0px)');
        });

        it('adjustContainerRightEdges clamps negative newLeft to 0 and uses ele width', () => {
            const el = $('<div></div>');
            const ele = $('<div style="width:800px"></div>');
            const parent: any = { getBoundingClientRect: () => ({ right: 100, width: 100 }) };
            adjustContainerRightEdges(el, parent, { ngZone: {} }, ele);
            expect(el[0].style.transform).toBe('translate3d(0px, 20px, 0px)');
        });

        it('adjustContainerRightEdges returns when no matrix and skips when enough room', () => {
            const parent: any = { getBoundingClientRect: () => ({ right: 10, width: 10 }) };
            const empty = $();
            (empty as any).css = () => '100px';
            adjustContainerRightEdges(empty, parent, {});
            const el = $('<div style="width:50px"></div>');
            const w = jest.spyOn($.fn, 'width').mockReturnValue(1024);
            adjustContainerRightEdges(el, parent, {});
            w.mockRestore();
            expect(el[0].style.transform).toBe('');
        });

        it('adjustVerticalPosition flips above when no room below and room above', () => {
            matrix.m42 = 300;
            const el = $('<div style="height:100px"></div>');
            const parent: any = { getBoundingClientRect: () => ({ top: 400, bottom: 750, height: 50 }) };
            Object.defineProperty(window, 'innerHeight', { value: 768, configurable: true });
            adjustVerticalPosition(el, parent, {});
            expect(el[0].style.transform).toBe('translate3d(-10px, 150px, 0px)');
        });

        it('adjustVerticalPosition clamps negative m42 to 0 and skips when room below', () => {
            const el = $('<div style="height:100px"></div>');
            const parent: any = { getBoundingClientRect: () => ({ top: 400, bottom: 750, height: 50 }) };
            Object.defineProperty(window, 'innerHeight', { value: 768, configurable: true });
            adjustVerticalPosition(el, parent, {}, $('<div style="height:100px"></div>'));
            expect(el[0].style.transform).toBe('translate3d(-10px, 0px, 0px)');

            const el2 = $('<div style="height:10px"></div>');
            adjustVerticalPosition(el2, parent, {});
            expect(el2[0].style.transform).toBe('');
        });
    });
});

describe('utils.more - triggerItemAction / findRootContainer / setListClass / findParent', () => {
    it('triggerItemAction navigates for hash links and opens others', () => {
        const navigate = jest.fn();
        const scope: any = { route: { navigate }, itemActionFn: jest.fn(), userDefinedExecutionContext: {} };
        triggerItemAction(scope, { link: '#/Main?x=1', action: 'a()' });
        expect(scope.itemActionFn).toHaveBeenCalled();
        expect(navigate).toHaveBeenCalledWith(['/Main'], { queryParams: { x: '1' } });

        const scope2: any = { menuRef: { route: { navigate } } };
        triggerItemAction(scope2, { link: '#/Other' });
        expect(navigate).toHaveBeenLastCalledWith(['/Other'], { queryParams: {} });

        const open = jest.spyOn(window, 'open').mockImplementation(() => null);
        triggerItemAction({}, { link: 'http://x.com', target: '_blank' });
        expect(open).toHaveBeenCalledWith('http://x.com', '_blank');
        triggerItemAction({}, { link: '#/p', target: '_blank' });
        expect(open).toHaveBeenLastCalledWith('#/p', '_blank');
        open.mockRestore();
    });

    it('findRootContainer picks closest container type in order', () => {
        document.body.innerHTML = '<section><div class="app-prefab"><i id="a"></i></div></section>' +
            '<article><div class="app-partial"><i id="b"></i></div></article>' +
            '<main><div class="app-spa-page"><i id="c"></i></div></main>' +
            '<nav><div class="app-page"><i id="d"></i></div></nav><i id="e"></i>';
        expect(findRootContainer($('#a'))).toBe('SECTION');
        expect(findRootContainer($('#b'))).toBe('ARTICLE');
        expect(findRootContainer($('#c'))).toBe('MAIN');
        expect(findRootContainer($('#d'))).toBe('NAV');
        expect(findRootContainer($('#e'))).toBe(0);
        document.body.innerHTML = '';
    });

    it('setListClass variants', () => {
        const s: any = {};
        setListClass(s);
        expect(s.itemsPerRowClass).toBe('');
        s.itemsperrow = 'auto';
        setListClass(s);
        expect(s.itemsPerRowClass).toBe('');
        s.itemsperrow = 'lg-3 xs-2';
        setListClass(s);
        expect(s.itemsPerRowClass).toBe('col-lg-4 col-xs-6');
        s.itemsperrow = '4';
        setListClass(s);
        expect(s.itemsPerRowClass).toBe('col-xs-3');
    });

    it('findViewParent / findParent read lView[15][8]', () => {
        const lv: any = []; lv[15] = []; lv[15][8] = 'P';
        expect(findViewParent(lv)).toBe('P');
        expect(findParent(lv, 'app')).toBe('P');
        expect(findParent([], 'app')).toBe('app');
    });
});

describe('utils.more - script loading', () => {
    afterEach(() => { document.head.innerHTML = ''; jest.restoreAllMocks(); });

    it('appendScriptToHead appends formatter script, calls back on load and warns on error', () => {
        (globalThis as any).WM_CUSTOM_FORMATTERS = { f: 1 };
        const cb = jest.fn();
        appendScriptToHead(cb);
        const script = document.head.querySelector('script') as HTMLScriptElement;
        expect(script.getAttribute('src')).toBe('./extensions/formatters.js');
        script.onload(new Event('load'));
        expect(cb).toHaveBeenCalledWith({ f: 1 });
        const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
        script.onerror('boom' as any);
        expect(warn).toHaveBeenCalled();
    });

    it('$.cachedScript dedupes in-progress loads and resolves cached', async () => {
        let doneCb: any;
        const ajax = jest.spyOn($, 'ajax').mockImplementation((() => ({ done: (cb) => { doneCb = cb; return {}; } })) as any);
        const p1 = ($ as any).cachedScript('a.js');
        const p2 = ($ as any).cachedScript('a.js');
        expect(p2).toBe(p1);
        expect(ajax).toHaveBeenCalledTimes(1);
        doneCb();
        await p1;
        await expect(($ as any).cachedScript('a.js')).resolves.toBeUndefined();
        expect(ajax).toHaveBeenCalledTimes(1);
    });

    it('loadScript uses ajax with cache option and plain getScript otherwise', async () => {
        const fail = () => ({});
        const chain: any = { done: () => ({ fail }) };
        const ajax = jest.spyOn($, 'ajax').mockReturnValue(chain);
        const getScript = jest.spyOn($, 'getScript').mockReturnValue(chain);
        await loadScript('x1.js', false, true);
        expect(ajax).toHaveBeenCalledWith({ dataType: 'script', cache: true, url: 'x1.js' });
        await loadScript('x2.js', false, false);
        expect(getScript).toHaveBeenCalledWith('x2.js');
    });

    it('fetchContent invokes success and error callbacks', () => {
        const success = jest.fn();
        const error = jest.fn();
        const chain: any = { done: (cb) => { cb('R'); return chain; }, fail: (cb) => { cb('E'); return chain; } };
        jest.spyOn($, 'ajax').mockReturnValue(chain);
        fetchContent('json', 'u', false, success, error);
        expect(success).toHaveBeenCalledWith('R');
        expect(error).toHaveBeenCalledWith('E');
    });
});

describe('utils.more - remaining branches', () => {
    afterEach(() => { document.head.innerHTML = ''; jest.restoreAllMocks(); });

    it('getDateObj returns undefined for the CURRENT_DATE keyword (moment rejects it before the CURRENT_DATE check)', () => {
        jest.spyOn(console, 'warn').mockImplementation(() => {});
        expect(getDateObj('CURRENT_DATE')).toBeUndefined();
    });

    it('getValidDateObject strips weekday "E," from the pattern', () => {
        const d = getValidDateObject('2020-01-02', { isNativePicker: false, pattern: 'E, yyyy-MM-dd' }) as Date;
        expect(d.getFullYear()).toBe(2020);
        expect(d.getMonth()).toBe(0);
        expect(d.getDate()).toBe(2);
    });

    it('loadScript via script tag resolves on load and rejects on error', async () => {
        const p = loadScript('tag1.js', true);
        const s1 = document.head.querySelector('script[src="tag1.js"]') as any;
        s1.onload();
        await expect(p).resolves.toBe(true);

        const p2 = loadScript('tag2.js', true);
        const s2 = document.head.querySelector('script[src="tag2.js"]') as any;
        s2.onerror('bad');
        await expect(p2).rejects.toBe('bad');
        // already present scripts short-circuit
        await expect(loadScript('tag1.js', true)).resolves.toBeUndefined();
        await expect(loadScript('   ', true)).resolves.toBeUndefined();
    });

    it('loadScript ajax/getScript done and fail callbacks are wired', async () => {
        const chain: any = {};
        chain.done = jest.fn((cb) => { cb('ok'); return chain; });
        chain.fail = jest.fn((cb) => { cb('no'); return chain; });
        jest.spyOn($, 'ajax').mockReturnValue(chain);
        jest.spyOn($, 'getScript').mockReturnValue(chain);
        await loadScript('c1.js', false, true);
        await loadScript('c2.js', false, false);
        expect(chain.done).toHaveBeenCalledTimes(2);
        expect(chain.fail).toHaveBeenCalledTimes(2);
    });

    it('triggerItemAction builds itemActionFn from the action expression when absent', () => {
        const scope: any = { userDefinedExecutionContext: { hit: jest.fn() } };
        triggerItemAction(scope, { action: 'hit()' });
        expect(typeof scope.itemActionFn).toBe('function');
    });

    it('isInsecureContentRequest relative url is not insecure', () => {
        expect(isInsecureContentRequest('relative/path')).toBe(false);
    });

    it('loadScript via script tag supports the legacy readyState (IE) path', async () => {
        Object.defineProperty(HTMLScriptElement.prototype, 'readyState', { configurable: true, get: () => 'loading' });
        try {
            const p = loadScript('ie1.js', true);
            const s = document.head.querySelector('script[src="ie1.js"]') as any;
            s.onreadystatechange();
            let settled = false;
            p.then(() => (settled = true));
            await Promise.resolve();
            expect(settled).toBe(false);
            Object.defineProperty(s, 'readyState', { configurable: true, get: () => 'complete' });
            s.onreadystatechange();
            await expect(p).resolves.toBe(true);
            expect(s.onreadystatechange).toBeNull();
        } finally {
            delete (HTMLScriptElement.prototype as any).readyState;
        }
    });
});
