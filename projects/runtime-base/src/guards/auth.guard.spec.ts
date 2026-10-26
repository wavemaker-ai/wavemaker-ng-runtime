jest.mock('../services/app.manager.service', () => ({ AppManagerService: class {} }));

describe('AuthGuard', () => {
    // AuthGuard caches security-config loading in a module-level variable, so each test
    // loads a fresh copy of the module to avoid state leaking across tests.
    const loadGuardCtor = () => {
        let ctor: any;
        jest.isolateModules(() => {
            ctor = require('./auth.guard').AuthGuard;
        });
        return ctor;
    };

    it('should load the security config once and cache it across calls', async () => {
        const AuthGuardCtor = loadGuardCtor();
        const appManager: any = { loadSecurityConfig: jest.fn().mockResolvedValue(undefined) };
        const securityService: any = { isAuthenticated: jest.fn() };
        const guard = new AuthGuardCtor(securityService, appManager);
        await guard.loadSecurityConfig();
        await guard.loadSecurityConfig();
        expect(appManager.loadSecurityConfig).toHaveBeenCalledTimes(1);
    });

    it('isAuthenticated should resolve via the security service after loading config', async () => {
        const AuthGuardCtor = loadGuardCtor();
        const appManager: any = { loadSecurityConfig: jest.fn().mockResolvedValue(undefined) };
        const securityService: any = { isAuthenticated: jest.fn((resolve: any) => resolve(true)) };
        const guard = new AuthGuardCtor(securityService, appManager);
        await expect(guard.isAuthenticated()).resolves.toBe(true);
    });

    it('canActivate should resolve true and not redirect when authenticated', async () => {
        const AuthGuardCtor = loadGuardCtor();
        const appManager: any = { loadSecurityConfig: jest.fn().mockResolvedValue(undefined), handle401: jest.fn() };
        const securityService: any = { isAuthenticated: jest.fn((resolve: any) => resolve(true)) };
        const guard = new AuthGuardCtor(securityService, appManager);
        const route: any = { routeConfig: { path: 'home' }, queryParams: { a: 1 } };
        await expect(guard.canActivate(route)).resolves.toBe(true);
        expect(appManager.handle401).not.toHaveBeenCalled();
    });

    it('canActivate should redirect via handle401 and resolve false when not authenticated', async () => {
        const AuthGuardCtor = loadGuardCtor();
        const appManager: any = { loadSecurityConfig: jest.fn().mockResolvedValue(undefined), handle401: jest.fn() };
        const securityService: any = { isAuthenticated: jest.fn((resolve: any) => resolve(false)) };
        const guard = new AuthGuardCtor(securityService, appManager);
        const route: any = { routeConfig: { path: 'secure' }, queryParams: { a: 1 } };
        await expect(guard.canActivate(route)).resolves.toBe(false);
        expect(appManager.handle401).toHaveBeenCalledWith('secure', { queryParams: { a: 1 } });
    });
});
