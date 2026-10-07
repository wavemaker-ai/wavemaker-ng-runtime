import { getWmProjectProperties } from './wm-project-properties';

describe('wm-project-properties - cover', () => {
    afterEach(() => {
        delete (window as any)._WM_APP_PROPERTIES;
    });

    it('returns the declared global even when it holds a falsy value', () => {
        // the global is declared (typeof is not "undefined") but falsy, so the window check fails and the global branch is used
        (window as any)._WM_APP_PROPERTIES = null;
        expect(getWmProjectProperties()).toBeNull();
        (window as any)._WM_APP_PROPERTIES = 0;
        expect(getWmProjectProperties()).toBe(0);
    });
});
