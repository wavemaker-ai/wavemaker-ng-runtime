import { setDependency } from '../../util/variable/variables.utils';
import { LoginActionManager } from './login-action.manager';

describe('LoginActionManager', () => {
    let appManager: any;
    let dialogService: any;
    let routerService: any;
    let securityService: any;
    const manager = new LoginActionManager();

    beforeEach(() => {
        appManager = {
            notify: jest.fn(),
            reloadAppData: jest.fn().mockResolvedValue({ userInfo: { userName: 'ram' } }),
            executeSessionFailureRequests: jest.fn(),
            noRedirect: jest.fn().mockReturnValue(true),
        };
        dialogService = { close: jest.fn() };
        routerService = { navigate: jest.fn().mockResolvedValue(true) };
        securityService = {
            get: jest.fn().mockReturnValue({}),
            appLogin: jest.fn(),
            getCurrentRouteQueryParam: jest.fn().mockReturnValue(undefined),
            getRedirectedRouteQueryParams: jest.fn().mockReturnValue({}),
        };
        setDependency('appManager', appManager);
        setDependency('dialog', dialogService);
        setDependency('router', routerService);
        setDependency('security', securityService);
    });

    describe('validate (private)', () => {
        it('should return an error message when a required credential is missing', () => {
            const err = (manager as any).validate({ j_username: 'ram', j_password: '' });
            expect(err).toBe('Please provide required credentials');
        });

        it('should default rememberme to false when not provided', () => {
            const params: any = { j_username: 'ram', j_password: 'pwd' };
            const err = (manager as any).validate(params);
            expect(err).toBeUndefined();
            expect(params.j_rememberme).toBe(false);
        });

        it('should pick up the legacy rememberme key when present as boolean', () => {
            const params: any = { j_username: 'ram', j_password: 'pwd', rememberme: true };
            (manager as any).validate(params);
            expect(params.rememberme).toBe(true);
        });
    });

    describe('migrateOldParams (private)', () => {
        it('should migrate legacy param names to the j_ prefixed equivalents', () => {
            const migrated = (manager as any).migrateOldParams({ username: 'ram', password: 'pwd', extra: 'x' });
            expect(migrated).toEqual({ j_username: 'ram', j_password: 'pwd', extra: 'x' });
        });
    });

    describe('login', () => {
        it('should call the error callback and skip the network call for invalid credentials', () => {
            const error = jest.fn();
            // initiateCallback('onError', ...) here has no skipDefaultNotification flag, so it
            // falls into the default-notification lookup, which reads _context.Actions.
            const variable: any = { dataBinding: { j_username: '', j_password: '' }, _context: { Actions: {} } };
            manager.login(variable, {}, jest.fn(), error);
            expect(error).toHaveBeenCalledWith('Please provide required credentials');
            expect(securityService.appLogin).not.toHaveBeenCalled();
        });

        it('should notify inflight and call appLogin for valid credentials', () => {
            const variable: any = { dataBinding: { j_username: 'ram', j_password: 'pwd' }, _context: {} };
            manager.login(variable, {}, jest.fn(), jest.fn());
            expect(appManager.notify).toHaveBeenCalledWith('toggle-variable-state', expect.objectContaining({ active: true }));
            expect(securityService.appLogin).toHaveBeenCalled();
        });

        it('should close the login dialog and reload app data on successful login (no redirect)', async () => {
            jest.useFakeTimers();
            const success = jest.fn();
            securityService.appLogin.mockImplementation((params, onSuccess) => onSuccess({}));
            const variable: any = {
                dataBinding: { j_username: 'ram', j_password: 'pwd' },
                _context: {},
                useDefaultSuccessHandler: false,
            };
            manager.login(variable, {}, success, jest.fn());
            await Promise.resolve();
            await Promise.resolve();
            expect(dialogService.close).toHaveBeenCalledWith('CommonLoginDialog');
            expect(appManager.reloadAppData).toHaveBeenCalled();
            expect(success).toHaveBeenCalled();
            jest.runAllTimers();
            jest.useRealTimers();
        });

        it('should not attempt any redirect navigation for a first-time login with noRedirect true', async () => {
            jest.useFakeTimers();
            securityService.appLogin.mockImplementation((params, onSuccess) => onSuccess({}));
            const variable: any = {
                dataBinding: { j_username: 'ram', j_password: 'pwd' },
                _context: {},
                useDefaultSuccessHandler: true,
            };
            manager.login(variable, {}, jest.fn(), jest.fn());
            await Promise.resolve();
            await Promise.resolve();
            jest.runAllTimers();
            expect(routerService.navigate).not.toHaveBeenCalled();
            expect(appManager.executeSessionFailureRequests).toHaveBeenCalledTimes(1);
            jest.useRealTimers();
        });

        it('should call the error callback and notify inflight-false on a failed login', () => {
            const error = jest.fn();
            securityService.appLogin.mockImplementation((params, onSuccess, onError) => onError({ error: 'bad creds', details: { status: 401 } }));
            const variable: any = { dataBinding: { j_username: 'ram', j_password: 'pwd' }, _context: {} };
            manager.login(variable, {}, jest.fn(), error);
            expect(error).toHaveBeenCalledWith('bad creds', { status: 401 });
            expect(appManager.notify).toHaveBeenLastCalledWith('toggle-variable-state', expect.objectContaining({ active: false }));
        });

        it('should use a default error message when the error has none', () => {
            const error = jest.fn();
            securityService.appLogin.mockImplementation((params, onSuccess, onError) => onError({}));
            const variable: any = { dataBinding: { j_username: 'ram', j_password: 'pwd' }, _context: {} };
            manager.login(variable, {}, jest.fn(), error);
            expect(error).toHaveBeenCalledWith('Invalid credentials.', undefined);
        });

        it('should read loginInfo from options.loginInfo when provided', () => {
            const variable: any = { dataBinding: {}, _context: {} };
            manager.login(variable, { loginInfo: { j_username: 'ram', j_password: 'pwd' } }, jest.fn(), jest.fn());
            expect(securityService.appLogin).toHaveBeenCalledWith(
                expect.objectContaining({ j_username: 'ram', j_password: 'pwd' }),
                expect.any(Function),
                expect.any(Function)
            );
        });
    });
});
