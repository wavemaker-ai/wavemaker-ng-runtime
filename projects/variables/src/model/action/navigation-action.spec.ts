jest.mock('../../factory/variable-manager.factory', () => ({
    VariableManagerFactory: { get: jest.fn() },
}));

import { VariableManagerFactory } from '../../factory/variable-manager.factory';
import { NavigationAction } from './navigation-action';

describe('NavigationAction', () => {
    afterEach(() => jest.clearAllMocks());

    it('should copy variable config properties onto the instance', () => {
        const action = new NavigationAction({ operation: 'gotoPage', pageName: 'Home' });
        expect(action.operation).toBe('gotoPage');
        expect(action.pageName).toBe('Home');
    });

    it('invoke() should delegate to the navigation-action manager', () => {
        const manager: any = { invoke: jest.fn() };
        (VariableManagerFactory.get as jest.Mock).mockReturnValue(manager);
        const action = new NavigationAction({});
        action.invoke({ x: 1 });
        expect(manager.invoke).toHaveBeenCalledWith(action, { x: 1 });
    });

    it('navigate() (legacy) should delegate to invoke()', () => {
        const manager: any = { invoke: jest.fn() };
        (VariableManagerFactory.get as jest.Mock).mockReturnValue(manager);
        const action = new NavigationAction({});
        action.navigate({ y: 2 });
        expect(manager.invoke).toHaveBeenCalledWith(action, { y: 2 });
    });

    it('init() should initialize both dataBinding and dataSet property bindings', () => {
        const manager: any = { initBinding: jest.fn() };
        (VariableManagerFactory.get as jest.Mock).mockReturnValue(manager);
        const action = new NavigationAction({});
        action.init();
        expect(manager.initBinding).toHaveBeenCalledWith(action, 'dataBinding', 'dataBinding');
        expect(manager.initBinding).toHaveBeenCalledWith(action, 'dataSet', 'dataSet');
    });
});
