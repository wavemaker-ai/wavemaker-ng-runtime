import { StatePersistence } from './state-persistence.service';

describe('StatePersistence coverage', () => {
    let svc: StatePersistence;

    beforeEach(() => {
        svc = new StatePersistence();
        localStorage.clear();
        sessionStorage.clear();
        window.history.replaceState({}, '', '/app/index');
    });

    afterEach(() => jest.restoreAllMocks());

    it('does neither push nor replace history for an unknown HISTORY_HANDLER', () => {
        const push = jest.spyOn(window.history, 'pushState');
        const replace = jest.spyOn(window.history, 'replaceState');
        (svc as any).HISTORY_HANDLER = 'none';
        svc.setStateParams('widget_state', 'W1', { a: 1 }, 'url');
        expect(push).not.toHaveBeenCalled();
        expect(replace).not.toHaveBeenCalled();
    });

    it('falls back to an empty object when the page state entry is not readable back', () => {
        // page state object whose entry for "key" always reads back falsy
        const pageState: any = {};
        Object.defineProperty(pageState, 'W1', { get: () => undefined, set: () => {}, enumerable: true, configurable: true });
        jest.spyOn(svc, 'getStateInformation').mockReturnValue({ Main: pageState });
        const widget: any = { getAppInstance: () => ({ activePageName: 'Main' }) };
        expect(() => svc.setStateParams('', 'W1', { a: 1 }, 'localstorage', widget)).not.toThrow();
        expect(JSON.parse(localStorage.getItem('appindex_wm_state'))).toHaveProperty('Main');
    });

    it('removeStateParam leaves state intact when the key is missing under an existing stateParam', () => {
        svc.setStateParams('widget_state', 'W1', { a: 1 }, 'localstorage');
        svc.removeStateParam('widget_state', 'unknown', undefined, 'localstorage');
        expect(JSON.parse(localStorage.getItem('appindex_wm_state'))).toEqual({ widget_state: { W1: { a: 1 } } });
    });
});
