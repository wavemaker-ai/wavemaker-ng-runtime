jest.mock('../services/app.manager.service', () => ({ AppManagerService: class {} }));

import { PageNotFoundGuard } from './page-not-found.guard';

describe('PageNotFoundGuard', () => {
    it('should notify the app with the localized not-found message and resolve false', async () => {
        const app: any = { appLocale: { MESSAGE_PAGE_NOT_FOUND: 'Custom not found' } };
        const appManager: any = { notifyApp: jest.fn() };
        const guard = new PageNotFoundGuard(app, appManager);
        const result = await guard.canActivate({} as any);
        expect(appManager.notifyApp).toHaveBeenCalledWith('Custom not found', 'error');
        expect(result).toBe(false);
    });

    it('should fall back to the default message when no locale message is configured', async () => {
        const app: any = { appLocale: {} };
        const appManager: any = { notifyApp: jest.fn() };
        const guard = new PageNotFoundGuard(app, appManager);
        await guard.canActivate({} as any);
        expect(appManager.notifyApp).toHaveBeenCalledWith('The page you are trying to reach is not available', 'error');
    });
});
