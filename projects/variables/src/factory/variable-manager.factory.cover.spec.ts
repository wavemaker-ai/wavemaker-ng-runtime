import { VariableManagerFactory } from './variable-manager.factory';
import { BaseVariableManager } from '../manager/variable/base-variable.manager';
import { NavigationActionManager } from '../manager/action/navigation-action.manager';
import { NotificationActionManager } from '../manager/action/notification-action.manager';
import { BaseActionManager } from '../manager/action/base-action.manager';
import { LoginActionManager } from '../manager/action/login-action.manager';
import { LogoutActionManager } from '../manager/action/logout-action.manager';
import { WebSocketVariableManager } from '../manager/variable/web-socket-variable.manager';

describe('VariableManagerFactory', () => {
    const cases: Array<[string, any]> = [
        ['Variable', BaseVariableManager],
        ['Action', BaseActionManager],
        ['wm.NavigationAction', NavigationActionManager],
        ['wm.NotificationAction', NotificationActionManager],
        ['wm.LoginAction', LoginActionManager],
        ['wm.LogoutAction', LogoutActionManager],
        ['wm.WebSocketVariable', WebSocketVariableManager]
    ];

    it.each(cases)('creates a %s manager once and caches it', (type, ctor) => {
        const first = VariableManagerFactory.get(type);
        expect(first).toBeInstanceOf(ctor);
        expect(VariableManagerFactory.get(type)).toBe(first);
    });

    it('throws for an unknown type', () => {
        expect(() => VariableManagerFactory.get('wm.Unknown')).toThrow();
    });
});
