import { _WM_APP_PROJECT, getWmProjectProperties, isIE } from '@wm/core';
import { getAccessToken, performAuthorization, removeAccessToken } from './oAuth.utils';

jest.mock('@wm/core', () => ({
    ...jest.requireActual('@wm/core'),
    isIE: jest.fn(() => false),
    getWmProjectProperties: jest.fn(() => ({})),
}));

const runKey = (provider: string) => `WM_RUN_${(_WM_APP_PROJECT as any).id}_${provider}.access_token`;
const sendMessage = () => window.dispatchEvent(new MessageEvent('message', { origin: window.location.origin }));

describe('oAuth.utils flows', () => {
    const originalId = (_WM_APP_PROJECT as any).id;
    let open: jest.SpyInstance;
    let uid = 0;
    const provider = () => `provider${++uid}`;

    const implicitInfo = (overrides: any = {}) => ({
        oauth2Flow: 'IMPLICIT',
        clientId: 'client-1',
        scopes: [{ name: 'read' }, { name: 'write' }],
        authorizationUrl: 'https://auth.example.com/authorize',
        ...overrides,
    });

    const pkceInfo = (overrides: any = {}) => ({
        oauth2Flow: 'AUTHORIZATION_CODE',
        oAuth2Pkce: { enabled: true, challengeMethod: 'plain' },
        clientId: 'client-1',
        scopes: [{ name: 'read' }],
        authorizationUrl: 'https://auth.example.com/authorize',
        accessTokenUrl: 'https://auth.example.com/token',
        ...overrides,
    });

    beforeEach(() => {
        (_WM_APP_PROJECT as any).id = 'proj1';
        localStorage.clear();
        (isIE as jest.Mock).mockReturnValue(false);
        (getWmProjectProperties as jest.Mock).mockReturnValue({});
        open = jest.spyOn(window, 'open').mockReturnValue({ closed: false } as any);
        jest.useFakeTimers();
    });

    afterEach(() => {
        jest.useRealTimers();
        open.mockRestore();
        (_WM_APP_PROJECT as any).id = originalId;
    });

    describe('removeAccessToken', () => {
        it('removes the run mode token of the provider', () => {
            localStorage.setItem(runKey('google'), 'tok');
            removeAccessToken('google');
            expect(getAccessToken('google', false)).toBeNull();
        });
    });

    describe('performAuthorization with an authorization url (default flow)', () => {
        it('opens the url in a popup and stores the token once the callback page posts a message', () => {
            const p = provider();
            const onSuccess = jest.fn();
            const removeProviderConfig = jest.fn();

            performAuthorization('https://auth/x', p, onSuccess, jest.fn(), {}, jest.fn(), removeProviderConfig);

            expect(open).toHaveBeenCalledWith('https://auth/x', '_blank', 'width=400,height=600');

            localStorage.setItem(`${p}.access_token`, 'tok');
            sendMessage();
            jest.runOnlyPendingTimers();

            expect(removeProviderConfig).toHaveBeenCalledWith(p);
            expect(localStorage.getItem(`${p}.access_token`)).toBeNull();
            expect(getAccessToken(p, false)).toBe('tok');
            expect(onSuccess).toHaveBeenCalledWith('tok');
        });

        it('does nothing on a message before any token is stored', () => {
            const p = provider();
            const onSuccess = jest.fn();
            performAuthorization('https://auth/x', p, onSuccess, jest.fn(), {}, jest.fn(), jest.fn());
            sendMessage();
            jest.runOnlyPendingTimers();
            expect(onSuccess).not.toHaveBeenCalled();
        });

        it('ignores messages posted from another origin', () => {
            const p = provider();
            const onSuccess = jest.fn();
            performAuthorization('https://auth/x', p, onSuccess, jest.fn(), {}, jest.fn(), jest.fn());

            localStorage.setItem(`${p}.access_token`, 'tok');
            window.dispatchEvent(new MessageEvent('message', { origin: 'https://evil.example.com' }));
            jest.runOnlyPendingTimers();

            expect(onSuccess).not.toHaveBeenCalled();
            expect(localStorage.getItem(`${p}.access_token`)).toBe('tok');
        });

        it('reports an error when the popup is closed before authorizing', () => {
            open.mockReturnValue({ closed: true } as any);
            const onSuccess = jest.fn();
            performAuthorization('https://auth/x', provider(), onSuccess, jest.fn(), {}, jest.fn(), jest.fn());
            expect(onSuccess).toHaveBeenCalledWith('error');
        });

        it('keeps polling the popup and reports an error once it is closed', () => {
            const popup = { closed: false };
            open.mockReturnValue(popup as any);
            const onSuccess = jest.fn();
            performAuthorization('https://auth/x', provider(), onSuccess, jest.fn(), {}, jest.fn(), jest.fn());

            jest.advanceTimersByTime(3000);
            expect(onSuccess).not.toHaveBeenCalled();

            popup.closed = true;
            jest.advanceTimersByTime(3000);
            expect(onSuccess).toHaveBeenCalledWith('error');
        });

        it('stops polling after the authorization succeeded', () => {
            const popup = { closed: false };
            open.mockReturnValue(popup as any);
            const p = provider();
            const onSuccess = jest.fn();
            performAuthorization('https://auth/x', p, onSuccess, jest.fn(), {}, jest.fn(), jest.fn());

            localStorage.setItem(`${p}.access_token`, 'tok');
            sendMessage();
            jest.runOnlyPendingTimers();
            popup.closed = true;
            jest.advanceTimersByTime(6000);

            expect(onSuccess).toHaveBeenCalledTimes(1);
            expect(onSuccess).toHaveBeenCalledWith('tok');
        });
    });

    describe('performAuthorization without a url', () => {
        it('fetches the authorization url, registers the provider and opens it on invoke', async () => {
            jest.useRealTimers();
            open.mockReturnValue({ closed: true } as any);
            const p = provider();
            const http = { send: jest.fn().mockResolvedValue({ body: 'https://auth/fetched' }) };
            const addProviderConfig = jest.fn();

            await performAuthorization(null, p, jest.fn(), jest.fn(), http, addProviderConfig, jest.fn());

            const settings = http.send.mock.calls[0][0];
            expect(settings.url).toBe(`services/oauth2/${p}/authorizationUrl`);
            expect(settings.params).toEqual({ requestSourceType: 'WEB' });

            const registered = addProviderConfig.mock.calls[0][0];
            expect(registered.name).toBe(p);
            expect(registered.url).toBe('https://auth/fetched');

            registered.invoke();
            expect(open).toHaveBeenCalledWith('https://auth/fetched', '_blank', 'width=400,height=600');
        });

        it('handles the sign in through the IE flow when running in IE', async () => {
            jest.useRealTimers();
            (isIE as jest.Mock).mockReturnValue(true);
            const p = provider();
            const onSuccess = jest.fn();
            const http = { send: jest.fn().mockResolvedValue({ body: 'https://auth/fetched' }) };
            const addProviderConfig = jest.fn();

            await performAuthorization(null, p, onSuccess, jest.fn(), http, addProviderConfig, jest.fn());
            localStorage.setItem(`${p}.access_token`, 'ie-token');
            addProviderConfig.mock.calls[0][0].invoke();

            expect(open).toHaveBeenCalledWith(expect.anything(), '_blank', 'width=400,height=600');
            expect(onSuccess).toHaveBeenCalledWith();
            expect(getAccessToken(p, false)).toBe('ie-token');
        });
    });

    describe('implicit flow', () => {
        it('registers the provider with the url of the flow and builds the authorization url on invoke', () => {
            const p = provider();
            const addProviderConfig = jest.fn();

            performAuthorization(undefined, p, jest.fn(), jest.fn(), {}, addProviderConfig, jest.fn(), implicitInfo());
            addProviderConfig.mock.calls[0][0].invoke();

            const url: string = open.mock.calls[0][0];
            expect(url).toContain('https://auth.example.com/authorize?client_id=client-1');
            expect(url).toContain(`redirect_uri=${window.location.href.split('/#/')[0]}/oAuthCallback.html`);
            expect(url).toContain('scope=read%20write');
            expect(url).toContain('response_type=token');
            const state = JSON.parse(decodeURIComponent(url.match(/state=([^&]+)/)![1]));
            expect(state).toEqual({ providerId: p, suffix: '.access_token', requestSourceType: 'WEB', flow: 'implicit' });
        });

        it('uses the configured response type', () => {
            const addProviderConfig = jest.fn();
            performAuthorization(undefined, provider(), jest.fn(), jest.fn(), {}, addProviderConfig, jest.fn(), implicitInfo({ responseType: 'id_token' }));
            addProviderConfig.mock.calls[0][0].invoke();
            expect(open.mock.calls[0][0]).toContain('response_type=id_token');
        });

        it('appends client_id with & when the authorization url already has query params', () => {
            const addProviderConfig = jest.fn();
            performAuthorization(undefined, provider(), jest.fn(), jest.fn(), {}, addProviderConfig, jest.fn(),
                implicitInfo({ authorizationUrl: 'https://auth.example.com/authorize?tenant=a' }));
            addProviderConfig.mock.calls[0][0].invoke();
            expect(open.mock.calls[0][0]).toContain('authorize?tenant=a&client_id=client-1');
        });

        it('appends client_id directly when the authorization url ends with ?', () => {
            const addProviderConfig = jest.fn();
            performAuthorization(undefined, provider(), jest.fn(), jest.fn(), {}, addProviderConfig, jest.fn(),
                implicitInfo({ authorizationUrl: 'https://auth.example.com/authorize?' }));
            addProviderConfig.mock.calls[0][0].invoke();
            expect(open.mock.calls[0][0]).toContain('authorize?client_id=client-1');
        });

        it('uses the studio callback page for test runtimes', () => {
            (getWmProjectProperties as jest.Mock).mockReturnValue({ isTestRuntime: true });
            const addProviderConfig = jest.fn();
            performAuthorization(undefined, provider(), jest.fn(), jest.fn(), {}, addProviderConfig, jest.fn(), implicitInfo());
            addProviderConfig.mock.calls[0][0].invoke();
            expect(open.mock.calls[0][0]).toContain(`redirect_uri=${window.location.protocol}//${window.location.host}/studio/oAuthCallback.html`);
        });

        it('rebuilds the url for an implicit provider when a url is supplied', () => {
            performAuthorization('ignored', provider(), jest.fn(), jest.fn(), {}, jest.fn(), jest.fn(), implicitInfo());
            expect(open.mock.calls[0][0]).toContain('response_type=token');
        });

        it('handles the implicit sign in through the IE flow', () => {
            (isIE as jest.Mock).mockReturnValue(true);
            const p = provider();
            const onSuccess = jest.fn();
            localStorage.setItem(`${p}.access_token`, 'tok');

            performAuthorization('https://auth/x', p, onSuccess, jest.fn(), {}, jest.fn(), jest.fn());

            expect(open).toHaveBeenCalledWith('https://auth/x', '_blank', 'width=400,height=600');
            expect(onSuccess).toHaveBeenCalled();
        });

        it('rebuilds the url in the IE flow for an implicit provider', () => {
            (isIE as jest.Mock).mockReturnValue(true);
            const addProviderConfig = jest.fn();
            performAuthorization(undefined, provider(), jest.fn(), jest.fn(), {}, addProviderConfig, jest.fn(), implicitInfo());
            addProviderConfig.mock.calls[0][0].invoke();
            expect(open.mock.calls[0][0]).toContain('response_type=token');
        });
    });

    describe('IE polling', () => {
        it('reports an error when no token shows up for more than a minute', () => {
            jest.setSystemTime(new Date('2026-01-01T10:00:00'));
            (isIE as jest.Mock).mockReturnValue(true);
            const onSuccess = jest.fn();

            performAuthorization('https://auth/x', provider(), onSuccess, jest.fn(), {}, jest.fn(), jest.fn());
            expect(onSuccess).not.toHaveBeenCalled();

            jest.advanceTimersByTime(3 * 60 * 1000);

            expect(onSuccess).toHaveBeenCalledWith('error');
        });

        it('keeps polling until the token is stored', () => {
            jest.setSystemTime(new Date('2026-01-01T10:00:00'));
            (isIE as jest.Mock).mockReturnValue(true);
            const p = provider();
            const removeProviderConfig = jest.fn();
            const onSuccess = jest.fn();

            performAuthorization('https://auth/x', p, onSuccess, jest.fn(), {}, jest.fn(), removeProviderConfig);
            jest.advanceTimersByTime(3000);
            expect(onSuccess).not.toHaveBeenCalled();

            localStorage.setItem(`${p}.access_token`, 'late');
            jest.advanceTimersByTime(3000);

            expect(onSuccess).toHaveBeenCalledWith();
            expect(removeProviderConfig).toHaveBeenCalledWith(p);
            expect(getAccessToken(p, false)).toBe('late');
        });
    });

    describe('PKCE flow', () => {
        let originalCrypto: any;

        beforeAll(() => {
            originalCrypto = (window as any).crypto;
            if (!window.crypto || !window.crypto.getRandomValues) {
                Object.defineProperty(window, 'crypto', {
                    configurable: true,
                    value: { getRandomValues: (arr: Uint32Array) => arr.fill(7) },
                });
            }
        });

        afterAll(() => {
            Object.defineProperty(window, 'crypto', { configurable: true, value: originalCrypto });
            delete (window as any).jsSHA;
        });

        it('uses the verifier as the challenge for the plain method', () => {
            const addProviderConfig = jest.fn();
            performAuthorization(undefined, provider(), jest.fn(), jest.fn(), {}, addProviderConfig, jest.fn(), pkceInfo());
            addProviderConfig.mock.calls[0][0].invoke();

            const url: string = open.mock.calls[0][0];
            expect(url).toContain('response_type=code');
            expect(url).toContain('code_challenge_method=plain');
            expect(url).toMatch(/code_challenge=[0-9a-f]{56}&/);
        });

        it('hashes the verifier with SHA-256 and base64url encodes it otherwise', () => {
            (window as any).jsSHA = class {
                update() {}
                getHash() {
                    return new Uint8Array([251, 255, 254]).buffer;
                }
            };
            const addProviderConfig = jest.fn();
            performAuthorization(undefined, provider(), jest.fn(), jest.fn(), {}, addProviderConfig, jest.fn(),
                pkceInfo({ oAuth2Pkce: { enabled: true, challengeMethod: 'S256' } }));
            addProviderConfig.mock.calls[0][0].invoke();

            const url: string = open.mock.calls[0][0];
            expect(url).toContain('code_challenge=-__-');
            expect(url).toContain('code_challenge_method=S256');
        });

        it('exchanges the returned code for an access token', async () => {
            jest.useRealTimers();
            open.mockReturnValue({ closed: true } as any);
            const p = provider();
            const info = pkceInfo();
            const onSuccess = jest.fn();
            const removeProviderConfig = jest.fn();
            const http = { send: jest.fn().mockResolvedValue({ body: { access_token: 'exchanged' } }) };
            const addProviderConfig = jest.fn();

            performAuthorization(undefined, p, onSuccess, jest.fn(), http, addProviderConfig, removeProviderConfig, info);
            addProviderConfig.mock.calls[0][0].invoke();

            localStorage.setItem(`${p}.access_token`, 'auth-code');
            sendMessage();
            await new Promise((resolve) => setTimeout(resolve, 20));

            const request = http.send.mock.calls[0][0];
            expect(request.method).toBe('POST');
            expect(request.url).toBe('https://auth.example.com/token');
            expect(request.headers['Content-Type']).toBe('application/x-www-form-urlencoded');
            expect(request.data).toContain('client_id=client-1&code=auth-code&grant_type=authorization_code&code_verifier=');
            expect(getAccessToken(p, false)).toBe('exchanged');
            expect(onSuccess).toHaveBeenCalledWith('exchanged');
            expect(removeProviderConfig).toHaveBeenCalledWith(p);
        });

        it('exchanges the code when an authorization url is passed along with a PKCE provider', async () => {
            jest.useRealTimers();
            open.mockReturnValue({ closed: true } as any);
            const p = provider();
            const onSuccess = jest.fn();
            const http = { send: jest.fn().mockResolvedValue({ body: { access_token: 'exchanged' } }) };

            performAuthorization('https://auth/x', p, onSuccess, jest.fn(), http, jest.fn(), jest.fn(), pkceInfo());

            localStorage.setItem(`${p}.access_token`, 'auth-code');
            sendMessage();
            await new Promise((resolve) => setTimeout(resolve, 20));

            expect(http.send).toHaveBeenCalledTimes(1);
            expect(onSuccess).toHaveBeenCalledWith('exchanged');
        });

        it('logs instead of rejecting unhandled when the token request fails', async () => {
            jest.useRealTimers();
            open.mockReturnValue({ closed: true } as any);
            const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
            const p = provider();
            const onSuccess = jest.fn();
            const http = { send: jest.fn().mockRejectedValue(new Error('invalid_grant')) };
            const addProviderConfig = jest.fn();

            performAuthorization(undefined, p, onSuccess, jest.fn(), http, addProviderConfig, jest.fn(), pkceInfo());
            addProviderConfig.mock.calls[0][0].invoke();

            localStorage.setItem(`${p}.access_token`, 'auth-code');
            sendMessage();
            await new Promise((resolve) => setTimeout(resolve, 20));

            expect(consoleError).toHaveBeenCalledWith(expect.stringContaining(p), expect.any(Error));
            expect(onSuccess).not.toHaveBeenCalled();
            consoleError.mockRestore();
        });

        it('keeps waiting when the popup is closed during a PKCE flow', () => {
            open.mockReturnValue({ closed: true } as any);
            const onSuccess = jest.fn();
            const addProviderConfig = jest.fn();
            performAuthorization(undefined, provider(), onSuccess, jest.fn(), {}, addProviderConfig, jest.fn(), pkceInfo());
            addProviderConfig.mock.calls[0][0].invoke();
            expect(onSuccess).not.toHaveBeenCalled();
        });
    });
});
