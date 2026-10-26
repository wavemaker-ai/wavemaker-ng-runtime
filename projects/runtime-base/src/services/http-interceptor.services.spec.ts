import { HttpRequest, HttpResponse } from '@angular/common/http';
import { Observable, of, throwError } from 'rxjs';

let mockAppManager: any;
const mockHttpService: any = {};
const mockProject: any = { apiUrl: 'api/' };

jest.mock('@wm/variables', () => ({
    ...jest.requireActual('@wm/variables'),
    get appManager() { return mockAppManager; },
    get httpService() { return mockHttpService; }
}));
jest.mock('@wm/http', () => ({
    WmHttpRequest: class {
        angularToWmRequest = jest.fn(r => ({ wm: r.url }));
        wmToAngularRequest = jest.fn(r => new (jest.requireActual('@angular/common/http').HttpRequest)('GET', r.url));
    },
    WmHttpResponse: class {
        angularToWmResponse = jest.fn(r => ({ body: r.body, message: r.message }));
        wmToAngularResponse = jest.fn(r => ({ body: r.body }));
    }
}));
jest.mock('@wm/core', () => ({
    ...jest.requireActual('@wm/core'),
    get _WM_APP_PROJECT() { return mockProject; }
}));

import { HttpCallInterceptor } from './http-interceptor.services';

describe('HttpCallInterceptor', () => {
    let interceptor: HttpCallInterceptor;
    let next: any;
    let lastRequest: HttpRequest<any>;

    const run = (req: HttpRequest<any>) =>
        new Promise<any>((resolve, reject) => {
            const results: any[] = [];
            interceptor.intercept(req, next).subscribe({
                next: v => results.push(v),
                error: e => reject(e),
                complete: () => resolve(results)
            });
        });

    beforeEach(() => {
        mockAppManager = {
            appOnBeforeServiceCall: jest.fn(),
            appOnServiceSuccess: jest.fn(),
            appOnServiceError: jest.fn()
        };
        mockHttpService.isPlatformSessionTimeout = jest.fn(() => false);
        mockHttpService.handleSessionTimeout = jest.fn();
        next = {
            handle: jest.fn((r: HttpRequest<any>): Observable<any> => {
                lastRequest = r;
                return of(new HttpResponse({ body: { ok: 1 }, status: 200 }));
            })
        };
        interceptor = new HttpCallInterceptor();
    });

    describe('url handling', () => {
        it('detects absolute urls', () => {
            expect(interceptor.isAbsoluteUrl('https://x.com/a')).toBe(true);
            expect(interceptor.isAbsoluteUrl('HTTP://x')).toBe(true);
            expect(interceptor.isAbsoluteUrl('services/a')).toBe(false);
        });

        it.each([
            'services/foo',
            'j_spring_security_check',
            'j_spring_security_logout',
            'x/oAuthCallback.html',
            'resources/i18n/en.json',
            'prefabs/p/config.json'
        ])('prefixes relative api url %s with the api url', async (url) => {
            await run(new HttpRequest('GET', url));
            expect(lastRequest.url).toBe('api/' + url);
        });

        it('leaves absolute and other relative urls alone', async () => {
            await run(new HttpRequest('GET', 'https://x.com/services/a'));
            expect(lastRequest.url).toBe('https://x.com/services/a');
            await run(new HttpRequest('GET', 'pages/a.json'));
            expect(lastRequest.url).toBe('pages/a.json');
        });
    });

    describe('before service call', () => {
        it('replaces the request when the hook returns a modified one', async () => {
            mockAppManager.appOnBeforeServiceCall.mockReturnValue({ url: 'modified' });
            await run(new HttpRequest('GET', 'pages/a.json'));
            expect(mockAppManager.appOnBeforeServiceCall).toHaveBeenCalledWith({ wm: 'pages/a.json' });
            expect(lastRequest.url).toBe('modified');
        });

        it('keeps the request when the hook returns nothing', async () => {
            await run(new HttpRequest('GET', 'pages/a.json'));
            expect(lastRequest.url).toBe('pages/a.json');
        });

        it('skips the hook when the app manager has none or does not exist', async () => {
            mockAppManager = {};
            await run(new HttpRequest('GET', 'pages/a.json'));
            mockAppManager = undefined;
            await run(new HttpRequest('GET', 'pages/b.json'));
            expect(lastRequest.url).toBe('pages/b.json');
        });
    });

    describe('success handling', () => {
        it('notifies on completed responses and merges a modified response', async () => {
            mockAppManager.appOnServiceSuccess.mockReturnValue({ body: { changed: true } });
            const [resp] = await run(new HttpRequest('GET', 'pages/a.json'));
            expect(mockAppManager.appOnServiceSuccess).toHaveBeenCalled();
            expect(resp.body).toEqual({ changed: true });
        });

        it('leaves the response alone when the hook returns nothing', async () => {
            const [resp] = await run(new HttpRequest('GET', 'pages/a.json'));
            expect(resp.body).toEqual({ ok: 1 });
        });

        it('ignores non-final events and missing success hooks', async () => {
            next.handle.mockReturnValue(of({ type: 1 }));
            await run(new HttpRequest('GET', 'pages/a.json'));
            expect(mockAppManager.appOnServiceSuccess).not.toHaveBeenCalled();

            next.handle.mockReturnValue(of(null));
            await run(new HttpRequest('GET', 'pages/a.json'));

            mockAppManager = {};
            next.handle.mockReturnValue(of(new HttpResponse({ body: 1 })));
            await run(new HttpRequest('GET', 'pages/a.json'));

            mockAppManager = undefined;
            await run(new HttpRequest('GET', 'pages/a.json'));
        });
    });

    describe('error handling', () => {
        const failing = (err: any) => next.handle.mockReturnValue(throwError(() => err));

        it('adds a 401 subscriber, notifies the error hook and merges a modified error', async () => {
            const err: any = { message: 'bad' };
            failing(err);
            mockAppManager.appOnServiceError.mockReturnValue({ body: 'fixed' });
            await expect(run(new HttpRequest('GET', 'pages/a.json'))).rejects.toBe(err);
            expect(err._401Subscriber).toBeDefined();
            expect(mockAppManager.appOnServiceError).toHaveBeenCalledWith('bad', expect.anything());
            expect(err.body).toBe('fixed');
            expect(mockHttpService.handleSessionTimeout).not.toHaveBeenCalled();
        });

        it('delegates platform session timeouts to the http service', async () => {
            const err: any = { message: 'timeout' };
            failing(err);
            mockHttpService.isPlatformSessionTimeout.mockReturnValue(true);
            await expect(run(new HttpRequest('GET', 'pages/a.json'))).rejects.toBe(err);
            expect(mockHttpService.handleSessionTimeout).toHaveBeenCalledWith(expect.anything(), err._401Subscriber);
        });

        it('copes without a modified error or without an error hook', async () => {
            const err: any = { message: 'x' };
            failing(err);
            await expect(run(new HttpRequest('GET', 'pages/a.json'))).rejects.toBe(err);
            mockAppManager = {};
            await expect(run(new HttpRequest('GET', 'pages/a.json'))).rejects.toBe(err);
        });
    });

    it('createSubject returns a fresh subject', () => {
        expect(interceptor.createSubject()).not.toBe(interceptor.createSubject());
    });
});
