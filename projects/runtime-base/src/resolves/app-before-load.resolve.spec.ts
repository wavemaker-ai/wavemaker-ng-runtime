jest.mock('../services/app.manager.service', () => ({ AppManagerService: class AppManagerService {} }));

import { AppBeforeLoadResolve } from './app-before-load.resolve';

describe('AppBeforeLoadResolve', () => {
    it('initialises the app modes and returns the before-app-ready result', () => {
        const manager: any = { initAppModes: jest.fn(), beforeAppReady: jest.fn(() => 'ready') };
        const resolve = new AppBeforeLoadResolve(manager, {} as any);
        expect(resolve.resolve()).toBe('ready');
        expect(manager.initAppModes).toHaveBeenCalled();
        expect(manager.initAppModes.mock.invocationCallOrder[0]).toBeLessThan(manager.beforeAppReady.mock.invocationCallOrder[0]);
    });
});
