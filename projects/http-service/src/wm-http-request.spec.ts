import { HttpHeaders, HttpRequest } from '@angular/common/http';
import { WmHttpRequest } from './wm-http-request';

describe('WmHttpRequest', () => {
    describe('wmToAngularRequest', () => {
        it('should convert a wm request object into an Angular HttpRequest with matching fields', () => {
            const wmReq = new WmHttpRequest();
            const headers = new Map<string, string>([
                ['X-Custom', 'value1'],
                ['X-Other', 'value2'],
            ]);
            const reqObj: any = {
                method: 'POST',
                url: '/api/data',
                body: { a: 1 },
                responseType: 'json',
                reportProgress: true,
                withCredentials: true,
                headers,
            };
            const angReq = wmReq.wmToAngularRequest(reqObj);
            expect(angReq.body).toEqual({ a: 1 });
            expect(angReq.method).toBe('POST');
            expect(angReq.responseType).toBe('json');
            expect(angReq.reportProgress).toBe(true);
            expect(angReq.withCredentials).toBe(true);
            expect(angReq.urlWithParams).toBe('/api/data');
            expect(angReq.headers.get('X-Custom')).toBe('value1');
            expect(angReq.headers.get('X-Other')).toBe('value2');
        });
    });

    describe('angularToWmRequest', () => {
        it('should convert an Angular HttpRequest into a wm request object with a header Map', () => {
            const wmReq = new WmHttpRequest();
            const angReq = new HttpRequest('GET', '/api/list', {
                headers: new HttpHeaders({ 'X-Custom': 'value1' }),
                responseType: 'json',
                reportProgress: false,
                withCredentials: false,
            });
            const result = wmReq.angularToWmRequest(angReq);
            expect(result.method).toBe('GET');
            expect(result.url).toBe(angReq.urlWithParams);
            expect(result.responseType).toBe('json');
            expect(result.headers.get('X-Custom')).toBe('value1');
        });
    });
});
