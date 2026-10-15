import { MetadataService } from './metadata.service';
import { _WM_APP_PROJECT } from '@wm/core';

describe('MetadataService', () => {
    afterEach(() => {
        delete _WM_APP_PROJECT.isPreview;
        delete _WM_APP_PROJECT.cdnUrl;
        delete (window as any)._WM_APP_PROPERTIES;
    });

    const createService = () => {
        const $http: any = { send: jest.fn() };
        return { service: new MetadataService($http), $http };
    };

    describe('isLoaded', () => {
        it('should return false before anything has been loaded', () => {
            const { service } = createService();
            expect(service.isLoaded()).toBe(false);
        });

        it('should return true once the app context has been loaded', async () => {
            (window as any)._WM_APP_PROPERTIES = {};
            _WM_APP_PROJECT.isPreview = true;
            const { service, $http } = createService();
            $http.send.mockResolvedValue({ body: { serviceDefs: {} } });
            await service.load();
            expect(service.isLoaded()).toBe(true);
        });
    });

    describe('load', () => {
        it('should request the preview servicedefs url when in preview mode', async () => {
            (window as any)._WM_APP_PROPERTIES = {};
            _WM_APP_PROJECT.isPreview = true;
            const { service, $http } = createService();
            $http.send.mockResolvedValue({ body: { serviceDefs: { op1: {} } } });
            await service.load();
            expect($http.send).toHaveBeenCalledWith({ url: './services/servicedefs', method: 'GET' });
        });

        it('should request the deployed servicedefs url outside preview mode', async () => {
            (window as any)._WM_APP_PROPERTIES = {};
            _WM_APP_PROJECT.isPreview = false;
            _WM_APP_PROJECT.cdnUrl = 'https://cdn.example.com/';
            const { service, $http } = createService();
            $http.send.mockResolvedValue({ body: { serviceDefs: {} } });
            await service.load();
            expect($http.send).toHaveBeenCalledWith({ url: 'https://cdn.example.com/servicedefs/app-servicedefs.json', method: 'GET' });
        });

        it('should request the preview prefab servicedefs url with a prefab name', async () => {
            (window as any)._WM_APP_PROPERTIES = {};
            _WM_APP_PROJECT.isPreview = true;
            const { service, $http } = createService();
            $http.send.mockResolvedValue({ body: { serviceDefs: {} } });
            await service.load('MyPrefab');
            expect($http.send).toHaveBeenCalledWith({ url: './services/prefabs/MyPrefab/servicedefs', method: 'GET' });
        });

        it('should request the dynamic preview url outside preview mode when serviceDefSources is DYNAMIC', async () => {
            (window as any)._WM_APP_PROPERTIES = { serviceDefSources: 'DYNAMIC' };
            _WM_APP_PROJECT.isPreview = false;
            _WM_APP_PROJECT.cdnUrl = 'https://cdn.example.com/';
            const { service, $http } = createService();
            $http.send.mockResolvedValue({ body: { serviceDefs: {} } });
            await service.load();
            expect($http.send).toHaveBeenCalledWith({ url: './services/servicedefs', method: 'GET' });
        });

        it('should store the service defs under the app context by default', async () => {
            (window as any)._WM_APP_PROPERTIES = {};
            _WM_APP_PROJECT.isPreview = true;
            const { service, $http } = createService();
            const serviceDefs = { op1: { crudOperationId: 'c1' } };
            $http.send.mockResolvedValue({ body: { serviceDefs } });
            const resolved = await service.load();
            expect(resolved).toBe(serviceDefs);
            expect(service.getByOperationId('op1', 'app')).toBe(serviceDefs.op1);
        });

        it('should store the provider map when securityDefinitions are present', async () => {
            (window as any)._WM_APP_PROPERTIES = {};
            _WM_APP_PROJECT.isPreview = true;
            const { service, $http } = createService();
            $http.send.mockResolvedValue({
                body: { serviceDefs: {}, securityDefinitions: { oauthProvider: { name: 'google' } } },
            });
            await service.load();
            expect(service.providerMap.get('app')).toEqual({ name: 'google' });
            expect(service.getByProviderId('name', 'app')).toBe('google');
        });

        it('should reject when the http call fails', async () => {
            (window as any)._WM_APP_PROPERTIES = {};
            _WM_APP_PROJECT.isPreview = true;
            const { service, $http } = createService();
            $http.send.mockRejectedValue('network error');
            await expect(service.load()).rejects.toBe('network error');
        });
    });

    describe('getByOperationId / getByProviderId / getByCrudId', () => {
        it('should return undefined for an unknown operation id', async () => {
            (window as any)._WM_APP_PROPERTIES = {};
            _WM_APP_PROJECT.isPreview = true;
            const { service, $http } = createService();
            $http.send.mockResolvedValue({ body: { serviceDefs: {} } });
            await service.load();
            expect(service.getByOperationId('missing', undefined)).toBeUndefined();
        });

        it('should collect all operations matching a crudOperationId', async () => {
            (window as any)._WM_APP_PROPERTIES = {};
            _WM_APP_PROJECT.isPreview = true;
            const { service, $http } = createService();
            const serviceDefs = {
                op1: { crudOperationId: 'crud1' },
                op2: { crudOperationId: 'crud2' },
                op3: { crudOperationId: 'crud1' },
            };
            $http.send.mockResolvedValue({ body: { serviceDefs } });
            await service.load();
            const ops = service.getByCrudId('crud1', undefined);
            expect(ops).toEqual([serviceDefs.op1, serviceDefs.op3]);
        });
    });
});
