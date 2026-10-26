import { setDependency } from '../../util/variable/variables.utils';
import { LoginActionManager } from './login-action.manager';

describe('LoginActionManager - redirects and callbacks', () => {
    let appManager: any;
    let routerService: any;
    let securityService: any;
    const manager = new LoginActionManager();

    const creds = (name = 'ram') => ({ j_username: name, j_password: 'pwd' });
    const flush = async () => {
        await Promise.resolve();
        await Promise.resolve();
        await Promise.resolve();
        jest.runAllTimers();
        await Promise.resolve();
    };
    const login = async (variable: any = {}, previousUser?: string, config: any = {}) => {
        securityService.get.mockReturnValue({ userInfo: previousUser ? { userName: previousUser } : undefined, ...config });
        securityService.appLogin.mockImplementation((params: any, onSuccess: Function) => onSuccess({ body: 'ok' }));
        manager.login({ dataBinding: creds(), _context: {}, useDefaultSuccessHandler: true, ...variable }, {}, jest.fn(), jest.fn());
        await flush();
    };

    beforeEach(() => {
        jest.useFakeTimers();
        appManager = {
            notify: jest.fn(),
            reloadAppData: jest.fn().mockResolvedValue({ userInfo: { userName: 'ram' } }),
            executeSessionFailureRequests: jest.fn(),
            noRedirect: jest.fn().mockReturnValue(false),
        };
        routerService = { navigate: jest.fn().mockResolvedValue(true) };
        securityService = {
            get: jest.fn().mockReturnValue({}),
            appLogin: jest.fn(),
            getCurrentRouteQueryParam: jest.fn().mockReturnValue(undefined),
            getRedirectedRouteQueryParams: jest.fn().mockReturnValue({}),
        };
        setDependency('appManager', appManager);
        setDependency('dialog', { close: jest.fn() });
        setDependency('router', routerService);
        setDependency('security', securityService);
    });

    afterEach(() => {
        jest.useRealTimers();
        jest.restoreAllMocks();
    });

    describe('first time login', () => {
        it('navigates to the requested page with the page params, dropping redirectTo', async () => {
            securityService.getCurrentRouteQueryParam.mockReturnValue('Orders');
            securityService.getRedirectedRouteQueryParams.mockReturnValue({ redirectTo: 'Orders', id: '5' });
            await login();
            expect(routerService.navigate).toHaveBeenCalledWith(['/Orders'], { queryParams: { id: '5' } });
            expect(appManager.noRedirect).toHaveBeenCalledWith(false);
            expect(appManager.executeSessionFailureRequests).toHaveBeenCalled();
        });

        it('resets the url when there is no page to redirect to', async () => {
            await login();
            expect(routerService.navigate).toHaveBeenCalledWith(['/']);
        });
    });

    describe('login after a session timeout', () => {
        it('goes to the requested page when the same user logs in again', async () => {
            securityService.getCurrentRouteQueryParam.mockReturnValue('Orders');
            await login({}, 'ram');
            expect(routerService.navigate).toHaveBeenCalledWith(['/Orders'], { queryParams: {} });
            expect(appManager.executeSessionFailureRequests).toHaveBeenCalled();
        });

        it('reloads the app for a different user and discards the requested page', async () => {
            securityService.getCurrentRouteQueryParam.mockReturnValue('Orders');
            jest.spyOn(console, 'error').mockImplementation(() => undefined);
            await login({}, 'someone-else');
            expect(routerService.navigate).toHaveBeenCalledWith(['/']);
            expect(appManager.executeSessionFailureRequests).not.toHaveBeenCalled();
        });

        it('reloads the app for a new user without a requested page', async () => {
            jest.spyOn(console, 'error').mockImplementation(() => undefined);
            await login({}, 'someone-else');
            expect(routerService.navigate).toHaveBeenCalledWith(['/']);
        });

        it('keeps the page when the same user logs in again through the session timeout dialog', async () => {
            await login({}, 'ram', { loginConfig: { sessionTimeout: { type: 'DIALOG' } } });
            expect(routerService.navigate).not.toHaveBeenCalled();
        });

        it('reloads the app for session timeout page logins', async () => {
            jest.spyOn(console, 'error').mockImplementation(() => undefined);
            await login({}, 'ram');
            expect(routerService.navigate).toHaveBeenCalledWith(['/']);
        });

        it('does not retry failed requests when the login is not the default handler', async () => {
            await login({ useDefaultSuccessHandler: false }, 'ram');
            expect(routerService.navigate).not.toHaveBeenCalled();
            expect(appManager.executeSessionFailureRequests).not.toHaveBeenCalled();
        });
    });

    describe('variable events', () => {
        it('lets onBeforeUpdate replace the login params', () => {
            const variable: any = {
                dataBinding: creds(),
                _context: { before: () => ({ j_username: 'replaced', j_password: 'p2' }) },
                onBeforeUpdate: 'before()',
            };
            manager.login(variable, {}, jest.fn(), jest.fn());
            expect(securityService.appLogin).toHaveBeenCalledWith(expect.objectContaining({ j_username: 'replaced', j_password: 'p2' }), expect.any(Function), expect.any(Function));
        });

        it('aborts when onBeforeUpdate returns false', () => {
            const error = jest.fn();
            const variable: any = { dataBinding: creds(), _context: { before: () => false }, onBeforeUpdate: 'before()' };
            manager.login(variable, {}, jest.fn(), error);
            expect(error).toHaveBeenCalled();
            expect(securityService.appLogin).not.toHaveBeenCalled();
        });

        it('uses the data returned by onPrepareSetData as the user info', async () => {
            const config: any = { userInfo: { userName: 'ram' } };
            appManager.reloadAppData.mockResolvedValue(config);
            const variable: any = { _context: { prepare: () => ({ userName: 'prepared' }) }, onBeforeDatasetReady: 'prepare()', useDefaultSuccessHandler: false };
            await login(variable);
            expect(config.userInfo).toEqual({ userName: 'prepared' });
        });

        it('raises the variable error event on a failed login in run mode', () => {
            const onError = jest.fn();
            securityService.appLogin.mockImplementation((p: any, ok: Function, fail: Function) => fail({ error: 'bad', details: { status: 401 } }));
            const variable: any = { dataBinding: creds(), _context: { onError }, onError: 'onError($event)' };
            const error = jest.fn();
            manager.login(variable, {}, jest.fn(), error);
            expect(error).toHaveBeenCalledWith('bad', { status: 401 });
        });
    });

    it('reloads the app after navigating to the base path', async () => {
        jest.spyOn(console, 'error').mockImplementation(() => undefined);
        routerService.navigate.mockResolvedValueOnce(false);
        (manager as any).redirectToAppBasePath();
        await Promise.resolve();
        routerService.navigate.mockResolvedValueOnce(true);
        (manager as any).redirectToAppBasePath();
        await Promise.resolve();
        expect(routerService.navigate).toHaveBeenCalledTimes(2);
    });
});
