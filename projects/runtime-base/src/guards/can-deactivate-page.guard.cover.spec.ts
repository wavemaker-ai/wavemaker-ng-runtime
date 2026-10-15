import { CanDeactivateNgPageGuard } from './can-deactivate-page.guard';

describe('CanDeactivateNgPageGuard', () => {
    const guard = new CanDeactivateNgPageGuard();
    it('delegates to the component with the next url', () => {
        const canDeactivate = jest.fn().mockReturnValue(false);
        expect(guard.canDeactivate({ canDeactivate } as any, {} as any, {} as any, { url: '/n' } as any)).toBe(false);
        expect(canDeactivate).toHaveBeenCalledWith('/n');
    });
    it('passes undefined when there is no next state', () => {
        const canDeactivate = jest.fn().mockReturnValue(true);
        guard.canDeactivate({ canDeactivate } as any);
        expect(canDeactivate).toHaveBeenCalledWith(undefined);
    });
    it('returns true when component has no canDeactivate', () => {
        expect(guard.canDeactivate({} as any)).toBe(true);
    });
});
