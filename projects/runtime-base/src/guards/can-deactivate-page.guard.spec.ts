import { CanDeactivatePageGuard, CanDeactivateNgPageGuard } from './can-deactivate-page.guard';

describe('CanDeactivatePageGuard', () => {
    const guard = new CanDeactivatePageGuard();

    it('should return true when neither a page-level nor app-level hook is defined', () => {
        const component: any = { app: {} };
        const result = guard.canDeactivate(component, {} as any, {} as any, { url: '/next' } as any);
        expect(result).toBe(true);
    });

    it('should call the page-level onBeforePageLeave with the next route', () => {
        const onBeforePageLeave = jest.fn().mockReturnValue(true);
        const component: any = { app: { activePage: { onBeforePageLeave } } };
        guard.canDeactivate(component, {} as any, {} as any, { url: '/next' } as any);
        expect(onBeforePageLeave).toHaveBeenCalledWith('/next');
    });

    it('should skip the app-level hook when the page-level hook returns false', () => {
        const appLevelHook = jest.fn();
        const component: any = {
            app: {
                activePage: { onBeforePageLeave: () => false },
                onBeforePageLeave: appLevelHook,
            },
        };
        const result = guard.canDeactivate(component, {} as any, {} as any, { url: '/next' } as any);
        expect(appLevelHook).not.toHaveBeenCalled();
        expect(result).toBe(false);
    });

    it('should call the app-level hook when the page-level hook does not return false', () => {
        const appLevelHook = jest.fn().mockReturnValue(true);
        const activePage = { onBeforePageLeave: () => true };
        const component: any = {
            app: { activePageName: 'HomePage', activePage, onBeforePageLeave: appLevelHook },
        };
        const result = guard.canDeactivate(component, {} as any, {} as any, { url: '/next' } as any);
        expect(appLevelHook).toHaveBeenCalledWith('HomePage', activePage, '/next');
        expect(result).toBe(true);
    });

    it('should default to true when the app-level hook returns undefined', () => {
        const component: any = {
            app: {
                activePage: { onBeforePageLeave: () => true },
                onBeforePageLeave: () => undefined,
            },
        };
        const result = guard.canDeactivate(component, {} as any, {} as any, { url: '/next' } as any);
        expect(result).toBe(true);
    });

    it('should pass undefined as nextRoute when there is no nextState', () => {
        const onBeforePageLeave = jest.fn().mockReturnValue(true);
        const component: any = { app: { activePage: { onBeforePageLeave } } };
        guard.canDeactivate(component, {} as any, {} as any, undefined);
        expect(onBeforePageLeave).toHaveBeenCalledWith(undefined);
    });
});

describe('CanDeactivateNgPageGuard', () => {
    const guard = new CanDeactivateNgPageGuard();

    it('should delegate to the component canDeactivate method with the next route', () => {
        const canDeactivate = jest.fn().mockReturnValue(true);
        const component: any = { canDeactivate };
        const result = guard.canDeactivate(component, undefined, undefined, { url: '/next' } as any);
        expect(canDeactivate).toHaveBeenCalledWith('/next');
        expect(result).toBe(true);
    });

    it('should return true when the component has no canDeactivate method', () => {
        const component: any = {};
        const result = guard.canDeactivate(component, undefined, undefined, { url: '/next' } as any);
        expect(result).toBe(true);
    });
});
