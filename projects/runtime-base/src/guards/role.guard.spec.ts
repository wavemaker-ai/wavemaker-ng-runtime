jest.mock('../services/app.manager.service', () => ({ AppManagerService: class {} }));

import { RoleGuard } from './role.guard';

describe('RoleGuard', () => {
    const createGuard = (overrides: any = {}) => {
        const securityService: any = {
            get: jest.fn().mockReturnValue({ userInfo: { userRoles: ['user'] } }),
            ...overrides.securityService,
        };
        const authGuard: any = { isAuthenticated: jest.fn().mockResolvedValue(true), ...overrides.authGuard };
        const toasterService: any = {};
        const app: any = { appLocale: overrides.appLocale ?? {} };
        const appManager: any = { notifyAccessDenied: jest.fn(), handle401: jest.fn() };
        const guard = new RoleGuard(securityService, authGuard, toasterService, app, appManager);
        return { guard, securityService, authGuard, appManager, app };
    };

    it('should resolve true when the user has one of the allowed roles', async () => {
        const { guard, appManager } = createGuard();
        const route: any = { data: { allowedRoles: ['user', 'admin'] }, routeConfig: { path: 'home' } };
        await expect(guard.canActivate(route)).resolves.toBe(true);
        expect(appManager.notifyAccessDenied).not.toHaveBeenCalled();
    });

    it('should notify access denied and resolve false when the user lacks the allowed roles', async () => {
        const { guard, appManager } = createGuard({
            securityService: { get: jest.fn().mockReturnValue({ userInfo: { userRoles: ['guest'] } }) },
        });
        const route: any = { data: { allowedRoles: ['admin'] }, routeConfig: { path: 'admin' } };
        await expect(guard.canActivate(route)).resolves.toBe(false);
        expect(appManager.notifyAccessDenied).toHaveBeenCalledWith('admin', 'Access Denied');
    });

    it('should use a custom access-denied label when configured', async () => {
        const { guard, appManager } = createGuard({
            securityService: { get: jest.fn().mockReturnValue({ userInfo: { userRoles: [] } }) },
            appLocale: { LABEL_ACCESS_DENIED: 'No Access' },
        });
        const route: any = { data: { allowedRoles: ['admin'] }, routeConfig: { path: 'admin' } };
        await guard.canActivate(route);
        expect(appManager.notifyAccessDenied).toHaveBeenCalledWith('admin', 'No Access');
    });

    it('should redirect to login (handle401) when the user is not authenticated', async () => {
        const { guard, appManager } = createGuard({ authGuard: { isAuthenticated: jest.fn().mockResolvedValue(false) } });
        const route: any = { data: { allowedRoles: ['admin'] }, routeConfig: { path: 'secure' }, queryParams: { a: 1 } };
        await expect(guard.canActivate(route)).resolves.toBe(false);
        expect(appManager.handle401).toHaveBeenCalledWith('secure', { queryParams: { a: 1 } });
    });
});
