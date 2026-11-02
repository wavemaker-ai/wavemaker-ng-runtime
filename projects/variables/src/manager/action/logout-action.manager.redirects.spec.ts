import { setDependency } from '../../util/variable/variables.utils';
import { CONSTANTS } from '../../constants/variables.constants';
import { LogoutActionManager } from './logout-action.manager';

describe('LogoutActionManager - redirects', () => {
    let appManager: any;
    let securityService: any;
    let routerService: any;
    const manager = new LogoutActionManager();
    const flush = async () => {
        await Promise.resolve();
        await Promise.resolve();
        jest.runAllTimers();
    };

    beforeEach(() => {
        jest.useFakeTimers();
        jest.spyOn(console, 'error').mockImplementation(() => undefined);
        appManager = { notify: jest.fn(), reloadAppData: jest.fn().mockResolvedValue({}) };
        securityService = { isAuthenticated: jest.fn((cb: Function) => cb(true)), appLogout: jest.fn() };
        routerService = { navigate: jest.fn() };
        setDependency('appManager', appManager);
        setDependency('security', securityService);
        setDependency('router', routerService);
    });

    afterEach(() => {
        jest.useRealTimers();
        jest.restoreAllMocks();
        (CONSTANTS as any).isStudioMode = false;
    });

    const logout = async (variable: any, body: any = null) => {
        securityService.appLogout.mockImplementation((onSuccess: Function) => onSuccess({ body }));
        const success = jest.fn();
        manager.logout({ _context: {}, ...variable }, {}, success, jest.fn());
        await flush();
        return success;
    };

    it.each([
        ['', '/'],
        ['login.html', '/'],
        ['index.html', '/'],
        ['Home', '/Home'],
    ])('navigates to the redirect page %p', async (redirectTo, expected) => {
        const success = await logout({ useDefaultSuccessHandler: true, redirectTo });
        expect(routerService.navigate).toHaveBeenCalledWith([expected]);
        expect(success).toHaveBeenCalled();
    });

    it('defaults to the app root when no redirect page is configured', async () => {
        await logout({ useDefaultSuccessHandler: true });
        expect(routerService.navigate).toHaveBeenCalledWith(['/']);
    });

    it('redirects to the url returned by the identity provider', async () => {
        await logout({ useDefaultSuccessHandler: true }, JSON.stringify({ result: 'https://idp.example/logout' }));
        expect(routerService.navigate).not.toHaveBeenCalled();
    });

    it('uses the data returned by onPrepareSetData as the redirect result', async () => {
        const onSuccess = jest.fn();
        await logout({ _context: { prepare: () => ({ done: true }), success: onSuccess }, onBeforeDatasetReady: 'prepare()', onSuccess: 'success($event)' });
        expect(appManager.reloadAppData).toHaveBeenCalledTimes(1);
    });

    it('does not trigger the variable error event in studio mode', () => {
        (CONSTANTS as any).isStudioMode = true;
        const error = jest.fn();
        securityService.isAuthenticated.mockImplementation((cb: Function) => cb(false));
        manager.logout({ _context: {} } as any, {}, jest.fn(), error);
        expect(error).toHaveBeenCalledWith('No authenticated user to logout.', undefined);
    });
});
