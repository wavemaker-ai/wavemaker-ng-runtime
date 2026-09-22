import { AppResourceManagerService } from './app-resource-manager.service';

describe('AppResourceManagerService', () => {
    const createService = () => {
        const $http: any = { get: jest.fn() };
        return { service: new AppResourceManagerService($http), $http };
    };

    afterEach(() => {
        // clear the module-level cache so tests don't leak into each other
        createService().service.clearCache();
    });

    it('should fetch and return the response from http on a cache miss', async () => {
        const { service, $http } = createService();
        $http.get.mockResolvedValue('file contents');
        const result = await service.get('./app.variables.json');
        expect($http.get).toHaveBeenCalledWith('./app.variables.json');
        expect(result).toBe('file contents');
    });

    it('should not populate the cache when useCache is not passed', async () => {
        const { service, $http } = createService();
        $http.get.mockResolvedValue('first response');
        await service.get('./same-url.json');
        $http.get.mockResolvedValue('second response');
        const secondResult = await service.get('./same-url.json');
        expect($http.get).toHaveBeenCalledTimes(2);
        expect(secondResult).toBe('second response');
    });

    it('should serve subsequent requests from cache when useCache is true', async () => {
        const { service, $http } = createService();
        $http.get.mockResolvedValue('cached response');
        const first = await service.get('./cacheable.json', true);
        const second = await service.get('./cacheable.json', true);
        expect($http.get).toHaveBeenCalledTimes(1);
        expect(first).toBe('cached response');
        expect(second).toBe('cached response');
    });

    it('clearCache should force a fresh http call afterwards', async () => {
        const { service, $http } = createService();
        $http.get.mockResolvedValue('v1');
        await service.get('./clearable.json', true);
        service.clearCache();
        $http.get.mockResolvedValue('v2');
        const result = await service.get('./clearable.json', true);
        expect($http.get).toHaveBeenCalledTimes(2);
        expect(result).toBe('v2');
    });
});
