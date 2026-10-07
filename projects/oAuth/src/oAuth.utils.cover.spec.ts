import { _WM_APP_PROJECT, isIE } from '@wm/core';
import { getAccessToken, parseConfig, performAuthorization } from './oAuth.utils';

jest.mock('@wm/core', () => ({
    ...jest.requireActual('@wm/core'),
    isIE: jest.fn(() => false),
    getWmProjectProperties: jest.fn(() => ({})),
}));

const sendMessage = () => window.dispatchEvent(new MessageEvent('message', { origin: window.location.origin }));

describe('oAuth.utils - remaining branches', () => {
    const originalId = (_WM_APP_PROJECT as any).id;
    let open: jest.SpyInstance;
    let uid = 0;
    const provider = () => `coverprovider${++uid}`;

    beforeEach(() => {
        (_WM_APP_PROJECT as any).id = 'proj-cover';
        localStorage.clear();
        (isIE as jest.Mock).mockReturnValue(false);
        open = jest.spyOn(window, 'open').mockReturnValue({ closed: false } as any);
        jest.useFakeTimers();
    });
    afterEach(() => {
        jest.useRealTimers();
        open.mockRestore();
        (_WM_APP_PROJECT as any).id = originalId;
    });

    it('parseConfig ignores inherited url params', () => {
        const urlParams = Object.create({ inherited: 'x' });
        urlParams.providerId = 'p1';
        const cfg = parseConfig({ urlParams });
        expect(cfg.url).toBe('services/oauth2/p1/authorizationUrl');
        expect(cfg.url).not.toContain('inherited');
        const inheritedOnly = parseConfig({ urlParams: Object.create({ providerId: 'zzz' }) });
        expect(inheritedOnly.url).toBe('services/oauth2/:providerId/authorizationUrl');
    });

    it('stores the token without a success callback', () => {
        const p = provider();
        const removeCfg = jest.fn();
        performAuthorization('https://auth/x', p, null, jest.fn(), {}, jest.fn(), removeCfg);
        localStorage.setItem(`${p}.access_token`, 'tok2');
        sendMessage();
        expect(() => jest.runOnlyPendingTimers()).not.toThrow();
        expect(removeCfg).toHaveBeenCalledWith(p);
        expect(getAccessToken(p, false)).toBe('tok2');
    });

    it('cleans up silently when the popup closes and there is no callback', () => {
        open.mockReturnValue({ closed: true } as any);
        const remove = jest.spyOn(window, 'removeEventListener');
        expect(() => performAuthorization('https://auth/x', provider(), null, jest.fn(), {}, jest.fn(), jest.fn())).not.toThrow();
        expect(remove).toHaveBeenCalledWith('message', expect.any(Function));
        remove.mockRestore();
    });

    it('IE flow stores the token without a success callback', () => {
        (isIE as jest.Mock).mockReturnValue(true);
        const p = provider();
        const removeCfg = jest.fn();
        localStorage.setItem(`${p}.access_token`, 'ie-tok');
        performAuthorization('https://auth/x', p, null, jest.fn(), {}, jest.fn(), removeCfg);
        expect(removeCfg).toHaveBeenCalledWith(p);
        expect(getAccessToken(p, false)).toBe('ie-tok');
    });
});

describe('oAuth.utils - moment fallback', () => {
    it('falls back to window.moment when the moment module has no default export', () => {
        jest.isolateModules(() => {
            const fmt = jest.fn(() => '10:00');
            const duration = { subtract: jest.fn(() => ({ minutes: () => 0 })) };
            const fake: any = jest.fn(() => ({ format: fmt }));
            fake.duration = jest.fn(() => duration);
            (window as any).moment = fake;
            jest.doMock('moment', () => ({ __esModule: true }));
            jest.doMock('@wm/core', () => ({
                ...jest.requireActual('@wm/core'),
                isIE: jest.fn(() => true),
                getWmProjectProperties: jest.fn(() => ({})),
            }));
            const mod = require('./oAuth.utils');
            jest.spyOn(window, 'open').mockReturnValue({ closed: false } as any);
            jest.useFakeTimers();
            mod.performAuthorization('https://auth/x', 'momentprov', jest.fn(), jest.fn(), {}, jest.fn(), jest.fn());
            expect(fake.duration).toHaveBeenCalledWith('10:00', 'HH:mm');
            jest.clearAllTimers();
            jest.useRealTimers();
            delete (window as any).moment;
        });
    });
});
