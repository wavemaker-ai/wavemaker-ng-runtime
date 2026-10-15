jest.mock('../services/app.manager.service', () => ({ AppManagerService: class AppManagerService {} }));

import { MetadataResolve } from './metadata.resolve';

describe('MetadataResolve', () => {
    it('loads metadata once and then short-circuits', async () => {
        const manager: any = { loadMetadata: jest.fn(() => Promise.resolve()) };
        const resolve = new MetadataResolve(manager);
        await expect(resolve.resolve()).resolves.toBe(true);
        expect(resolve.resolve()).toBe(true);
        expect(manager.loadMetadata).toHaveBeenCalledTimes(1);
    });
});
