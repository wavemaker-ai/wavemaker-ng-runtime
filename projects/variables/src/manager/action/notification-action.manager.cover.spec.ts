import { setDependency } from '../../util/variable/variables.utils';
import { NotificationActionManager } from './notification-action.manager';

describe('NotificationActionManager (cover)', () => {
    let toasterService: any;
    let dialogService: any;
    const manager = new NotificationActionManager();

    beforeEach(() => {
        toasterService = { show: jest.fn(), showCustom: jest.fn() };
        dialogService = { open: jest.fn(), close: jest.fn() };
        setDependency('toaster', toasterService);
        setDependency('dialog', dialogService);
        delete (window as any)._WM_APP_PROPERTIES;
    });

    describe('toaster callbacks', () => {
        const makeToaster = (extra: any = {}) => {
            const taps: Function[] = [];
            const hides: Function[] = [];
            return {
                taps, hides,
                onTap: { subscribe: jest.fn((fn: Function) => { taps.push(fn); return 'tapSub'; }) },
                onHidden: { subscribe: jest.fn((fn: Function) => { hides.push(fn); return 'hideSub'; }) },
                ...extra
            };
        };

        it('invokes the variable onClick and onHide events when the toaster is tapped and hidden', () => {
            const onClick = jest.fn(), onHide = jest.fn();
            const toaster: any = makeToaster();
            toasterService.show.mockReturnValue(toaster);
            const variable: any = { operation: 'toast', dataBinding: {}, onClick: 'onClick()', onHide: 'onHide()', _context: { onClick, onHide } };
            manager.notify(variable, {}, undefined, undefined);
            toaster.taps[0]();
            toaster.hides[0]();
            expect(onClick).toHaveBeenCalled();
            expect(onHide).toHaveBeenCalled();
            expect(toaster._subscriptions).toEqual(['tapSub', 'hideSub']);
        });

        it('reuses an existing subscriptions array on the toaster', () => {
            const existing = ['old'];
            const toaster: any = makeToaster({ _subscriptions: existing });
            toasterService.show.mockReturnValue(toaster);
            manager.notify({ operation: 'toast', dataBinding: {}, onClick: jest.fn(), onHide: jest.fn() } as any, {}, undefined, undefined);
            expect(toaster._subscriptions).toBe(existing);
            expect(existing).toEqual(['old', 'tapSub', 'hideSub']);
        });

        it('does not push subscriptions when the toaster cannot hold a subscriptions array', () => {
            const toaster: any = makeToaster();
            Object.defineProperty(toaster, '_subscriptions', { get: () => undefined, set: () => undefined, configurable: true });
            toasterService.show.mockReturnValue(toaster);
            expect(() => manager.notify({ operation: 'toast', dataBinding: {}, onClick: jest.fn(), onHide: jest.fn() } as any, {}, undefined, undefined)).not.toThrow();
            expect(toaster.onTap.subscribe).toHaveBeenCalled();
            expect(toaster.onHidden.subscribe).toHaveBeenCalled();
        });
    });

    describe('dialog callbacks', () => {
        it('wires onOk, onCancel and onClose of the dialog config to the variable events and dialog service', () => {
            const onOk = jest.fn(), onCancel = jest.fn(), onClose = jest.fn();
            const variable: any = { operation: 'confirm', dataBinding: {}, onOk: 'onOk()', onCancel: 'onCancel()', onClose: 'onClose()', _context: { onOk, onCancel, onClose } };
            manager.notify(variable, { data: 'd' }, undefined, undefined);
            const cfg = dialogService.open.mock.calls[0][2].notification;
            cfg.onCancel();
            expect(onCancel).toHaveBeenCalled();
            expect(dialogService.close).toHaveBeenLastCalledWith('CommonConfirmDialog', undefined);
            cfg.onClose();
            expect(onClose).toHaveBeenCalled();
            cfg.onOk();
            const [id, , closeCb] = dialogService.close.mock.calls[1];
            expect(id).toBe('CommonConfirmDialog');
            closeCb();
            expect(onOk).toHaveBeenCalled();
        });
    });

    describe('setters ignore non-string values', () => {
        it.each([
            ['setToasterClass', 'class'],
            ['setToasterPosition', 'position'],
            ['setAlertType', 'alerttype'],
            ['setCancelButtonText', 'cancelButtonText'],
            ['setMessage', 'text'],
            ['setOkButtonText', 'okButtonText']
        ])('%s keeps the existing value for a non-string', (fn, prop) => {
            const variable: any = { dataBinding: { [prop]: 'keep' } };
            expect((manager as any)[fn](variable, 5)).toBe('keep');
            expect((manager as any)[fn](variable, 'new')).toBe('new');
        });
    });
});
