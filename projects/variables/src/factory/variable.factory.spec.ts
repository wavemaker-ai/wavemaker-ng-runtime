import { VariableFactory } from './variable.factory';
import { VARIABLE_CONSTANTS } from '../constants/variables.constants';
import { ModelVariable, ServiceVariable, LiveVariable, CrudVariable, TimerAction } from '@wavemaker-ai/variables';
import { NavigationAction } from '../model/action/navigation-action';
import { NotificationAction } from '../model/action/notification-action';
import { LoginAction } from '../model/action/login-action';
import { LogoutAction } from '../model/action/logout-action';
import { WebSocketVariable } from '../model/variable/web-socket-variable';

describe('VariableFactory', () => {
    const cases: Array<[string, string, any]> = [
        ['MODEL', VARIABLE_CONSTANTS.CATEGORY.MODEL, ModelVariable],
        ['SERVICE', VARIABLE_CONSTANTS.CATEGORY.SERVICE, ServiceVariable],
        ['LIVE', VARIABLE_CONSTANTS.CATEGORY.LIVE, LiveVariable],
        ['CRUD', VARIABLE_CONSTANTS.CATEGORY.CRUD, CrudVariable],
        ['NAVIGATION', VARIABLE_CONSTANTS.CATEGORY.NAVIGATION, NavigationAction],
        ['NOTIFICATION', VARIABLE_CONSTANTS.CATEGORY.NOTIFICATION, NotificationAction],
        ['LOGIN', VARIABLE_CONSTANTS.CATEGORY.LOGIN, LoginAction],
        ['LOGOUT', VARIABLE_CONSTANTS.CATEGORY.LOGOUT, LogoutAction],
        ['TIMER', VARIABLE_CONSTANTS.CATEGORY.TIMER, TimerAction],
        ['WEBSOCKET', VARIABLE_CONSTANTS.CATEGORY.WEBSOCKET, WebSocketVariable],
    ];

    it.each(cases)('should create a %s variable instance for category %s', (_label, category, ExpectedClass) => {
        const variable = VariableFactory.create({ category, name: 'v1' }, { ctx: 1 });
        expect(variable).toBeInstanceOf(ExpectedClass);
    });

    it('should attach the given context and mark the instance as non-cloneable', () => {
        const context = { page: 'Main' };
        const variable: any = VariableFactory.create({ category: VARIABLE_CONSTANTS.CATEGORY.MODEL }, context);
        expect(variable._context).toBe(context);
        expect(variable.__cloneable__).toBe(false);
    });

    it('should throw for an unrecognized category (no matching switch case)', () => {
        expect(() => VariableFactory.create({ category: 'wm.Unknown' }, {})).toThrow();
    });
});
