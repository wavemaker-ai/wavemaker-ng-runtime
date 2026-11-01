import { HttpHeaders, HttpRequest } from '@angular/common/http';
import { Subject, of, throwError } from 'rxjs';

import { HttpServiceImpl } from './http.service';

jest.mock('@wavemaker-ai/variables', () => ({
    getErrMessage: jest.fn((err, locale) => `msg:${err.status}:${locale}`)
}));

describe('HttpServiceImpl', () => {
    let httpClient: { request: jest.Mock };
    let service: HttpServiceImpl;

    beforeEach(() => {
        httpClient = { request: jest.fn() };
        service = new HttpServiceImpl(httpClient as any);
    });

    describe('generateRequest (via sendCallAsObservable)', () => {
        const build = (options: any): HttpRequest<any> => {
            httpClient.request.mockReturnValue(of({}));
            service.sendCallAsObservable(options);
            return httpClient.request.mock.calls[0][0];
        };

        it('adds X-Requested-With for proxy calls and skips it for direct calls', () => {
            expect(build({ method: 'GET', url: '/a' }).headers.get('X-Requested-With')).toBe('XMLHttpRequest');
            httpClient.request.mockClear();
            expect(build({ method: 'GET', url: '/a', isDirectCall: true }).headers.has('X-Requested-With')).toBe(false);
        });

        it('stringifies number/boolean headers and appends params', () => {
            const req = build({
                method: 'GET',
                url: '/a',
                headers: { n: 5, b: false, s: 'x' },
                params: { q: '1', r: '2' },
                responseType: 'json',
                withCredentials: true
            });
            expect(req.headers.get('n')).toBe('5');
            expect(req.headers.get('b')).toBe('false');
            expect(req.headers.get('s')).toBe('x');
            expect(req.params.get('q')).toBe('1');
            expect(req.params.get('r')).toBe('2');
            expect(req.withCredentials).toBe(true);
        });

        it('treats non-body methods without data as bodyless', () => {
            const req = build({ method: 'get', url: '/a' });
            expect(req.body).toBeNull();
        });

        it('passes data through for non-body methods when data is supplied', () => {
            const req = build({ method: 'DELETE', url: '/a', data: { id: 1 } });
            expect(req.body).toEqual({ id: 1 });
        });

        it('passes data as body for body methods', () => {
            const req = build({ method: 'POST', url: '/a', data: 'payload' });
            expect(req.body).toBe('payload');
        });
    });

    describe('sendCall', () => {
        it('resolves with a response that has a type', async () => {
            httpClient.request.mockReturnValue(of({ type: 4, body: 'ok' }));
            const variable: any = {};
            const res = await service.sendCall({ method: 'GET', url: '/a' }, variable);
            expect(res).toEqual({ type: 4, body: 'ok' });
            expect(variable._observable).toBeDefined();
        });

        it('ignores responses without a type, then rejects on error', async () => {
            const subj = new Subject<any>();
            httpClient.request.mockReturnValue(subj);
            const p = service.sendCall({ method: 'GET', url: '/a' }, {});
            subj.next(null);
            subj.next({});
            subj.error('boom');
            await expect(p).rejects.toBe('boom');
        });
    });

    describe('send', () => {
        it('resolves with the response', async () => {
            httpClient.request.mockReturnValue(of({ body: 1 }));
            await expect(service.send({ method: 'GET', url: '/a' })).resolves.toEqual({ body: 1 });
        });

        it('rejects with a formatted error for ordinary failures', async () => {
            const err = { status: 500, headers: new HttpHeaders() };
            httpClient.request.mockReturnValue(throwError(() => err));
            service.setLocale('en');
            await expect(service.send({ method: 'GET', url: '/a' })).rejects.toEqual({
                error: 'msg:500:en',
                details: err
            });
        });

        it('waits on the 401 subscriber for platform session timeout (resolve)', async () => {
            const sub = new Subject<any>();
            const err = {
                status: 401,
                headers: new HttpHeaders({ 'x-wm-login-errormessage': 'Session Not Found' }),
                _401Subscriber: sub
            };
            httpClient.request.mockReturnValue(throwError(() => err));
            const p = service.send({ method: 'GET', url: '/a' });
            await Promise.resolve();
            await Promise.resolve();
            sub.next('retried');
            await expect(p).resolves.toBe('retried');
        });

        it('waits on the 401 subscriber for platform session timeout (reject)', async () => {
            const sub = new Subject<any>();
            const err = {
                status: 401,
                headers: new HttpHeaders({ 'x-wm-login-errormessage': 'Session Not Found' }),
                _401Subscriber: sub
            };
            httpClient.request.mockReturnValue(throwError(() => err));
            const p = service.send({ method: 'GET', url: '/a' });
            await Promise.resolve();
            await Promise.resolve();
            sub.error('nope');
            await expect(p).rejects.toBe('nope');
        });
    });

    describe('isPlatformSessionTimeout / getHeader', () => {
        it('is false for non-401 and for other 401 messages', () => {
            expect(service.isPlatformSessionTimeout({ status: 500, headers: new HttpHeaders() })).toBe(false);
            expect(service.isPlatformSessionTimeout({
                status: 401,
                headers: new HttpHeaders({ 'x-wm-login-errormessage': 'other' })
            })).toBe(false);
        });

        it('getHeader reads from error headers', () => {
            expect(service.getHeader({ headers: new HttpHeaders({ a: 'b' }) }, 'a')).toBe('b');
        });
    });

    describe('cancel', () => {
        it('unsubscribes the variable observable and upload progress', () => {
            const v = { _observable: { unsubscribe: jest.fn() } };
            const f = { _uploadProgress: { unsubscribe: jest.fn() } };
            service.cancel(v, f);
            expect(v._observable.unsubscribe).toHaveBeenCalledTimes(1);
            expect(f._uploadProgress.unsubscribe).toHaveBeenCalledTimes(1);
        });

        it('tolerates missing observable and file', () => {
            expect(() => service.cancel({})).not.toThrow();
            expect(() => service.cancel({}, {})).not.toThrow();
        });
    });

    describe('locale', () => {
        it('sets and gets locale', () => {
            service.setLocale({ a: 1 });
            expect(service.getLocale()).toEqual({ a: 1 });
        });
    });

    describe('verb helpers', () => {
        beforeEach(() => {
            httpClient.request.mockReturnValue(of({ body: 'b' }));
        });

        it('get returns the response body and defaults options', async () => {
            await expect(service.get('/u')).resolves.toBe('b');
            expect(httpClient.request.mock.calls[0][0].method).toBe('GET');
            await expect(service.get('/u', { params: { a: '1' } })).resolves.toBe('b');
        });

        it.each([
            ['post', 'POST'],
            ['put', 'PUT'],
            ['patch', 'PATCH']
        ])('%s sends data', async (fn, method) => {
            await (service as any)[fn]('/u', 'd', undefined);
            const req = httpClient.request.mock.calls[0][0];
            expect(req.method).toBe(method);
            expect(req.body).toBe('d');
            await (service as any)[fn]('/u', 'd', {});
        });

        it.each([
            ['delete', 'DELETE'],
            ['head', 'HEAD'],
            ['jsonp', 'JSONP']
        ])('%s sends without data', async (fn, method) => {
            await (service as any)[fn]('/u', undefined);
            expect(httpClient.request.mock.calls[0][0].method).toBe(method);
            await (service as any)[fn]('/u', {});
        });
    });

    describe('upload / uploadFile', () => {
        it('upload issues a POST with progress reporting', () => {
            httpClient.request.mockReturnValue(of({}));
            service.upload('/up', 'data', {});
            const req = httpClient.request.mock.calls[0][0];
            expect(req.method).toBe('POST');
            expect(req.reportProgress).toBe(true);
        });

        it('uploadFile notifies progress then resolves with body', async () => {
            const events = new Subject<any>();
            httpClient.request.mockReturnValue(events);
            const notify = jest.fn();
            const variable: any = {};
            const p = service.uploadFile('/up', 'd', variable, { notify });
            events.next({ type: 1, loaded: 1, total: 4 });
            events.next({ type: 0 });
            events.next({ type: 4, body: 'done' });
            await expect(p).resolves.toBe('done');
            expect(notify).toHaveBeenCalledWith(25);
            expect(variable.request).toBeDefined();
        });

        it('uploadFile rejects on error', async () => {
            httpClient.request.mockReturnValue(throwError(() => 'bad'));
            await expect(service.uploadFile('/up', 'd', {}, { notify: jest.fn() })).rejects.toBe('bad');
        });
    });

    describe('session timeout handling', () => {
        it('registerOnSessionTimeout fires on on401 and can be unsubscribed', () => {
            const cb = jest.fn();
            const unsub = service.registerOnSessionTimeout(cb);
            service.on401();
            expect(cb).toHaveBeenCalledTimes(1);
            unsub();
            service.on401();
            expect(cb).toHaveBeenCalledTimes(1);
            // second unsubscribe: subscription no longer tracked
            expect(() => unsub()).not.toThrow();
        });

        it('handleSessionTimeout queues the request and triggers on401', () => {
            const cb = jest.fn();
            service.registerOnSessionTimeout(cb);
            service.handleSessionTimeout({ r: 1 }, 'sub');
            expect(service.sessionTimeoutQueue).toEqual([{ requestInfo: { r: 1 }, sub401: 'sub' }]);
            expect(cb).toHaveBeenCalled();
        });

        it('pushToSessionFailureQueue queues a callback', () => {
            const cb = jest.fn();
            service.pushToSessionFailureQueue(cb);
            expect(service.sessionTimeoutQueue).toEqual([{ callback: cb }]);
        });

        describe('executeSessionFailureRequests', () => {
            const makeInfo = () => ({ headers: { headers: { delete: jest.fn() } } });

            it('runs callbacks and clears the queue', () => {
                const cb = jest.fn();
                service.pushToSessionFailureQueue(cb);
                service.executeSessionFailureRequests();
                expect(cb).toHaveBeenCalledTimes(1);
                expect(service.sessionTimeoutQueue).toEqual([]);
            });

            it('replays requests and forwards typed responses to sub401', () => {
                const info = makeInfo();
                const sub401 = { next: jest.fn(), error: jest.fn() };
                httpClient.request.mockReturnValue(of({ type: 4 }));
                service.handleSessionTimeout(info, sub401);
                service.executeSessionFailureRequests();
                expect(info.headers.headers.delete).toHaveBeenCalledWith('x-wm-xsrf-token');
                expect(sub401.next).toHaveBeenCalledWith({ type: 4 });
            });

            it('does not forward untyped responses or when sub401 is missing', () => {
                const sub401 = { next: jest.fn(), error: jest.fn() };
                httpClient.request.mockReturnValue(of(null));
                service.handleSessionTimeout(makeInfo(), sub401);
                service.handleSessionTimeout(makeInfo());
                service.executeSessionFailureRequests();
                expect(sub401.next).not.toHaveBeenCalled();
            });

            it('forwards failures to sub401.error', () => {
                const sub401 = { next: jest.fn(), error: jest.fn() };
                httpClient.request.mockReturnValue(throwError(() => 'fail'));
                service.handleSessionTimeout(makeInfo(), sub401);
                service.executeSessionFailureRequests();
                expect(sub401.error).toHaveBeenCalledWith('fail');
            });
        });
    });

    describe('ngOnDestroy', () => {
        it('cleans up subscriptions, subject, queue and locale', () => {
            const cb = jest.fn();
            service.registerOnSessionTimeout(cb);
            const closed = service.registerOnSessionTimeout(jest.fn());
            closed(); // already-unsubscribed entry removed from list
            (service as any).sessionTimeoutSubscriptions.push({ closed: true, unsubscribe: jest.fn() }, null);
            service.setLocale('en');
            service.pushToSessionFailureQueue(jest.fn());

            service.ngOnDestroy();

            expect(service.sessionTimeoutObservable).toBeNull();
            expect(service.sessionTimeoutQueue).toEqual([]);
            expect(service.getLocale()).toBeNull();
            expect((service as any).sessionTimeoutSubscriptions).toEqual([]);
        });

        it('is safe to call twice', () => {
            service.ngOnDestroy();
            expect(() => service.ngOnDestroy()).not.toThrow();
        });
    });
});
