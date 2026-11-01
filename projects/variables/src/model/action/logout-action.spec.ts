jest.mock('../../factory/variable-manager.factory', () => ({
    VariableManagerFactory: { get: jest.fn() },
}));

import { VariableManagerFactory } from '../../factory/variable-manager.factory';
import { LogoutAction } from './logout-action';

describe('LogoutAction', () => {
    afterEach(() => jest.clearAllMocks());

    const mockManager = () => {
        const manager: any = { logout: jest.fn() };
        (VariableManagerFactory.get as jest.Mock).mockReturnValue(manager);
        return manager;
    };

    it('should copy variable config properties onto the instance', () => {
        const action: any = new LogoutAction({ name: 'logoutVar', autoUpdate: true });
        expect(action.name).toBe('logoutVar');
        expect(action.autoUpdate).toBe(true);
    });

    it('logout() should delegate to the logout manager', () => {
        const manager = mockManager();
        const action = new LogoutAction({});
        action.logout({ a: 1 }, jest.fn(), jest.fn());
        expect(manager.logout).toHaveBeenCalledWith(action, { a: 1 }, expect.any(Function), expect.any(Function));
    });

    it('invoke() should delegate to logout()', () => {
        mockManager();
        const action = new LogoutAction({});
        const logoutSpy = jest.spyOn(action, 'logout');
        const success = jest.fn();
        const error = jest.fn();
        action.invoke({}, success, error);
        expect(logoutSpy).toHaveBeenCalledWith({}, success, error);
    });

    it('cancel() should not throw', () => {
        const action = new LogoutAction({});
        expect(() => action.cancel()).not.toThrow();
    });
});
