jest.mock('../../factory/variable-manager.factory', () => ({
    VariableManagerFactory: { get: jest.fn() },
}));

import { VariableManagerFactory } from '../../factory/variable-manager.factory';
import { LoginAction } from './login-action';

describe('LoginAction', () => {
    afterEach(() => jest.clearAllMocks());

    const mockManager = () => {
        const manager: any = { login: jest.fn(), initBinding: jest.fn() };
        (VariableManagerFactory.get as jest.Mock).mockReturnValue(manager);
        return manager;
    };

    it('should copy variable config properties onto the instance', () => {
        const action: any = new LoginAction({ name: 'loginVar', useDefaultSuccessHandler: true });
        expect(action.name).toBe('loginVar');
        expect(action.useDefaultSuccessHandler).toBe(true);
    });

    it('login() should delegate to the login manager', () => {
        const manager = mockManager();
        manager.login.mockReturnValue('login-result');
        const action = new LoginAction({});
        const result = action.login({ a: 1 }, jest.fn(), jest.fn());
        expect(manager.login).toHaveBeenCalledWith(action, { a: 1 }, expect.any(Function), expect.any(Function));
        expect(result).toBe('login-result');
    });

    it('invoke() should delegate to login()', () => {
        mockManager();
        const action = new LoginAction({});
        const loginSpy = jest.spyOn(action, 'login');
        action.invoke({}, jest.fn(), jest.fn());
        expect(loginSpy).toHaveBeenCalled();
    });

    it('cancel() should not throw', () => {
        const action = new LoginAction({});
        expect(() => action.cancel()).not.toThrow();
    });

    it('init() should initialize the dataBinding binding', () => {
        const manager = mockManager();
        const action = new LoginAction({});
        action.init();
        expect(manager.initBinding).toHaveBeenCalledWith(action, 'dataBinding', 'dataBinding');
    });
});
