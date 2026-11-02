import { setDependency } from '../../util/variable/variables.utils';
import { NotificationActionManager } from './notification-action.manager';

describe('NotificationActionManager', () => {
    let toasterService: any;
    let dialogService: any;
    const manager = new NotificationActionManager();

    beforeEach(() => {
        toasterService = { show: jest.fn().mockReturnValue({}), showCustom: jest.fn().mockReturnValue({}) };
        dialogService = { open: jest.fn(), close: jest.fn() };
        setDependency('toaster', toasterService);
        setDependency('dialog', dialogService);
        delete (window as any)._WM_APP_PROPERTIES;
    });

    describe('notify', () => {
        it('should route to the toaster for a toast operation', () => {
            const variable: any = { operation: 'toast', dataBinding: {} };
            manager.notify(variable, {}, undefined, undefined);
            expect(toasterService.show).toHaveBeenCalledTimes(1);
            expect(toasterService.show).toHaveBeenCalledWith('info', undefined, null, { positionClass: 'toast-bottom-right', timeOut: 0, enableHtml: true });
            expect(dialogService.open).not.toHaveBeenCalled();
        });

        it('should route to the dialog for a non-toast operation', () => {
            const variable: any = { operation: 'confirm', dataBinding: {} };
            manager.notify(variable, {}, undefined, undefined);
            expect(dialogService.open).toHaveBeenCalledTimes(1);
            expect(dialogService.open).toHaveBeenCalledWith(expect.stringMatching(/ConfirmDialog$/), undefined, expect.anything());
            expect(toasterService.show).not.toHaveBeenCalled();
        });

        it('should default options to an empty object when not provided', () => {
            const variable: any = { operation: 'toast', dataBinding: {} };
            expect(() => manager.notify(variable, undefined, undefined, undefined)).not.toThrow();
            expect(toasterService.show).toHaveBeenCalledTimes(1);
        });
    });

    describe('notifyViaToaster (via notify)', () => {
        it('should default to info type, bottom-right position and no duration', () => {
            const variable: any = { operation: 'toast', dataBinding: {} };
            manager.notify(variable, {}, undefined, undefined);
            expect(toasterService.show).toHaveBeenCalledWith('info', undefined, null, {
                positionClass: 'toast-bottom-right', timeOut: 0, enableHtml: true,
            });
        });

        it('should use a default 3000ms duration for a success toast', () => {
            const variable: any = { operation: 'toast', dataBinding: { class: 'success' } };
            manager.notify(variable, {}, undefined, undefined);
            expect(toasterService.show).toHaveBeenCalledWith('success', undefined, null, expect.objectContaining({ timeOut: 3000 }));
        });

        it('should use the given class/title/message/position/duration options over dataBinding', () => {
            const variable: any = {
                operation: 'toast',
                dataBinding: { class: 'info', text: 'bound', toasterPosition: 'top left', duration: 1000 },
            };
            manager.notify(
                variable,
                { class: 'error', title: 'Oops', message: 'failed', position: 'top right', duration: 500 },
                undefined,
                undefined
            );
            expect(toasterService.show).toHaveBeenCalledWith('error', 'Oops', 'failed', {
                positionClass: 'toast-top-right', timeOut: 500, enableHtml: true,
            });
        });

        it('should show a custom partial toaster when content is a page', () => {
            const variable: any = {
                operation: 'toast',
                dataBinding: { content: 'page', page: 'MyPartial' },
                _binddataSet: { a: 1 },
                _context: { ctx: 1 },
            };
            manager.notify(variable, {}, undefined, undefined);
            expect(toasterService.showCustom).toHaveBeenCalledWith('MyPartial', expect.objectContaining({
                positionClass: 'toast-bottom-right',
                partialParams: { a: 1 },
                context: { ctx: 1 },
            }));
        });

        it('should subscribe to onTap when the variable has an onClick handler', () => {
            const onTap = { subscribe: jest.fn() };
            toasterService.show.mockReturnValue({ onTap });
            const variable: any = { operation: 'toast', dataBinding: {}, onClick: true };
            manager.notify(variable, {}, undefined, undefined);
            expect(onTap.subscribe).toHaveBeenCalledWith(expect.any(Function));
        });

        it('should subscribe to onHidden when the variable has an onHide handler', () => {
            const onHidden = { subscribe: jest.fn() };
            toasterService.show.mockReturnValue({ onHidden });
            const variable: any = { operation: 'toast', dataBinding: {}, onHide: true };
            manager.notify(variable, {}, undefined, undefined);
            expect(onHidden.subscribe).toHaveBeenCalledWith(expect.any(Function));
        });
    });

    describe('notifyViaDialog (via notify)', () => {
        it('should open a Common*Dialog with the notification wrapper for a non-prefab project', () => {
            const variable: any = { operation: 'confirm', dataBinding: { title: 'T', text: 'M' } };
            manager.notify(variable, {}, undefined, undefined);
            const [dialogId, , config] = dialogService.open.mock.calls[0];
            expect(dialogId).toBe('CommonConfirmDialog');
            expect(config.notification).toEqual(expect.objectContaining({
                title: 'T', text: 'M', okButtonText: 'OK', cancelButtonText: 'CANCEL', alerttype: 'information',
            }));
        });

        it('should open a Prefab*Dialog without the notification wrapper for a prefab project', () => {
            (window as any)._WM_APP_PROPERTIES = { type: 'PREFAB' };
            const variable: any = { operation: 'alert', dataBinding: {} };
            manager.notify(variable, {}, undefined, undefined);
            const [dialogId, , config] = dialogService.open.mock.calls[0];
            expect(dialogId).toBe('PrefabAlertDialog');
            expect(config.notification).toBeUndefined();
            expect(config.okButtonText).toBe('OK');
        });

        it('should close the dialog via onOk', () => {
            const variable: any = { operation: 'confirm', dataBinding: {} };
            manager.notify(variable, {}, undefined, undefined);
            const [dialogId, , config] = dialogService.open.mock.calls[0];
            const dialogConfig = config.notification || config;
            dialogConfig.onOk();
            expect(dialogService.close).toHaveBeenCalledWith(dialogId, undefined, expect.any(Function));
        });

        it('should close the dialog via onCancel without throwing', () => {
            const variable: any = { operation: 'confirm', dataBinding: {} };
            manager.notify(variable, { data: 'x' }, undefined, undefined);
            const [dialogId, , config] = dialogService.open.mock.calls[0];
            const dialogConfig = config.notification || config;
            expect(() => dialogConfig.onCancel()).not.toThrow();
            expect(dialogService.close).toHaveBeenCalledWith(dialogId, undefined);
        });

        it('should not throw via onClose', () => {
            const variable: any = { operation: 'confirm', dataBinding: {} };
            manager.notify(variable, {}, undefined, undefined);
            const [, , config] = dialogService.open.mock.calls[0];
            const dialogConfig = config.notification || config;
            expect(() => dialogConfig.onClose()).not.toThrow();
        });
    });

    describe('getter/setter helpers', () => {
        it('getMessage/setMessage should read/write dataBinding.text and ignore non-string values', () => {
            const variable: any = { dataBinding: { text: 'hello' } };
            expect(manager.getMessage(variable)).toBe('hello');
            manager.setMessage(variable, 'world');
            expect(variable.dataBinding.text).toBe('world');
            manager.setMessage(variable, 123 as any);
            expect(variable.dataBinding.text).toBe('world');
        });

        it('getOkButtonText/setOkButtonText', () => {
            const variable: any = { dataBinding: {} };
            manager.setOkButtonText(variable, 'Yes');
            expect(manager.getOkButtonText(variable)).toBe('Yes');
        });

        it('getToasterDuration/setToasterDuration', () => {
            const variable: any = { dataBinding: {} };
            manager.setToasterDuration(variable, 4000);
            expect(manager.getToasterDuration(variable)).toBe(4000);
        });

        it('getToasterClass/setToasterClass', () => {
            const variable: any = { dataBinding: {} };
            manager.setToasterClass(variable, 'warning');
            expect(manager.getToasterClass(variable)).toBe('warning');
        });

        it('setToasterPosition sets dataBinding.position (getToasterPosition reads .class, a pre-existing quirk)', () => {
            const variable: any = { dataBinding: { class: 'info' } };
            manager.setToasterPosition(variable, 'top left');
            expect(variable.dataBinding.position).toBe('top left');
            expect(manager.getToasterPosition(variable)).toBe('info');
        });

        it('getAlertType/setAlertType', () => {
            const variable: any = { dataBinding: {} };
            manager.setAlertType(variable, 'warning');
            expect(manager.getAlertType(variable)).toBe('warning');
        });

        it('getCancelButtonText/setCancelButtonText', () => {
            const variable: any = { dataBinding: {} };
            manager.setCancelButtonText(variable, 'No');
            expect(manager.getCancelButtonText(variable)).toBe('No');
        });
    });
});
