jest.mock('@wm/runtime/base', () => ({ AppVariablesProvider: class AppVariablesProvider {} }));
jest.mock('./app-resource-manager.service', () => ({ AppResourceManagerService: class AppResourceManagerService {} }));

import { AppVariablesProviderService } from './app-variables-provider.service';

describe('AppVariablesProviderService', () => {
    it('returns an empty object for prefab projects without fetching', async () => {
        const resources: any = { get: jest.fn() };
        const service = new AppVariablesProviderService(resources, { isPrefabType: true } as any);
        await expect(service.getAppVariables()).resolves.toEqual({});
        expect(resources.get).not.toHaveBeenCalled();
    });

    it('loads app.variables.json for applications', async () => {
        const resources: any = { get: jest.fn(() => Promise.resolve({ v: 1 })) };
        const service = new AppVariablesProviderService(resources, { isPrefabType: false } as any);
        await expect(service.getAppVariables()).resolves.toEqual({ v: 1 });
        expect(resources.get).toHaveBeenCalledWith('./app.variables.json');
    });
});
