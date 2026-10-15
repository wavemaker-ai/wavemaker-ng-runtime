jest.mock('@wm/runtime/base', () => ({
    PrefabConfigProvider: class PrefabConfigProvider {},
    getPrefabConfigUrl: (n: string) => `prefab/${n}/config.json`
}));
jest.mock('./app-resource-manager.service', () => ({ AppResourceManagerService: class AppResourceManagerService {} }));

import { PrefabConfigProviderService } from './prefab-config-provider.service';

describe('PrefabConfigProviderService', () => {
    it('fetches a prefab config once and serves later requests from the cache', async () => {
        const resources: any = { get: jest.fn(() => Promise.resolve({ cfg: 1 })) };
        const service = new PrefabConfigProviderService(resources);
        await expect(service.getConfig('pf-a')).resolves.toEqual({ cfg: 1 });
        await expect(service.getConfig('pf-a')).resolves.toEqual({ cfg: 1 });
        expect(resources.get).toHaveBeenCalledTimes(1);
        expect(resources.get).toHaveBeenCalledWith('prefab/pf-a/config.json');
        await service.getConfig('pf-b');
        expect(resources.get).toHaveBeenCalledTimes(2);
    });
});
