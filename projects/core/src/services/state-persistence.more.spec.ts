import { StatePersistence } from './state-persistence.service';

const widgetOf = (name: string, page = 'Main', extra: any = {}) => ({
    statehandler: extra.statehandler,
    viewParent: extra.viewParent,
    getWidget: () => ({ name }),
    getAppInstance: () => ({ activePageName: page })
});

const currentState = () => {
    const m = decodeURIComponent(window.location.href).match(/wm_state=(.*?)(&|$)/);
    return m ? m[1] : null;
};

describe('StatePersistence (real storage / history)', () => {
    let svc: StatePersistence;

    beforeEach(() => {
        svc = new StatePersistence();
        localStorage.clear();
        sessionStorage.clear();
        window.history.replaceState({}, '', '/app/index');
    });

    afterEach(() => jest.restoreAllMocks());

    describe('getStateInformation', () => {
        it('returns undefined when the url has no wm_state', () => {
            expect(svc.getStateInformation('url')).toBeUndefined();
        });

        it('parses wm_state from the url', () => {
            svc.setStateVariable('v', { a: 1 }, 'url');
            expect(svc.getStateInformation('URL')).toEqual({ v: { a: 1 } });
        });

        it('reads local and session storage entries keyed by pathname', () => {
            localStorage.setItem('appindex_wm_state', JSON.stringify({ l: 1 }));
            sessionStorage.setItem('appindex_wm_state', JSON.stringify({ s: 2 }));
            expect(svc.getStateInformation('localStorage')).toEqual({ l: 1 });
            expect(svc.getStateInformation('sessionStorage')).toEqual({ s: 2 });
        });

        it('returns undefined for storage with nothing stored and for unknown modes', () => {
            expect(svc.getStateInformation('localstorage')).toBeUndefined();
            expect(svc.getStateInformation('sessionstorage')).toBeUndefined();
            expect(svc.getStateInformation('cookie')).toBeUndefined();
        });
    });

    describe('computeMode / setHistoryHandler', () => {
        it('computeMode defaults to url, none disables, others lowercase', () => {
            expect(svc.computeMode(undefined)).toBe('url');
            expect(svc.computeMode('NONE')).toBeUndefined();
            expect(svc.computeMode('LocalStorage')).toBe('localstorage');
        });

        it('setHistoryHandler: push uses pushState, replace uses replaceState, invalid ignored', () => {
            const push = jest.spyOn(window.history, 'pushState');
            const replace = jest.spyOn(window.history, 'replaceState');
            svc.setHistoryHandler('bogus');
            svc.setStateVariable('a', 'x', 'url');
            expect(replace).toHaveBeenCalledTimes(1);
            expect(push).not.toHaveBeenCalled();
            svc.setHistoryHandler('push');
            svc.setStateVariable('b', 'y', 'url');
            expect(push).toHaveBeenCalledTimes(1);
            expect(window.location.href).toContain('wm_state=');
        });
    });

    describe('getNestedPath', () => {
        it('builds nested prefab/partial path and reverses it', () => {
            const pageParent = { };
            const partialParent = { partialName: 'Partial1', containerWidget: { name: 'container1', viewParent: pageParent } };
            expect(svc.getNestedPath(partialParent, 'tabs1')).toBe('container1.Partial1.tabs1');
            const prefab = { prefabName: 'MyPrefab', containerWidget: { name: 'pf1', viewParent: partialParent } };
            expect(svc.getNestedPath(prefab, 'tabs1')).toBe('container1.Partial1.pf1.MyPrefab.tabs1');
            expect(svc.getNestedPath(undefined, 'tabs1')).toBe('tabs1');
        });

        it('handles an empty widget name when nested', () => {
            const vp = { partialName: 'P', containerWidget: { name: 'c', viewParent: null as any } };
            expect(svc.getNestedPath(vp, '')).toBe('c.P');
        });
    });

    describe('url mode round trips', () => {
        it('set/get/remove state variable', () => {
            svc.setStateVariable('var1', { a: 1, b: 'x y' });
            expect(svc.getStateVariable('var1')).toEqual({ a: 1, b: 'x y' });
            svc.setStateVariable('var1', { c: 2 });
            expect(svc.getStateVariable('var1')).toEqual({ a: 1, b: 'x y', c: 2 });
            svc.setStateVariable('arr', ['1', '2']);
            expect(svc.getStateVariable('arr')).toEqual(['1', '2']);
            svc.removeStateVariable('arr');
            expect(svc.getStateVariable('arr')).toBeUndefined();
            svc.removeStateVariable('var1');
            expect(currentState()).toBeNull();
            expect(window.location.href).not.toContain('wm_state');
        });

        it('escapes reserved characters in values and round-trips them', () => {
            const value = { t: "it's (a) ~test_ ! *{}" };
            svc.setStateVariable('v', value);
            expect(svc.getStateVariable('v')).toEqual(value);
        });

        it('appends wm_state with & when other query params exist, and preserves them', () => {
            window.history.replaceState({}, '', '/app/index?x=1');
            svc.setStateVariable('v', { a: 1 });
            expect(window.location.search).toContain('x=1&wm_state=');
            svc.setStateVariable('v', { a: 2 });
            expect(svc.getStateVariable('v')).toEqual({ a: 2 });
            svc.removeStateVariable('v');
            expect(window.location.search).toBe('?x=1');
        });

        it('does not touch history when the url would not change', () => {
            svc.setStateVariable('v', { a: 1 });
            const replace = jest.spyOn(window.history, 'replaceState');
            svc.setStateVariable('v', { a: 1 });
            expect(replace).not.toHaveBeenCalled();
        });

        it('removeStateVariable is a no-op when key absent', () => {
            const replace = jest.spyOn(window.history, 'replaceState');
            svc.removeStateVariable('nothing');
            expect(replace).not.toHaveBeenCalled();
        });

        it('getStateVariable returns undefined with no state', () => {
            expect(svc.getStateVariable('nothing')).toBeUndefined();
        });

        it('uriToJson swallows malformed state, warns and returns undefined', () => {
            const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
            window.history.replaceState({}, '', '/app/index?wm_state=(((');
            expect(svc.getStateInformation('url')).toBeUndefined();
            expect(warn).toHaveBeenCalled();
        });
    });

    describe('widget state', () => {
        it('set/get/remove widget state in url mode', () => {
            const w = widgetOf('table1');
            svc.setWidgetState(w, { pagination: '2', selectedItem: [{ i: 1 }] });
            expect(svc.getWidgetState(w)).toEqual({ pagination: '2', selectedItem: [{ i: 1 }] });
            svc.removeWidgetState(w, 'pagination');
            expect(svc.getWidgetState(w)).toEqual({ selectedItem: [{ i: 1 }] });
            svc.removeWidgetState(w);
            expect(svc.getWidgetState(w)).toBeUndefined();
        });

        it('statehandler "none" disables get/set/remove', () => {
            const w = widgetOf('table1', 'Main', { statehandler: 'none' });
            const replace = jest.spyOn(window.history, 'replaceState');
            svc.setWidgetState(w, { a: 1 });
            svc.removeWidgetState(w, 'a');
            expect(svc.getWidgetState(w)).toBeUndefined();
            expect(replace).not.toHaveBeenCalled();
        });

        it('widget state with explicit mode override and nested viewParent', () => {
            const vp = { partialName: 'P1', containerWidget: { name: 'c1', viewParent: null as any } };
            const w = widgetOf('t', 'Main', { viewParent: vp });
            svc.setWidgetState(w, { a: 1 }, 'sessionstorage');
            const stored = JSON.parse(sessionStorage.getItem('appindex_wm_state'));
            expect(stored).toEqual({ Main: { ws: { 'c1.P1.t': { a: 1 } } } });
            expect(svc.getWidgetState(w, 'sessionstorage')).toEqual({ a: 1 });
        });

        it('storage modes keep per-page state and preserve other pages', () => {
            const a = widgetOf('t1', 'PageA');
            const b = widgetOf('t2', 'PageB');
            svc.setWidgetState(a, { x: 1 }, 'localstorage');
            svc.setWidgetState(b, { y: 2 }, 'localstorage');
            expect(JSON.parse(localStorage.getItem('appindex_wm_state'))).toEqual({
                PageA: { ws: { t1: { x: 1 } } },
                PageB: { ws: { t2: { y: 2 } } }
            });
            expect(svc.getWidgetState(a, 'localstorage')).toEqual({ x: 1 });
            expect(svc.getWidgetState(widgetOf('zzz', 'PageA'), 'localstorage')).toBeUndefined();

            svc.removeWidgetState(a, undefined, 'localstorage');
            const after = JSON.parse(localStorage.getItem('appindex_wm_state'));
            expect(after.PageA).toEqual({});
            expect(after.PageB).toEqual({ ws: { t2: { y: 2 } } });
        });

        it('removeWidgetState with a sub key in storage mode removes only that key', () => {
            const w = widgetOf('t1', 'PageA');
            svc.setWidgetState(w, { x: 1, y: 2 }, 'localstorage');
            svc.removeWidgetState(w, 'x', 'localstorage');
            expect(svc.getWidgetState(w, 'localstorage')).toEqual({ y: 2 });
        });

        it('removeWidgetState does nothing when no state exists for the widget', () => {
            const w = widgetOf('t1', 'PageA');
            svc.removeWidgetState(w, 'x', 'localstorage');
            expect(localStorage.getItem('appindex_wm_state')).toBeNull();
        });

        it('getWidgetState returns undefined when no ws section', () => {
            svc.setStateVariable('other', { a: 1 });
            expect(svc.getWidgetState(widgetOf('t'))).toBeUndefined();
        });

        it('setStateParams with primitive value for widget key stores it as is', () => {
            svc.setStateParams('ws', 't', 'plain', 'url');
            expect(svc.getStateInformation('url')).toEqual({ ws: { t: 'plain' } });
        });

        it('setStateParams in storage mode without widget stores flat object', () => {
            svc.setStateParams('', 'k', 5, 'sessionstorage');
            expect(JSON.parse(sessionStorage.getItem('appindex_wm_state'))).toEqual({ k: 5 });
            svc.setStateParams('', 'k2', { z: 1 }, 'sessionstorage');
            expect(svc.getStateVariable('k2', 'sessionstorage')).toEqual({ z: 1 });
        });

        it('removeStateParam with empty stateParam deletes top-level key', () => {
            svc.setStateVariable('a', 'v', 'localstorage');
            svc.setStateVariable('b', 'w', 'localstorage');
            svc.removeStateVariable('a', 'localstorage');
            expect(JSON.parse(localStorage.getItem('appindex_wm_state'))).toEqual({ b: 'w' });
        });

        it('removeWidgetState persists to sessionStorage for the active page', () => {
            const w = widgetOf('t1', 'PageA');
            svc.setWidgetState(w, { x: 1, y: 2 }, 'sessionstorage');
            svc.removeWidgetState(w, 'x', 'sessionstorage');
            expect(JSON.parse(sessionStorage.getItem('appindex_wm_state'))).toEqual({ PageA: { ws: { t1: { y: 2 } } } });
        });
    });
});
