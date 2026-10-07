import { MetadataService } from './metadata.service';
import { _WM_APP_PROJECT } from '@wm/core';

describe('MetadataService remaining branches', () => {
    afterEach(() => {
        delete _WM_APP_PROJECT.isPreview;
        delete (window as any)._WM_APP_PROPERTIES;
    });

    it('tolerates a response without a body and stores undefined service defs', async () => {
        (window as any)._WM_APP_PROPERTIES = {};
        _WM_APP_PROJECT.isPreview = true;
        const $http: any = { send: jest.fn().mockResolvedValue({}) };
        const service = new MetadataService($http);
        await expect(service.load()).resolves.toBeUndefined();
        expect(service.metadataMap.has('app')).toBe(true);
        expect(service.metadataMap.get('app')).toBeUndefined();
        expect(service.providerMap.has('app')).toBe(false);
    });

    it('looks up operation and provider ids in the app context by default', () => {
        const service = new MetadataService({} as any);
        service.metadataMap = new Map([['app', { op: { id: 1 } }]]);
        service.providerMap = new Map([['app', { prov: { id: 2 } }]]);
        expect(service.getByOperationId('op', undefined)).toEqual({ id: 1 });
        expect(service.getByProviderId('prov', undefined)).toEqual({ id: 2 });
    });
});
