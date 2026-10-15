import { DialogServiceImpl } from './dialog.service';

jest.mock('@wm/core', () => ({
    isMobile: jest.fn().mockReturnValue(false),
}));

describe('DialogServiceImpl cover', () => {
    let service: DialogServiceImpl;

    beforeEach(() => {
        service = new DialogServiceImpl();
        service.getOpenedDialogs().length = 0;
    });

    it('deRegister is a no-op for a dialog name that was never registered', () => {
        expect(() => service.deRegister('unknown', {})).not.toThrow();
        expect(service.getDialogRefsCollection().has('unknown')).toBe(false);
    });

    it('deRegister removes only the given scope from a registered dialog', () => {
        const s1 = {}, s2 = {};
        service.register('d', { id: 1 }, s1);
        service.register('d', { id: 2 }, s2);
        service.deRegister('d', s1);
        expect(service.getDialogRefsCollection().get('d').has(s1)).toBe(false);
        expect(service.getDialogRefsCollection().get('d').has(s2)).toBe(true);
    });

    it('removeFromOpenedDialogs leaves the list untouched when the ref is not opened', () => {
        const a = { id: 'a' };
        service.addToOpenedDialogs(a);
        service.removeFromOpenedDialogs({ id: 'other' });
        expect(service.getOpenedDialogs()).toEqual([a]);
    });

    it('removeFromClosedDialogs leaves the list untouched when the ref is not in the closed list', () => {
        const a = { id: 'a' };
        service.addToClosedDialogs(a);
        service.removeFromClosedDialogs({ id: 'other' });
        expect(service.getDialogRefFromClosedDialogs()).toBe(a);
        service.removeFromClosedDialogs(a);
    });
});
