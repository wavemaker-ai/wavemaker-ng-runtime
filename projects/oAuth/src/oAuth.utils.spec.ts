import { _WM_APP_PROJECT } from '@wm/core';
import { parseConfig, getAccessToken } from './oAuth.utils';

describe('oAuth.utils', () => {
    describe('parseConfig', () => {
        it('should return the default authorization url config when nothing extra is provided', () => {
            const config = parseConfig({});
            expect(config.url).toBe('services/oauth2/:providerId/authorizationUrl');
            expect(config.method).toBe('GET');
        });

        it('should prefix the url and override the method from serviceParams.config', () => {
            const config = parseConfig({ config: { url: 'https://host/', method: 'POST', headers: { 'X-A': '1' } } });
            expect(config.url).toBe('https://host/services/oauth2/:providerId/authorizationUrl');
            expect(config.method).toBe('POST');
            expect(config.headers['X-A']).toBe('1');
        });

        it('should substitute url params present in the url', () => {
            const config = parseConfig({ urlParams: { providerId: 'google' } });
            expect(config.url).toBe('services/oauth2/google/authorizationUrl');
        });

        it('should skip substitution for undefined/null url param values', () => {
            const config = parseConfig({ urlParams: { providerId: undefined } });
            expect(config.url).toBe('services/oauth2/:providerId/authorizationUrl');
        });

        it('should set params and data when provided', () => {
            const config = parseConfig({ params: { a: 1 }, data: { b: 2 } });
            expect(config.params).toEqual({ a: 1 });
            expect(config.data).toEqual({ b: 2 });
        });

        it('should attach dataParams onto config.data.params when data is already present', () => {
            const config = parseConfig({ data: {}, dataParams: { c: 3 } });
            expect(config.data.params).toEqual({ c: 3 });
        });

        it('should let serviceParams.headers override any config.headers set earlier', () => {
            const config = parseConfig({ config: { headers: { 'X-A': '1' } }, headers: { 'X-B': '2' } });
            expect(config.headers).toEqual({ 'X-B': '2' });
        });

        it('should copy the extra config flags from serviceParams', () => {
            const config = parseConfig({
                byPassResult: true, isDirectCall: true, isExtURL: false, preventMultiple: true, responseType: 'json',
            });
            expect(config.byPassResult).toBe(true);
            expect(config.isDirectCall).toBe(true);
            expect(config.isExtURL).toBe(false);
            expect(config.preventMultiple).toBe(true);
            expect(config.responseType).toBe('json');
        });
    });

    describe('getAccessToken', () => {
        const originalId = (_WM_APP_PROJECT as any).id;

        beforeEach(() => {
            (_WM_APP_PROJECT as any).id = 'proj1';
            localStorage.clear();
        });

        afterAll(() => {
            (_WM_APP_PROJECT as any).id = originalId;
        });

        it('should read the run-mode placeholder key by default', () => {
            localStorage.setItem('WM_RUN_proj1_google.access_token', 'token-abc');
            expect(getAccessToken('google', false)).toBe('token-abc');
        });

        it('should read directly by provider name when checkLocalStorage is true', () => {
            localStorage.setItem('google.access_token', 'token-xyz');
            expect(getAccessToken('google', true)).toBe('token-xyz');
        });

        it('should return null when no token is stored', () => {
            expect(getAccessToken('unknown', false)).toBeNull();
        });
    });
});
