import { setDependency } from '../../util/variable/variables.utils';
import { LogoutActionManager } from './logout-action.manager';

describe('LogoutActionManager', () => {
    let appManager: any;
    let securityService: any;
    let routerService: any;
    const manager = new LogoutActionManager();

    beforeEach(() => {
        appManager = { notify: jest.fn(), reloadAppData: jest.fn().mockResolvedValue({}) };
        securityService = { isAuthenticated: jest.fn(), appLogout: jest.fn() };
        routerService = { navigate: jest.fn() };
        setDependency('appManager', appManager);
        setDependency('security', securityService);
        setDependency('router', routerService);
    });

    it('should abort and call error when the BEFORE_UPDATE handler returns false', () => {
        const error = jest.fn();
        const variable: any = { onBeforeUpdate: 'block()', _context: { block: () => false } };
        manager.logout(variable, {}, jest.fn(), error);
        expect(error).toHaveBeenCalledTimes(1);
        expect(securityService.isAuthenticated).not.toHaveBeenCalled();
    });

    it('should call error with a not-authenticated message when the user is not authenticated', () => {
        const error = jest.fn();
        securityService.isAuthenticated.mockImplementation((cb) => cb(false));
        const variable: any = { _context: { Actions: {} } };
        manager.logout(variable, {}, jest.fn(), error);
        expect(error).toHaveBeenCalledWith('No authenticated user to logout.', undefined);
        expect(securityService.appLogout).not.toHaveBeenCalled();
    });

    it('should notify inflight-false and call error when isAuthenticated itself errors', () => {
        const error = jest.fn();
        securityService.isAuthenticated.mockImplementation((cb, errCb) => errCb('boom'));
        const variable: any = { _context: { Actions: {} } };
        manager.logout(variable, {}, jest.fn(), error);
        expect(appManager.notify).toHaveBeenCalledWith('toggle-variable-state', expect.objectContaining({ active: false }));
        expect(error).toHaveBeenCalledWith('boom', undefined);
    });

    it('should notify inflight, call appLogout and success when authenticated (no redirect branch taken)', async () => {
        // Neither redirectUrl.result nor useDefaultSuccessHandler is set, so window.location is never touched.
        jest.useFakeTimers();
        securityService.isAuthenticated.mockImplementation((cb) => cb(true));
        securityService.appLogout.mockImplementation((onSuccess) => onSuccess({ body: null }));
        const success = jest.fn();
        const variable: any = { _context: {} };
        manager.logout(variable, {}, success, jest.fn());
        expect(appManager.notify).toHaveBeenCalledWith('toggle-variable-state', expect.objectContaining({ active: true }));
        expect(securityService.appLogout).toHaveBeenCalled();
        expect(success).toHaveBeenCalled();
        await Promise.resolve();
        await Promise.resolve();
        jest.runAllTimers();
        expect(appManager.reloadAppData).toHaveBeenCalled();
        expect(routerService.navigate).not.toHaveBeenCalled();
        jest.useRealTimers();
    });

    it('should call handleError when appLogout itself fails', () => {
        const error = jest.fn();
        securityService.isAuthenticated.mockImplementation((cb) => cb(true));
        securityService.appLogout.mockImplementation((onSuccess, onError) => onError('logout failed'));
        const variable: any = { _context: { Actions: {} } };
        manager.logout(variable, {}, jest.fn(), error);
        expect(error).toHaveBeenCalledWith('logout failed', undefined);
    });
});
