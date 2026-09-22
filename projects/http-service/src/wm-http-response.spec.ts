import { HttpHeaders, HttpResponse } from '@angular/common/http';
import { WmHttpResponse } from './wm-http-response';

describe('WmHttpResponse', () => {
    describe('wmToAngularResponse', () => {
        it('should convert a wm response object into an Angular HttpResponse with matching fields', () => {
            const wmResp = new WmHttpResponse();
            const headers = new Map<string, string>([['X-Custom', 'value1']]);
            const respObj: any = {
                body: { a: 1 },
                error: null,
                message: 'OK',
                url: '/api/data',
                ok: true,
                status: 200,
                statusText: 'OK',
                headers,
            };
            const angResp = wmResp.wmToAngularResponse(respObj);
            expect(angResp.body).toEqual({ a: 1 });
            expect(angResp.status).toBe(200);
            expect(angResp.statusText).toBe('OK');
            expect(angResp.headers.get('X-Custom')).toBe('value1');
        });
    });

    describe('angularToWmResponse', () => {
        it('should convert an Angular HttpResponse into a wm response object with a header Map', () => {
            const wmResp = new WmHttpResponse();
            const angResp = new HttpResponse({
                body: { list: [] },
                headers: new HttpHeaders({ 'X-Custom': 'value1' }),
                status: 200,
                statusText: 'OK',
                url: '/api/list',
            });
            const result = wmResp.angularToWmResponse(angResp);
            expect(result.body).toEqual({ list: [] });
            expect(result.status).toBe(200);
            expect(result.statusText).toBe('OK');
            expect(result.headers.get('X-Custom')).toBe('value1');
        });
    });
});
