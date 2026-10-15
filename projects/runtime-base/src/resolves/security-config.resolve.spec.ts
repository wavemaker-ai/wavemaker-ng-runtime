jest.mock('../services/app.manager.service', () => ({ AppManagerService: class {} }));

import { SecurityConfigResolve } from './security-config.resolve';

describe('SecurityConfigResolve', () => {
    afterEach(() => {
        delete (window as any)._WM_APP_PROPERTIES;
    });

    it('should be pre-loaded for a prefab project regardless of securityEnabled', () => {
        (window as any)._WM_APP_PROPERTIES = { securityEnabled: true };
        const appManager: any = { isPrefabType: () => true, isTemplateBundleType: () => false, loadSecurityConfig: jest.fn() };
        const resolve = new SecurityConfigResolve(appManager);
        expect(resolve.loaded).toBe(true);
    });

    it('should be pre-loaded for a template-bundle project', () => {
        (window as any)._WM_APP_PROPERTIES = { securityEnabled: true };
        const appManager: any = { isPrefabType: () => false, isTemplateBundleType: () => true, loadSecurityConfig: jest.fn() };
        const resolve = new SecurityConfigResolve(appManager);
        expect(resolve.loaded).toBe(true);
    });

    it('should be pre-loaded when security is disabled for the project', () => {
        (window as any)._WM_APP_PROPERTIES = { securityEnabled: false };
        const appManager: any = { isPrefabType: () => false, isTemplateBundleType: () => false, loadSecurityConfig: jest.fn() };
        const resolve = new SecurityConfigResolve(appManager);
        expect(resolve.loaded).toBe(true);
    });

    it('should not be pre-loaded when security is enabled for a plain web app', () => {
        (window as any)._WM_APP_PROPERTIES = { securityEnabled: true };
        const appManager: any = { isPrefabType: () => false, isTemplateBundleType: () => false, loadSecurityConfig: jest.fn() };
        const resolve = new SecurityConfigResolve(appManager);
        expect(resolve.loaded).toBeFalsy();
    });

    describe('resolve', () => {
        it('should resolve immediately (true) when already loaded', () => {
            (window as any)._WM_APP_PROPERTIES = { securityEnabled: false };
            const appManager: any = { isPrefabType: () => false, isTemplateBundleType: () => false, loadSecurityConfig: jest.fn() };
            const resolve = new SecurityConfigResolve(appManager);
            expect(resolve.resolve()).toBe(true);
            expect(appManager.loadSecurityConfig).not.toHaveBeenCalled();
        });

        it('should load the security config and mark loaded=true when not yet loaded', async () => {
            (window as any)._WM_APP_PROPERTIES = { securityEnabled: true };
            const appManager: any = {
                isPrefabType: () => false,
                isTemplateBundleType: () => false,
                loadSecurityConfig: jest.fn().mockResolvedValue(undefined),
            };
            const resolve = new SecurityConfigResolve(appManager);
            expect(resolve.loaded).toBeFalsy();
            const result = resolve.resolve();
            expect(result).toBeInstanceOf(Promise);
            await result;
            expect(resolve.loaded).toBe(true);
        });
    });
});
