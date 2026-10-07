import { setDependency } from '../../util/variable/variables.utils';
import { CONSTANTS } from '../../constants/variables.constants';
import { LoginActionManager } from './login-action.manager';

describe('LoginActionManager (cover)', () => {
    let securityService: any;
    const manager = new LoginActionManager();

    beforeEach(() => {
        securityService = { get: jest.fn().mockReturnValue({}), appLogin: jest.fn() };
        setDependency('appManager', { notify: jest.fn() });
        setDependency('dialog', { close: jest.fn() });
        setDependency('router', { navigate: jest.fn() });
        setDependency('security', securityService);
    });

    afterEach(() => {
        (CONSTANTS as any).isRunMode = true;
    });

    it('falls back to the variable dataBinding when no options are passed', () => {
        securityService.appLogin.mockReturnValue('p');
        const variable: any = { dataBinding: { j_username: 'a', j_password: 'b' }, _context: {} };
        manager.login(variable, undefined, jest.fn(), jest.fn());
        expect(securityService.appLogin.mock.calls[0][0]).toEqual({ j_username: 'a', j_password: 'b', j_rememberme: false });
        expect(variable.promise).toBe('p');
    });

    it('does not fire the variable onError event on a failed login outside run mode but still calls the error callback', () => {
        (CONSTANTS as any).isRunMode = false;
        securityService.appLogin.mockImplementation((p: any, ok: any, fail: any) => fail({ error: 'bad', details: 'x' }));
        const error = jest.fn();
        const onError = jest.fn();
        const variable: any = { dataBinding: { j_username: 'a', j_password: 'b' }, _context: {}, onError };
        manager.login(variable, {}, jest.fn(), error);
        expect(error).toHaveBeenCalledWith('bad', 'x');
        expect(onError).not.toHaveBeenCalled();
    });
});
